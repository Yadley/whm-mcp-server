<?php
/**
 * Creative Yadley - Server 2 Migration & Nameserver Audit Scanner
 * 
 * Purpose:
 * Audits all accounts, services, and domains on Server 2 and WHMCS to immediately detect 
 * client websites that have migrated away to other hosts.
 * 
 * Authorized Nameservers:
 * - ns1.creativeyadley.com
 * - ns2.creativeyadley.com
 * - bruce.ns.cloudflare.com
 * - elinore.ns.cloudflare.com
 * - jewel.ns.cloudflare.com
 * - scott.ns.cloudflare.com
 * 
 * Smart Detection Rules:
 * 1. Creative Yadley Cloudflare (bruce/elinore/jewel/scott): ACTIVE
 * 2. Creative Yadley Nameservers (ns1/ns2.creativeyadley.com):
 *    - A record matches Server 2 (66.29.147.164): ACTIVE
 *    - A record points elsewhere: A_RECORD_MIGRATED
 * 3. External Nameservers (GoDaddy, Wix, Bluehost, Squarespace, external Cloudflare):
 *    - A record points to Server 2 (66.29.147.164): ACTIVE (External DNS pointing to us)
 *    - A record points elsewhere: MIGRATED_AWAY
 * 
 * Daily Digest Features:
 * - Subject Line: [Creative Yadley Migration Digest]
 * - Action Required Section: Highlights migrated accounts that are still marked 'Active' in WHMCS (Security & Resource cleanup)
 * - Normalizes domains (handles trailing slashes like 'domain.com/' and URLs like 'https://...')
 * - Bypasses local DNS cache by querying public DNS resolvers (1.1.1.1 & 8.8.8.8)
 * - Sends authenticated SPF-compliant HTML alerts to info@creativeyadley.com
 * - Tracks state in migration_state.json to prevent duplicate ticket dispatches
 */

cli_set_process_title("CreativeYadley-Migration-Scanner");

$options = getopt("", ["dry-run", "notify-only", "force-ticket", "domain:", "test-client:"]);
$isDryRun = isset($options['dry-run']);
$isNotifyOnly = isset($options['notify-only']);
$forceTicket = isset($options['force-ticket']);
$filterDomain = isset($options['domain']) ? strtolower(trim($options['domain'])) : null;
$testClientId = isset($options['test-client']) ? intval($options['test-client']) : null;

$adminEmail = 'info@creativeyadley.com';
$fromEmail = 'noreply@creativeyadley.com';
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

function cleanDomain($raw) {
    if (empty($raw)) return null;
    $d = strtolower(trim($raw));
    $d = preg_replace('#^https?://#i', '', $d);
    $d = rtrim($d, '/');
    $parts = explode('/', $d);
    $d = trim($parts[0]);
    if (filter_var($d, FILTER_VALIDATE_DOMAIN, FILTER_FLAG_HOSTNAME)) {
        return $d;
    }
    return null;
}

logMessage("=== Starting Creative Yadley Migration Scanner ===", $logFile);
if ($isDryRun) {
    logMessage("MODE: DRY RUN (no tickets or emails will be dispatched)", $logFile);
}

// 1. Connect to WHMCS
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

if (file_exists($whmcsPath . '/init.php')) {
    try {
        require_once $whmcsPath . '/init.php';
    } catch (Throwable $e) {}
}

// 2. Discover Domains Across WHMCS & Server
$targets = [];

if ($pdo) {
    try {
        // Query tblhosting for Active, Suspended, and Cancelled accounts
        $stmt = $pdo->query("
            SELECT h.id as serviceid, h.userid, h.domain, h.username, h.domainstatus,
                   c.status as client_status, c.firstname, c.lastname, c.email as client_email, c.companyname
            FROM tblhosting h
            LEFT JOIN tblclients c ON c.id = h.userid
            WHERE h.domain IS NOT NULL AND h.domain != ''
            ORDER BY h.id DESC
        ");

        $domainServices = [];
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $dom = cleanDomain($row['domain']);
            if (!$dom) continue;
            $domainServices[$dom][] = $row;
        }

        foreach ($domainServices as $dom => $rows) {
            // Determine the accurate status for this domain:
            // 1. If any service row belongs to an Active client and is Active, that takes priority
            // 2. Safeguard: If any service row is Active (even if client status is Closed/Inactive in error), treat as Active
            // 3. If all clients associated with this domain are Closed and services are not active, status is Closed
            // 4. Otherwise, use the status from the latest service row, respecting client status
            $activeClientActiveService = null;
            $anyActiveService = null;
            $allClientsClosed = true;

            foreach ($rows as $r) {
                $cStatus = strtolower(trim($r['client_status'] ?? ''));
                $sStatus = $r['domainstatus'];
                if ($cStatus !== 'closed') {
                    $allClientsClosed = false;
                }
                if ($cStatus === 'active' && $sStatus === 'Active' && !$activeClientActiveService) {
                    $activeClientActiveService = $r;
                }
                if ($sStatus === 'Active' && !$anyActiveService) {
                    $anyActiveService = $r;
                }
            }

            if ($activeClientActiveService) {
                $chosen = $activeClientActiveService;
                $statusInWhmcs = 'Active';
            } elseif ($anyActiveService) {
                // Safeguard: An Active hosting service takes precedence over an administrative client-status error
                $chosen = $anyActiveService;
                $statusInWhmcs = 'Active';
                logMessage("Notice for {$dom}: Active hosting service #{$chosen['serviceid']} found, but client #{$chosen['userid']} status is '{$chosen['client_status']}'. Prioritizing Active service.", $logFile);
            } elseif ($allClientsClosed) {
                $chosen = $rows[0];
                $statusInWhmcs = 'Closed';
            } else {
                $chosen = $rows[0]; // latest service
                $cStatus = strtolower(trim($chosen['client_status'] ?? ''));
                if ($cStatus === 'closed') {
                    $statusInWhmcs = 'Closed';
                } elseif ($cStatus === 'inactive') {
                    $statusInWhmcs = 'Inactive';
                } else {
                    $statusInWhmcs = $chosen['domainstatus'];
                }
            }

            $targets[$dom] = [
                'domain' => $dom,
                'user' => $chosen['username'],
                'serviceid' => $chosen['serviceid'],
                'service_status' => $chosen['domainstatus'] ?? null,
                'userid' => $chosen['userid'],
                'client_name' => trim(($chosen['firstname'] ?? '') . ' ' . ($chosen['lastname'] ?? '')),
                'client_email' => $chosen['client_email'],
                'client_status' => $chosen['client_status'] ?? 'Unknown',
                'status_in_whmcs' => $statusInWhmcs,
                'source' => 'WHMCS Hosting'
            ];
        }
        logMessage("Loaded " . count($targets) . " unique domains from WHMCS hosting services.", $logFile);
        
        // Also load registered domains from tbldomains
        $stmt2 = $pdo->query("
            SELECT d.id as domainid, d.userid, d.domain, d.status,
                   c.status as client_status, c.firstname, c.lastname, c.email as client_email
            FROM tbldomains d
            LEFT JOIN tblclients c ON c.id = d.userid
            WHERE d.domain IS NOT NULL AND d.domain != ''
            ORDER BY d.id DESC
        ");
        $addedFromDomains = 0;
        while ($row = $stmt2->fetch(PDO::FETCH_ASSOC)) {
            $dom = cleanDomain($row['domain']);
            if ($dom && !isset($targets[$dom])) {
                $isDomainActive = (strtolower(trim($row['status'] ?? '')) === 'active');
                $isClientClosed = (strtolower(trim($row['client_status'] ?? '')) === 'closed');
                $isClientInactive = (strtolower(trim($row['client_status'] ?? '')) === 'inactive');
                if ($isDomainActive) {
                    $statusInWhmcs = 'Active';
                } elseif ($isClientClosed) {
                    $statusInWhmcs = 'Closed';
                } elseif ($isClientInactive) {
                    $statusInWhmcs = 'Inactive';
                } else {
                    $statusInWhmcs = $row['status'];
                }

                $targets[$dom] = [
                    'domain' => $dom,
                    'user' => '',
                    'serviceid' => null,
                    'service_status' => $row['status'] ?? null,
                    'userid' => $row['userid'],
                    'client_name' => trim(($row['firstname'] ?? '') . ' ' . ($row['lastname'] ?? '')),
                    'client_email' => $row['client_email'],
                    'client_status' => $row['client_status'] ?? 'Unknown',
                    'status_in_whmcs' => $statusInWhmcs,
                    'source' => 'WHMCS Registered Domain'
                ];
                $addedFromDomains++;
            }
        }
        if ($addedFromDomains > 0) {
            logMessage("Added {$addedFromDomains} domains from WHMCS registered domains table.", $logFile);
        }
    } catch (Throwable $e) {
        logMessage("Warning: WHMCS query failed: " . $e->getMessage(), $logFile);
    }
}

// Discover server cPanel accounts from /etc/trueuserdomains
if (file_exists('/etc/trueuserdomains')) {
    $lines = file('/etc/trueuserdomains', FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (strpos($line, ':') !== false) {
            list($d, $u) = explode(':', $line, 2);
            $dom = cleanDomain($d);
            $u = trim($u);
            if ($dom && !isset($targets[$dom])) {
                $targets[$dom] = [
                    'domain' => $dom,
                    'user' => $u,
                    'serviceid' => null,
                    'userid' => null,
                    'client_name' => 'Server cPanel (' . $u . ')',
                    'client_email' => null,
                    'status_in_whmcs' => 'Server Only',
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
                'status_in_whmcs' => 'Unknown',
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
                $status = 'ACTIVE';
                $details = 'Active on Creative Yadley Cloudflare (' . implode(', ', array_slice($nsRecords, 0, 2)) . ')';
            } else {
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
            // External Nameservers (GoDaddy, Wix, Bluehost, Google Domains, external Cloudflare, etc.)
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
        'client_status' => $meta['client_status'] ?? 'Unknown',
        'status_in_whmcs' => $meta['status_in_whmcs'],
        'status' => $status,
        'details' => $details,
        'ns' => $nsRecords,
        'ips' => $aRecords,
        'timestamp' => $now
    ];
    
    $auditResults[$domain] = $entry;
    
    $previousStatus = isset($state[$domain]) ? $state[$domain]['status'] : 'ACTIVE';
    $isNowMigrated = ($status === 'MIGRATED_AWAY' || $status === 'A_RECORD_MIGRATED');
    $wasMigrated = ($previousStatus === 'MIGRATED_AWAY' || $previousStatus === 'A_RECORD_MIGRATED');
    
    if ($isNowMigrated && (!$wasMigrated || $forceTicket)) {
        $newMigrations[$domain] = $entry;
    }
    
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
    
    // Only open tickets for Active services in WHMCS (don't ticket clients who already cancelled or closed)
    $whmcsStatus = $meta['status_in_whmcs'] ?? '';
    $serviceStatus = $meta['service_status'] ?? '';
    $clientStatus = strtolower(trim($meta['client_status'] ?? ''));

    // Safeguard: An Active hosting/domain service takes precedence over an accidental Closed/Inactive client status
    $isActiveService = ($whmcsStatus === 'Active' || strtolower(trim($serviceStatus)) === 'active');

    if (!$isActiveService) {
        logMessage("Skipping courtesy ticket for {$domain}: Account service is {$whmcsStatus}/{$serviceStatus} (Client: {$clientStatus}) in WHMCS.", $logFile);
        return null;
    }

    if ($clientStatus === 'closed' || $clientStatus === 'inactive') {
        logMessage("Notice: Client #{$userId} for {$domain} has client status '{$clientStatus}', but hosting service is Active. Proceeding with courtesy ticket.", $logFile);
    }
    
    $subject = "Important: Nameserver Update Detected for {$domain}";
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
function sendAdminNotificationEmail($adminEmail, $fromEmail, $newMigrations, $auditResults, $isDryRun, $logFile, $testClientId = null, $whmcsPath = null, $pdo = null) {
    $count = count($newMigrations);
    $totalScanned = count($auditResults);
    $activeCount = count(array_filter($auditResults, fn($x) => $x['status'] === 'ACTIVE' && ($x['status_in_whmcs'] ?? '') !== 'Closed'));
    $migratedCount = count(array_filter($auditResults, fn($x) => $x['status'] === 'MIGRATED_AWAY' || $x['status'] === 'A_RECORD_MIGRATED'));
    $deadCount = count(array_filter($auditResults, fn($x) => $x['status'] === 'DEAD_OR_EXPIRED'));
    $dateStr = date('Y-m-d H:i:s T');
    
    // Identify accounts that migrated away but are STILL marked as 'Active' in WHMCS (Security & Resource cleanup)
    $actionRequired = array_filter($auditResults, function($item) {
        $isMigrated = ($item['status'] === 'MIGRATED_AWAY' || $item['status'] === 'A_RECORD_MIGRATED');
        $isActiveInWhmcs = (($item['status_in_whmcs'] ?? '') === 'Active');
        return $isMigrated && $isActiveInWhmcs;
    });
    $actionCount = count($actionRequired);

    $subject = "[Creative Yadley Migration Digest] Server 2 Audit Report - " . date('Y-m-d');
    
    // Design System Tokens (v2.3.0 / Email Design System 1.0)
    $cInk = '#08090B';
    $cBody = '#434745';
    $cMuted = '#5E6463';
    $cHair = '#D2D6D0';
    $cPanel = '#F4F5F2';
    $cPage = '#ECEEE9';
    $cLime = '#AFE139';
    $cLimeInk = '#0B0D0E';
    $cWhite = '#FFFFFF';
    $cBorder = '#E2E8F0';
    $cCardBg = '#F8FAFC';
    
    // Alert / Status Colors
    $cAlertBg = '#FEF2F2';
    $cAlertBorder = '#FECACA';
    $cAlertInk = '#991B1B';
    $cAlertNum = '#DC2626';

    $cSuccessBg = '#F0FDF4';
    $cSuccessBorder = '#BBF7D0';
    $cSuccessInk = '#166534';
    $cSuccessNum = '#15803D';

    $cWarnBg = '#FFFBEB';
    $cWarnBorder = '#FDE68A';
    $cWarnInk = '#92400E';
    $cWarnNum = '#D97706';

    $cGreyBg = '#F3F4F6';
    $cGreyBorder = '#E5E7EB';
    $cGreyInk = '#6B7280';
    $cGreyNum = '#4B5563';

    $fDisplay = "'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif";
    $fSans = "'Nunito Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif";
    $fMono = "'JetBrains Mono',Consolas,'Courier New',monospace";

    // 1. Newly Migrated Today Section (with generous padding)
    $newMigrationsHtml = "";
    if ($count > 0) {
        $newRows = "";
        foreach ($newMigrations as $domain => $item) {
            $client = htmlspecialchars($item['client_name'] . ($item['userid'] ? " (#{$item['userid']})" : ""));
            $ns = htmlspecialchars(implode(', ', array_slice($item['ns'], 0, 2)));
            $whmcsStatusRaw = $item['status_in_whmcs'] ?? 'N/A';
            if ($whmcsStatusRaw === 'Active') {
                $statusBadge = "<span style=\"background: {$cAlertBg}; color: {$cAlertInk}; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 700;\">Active</span>";
            } elseif ($whmcsStatusRaw === 'Closed') {
                $statusBadge = "<span style=\"background: {$cPanel}; color: {$cMuted}; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;\">Closed</span>";
            } else {
                $statusBadge = "<span style=\"background: {$cPanel}; color: {$cMuted}; padding: 3px 8px; border-radius: 4px; font-size: 11px;\">{$whmcsStatusRaw}</span>";
            }
            
            $ticketStatus = !empty($item['courtesy_ticket_id']) 
                ? "<span style=\"color: #166534; font-weight: 700;\">Ticket #{$item['courtesy_ticket_id']}</span>"
                : "<span style=\"color: {$cMuted};\">None</span>";
            
            $ipsStr = !empty($item['ips']) ? htmlspecialchars(implode(', ', array_slice($item['ips'], 0, 2))) : 'None';
            $destHtml = "<div style=\"font-weight: 600; color: {$cInk};\">{$ns}</div><div style=\"color: {$cMuted}; font-size: 12px; margin-top: 2px;\">IP: {$ipsStr}</div>";
            
            $newRows .= "<tr>"
                . "<td style=\"padding: 12px 14px; border-bottom: 1px solid {$cHair}; vertical-align: top; word-break: break-all;\">"
                . "<a href=\"https://" . htmlspecialchars($domain) . "\" target=\"_blank\" style=\"color: {$cInk}; text-decoration: underline; text-decoration-color: {$cLime}; text-underline-offset: 3px; font-weight: 700;\">" . htmlspecialchars($domain) . "</a>"
                . "</td>"
                . "<td style=\"padding: 12px 14px; border-bottom: 1px solid {$cHair}; vertical-align: top; font-family: {$fSans}; font-size: 13px; color: {$cBody};\">{$client}</td>"
                . "<td style=\"padding: 12px 14px; border-bottom: 1px solid {$cHair}; vertical-align: top;\">{$statusBadge}</td>"
                . "<td style=\"padding: 12px 14px; border-bottom: 1px solid {$cHair}; vertical-align: top; word-break: break-word;\">{$destHtml}</td>"
                . "<td style=\"padding: 12px 14px; border-bottom: 1px solid {$cHair}; vertical-align: top; font-family: {$fSans}; font-size: 13px;\">{$ticketStatus}</td>"
                . "</tr>";
        }
        
        $newMigrationsHtml = "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"margin: 0 0 20px; background: {$cPanel}; border: 1px solid {$cHair}; border-radius: 12px; border-collapse: separate;\">"
            . "<tr><td style=\"padding: 20px 24px;\">"
            . "<p style=\"margin: 0 0 10px; font-family: {$fDisplay}; font-size: 13px; font-weight: 800; letter-spacing: 0.8px; text-transform: uppercase; color: {$cAlertInk};\">"
            . "Newly Migrated in Last 24 Hours ({$count})"
            . "</p>"
            . "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"background: {$cWhite}; border: 1px solid {$cHair}; border-radius: 10px; overflow: hidden; border-collapse: collapse;\">"
            . "<thead><tr style=\"background: {$cPanel};\">"
            . "<th style=\"padding: 10px 12px; text-align: left; font-family: {$fDisplay}; font-size: 11px; font-weight: 700; color: {$cInk}; text-transform: uppercase;\">Domain</th>"
            . "<th style=\"padding: 10px 12px; text-align: left; font-family: {$fDisplay}; font-size: 11px; font-weight: 700; color: {$cInk}; text-transform: uppercase;\">WHMCS Client</th>"
            . "<th style=\"padding: 10px 12px; text-align: left; font-family: {$fDisplay}; font-size: 11px; font-weight: 700; color: {$cInk}; text-transform: uppercase;\">Status</th>"
            . "<th style=\"padding: 10px 12px; text-align: left; font-family: {$fDisplay}; font-size: 11px; font-weight: 700; color: {$cInk}; text-transform: uppercase;\">Destination</th>"
            . "<th style=\"padding: 10px 12px; text-align: left; font-family: {$fDisplay}; font-size: 11px; font-weight: 700; color: {$cInk}; text-transform: uppercase;\">Ticket</th>"
            . "</tr></thead>"
            . "<tbody>{$newRows}</tbody>"
            . "</table>"
            . "</td></tr>"
            . "</table>";
    } else {
        $newMigrationsHtml = "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"margin: 0 0 20px; background: {$cSuccessBg}; border: 1px solid {$cSuccessBorder}; border-radius: 12px; border-collapse: separate;\">"
            . "<tr>"
            . "<td style=\"padding: 20px 24px; font-family: {$fSans}; font-size: 14px; line-height: 1.6; color: {$cSuccessInk};\">"
            . "<div style=\"font-family: {$fDisplay}; font-size: 14px; font-weight: 700; color: {$cSuccessInk}; margin-bottom: 4px;\">0 New Migrations Detected Today</div>"
            . "<div style=\"font-family: {$fSans}; font-size: 14px; line-height: 1.55; color: {$cSuccessInk};\">No client website DNS changes were detected in the last 24-hour audit cycle.</div>"
            . "</td>"
            . "</tr>"
            . "</table>";
    }

    // 2. Action Required Section: Migrated Away But STILL Active in WHMCS
    $actionRequiredHtml = "";
    if ($actionCount > 0) {
        $actionRows = "";
        foreach ($actionRequired as $domain => $item) {
            $client = htmlspecialchars($item['client_name'] . ($item['userid'] ? " (#{$item['userid']})" : ""));
            $ns = htmlspecialchars(implode(', ', array_slice($item['ns'], 0, 2)));
            $ipsStr = !empty($item['ips']) ? htmlspecialchars(implode(', ', array_slice($item['ips'], 0, 2))) : 'None';
            
            $actionRows .= "<tr>"
                . "<td style=\"padding: 12px 14px; border-bottom: 1px solid {$cHair}; vertical-align: top; word-break: break-all;\">"
                . "<a href=\"https://" . htmlspecialchars($domain) . "\" target=\"_blank\" style=\"color: {$cInk}; text-decoration: underline; text-decoration-color: {$cLime}; text-underline-offset: 3px; font-weight: 700;\">" . htmlspecialchars($domain) . "</a>"
                . "</td>"
                . "<td style=\"padding: 12px 14px; border-bottom: 1px solid {$cHair}; vertical-align: top; font-family: {$fSans}; font-size: 13px; color: {$cBody};\">{$client}</td>"
                . "<td style=\"padding: 12px 14px; border-bottom: 1px solid {$cHair}; vertical-align: top;\">"
                . "<span style=\"background: {$cAlertBg}; color: {$cAlertInk}; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; letter-spacing: 0.3px;\">ACTIVE IN WHMCS</span>"
                . "</td>"
                . "<td style=\"padding: 12px 14px; border-bottom: 1px solid {$cHair}; vertical-align: top; font-family: {$fSans}; font-size: 13px; color: {$cBody}; word-break: break-word;\">"
                . "<div style=\"font-weight: 600; color: {$cInk};\">{$ns}</div>"
                . "<div style=\"color: {$cMuted}; font-size: 11px; margin-top: 2px;\">IP: {$ipsStr}</div>"
                . "</td>"
                . "<td style=\"padding: 12px 14px; border-bottom: 1px solid {$cHair}; vertical-align: top; font-family: {$fSans}; font-size: 13px; font-weight: 700; color: {$cAlertInk};\">"
                . "Cancel & Archive"
                . "</td>"
                . "</tr>";
        }
        
        $actionRequiredHtml = "<div style=\"margin: 0 0 10px; font-family: {$fDisplay}; font-size: 13px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: {$cAlertInk};\">Action Required: Migrated but Active in WHMCS ({$actionCount})</div>"
            . "<div style=\"border: 1px solid {$cAlertBorder}; border-radius: 12px; overflow: hidden; margin-bottom: 20px; background: {$cWhite};\">"
            . "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\">"
            . "<thead><tr style=\"background: #FEE2E2;\">"
            . "<th style=\"padding: 10px 14px; text-align: left; font-family: {$fDisplay}; font-size: 11px; font-weight: 700; color: {$cAlertInk}; text-transform: uppercase;\">Domain</th>"
            . "<th style=\"padding: 10px 14px; text-align: left; font-family: {$fDisplay}; font-size: 11px; font-weight: 700; color: {$cAlertInk}; text-transform: uppercase;\">WHMCS Client</th>"
            . "<th style=\"padding: 10px 14px; text-align: left; font-family: {$fDisplay}; font-size: 11px; font-weight: 700; color: {$cAlertInk}; text-transform: uppercase;\">Status</th>"
            . "<th style=\"padding: 10px 14px; text-align: left; font-family: {$fDisplay}; font-size: 11px; font-weight: 700; color: {$cAlertInk}; text-transform: uppercase;\">Destination</th>"
            . "<th style=\"padding: 10px 14px; text-align: left; font-family: {$fDisplay}; font-size: 11px; font-weight: 700; color: {$cAlertInk}; text-transform: uppercase;\">Action</th>"
            . "</tr></thead>"
            . "<tbody>{$actionRows}</tbody>"
            . "</table>"
            . "</div>";
    }

    // 3. Clean 2x2 Color-Coded Metrics Grid
    $m3Bg = ($actionCount > 0) ? $cAlertBg : $cWarnBg;
    $m3Border = ($actionCount > 0) ? $cAlertBorder : $cWarnBorder;
    $m3LabelColor = ($actionCount > 0) ? $cAlertInk : $cWarnInk;
    $m3NumColor = ($actionCount > 0) ? $cAlertNum : $cWarnNum;
    $m3Subtitle = ($actionCount > 0) ? "Migrated but active in WHMCS" : "No domains routed away";

    $metricsHtml = "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"margin: 0 0 20px;\">"
      . "<tr>"
      . "<td class=\"cy-col\" width=\"48.5%\" valign=\"top\" style=\"background: {$cCardBg}; border: 1px solid {$cBorder}; border-radius: 12px; padding: 16px 20px;\">"
      . "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\"><tr><td>"
      . "<div style=\"font-family: {$fDisplay}; font-size: 11px; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase; color: #475569;\">Total Audited</div>"
      . "<div style=\"font-family: {$fDisplay}; font-size: 28px; font-weight: 800; color: #0F172A; line-height: 1.15; margin: 6px 0 2px;\">{$totalScanned}</div>"
      . "<div style=\"font-family: {$fSans}; font-size: 12px; line-height: 1.4; color: #64748B;\">Monitored cPanel accounts</div>"
      . "</td></tr></table>"
      . "</td>"
      . "<td class=\"cy-col-gap\" width=\"3%\" style=\"width: 3%; font-size: 0; line-height: 0;\">&nbsp;</td>"
      . "<td class=\"cy-col\" width=\"48.5%\" valign=\"top\" style=\"background: {$cSuccessBg}; border: 1px solid {$cSuccessBorder}; border-radius: 12px; padding: 16px 20px;\">"
      . "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\"><tr><td>"
      . "<div style=\"font-family: {$fDisplay}; font-size: 11px; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase; color: {$cSuccessInk};\">Active on Server</div>"
      . "<div style=\"font-family: {$fDisplay}; font-size: 28px; font-weight: 800; color: {$cSuccessNum}; line-height: 1.15; margin: 6px 0 2px;\">{$activeCount}</div>"
      . "<div style=\"font-family: {$fSans}; font-size: 12px; line-height: 1.4; color: {$cSuccessInk};\">Resolving to 66.29.147.164</div>"
      . "</td></tr></table>"
      . "</td>"
      . "</tr>"
      . "<tr><td class=\"cy-row-gap\" colspan=\"3\" height=\"12\" style=\"height: 12px; line-height: 12px; font-size: 0;\">&nbsp;</td></tr>"
      . "<tr>"
      . "<td class=\"cy-col\" width=\"48.5%\" valign=\"top\" style=\"background: {$m3Bg}; border: 1px solid {$m3Border}; border-radius: 12px; padding: 16px 20px;\">"
      . "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\"><tr><td>"
      . "<div style=\"font-family: {$fDisplay}; font-size: 11px; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase; color: {$m3LabelColor};\">Action Required</div>"
      . "<div style=\"font-family: {$fDisplay}; font-size: 28px; font-weight: 800; color: {$m3NumColor}; line-height: 1.15; margin: 6px 0 2px;\">{$actionCount}</div>"
      . "<div style=\"font-family: {$fSans}; font-size: 12px; line-height: 1.4; color: {$m3LabelColor};\">{$m3Subtitle}</div>"
      . "</td></tr></table>"
      . "</td>"
      . "<td class=\"cy-col-gap\" width=\"3%\" style=\"width: 3%; font-size: 0; line-height: 0;\">&nbsp;</td>"
      . "<td class=\"cy-col\" width=\"48.5%\" valign=\"top\" style=\"background: {$cGreyBg}; border: 1px solid {$cGreyBorder}; border-radius: 12px; padding: 16px 20px;\">"
      . "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\"><tr><td>"
      . "<div style=\"font-family: {$fDisplay}; font-size: 11px; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase; color: {$cGreyInk};\">Inactive / Excluded</div>"
      . "<div style=\"font-family: {$fDisplay}; font-size: 28px; font-weight: 800; color: {$cGreyNum}; line-height: 1.15; margin: 6px 0 2px;\">{$deadCount}</div>"
      . "<div style=\"font-family: {$fSans}; font-size: 12px; line-height: 1.4; color: {$cGreyInk};\">Core platform &amp; dormant</div>"
      . "</td></tr></table>"
      . "</td>"
      . "</tr>"
      . "</table>";

    $ctaUrl = 'https://creativeyadley.com/clientarea/admin/clients.php';
    $ctaLabel = 'Review Migrated Accounts';

    $ctaBlock = "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\">"
      . "<tr><td height=\"18\" style=\"height: 18px; line-height: 18px; font-size: 0;\">&nbsp;</td></tr>"
      . "<tr>"
      . "<td align=\"left\">"
      . "<!--[if mso]>"
      . "<v:roundrect xmlns:v=\"urn:schemas-microsoft-com:vml\" xmlns:w=\"urn:schemas-microsoft-com:office:word\" href=\"{$ctaUrl}\" style=\"height: 50px; v-text-anchor: middle; width: 270px;\" arcsize=\"50%\" fillcolor=\"{$cLime}\" stroke=\"f\">"
      . "<w:anchorlock/>"
      . "<center style=\"color: {$cLimeInk}; font-family: Arial, sans-serif; font-size: 15px; font-weight: bold;\">{$ctaLabel}</center>"
      . "</v:roundrect>"
      . "<![endif]-->"
      . "<!--[if !mso]><!-->"
      . "<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"border-collapse: separate;\">"
      . "<tr>"
      . "<td bgcolor=\"{$cLime}\" style=\"background-color: {$cLime}; border-radius: 9999px;\">"
      . "<a href=\"{$ctaUrl}\" class=\"cy-btn\" style=\"display: inline-block; padding: 16px 36px; font-family: {$fDisplay}; font-size: 15px; line-height: 1; font-weight: 700; color: {$cLimeInk}; background-color: {$cLime}; border: 1px solid {$cLime}; text-decoration: none; border-radius: 9999px; text-align: center;\">{$ctaLabel}</a>"
      . "</td>"
      . "</tr>"
      . "</table>"
      . "<!--<![endif]-->"
      . "</td>"
      . "</tr>"
      . "<tr><td height=\"20\" style=\"height: 20px; line-height: 20px; font-size: 0;\">&nbsp;</td></tr>"
      . "</table>";

    $rawHtml = "<!doctype html>"
      . "<html xmlns=\"http://www.w3.org/1999/xhtml\" xmlns:v=\"urn:schemas-microsoft-com:vml\" xmlns:o=\"urn:schemas-microsoft-com:office:office\" lang=\"en\" dir=\"ltr\">"
      . "<head>"
      . "<meta charset=\"utf-8\">"
      . "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">"
      . "<meta name=\"color-scheme\" content=\"light\">"
      . "<meta name=\"supported-color-schemes\" content=\"light\">"
      . "<title>Creative Yadley Migration Digest</title>"
      . "<style type=\"text/css\">"
      . "@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&family=Nunito+Sans:wght@400;600;700&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap');"
      . "html,body{margin:0!important;padding:0!important;width:100%!important;}"
      . "table{border-collapse:collapse;}"
      . "img{-ms-interpolation-mode:bicubic;}"
      . "a{text-decoration:none;}"
      . "@media only screen and (max-width:620px){"
      . ".cy-shell{width:100%!important;}"
      . ".cy-px{padding-left:20px!important;padding-right:20px!important;padding-top:28px!important;padding-bottom:24px!important;}"
      . ".cy-h1{font-size:22px!important;line-height:1.25!important;}"
      . ".cy-btn{display:block!important;width:100%!important;box-sizing:border-box!important;text-align:center!important;padding:16px 20px!important;}"
      . ".cy-col{display:block!important;width:100%!important;box-sizing:border-box!important;margin-bottom:10px!important;}"
      . ".cy-col-gap{display:none!important;}"
      . ".cy-row-gap{display:none!important;}"
      . "}"
      . "</style>"
      . "</head>"
      . "<body style=\"margin:0;padding:0;background:{$cPage};-webkit-text-size-adjust:100%;\">"
      . "<div style=\"display:none;font-size:1px;color:{$cPage};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;\">Creative Yadley Migration Digest - Server 2 Audit Report</div>"
      . "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" bgcolor=\"{$cPage}\" style=\"background:{$cPage};\">"
      . "<tr>"
      . "<td align=\"center\" style=\"padding:16px 10px;\">"
      . "<table role=\"presentation\" width=\"600\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" class=\"cy-shell\" style=\"width:600px;max-width:600px;background:{$cWhite};border-radius:14px;overflow:hidden;\">"
      . "<!-- Internal Admin Content-Only Fragment: No Hero, No Logo, No Footer -->"
      . "<tr>"
      . "<td class=\"cy-px\" bgcolor=\"{$cWhite}\" style=\"background:{$cWhite};padding:32px 36px 28px;\">"
      . "<p style=\"margin:0 0 6px;font-family:{$fDisplay};font-size:11px;line-height:1.4;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:{$cMuted};\">SERVER 2 MONITORING</p>"
      . "<h1 class=\"cy-h1\" style=\"margin:0 0 10px;font-family:{$fDisplay};font-size:24px;line-height:1.22;letter-spacing:-0.4px;font-weight:700;color:{$cInk};\">Creative Yadley Migration Digest</h1>"
      . "<p style=\"margin:0 0 18px;font-family:{$fSans};font-size:15px;line-height:1.5;color:{$cBody};\">"
      . "Automated DNS and nameserver audit report for server2.creativeyadley.com ({$dateStr}). Monitored client accounts, external routing changes, and recommended service cleanups are detailed below."
      . "</p>"
      . "{$newMigrationsHtml}"
      . "{$metricsHtml}"
      . "{$actionRequiredHtml}"
      . "{$ctaBlock}"
      . "<p style=\"margin:16px 0 0;font-family:{$fSans};font-size:12px;line-height:1.55;color:{$cMuted};border-top:1px solid {$cHair};padding-top:14px;\">"
      . "Internal studio audit automation. Not a client message. &middot; <a href=\"https://creativeyadley.com/clientarea/admin/\" style=\"color:{$cMuted};text-decoration:underline;\">Admin Area</a> &middot; server2.creativeyadley.com"
      . "</p>"
      . "</td>"
      . "</tr>"
      . "</table>"
      . "</td>"
      . "</tr>"
      . "</table>"
      . "</body>"
      . "</html>";

    $compact = preg_replace('/>\\r?\\n\\s*</', '><', $rawHtml);
    $compact = preg_replace('/\\r?\\n\\s*/', ' ', $compact);
    $htmlBody = trim($compact);
    
    // Authenticated SPF-aligned headers
    $headers = [
        'MIME-Version: 1.0',
        'Content-type: text/html; charset=UTF-8',
        "From: Creative Yadley Admin <{$fromEmail}>",
        "Reply-To: {$adminEmail}",
        "Return-Path: <{$fromEmail}>",
        'X-Mailer: CreativeYadley-MigrationScanner/2.3.0'
    ];
    
    if ($isDryRun) {
        logMessage("[DRY RUN] Would send digest email regarding {$count} new migrated domain(s) and {$actionCount} action item(s).", $logFile);
        return;
    }

    if ($testClientId) {
        logMessage("Dispatching test digest email to Client #{$testClientId}...", $logFile);
        if ($whmcsPath && file_exists($whmcsPath . '/init.php')) {
            require_once $whmcsPath . '/init.php';
            if (function_exists('localAPI')) {
                $apiRes = localAPI('SendEmail', [
                    'id' => $testClientId,
                    'customtype' => 'general',
                    'customsubject' => $subject,
                    'custommessage' => '{literal}' . $htmlBody . '{/literal}'
                ]);
                logMessage("localAPI SendEmail result: " . json_encode($apiRes), $logFile);
            }
        }
        // Also log to mod_cy_studio_automations
        try {
            if ($pdo) {
                $cStmt = $pdo->prepare("SELECT email FROM tblclients WHERE id = :id");
                $cStmt->execute([':id' => $testClientId]);
                $clientEmail = $cStmt->fetchColumn() ?: 'tinasheyadley@outlook.com';

                $aStmt = $pdo->prepare("INSERT INTO mod_cy_studio_automations (booking_code, recipient_email, template_filename, template_label, status, created_at) VALUES (:code, :email, 'server-migration-digest', 'Creative Yadley Migration Digest', 'Sent', NOW())");
                $aStmt->execute([
                    ':code' => "MIGR-" . date('YmdHi'),
                    ':email' => $clientEmail
                ]);
                logMessage("Logged to mod_cy_studio_automations successfully.", $logFile);
            }
        } catch (Throwable $e) {
            logMessage("Notice: mod_cy_studio_automations logging error: " . $e->getMessage(), $logFile);
        }
        return;
    }
    
    $sent = @mail($adminEmail, $subject, $htmlBody, implode("\r\n", $headers), "-f " . escapeshellarg($fromEmail));
    if ($sent) {
        logMessage("SUCCESS: Alert email sent to {$adminEmail} (From: {$fromEmail}).", $logFile);
    } else {
        logMessage("Notice: mail() returned false. Ensure local exim/sendmail is running.", $logFile);
    }
}

if (!$filterDomain || $testClientId) {
    sendAdminNotificationEmail($adminEmail, $fromEmail, $newMigrations, $auditResults, $isDryRun, $logFile, $testClientId, $whmcsPath, $pdo);
}

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
        echo " - {$d} [{$info['user']}] ({$info['status_in_whmcs']}) -> {$info['details']}\n";
    }
}

logMessage("=== Migration Scanner Run Completed ===", $logFile);
