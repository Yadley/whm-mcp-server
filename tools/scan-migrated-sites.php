<?php
/**
 * Creative Yadley - Server 2 Migration & Nameserver Audit Scanner
 * 
 * Purpose:
 * Detects client websites/accounts that have migrated away to other hosts.
 * 
 * Valid Nameservers:
 * - ns1.creativeyadley.com
 * - ns2.creativeyadley.com
 * - bruce.ns.cloudflare.com
 * - elinore.ns.cloudflare.com
 * - jewel.ns.cloudflare.com
 * - scott.ns.cloudflare.com
 * 
 * Smart Detection Rules:
 * 1. If domain is on Creative Yadley Cloudflare (bruce/elinore/jewel/scott): ACTIVE
 * 2. If domain is on Creative Yadley NS (ns1/ns2.creativeyadley.com):
 *    - A record matches Server 2 (66.29.147.164): ACTIVE
 *    - A record points elsewhere: A_RECORD_MIGRATED
 * 3. If domain is on EXTERNAL NS (GoDaddy, Wix, Bluehost, etc.):
 *    - A record still points to Server 2 (66.29.147.164): ACTIVE (External DNS pointing to us)
 *    - A record does NOT point to Server 2: MIGRATED_AWAY
 * 
 * Features:
 * - Queries public DNS (1.1.1.1 & 8.8.8.8) to bypass local caching
 * - Sends HTML summary alert to info@creativeyadley.com
 * - Dispatches automated courtesy ticket in WHMCS (once per newly migrated site)
 * - Tracks state in migration_state.json to prevent duplicate notifications
 */

cli_set_process_title("CreativeYadley-Migration-Scanner");

$options = getopt("", ["dry-run", "notify-only", "force-ticket", "domain::"]);
$isDryRun = isset($options['dry-run']);
$isNotifyOnly = isset($options['notify-only']);
$forceTicket = isset($options['force-ticket']);
$filterDomain = isset($options['domain']) ? strtolower(trim($options['domain'])) : null;

$adminEmail = 'info@creativeyadley.com';
$serverIp = '66.29.147.164';

$validNameservers = [
    'ns1.creativeyadley.com',
    'ns2.creativeyadley.com',
    'bruce.ns.cloudflare.com',
    'elinore.ns.cloudflare.com',
    'jewel.ns.cloudflare.com',
    'scott.ns.cloudflare.com'
];

$baseDir = __DIR__;
$stateFile = $baseDir . '/migration_state.json';
$logFile = $baseDir . '/migration_audit.log';

function logMessage($msg, $file) {
    $line = "[" . date('Y-m-d H:i:s') . "] " . $msg . "\n";
    echo $line;
    @file_put_contents($file, $line, FILE_APPEND);
}

logMessage("=== Starting Creative Yadley Migration Scanner ===", $logFile);
if ($isDryRun) {
    logMessage("MODE: DRY RUN (no tickets or emails will be dispatched)", $logFile);
}

// 1. Load WHMCS Environment (if available)
$whmcsPath = '/home/creativeyadley/public_html/clientarea';
$whmcsAvailable = false;
$pdo = null;

if (file_exists($whmcsPath . '/configuration.php')) {
    require_once $whmcsPath . '/configuration.php';
    try {
        $pdo = new PDO(
            "mysql:host=" . ($db_host ?: '127.0.0.1') . ";port=" . ($db_port ?: '3306') . ";dbname={$db_name};charset=utf8mb4",
            $db_username,
            $db_password,
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
        );
        $whmcsAvailable = true;
        logMessage("Connected to WHMCS database ({$db_name}).", $logFile);
    } catch (Throwable $e) {
        logMessage("Notice: Could not connect to WHMCS DB: " . $e->getMessage(), $logFile);
    }
}

// Bootstrap WHMCS API if present
if (file_exists($whmcsPath . '/init.php')) {
    try {
        require_once $whmcsPath . '/init.php';
    } catch (Throwable $e) {}
}

// 2. Discover Accounts & Domains
$targets = [];

if ($pdo) {
    try {
        $stmt = $pdo->query("
            SELECT h.id as serviceid, h.userid, h.domain, h.username, h.domainstatus,
                   c.firstname, c.lastname, c.email as client_email, c.companyname
            FROM tblhosting h
            JOIN tblclients c ON c.id = h.userid
            WHERE h.domainstatus = 'Active' AND h.domain IS NOT NULL AND h.domain != ''
        ");
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $dom = strtolower(trim($row['domain']));
            if (!empty($dom) && !isset($targets[$dom])) {
                $targets[$dom] = [
                    'domain' => $dom,
                    'user' => $row['username'],
                    'serviceid' => $row['serviceid'],
                    'userid' => $row['userid'],
                    'client_name' => trim($row['firstname'] . ' ' . $row['lastname']),
                    'client_email' => $row['client_email'],
                    'source' => 'WHMCS'
                ];
            }
        }
        logMessage("Loaded " . count($targets) . " active domains from WHMCS.", $logFile);
    } catch (Throwable $e) {
        logMessage("Warning: WHMCS query failed: " . $e->getMessage(), $logFile);
    }
}

// Also discover domains from server vhosts (/etc/trueuserdomains)
if (file_exists('/etc/trueuserdomains')) {
    $lines = file('/etc/trueuserdomains', FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (strpos($line, ':') !== false) {
            list($d, $u) = explode(':', $line, 2);
            $d = strtolower(trim($d));
            $u = trim($u);
            if (!empty($d) && !isset($targets[$d])) {
                $targets[$d] = [
                    'domain' => $d,
                    'user' => $u,
                    'serviceid' => null,
                    'userid' => null,
                    'client_name' => 'Server Account (' . $u . ')',
                    'client_email' => null,
                    'source' => 'Server cPanel'
                ];
            }
        }
    }
}

if ($filterDomain) {
    if (isset($targets[$filterDomain])) {
        $targets = [$filterDomain => $targets[$filterDomain]];
    } else {
        $targets = [
            $filterDomain => [
                'domain' => $filterDomain,
                'user' => 'unknown',
                'serviceid' => null,
                'userid' => null,
                'client_name' => 'Single Check',
                'client_email' => null,
                'source' => 'Manual'
            ]
        ];
    }
    logMessage("Filtering check to single domain: {$filterDomain}", $logFile);
}

logMessage("Total domains to audit: " . count($targets), $logFile);

// 3. Load State History
$state = [];
if (file_exists($stateFile)) {
    $data = @file_get_contents($stateFile);
    if (!empty($data)) {
        $state = json_decode($data, true) ?: [];
    }
}

// 4. DNS Helper Functions
function queryNameserversPublic($domain) {
    $nsList = [];
    $cmd = "dig +short +time=2 +tries=1 NS " . escapeshellarg($domain) . " @1.1.1.1 2>/dev/null";
    $output = @shell_exec($cmd);
    if (!empty($output)) {
        $lines = explode("\n", trim($output));
        foreach ($lines as $line) {
            $cleaned = strtolower(rtrim(trim($line), '.'));
            if (!empty($cleaned) && !strpos($cleaned, ' ')) {
                $nsList[] = $cleaned;
            }
        }
    }
    if (empty($nsList)) {
        $cmd = "dig +short +time=2 +tries=1 NS " . escapeshellarg($domain) . " @8.8.8.8 2>/dev/null";
        $output = @shell_exec($cmd);
        if (!empty($output)) {
            $lines = explode("\n", trim($output));
            foreach ($lines as $line) {
                $cleaned = strtolower(rtrim(trim($line), '.'));
                if (!empty($cleaned) && !strpos($cleaned, ' ')) {
                    $nsList[] = $cleaned;
                }
            }
        }
    }
    if (empty($nsList)) {
        $records = @dns_get_record($domain, DNS_NS);
        if (is_array($records)) {
            foreach ($records as $r) {
                if (!empty($r['target'])) {
                    $nsList[] = strtolower(rtrim($r['target'], '.'));
                }
            }
        }
    }
    return array_values(array_unique($nsList));
}

function queryARecordsPublic($domain) {
    $ips = [];
    $cmd = "dig +short +time=2 +tries=1 A " . escapeshellarg($domain) . " @1.1.1.1 2>/dev/null";
    $output = @shell_exec($cmd);
    if (!empty($output)) {
        $lines = explode("\n", trim($output));
        foreach ($lines as $line) {
            $l = trim($line);
            if (filter_var($l, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4)) {
                $ips[] = $l;
            }
        }
    }
    if (empty($ips)) {
        $cmd = "dig +short +time=2 +tries=1 A " . escapeshellarg($domain) . " @8.8.8.8 2>/dev/null";
        $output = @shell_exec($cmd);
        if (!empty($output)) {
            $lines = explode("\n", trim($output));
            foreach ($lines as $line) {
                $l = trim($line);
                if (filter_var($l, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4)) {
                    $ips[] = $l;
                }
            }
        }
    }
    if (empty($ips)) {
        $records = @dns_get_record($domain, DNS_A);
        if (is_array($records)) {
            foreach ($records as $r) {
                if (!empty($r['ip'])) {
                    $ips[] = $r['ip'];
                }
            }
        }
    }
    return array_values(array_unique($ips));
}

// 5. Audit Each Domain
$auditResults = [];
$newMigrations = [];
$now = time();

foreach ($targets as $domain => $meta) {
    $nsRecords = queryNameserversPublic($domain);
    $aRecords = queryARecordsPublic($domain);
    
    // Also resolve www. if root has no A records
    if (empty($aRecords)) {
        $wwwRecords = queryARecordsPublic('www.' . $domain);
        if (!empty($wwwRecords)) {
            $aRecords = $wwwRecords;
        }
    }
    
    $status = 'UNKNOWN';
    $details = '';
    
    if (empty($nsRecords)) {
        $status = 'DEAD_OR_EXPIRED';
        $details = 'No NS records found at public DNS';
    } else {
        // Check if any returned nameserver matches our authorized nameserver list
        $hasOurNS = false;
        $isOurCloudflare = false;
        
        foreach ($nsRecords as $ns) {
            foreach ($validNameservers as $valid) {
                if ($ns === $valid || str_ends_with($ns, '.' . $valid)) {
                    $hasOurNS = true;
                    if (str_contains($valid, 'cloudflare.com')) {
                        $isOurCloudflare = true;
                    }
                    break 2;
                }
            }
        }
        
        $pointsToOurServer = in_array($serverIp, $aRecords);
        
        if ($hasOurNS) {
            if ($isOurCloudflare) {
                // Verified on Creative Yadley Cloudflare account
                $status = 'ACTIVE';
                $details = 'Active on Creative Yadley Cloudflare (' . implode(', ', array_slice($nsRecords, 0, 2)) . ')';
            } else {
                // ns1/ns2.creativeyadley.com
                if ($pointsToOurServer) {
                    $status = 'ACTIVE';
                    $details = "Points directly to Server 2 ({$serverIp})";
                } elseif (!empty($aRecords)) {
                    $status = 'A_RECORD_MIGRATED';
                    $details = 'NS is Creative Yadley, but A record points to: ' . implode(', ', $aRecords);
                } else {
                    $status = 'ACTIVE_NO_A_RECORD';
                    $details = 'NS is Creative Yadley (no A record returned)';
                }
            }
        } else {
            // EXTERNAL NAMESERVERS (e.g. GoDaddy, Wix, Bluehost, Google Domains)
            // Check if client is still using our hosting via an A-record pointing to 66.29.147.164
            if ($pointsToOurServer) {
                $status = 'ACTIVE';
                $details = "Active via External DNS (" . implode(', ', array_slice($nsRecords, 0, 2)) . ") pointing to Server 2 ({$serverIp})";
            } elseif (!empty($aRecords)) {
                $status = 'MIGRATED_AWAY';
                $details = 'External NS (' . implode(', ', array_slice($nsRecords, 0, 2)) . ') and A record points to: ' . implode(', ', $aRecords);
            } else {
                $status = 'MIGRATED_AWAY';
                $details = 'External NS (' . implode(', ', array_slice($nsRecords, 0, 2)) . ') with no A record pointing to Server 2';
            }
        }
    }
    
    $entry = [
        'domain' => $domain,
        'user' => $meta['user'],
        'serviceid' => $meta['serviceid'],
        'userid' => $meta['userid'],
        'client_name' => $meta['client_name'],
        'client_email' => $meta['client_email'],
        'status' => $status,
        'details' => $details,
        'ns' => $nsRecords,
        'ips' => $aRecords,
        'timestamp' => $now
    ];
    
    $auditResults[$domain] = $entry;
    
    // Check if this is a newly discovered migration
    $previousStatus = isset($state[$domain]) ? $state[$domain]['status'] : 'ACTIVE';
    $isNowMigrated = ($status === 'MIGRATED_AWAY' || $status === 'A_RECORD_MIGRATED');
    $wasMigrated = ($previousStatus === 'MIGRATED_AWAY' || $previousStatus === 'A_RECORD_MIGRATED');
    
    if ($isNowMigrated && (!$wasMigrated || $forceTicket)) {
        $newMigrations[$domain] = $entry;
    }
    
    // Update state cache
    $state[$domain] = [
        'status' => $status,
        'details' => $details,
        'ns' => $nsRecords,
        'ips' => $aRecords,
        'last_checked' => $now,
        'first_detected_migrated' => $isNowMigrated ? ($state[$domain]['first_detected_migrated'] ?? $now) : null,
        'courtesy_ticket_id' => $state[$domain]['courtesy_ticket_id'] ?? null
    ];
}

// Save updated state file
if (!$isDryRun) {
    @file_put_contents($stateFile, json_encode($state, JSON_PRETTY_PRINT));
}

// 6. Automated Courtesy Ticket Dispatch (WHMCS)
function openWhmcsCourtesyTicket($pdo, $meta, $entry, $isDryRun, $logFile) {
    $domain = $entry['domain'];
    $userId = $meta['userid'];
    $clientName = $meta['client_name'];
    $nsString = !empty($entry['ns']) ? implode(', ', $entry['ns']) : 'external nameservers';
    
    if (empty($userId)) {
        logMessage("Skipping courtesy ticket for {$domain}: No WHMCS user ID linked.", $logFile);
        return null;
    }
    
    $subject = "Important: Nameserver update detected for {$domain}";
    $message = "Dear {$clientName},\n\n"
             . "Our automated monitoring system recently detected that the nameservers or DNS destination for your domain {$domain} were updated to point away from our servers:\n"
             . "Nameservers: {$nsString}\n\n"
             . "As a result of this change, website traffic for {$domain} is no longer being served by our server (Server 2).\n\n"
             . "How can we help?\n"
             . "1. If you have migrated your website to a new host:\n"
             . "   Please let us know if you would like us to cancel your hosting service so that you do not receive future renewal invoices. We can also provide a final backup archive of your files and database for your records before the hosting space is closed.\n\n"
             . "2. If this change was unintentional or done by error:\n"
             . "   Please reply to this ticket immediately so our technical support team can assist you in pointing your domain back to your hosting account.\n\n"
             . "Thank you for choosing Creative Yadley.\n\n"
             . "Warm regards,\n"
             . "Creative Yadley Support Team\n"
             . "info@creativeyadley.com";
             
    if ($isDryRun) {
        logMessage("[DRY RUN] Would open courtesy ticket for Client #{$userId} ({$domain})", $logFile);
        return 'DRY_RUN_TICKET';
    }
    
    if (function_exists('localAPI')) {
        $deptId = 1;
        if ($pdo) {
            try {
                $deptStmt = $pdo->query("SELECT id FROM tblticketdepartments WHERE hidden=0 ORDER BY id ASC LIMIT 1");
                $foundDept = $deptStmt->fetchColumn();
                if ($foundDept) $deptId = $foundDept;
            } catch (Throwable $e) {}
        }
        
        $postData = [
            'clientid' => $userId,
            'deptid' => $deptId,
            'subject' => $subject,
            'message' => $message,
            'priority' => 'Medium',
            'noemail' => false,
            'admin' => true
        ];
        
        $apiResults = localAPI('OpenTicket', $postData);
        if ($apiResults['result'] === 'success') {
            $ticketId = $apiResults['id'] ?? $apiResults['tid'];
            logMessage("SUCCESS: Opened WHMCS courtesy ticket #{$ticketId} for {$domain} (Client #{$userId}).", $logFile);
            return $ticketId;
        } else {
            logMessage("ERROR: WHMCS OpenTicket API failed for {$domain}: " . ($apiResults['message'] ?? 'Unknown error'), $logFile);
        }
    }
    
    return null;
}

// Dispatch courtesy tickets for newly migrated sites
if (!$isDryRun && !$isNotifyOnly && !empty($newMigrations)) {
    foreach ($newMigrations as $domain => $entry) {
        $meta = $targets[$domain];
        if (!empty($meta['userid'])) {
            $tId = openWhmcsCourtesyTicket($pdo, $meta, $entry, $isDryRun, $logFile);
            if ($tId) {
                $state[$domain]['courtesy_ticket_id'] = $tId;
                $newMigrations[$domain]['courtesy_ticket_id'] = $tId;
            }
        }
    }
    @file_put_contents($stateFile, json_encode($state, JSON_PRETTY_PRINT));
}

// 7. Dispatch Notification Email to info@creativeyadley.com
function sendAdminNotificationEmail($adminEmail, $newMigrations, $auditResults, $isDryRun, $logFile) {
    if (empty($newMigrations)) {
        logMessage("No new migration events detected. Skipping admin alert email.", $logFile);
        return;
    }
    
    $count = count($newMigrations);
    $subject = "🚨 [Creative Yadley Alert] {$count} Website(s) Migrated Away from Server 2";
    
    $rows = "";
    foreach ($newMigrations as $domain => $item) {
        $client = htmlspecialchars($item['client_name'] . ($item['userid'] ? " (#{$item['userid']})" : ""));
        $user = htmlspecialchars($item['user']);
        $ns = htmlspecialchars(implode(', ', array_slice($item['ns'], 0, 2)));
        $ticketStatus = !empty($item['courtesy_ticket_id']) 
            ? "<span style='color: green; font-weight: bold;'>Ticket #{$item['courtesy_ticket_id']}</span>"
            : "<span style='color: #888;'>No ticket</span>";
        $reason = htmlspecialchars($item['details']);
        
        $rows .= "<tr>
            <td style='padding: 8px 12px; border-bottom: 1px solid #eee;'><strong>" . htmlspecialchars($domain) . "</strong></td>
            <td style='padding: 8px 12px; border-bottom: 1px solid #eee;'>{$user}</td>
            <td style='padding: 8px 12px; border-bottom: 1px solid #eee;'>{$client}</td>
            <td style='padding: 8px 12px; border-bottom: 1px solid #eee;'>{$ns}</td>
            <td style='padding: 8px 12px; border-bottom: 1px solid #eee;'>{$reason}</td>
            <td style='padding: 8px 12px; border-bottom: 1px solid #eee;'>{$ticketStatus}</td>
        </tr>";
    }
    
    $totalScanned = count($auditResults);
    $activeCount = count(array_filter($auditResults, fn($x) => $x['status'] === 'ACTIVE'));
    $deadCount = count(array_filter($auditResults, fn($x) => $x['status'] === 'DEAD_OR_EXPIRED'));
    $dateStr = date('Y-m-d H:i:s');
    
    $htmlBody = "
    <html>
    <head>
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #333; line-height: 1.5; }
            .container { max-width: 850px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; }
            .header { background: #1e293b; color: #fff; padding: 16px 20px; border-radius: 6px 6px 0 0; }
            .header h2 { margin: 0; font-size: 20px; }
            .content { padding: 20px 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 13px; }
            th { background: #f8fafc; text-align: left; padding: 10px 12px; border-bottom: 2px solid #cbd5e1; font-weight: 600; }
            .summary { margin-top: 25px; padding: 15px; background: #f1f5f9; border-radius: 6px; font-size: 13px; }
        </style>
    </head>
    <body>
        <div class='container'>
            <div class='header'>
                <h2>🚨 Creative Yadley - Server 2 Migration Alert</h2>
            </div>
            <div class='content'>
                <p>Hello Team,</p>
                <p>The automated nameserver & DNS audit detected that <strong>{$count}</strong> website(s) have updated their nameservers or DNS destination away from Creative Yadley Server 2.</p>
                
                <table>
                    <thead>
                        <tr>
                            <th>Domain</th>
                            <th>cPanel User</th>
                            <th>WHMCS Client</th>
                            <th>Nameservers</th>
                            <th>Details</th>
                            <th>Courtesy Ticket</th>
                        </tr>
                    </thead>
                    <tbody>
                        {$rows}
                    </tbody>
                </table>
                
                <div class='summary'>
                    <strong>Audit Summary ({$dateStr}):</strong><br>
                    • Total Accounts Audited: <strong>{$totalScanned}</strong><br>
                    • Active on Server / Cloudflare / External A-Record: <strong>{$activeCount}</strong><br>
                    • Newly Migrated Away: <strong>{$count}</strong><br>
                    • Dead / Expired Domains: <strong>{$deadCount}</strong>
                </div>
                
                <p style='font-size: 12px; color: #64748b; margin-top: 25px;'>
                    Sent automatically by Creative Yadley Migration Scanner from <code>server2.creativeyadley.com</code>.
                </p>
            </div>
        </div>
    </body>
    </html>
    ";
    
    $headers = [
        'MIME-Version: 1.0',
        'Content-type: text/html; charset=UTF-8',
        'From: Creative Yadley Server2 <server2@creativeyadley.com>',
        'Reply-To: info@creativeyadley.com',
        'X-Mailer: PHP/' . phpversion()
    ];
    
    if ($isDryRun) {
        logMessage("[DRY RUN] Would send alert email to {$adminEmail} regarding {$count} migrated domain(s).", $logFile);
        return;
    }
    
    $sent = @mail($adminEmail, $subject, $htmlBody, implode("\r\n", $headers));
    if ($sent) {
        logMessage("SUCCESS: Alert email sent to {$adminEmail}.", $logFile);
    } else {
        logMessage("Notice: mail() returned false. Ensure local exim/sendmail is running.", $logFile);
    }
}

sendAdminNotificationEmail($adminEmail, $newMigrations, $auditResults, $isDryRun, $logFile);

// 8. Console Summary Output
$migratedList = array_filter($auditResults, fn($x) => $x['status'] === 'MIGRATED_AWAY' || $x['status'] === 'A_RECORD_MIGRATED');
$deadList = array_filter($auditResults, fn($x) => $x['status'] === 'DEAD_OR_EXPIRED');
$activeList = array_filter($auditResults, fn($x) => $x['status'] === 'ACTIVE');

echo "\n" . str_repeat('=', 60) . "\n";
echo "AUDIT RESULTS SUMMARY\n";
echo str_repeat('=', 60) . "\n";
echo "Total Domains Audited: " . count($auditResults) . "\n";
echo "  [ACTIVE]           : " . count($activeList) . "\n";
echo "  [MIGRATED AWAY]    : " . count($migratedList) . "\n";
echo "  [DEAD/EXPIRED]     : " . count($deadList) . "\n";
echo "  [NEW MIGRATIONS]   : " . count($newMigrations) . "\n";
echo str_repeat('=', 60) . "\n";

if (!empty($newMigrations)) {
    echo "\n🚨 NEWLY MIGRATED DOMAINS TODAY:\n";
    foreach ($newMigrations as $d => $info) {
        echo " - {$d} [{$info['user']}] -> {$info['details']}\n";
    }
}

logMessage("=== Migration Scanner Run Completed ===", $logFile);
