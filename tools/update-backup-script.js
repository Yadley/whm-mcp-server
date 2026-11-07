require('dotenv').config();
const WHMService = require('../src/services/whm.service');
const w = new WHMService();

async function main() {
  const scriptContent = `<?php
/**
 * WHMCS Automated Database Backup & Email Notification Script
 * Server: server2.creativeyadley.com
 * Account: creativeyadley
 * 
 * Standardized to Creative Yadley Email Design System 1.0 / Design System v2.3.0
 */

$retentionDays = 14; // Keep 14 days of daily backups
$backupDir = '/home/creativeyadley/backups/whmcs_db';
$logFile = $backupDir . '/backup.log';
$notifyEmail = 'info@creativeyadley.com';

umask(0077);

$options = getopt("", ["dry-run", "test-client::"]);
$isDryRun = isset($options['dry-run']);
$testClientId = isset($options['test-client']) ? intval($options['test-client']) : null;

function logMsg($msg, $file) {
    $entry = "[" . date('Y-m-d H:i:s') . "] " . $msg . "\\n";
    echo $entry;
    @file_put_contents($file, $entry, FILE_APPEND);
}

if (!is_dir($backupDir)) {
    mkdir($backupDir, 0700, true);
}
chmod($backupDir, 0700);

logMsg("Starting WHMCS Database Backup...", $logFile);

$whmcsPath = '/home/creativeyadley/public_html/clientarea';
$configPath = $whmcsPath . '/configuration.php';
if (!file_exists($configPath)) {
    logMsg("ERROR: Configuration file not found at $configPath", $logFile);
    exit(1);
}

require_once $configPath;

if (empty($db_name) || empty($db_username)) {
    logMsg("ERROR: Database credentials missing in configuration.php", $logFile);
    exit(1);
}

/**
 * Creative Yadley Email Design System 1.0 - Internal Admin Email Renderer
 * Generates an internal content-only fragment (no hero, no logo, no client footer)
 * wrapped in a standard 600px shell on #ECEEE9 canvas with 40px/24px padding.
 */
function buildBrandedInternalEmail($spec) {
    $cInk = '#08090B';
    $cBody = '#434745';
    $cMuted = '#5E6463';
    $cHair = '#D2D6D0';
    $cPanel = '#F4F5F2';
    $cPage = '#ECEEE9';
    $cLime = '#AFE139';
    $cLimeInk = '#0B0D0E';
    $cWhite = '#FFFFFF';

    $fDisplay = "'Plus Jakarta Sans','Segoe UI',Roboto,Helvetica,Arial,sans-serif";
    $fSans = "'Nunito Sans','Segoe UI',Roboto,Helvetica,Arial,sans-serif";
    $fMono = "'JetBrains Mono',Consolas,'Courier New',monospace";

    $eyebrow = htmlspecialchars($spec['eyebrow'] ?? 'DATABASE BACKUP', ENT_QUOTES, 'UTF-8');
    $title = htmlspecialchars($spec['title'] ?? 'WHMCS Database Backup Completed', ENT_QUOTES, 'UTF-8');
    $lead = htmlspecialchars($spec['lead'] ?? '', ENT_QUOTES, 'UTF-8');
    $ctaLabel = htmlspecialchars($spec['ctaLabel'] ?? 'Download Database Backup', ENT_QUOTES, 'UTF-8');
    $ctaUrl = htmlspecialchars($spec['ctaUrl'] ?? '', ENT_QUOTES, 'UTF-8');
    $footerNote = htmlspecialchars($spec['footerNote'] ?? 'Internal studio notification. Not a client message.', ENT_QUOTES, 'UTF-8');

    $detailRows = '';
    if (!empty($spec['details'])) {
        foreach ($spec['details'] as $row) {
            $label = htmlspecialchars($row[0], ENT_QUOTES, 'UTF-8');
            $val = $row[1]; // Allowed to have HTML badges
            $isMono = !empty($row[2]);
            $font = $isMono ? "font-family:{$fMono};font-size:14px;" : "font-family:{$fSans};font-size:15px;";
            $detailRows .= "<tr>
                <td class='cy-dl' width='38%' valign='top' style='padding:12px 16px 12px 0;border-bottom:1px solid {$cHair};font-family:{$fSans};font-size:14px;line-height:1.45;color:{$cMuted};'>{$label}</td>
                <td class='cy-dv' valign='top' style='padding:12px 0;border-bottom:1px solid {$cHair};{$font}line-height:1.45;font-weight:600;color:{$cInk};'>{$val}</td>
            </tr>";
        }
    }

    $detailsBlock = '';
    if ($detailRows !== '') {
        $detailsBlock = "<table role='presentation' width='100%' cellpadding='0' cellspacing='0' border='0' style='margin:6px 0 24px;background:{$cPanel};border:1px solid {$cHair};border-radius:14px;border-collapse:separate;border-spacing:0;'>
            <tr><td style='padding:6px 20px;'><table role='presentation' width='100%' cellpadding='0' cellspacing='0' border='0'>{$detailRows}</table></td></tr>
        </table>";
    }

    $noteBlock = '';
    if (!empty($spec['note'])) {
        $nLabel = htmlspecialchars($spec['note']['label'] ?? 'NOTE', ENT_QUOTES, 'UTF-8');
        $nText = htmlspecialchars($spec['note']['text'] ?? '', ENT_QUOTES, 'UTF-8');
        $noteBlock = "<table role='presentation' width='100%' cellpadding='0' cellspacing='0' border='0' style='margin:0 0 24px;background:{$cPanel};border:1px solid {$cHair};border-radius:14px;border-collapse:separate;border-spacing:0;'>
            <tr><td style='padding:18px 20px;'>
                <p style='margin:0 0 6px;font-family:{$fDisplay};font-size:12px;line-height:1.4;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:{$cMuted};'>{$nLabel}</p>
                <p style='margin:0;font-family:{$fSans};font-size:14px;line-height:1.6;color:{$cBody};'>{$nText}</p>
            </td></tr>
        </table>";
    }

    $ctaBlock = '';
    if ($ctaLabel !== '' && $ctaUrl !== '') {
        $ctaBlock = "<table role='presentation' width='100%' cellpadding='0' cellspacing='0' border='0'>
            <tr><td height='24' style='height:24px;line-height:24px;font-size:0;'>&nbsp;</td></tr>
            <tr>
                <td align='left'>
                    <!--[if mso]>
                    <v:roundrect xmlns:v='urn:schemas-microsoft-com:vml' xmlns:w='urn:schemas-microsoft-com:office:word' href='{$ctaUrl}' style='height:54px;v-text-anchor:middle;width:280px;' arcsize='50%' fillcolor='{$cLime}' stroke='f'>
                        <w:anchorlock/>
                        <center style='color:{$cLimeInk};font-family:Arial,sans-serif;font-size:16px;font-weight:bold;'>{$ctaLabel}</center>
                    </v:roundrect>
                    <![endif]-->
                    <!--[if !mso]><!-->
                    <a href='{$ctaUrl}' class='cy-btn' style='display:inline-block;padding:18px 34px;font-family:{$fDisplay};font-size:16px;line-height:1;font-weight:700;color:{$cLimeInk};background:{$cLime};border:1px solid {$cLime};text-decoration:none;border-radius:999px;'>{$ctaLabel}</a>
                    <!--<![endif]-->
                </td>
            </tr>
            <tr><td height='28' style='height:28px;line-height:28px;font-size:0;'>&nbsp;</td></tr>
        </table>";
    }

    return "<!doctype html>
<html xmlns='http://www.w3.org/1999/xhtml' xmlns:v='urn:schemas-microsoft-com:vml' xmlns:o='urn:schemas-microsoft-com:office:office' lang='en' dir='ltr'>
<head>
<meta charset='utf-8'>
<meta name='viewport' content='width=device-width,initial-scale=1'>
<meta name='color-scheme' content='light'>
<meta name='supported-color-schemes' content='light'>
<title>{$title}</title>
<style type='text/css'>
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&family=Nunito+Sans:wght@400;600;700&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap');
  html,body{margin:0!important;padding:0!important;width:100%!important;}
  table{border-collapse:collapse;}
  img{-ms-interpolation-mode:bicubic;}
  a{text-decoration:none;}
  @media only screen and (max-width:620px){
    .cy-shell{width:100%!important;}
    .cy-px{padding-left:24px!important;padding-right:24px!important;}
    .cy-h1{font-size:22px!important;line-height:1.25!important;}
    .cy-dl,.cy-dv{display:block!important;width:auto!important;padding:0 0 2px!important;border-bottom:none!important;}
    .cy-dl{padding-top:10px!important;}
    .cy-dv{padding-bottom:10px!important;border-bottom:1px solid {$cHair}!important;}
    .cy-btn{display:block!important;text-align:center!important;padding:18px 24px!important;}
  }
</style>
</head>
<body style='margin:0;padding:0;background:{$cPage};-webkit-text-size-adjust:100%;'>
<div style='display:none;font-size:1px;color:{$cPage};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;'>{$title}</div>
<table role='presentation' width='100%' cellpadding='0' cellspacing='0' border='0' bgcolor='{$cPage}' style='background:{$cPage};'>
  <tr>
    <td align='center' style='padding:24px 12px;'>
      <table role='presentation' width='600' cellpadding='0' cellspacing='0' border='0' class='cy-shell' style='width:600px;max-width:600px;background:{$cWhite};border-radius:16px;overflow:hidden;'>
        <!-- Internal Admin Content-Only Fragment: No Hero, No Logo, No Footer -->
        <tr>
          <td class='cy-px' bgcolor='{$cWhite}' style='background:{$cWhite};padding:40px 40px 32px;'>
            <p style='margin:0 0 10px;font-family:{$fDisplay};font-size:12px;line-height:1.4;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:{$cMuted};'>{$eyebrow}</p>
            <h1 class='cy-h1' style='margin:0 0 14px;font-family:{$fDisplay};font-size:24px;line-height:1.22;letter-spacing:-0.4px;font-weight:700;color:{$cInk};'>{$title}</h1>
            " . ($lead !== '' ? "<p style='margin:0 0 20px;font-family:{$fSans};font-size:15px;line-height:1.55;color:{$cBody};'>{$lead}</p>" : "") . "
            {$detailsBlock}
            {$noteBlock}
            {$ctaBlock}
            <p style='margin:20px 0 0;font-family:{$fSans};font-size:12px;line-height:1.6;color:{$cMuted};border-top:1px solid {$cHair};padding-top:16px;'>
              {$footerNote} &middot; <a href='https://creativeyadley.com/clientarea/admin/' style='color:{$cMuted};text-decoration:underline;'>Admin Area</a> &middot; server2.creativeyadley.com
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>";
}

$startTime = microtime(true);
$timestamp = date('Ymd_His');
$dateStr = date('Y-m-d');
$dtUtc = new DateTime('now', new DateTimeZone('UTC'));
$timeUTC = $dtUtc->format('Y-m-d H:i:s T');
$dtPht = new DateTime('now', new DateTimeZone('Asia/Manila'));
$timePHT = $dtPht->format('Y-m-d H:i:s T');
$filename = "whmcs_backup_{$timestamp}.sql.gz";
$targetPath = $backupDir . '/' . $filename;

$pipeline = sprintf(
    '/usr/bin/mysqldump --single-transaction --quick --max-allowed-packet=512M -h %s -u %s %s | /usr/bin/gzip -c > %s',
    escapeshellarg($db_host ?: '127.0.0.1'),
    escapeshellarg($db_username),
    escapeshellarg($db_name),
    escapeshellarg($targetPath)
);
$cmd = '/bin/bash -o pipefail -c ' . escapeshellarg($pipeline);

$descriptors = [
    0 => ['pipe', 'r'],
    1 => ['pipe', 'w'],
    2 => ['pipe', 'w']
];

$env = [
    'MYSQL_PWD' => $db_password,
    'PATH' => '/usr/bin:/bin'
];

$proc = proc_open($cmd, $descriptors, $pipes, null, $env);
if (!is_resource($proc)) {
    logMsg("ERROR: Failed to launch mysqldump process.", $logFile);
    $failHtml = buildBrandedInternalEmail([
        'eyebrow' => 'DATABASE BACKUP ALERT',
        'title' => 'WHMCS Database Backup Failed',
        'lead' => 'Failed to launch mysqldump process on server2.creativeyadley.com.',
        'details' => [
            ['Status', '<span style="color:#991B1B;background:#FEE2E2;padding:3px 8px;border-radius:4px;font-size:12px;font-weight:700;">FAILED</span>'],
            ['Server', 'server2.creativeyadley.com'],
            ['Database', $db_name],
            ['Timestamp (UTC)', $timeUTC],
        ],
        'ctaLabel' => 'Inspect Server Logs',
        'ctaUrl' => 'https://creativeyadley.com/clientarea/admin/systemactivitylog.php'
    ]);
    $headers = "From: WHMCS Backup System <noreply@creativeyadley.com>\\r\\nReply-To: {$notifyEmail}\\r\\nMIME-Version: 1.0\\r\\nContent-Type: text/html; charset=UTF-8";
    @mail($notifyEmail, "[Backup FAILED] WHMCS Database Backup - $dateStr", $failHtml, $headers, "-f noreply@creativeyadley.com");
    exit(1);
}

fclose($pipes[0]);
$stdout = stream_get_contents($pipes[1]);
$stderr = stream_get_contents($pipes[2]);
fclose($pipes[1]);
fclose($pipes[2]);
$exitCode = proc_close($proc);
$duration = round(microtime(true) - $startTime, 2);

if ($exitCode !== 0 || !file_exists($targetPath) || filesize($targetPath) === 0) {
    if (file_exists($targetPath)) {
        @unlink($targetPath);
    }
    logMsg("ERROR: Backup failed with exit code $exitCode. Stderr: $stderr", $logFile);
    $failHtml = buildBrandedInternalEmail([
        'eyebrow' => 'DATABASE BACKUP ALERT',
        'title' => 'WHMCS Database Backup Failed',
        'lead' => "Backup process terminated with exit code {$exitCode}. Stderr output: " . htmlspecialchars($stderr),
        'details' => [
            ['Status', '<span style="color:#991B1B;background:#FEE2E2;padding:3px 8px;border-radius:4px;font-size:12px;font-weight:700;">FAILED (Exit Code ' . $exitCode . ')</span>'],
            ['Database', $db_name],
            ['Timestamp (UTC)', $timeUTC],
            ['Stderr', htmlspecialchars($stderr) ?: 'None']
        ],
        'ctaLabel' => 'Inspect Server Logs',
        'ctaUrl' => 'https://creativeyadley.com/clientarea/admin/systemactivitylog.php'
    ]);
    $headers = "From: WHMCS Backup System <noreply@creativeyadley.com>\\r\\nReply-To: {$notifyEmail}\\r\\nMIME-Version: 1.0\\r\\nContent-Type: text/html; charset=UTF-8";
    @mail($notifyEmail, "[Backup FAILED] WHMCS Database Backup - $dateStr", $failHtml, $headers, "-f noreply@creativeyadley.com");
    exit(1);
}

// Verify gzip integrity
$testProc = proc_open("/usr/bin/gzip -t " . escapeshellarg($targetPath), $descriptors, $testPipes);
$testCode = -1;
if (is_resource($testProc)) {
    fclose($testPipes[0]);
    fclose($testPipes[1]);
    fclose($testPipes[2]);
    $testCode = proc_close($testProc);
}

if ($testCode !== 0) {
    if (file_exists($targetPath)) {
        @unlink($targetPath);
    }
    logMsg("ERROR: Backup file $filename failed integrity check!", $logFile);
    $failHtml = buildBrandedInternalEmail([
        'eyebrow' => 'DATABASE BACKUP ALERT',
        'title' => 'WHMCS Database Backup Failed Integrity Check',
        'lead' => "Backup file {$filename} failed gzip integrity test with code {$testCode}.",
        'details' => [
            ['Status', '<span style="color:#991B1B;background:#FEE2E2;padding:3px 8px;border-radius:4px;font-size:12px;font-weight:700;">INTEGRITY FAILED</span>'],
            ['Backup Archive', $filename, true],
            ['Database', $db_name],
            ['Timestamp (UTC)', $timeUTC],
        ],
        'ctaLabel' => 'Inspect Server Logs',
        'ctaUrl' => 'https://creativeyadley.com/clientarea/admin/systemactivitylog.php'
    ]);
    $headers = "From: WHMCS Backup System <noreply@creativeyadley.com>\\r\\nReply-To: {$notifyEmail}\\r\\nMIME-Version: 1.0\\r\\nContent-Type: text/html; charset=UTF-8";
    @mail($notifyEmail, "[Backup FAILED] WHMCS Database Backup - $dateStr", $failHtml, $headers, "-f noreply@creativeyadley.com");
    exit(1);
}

$fileSizeBytes = filesize($targetPath);
$fileSizeMB = round($fileSizeBytes / 1024 / 1024, 2);
$successMsg = "SUCCESS: Backup created: $filename ({$fileSizeMB} MB in {$duration}s)";
logMsg($successMsg, $logFile);

// Log to WHMCS tblactivitylog
try {
    $pdo = new PDO("mysql:host=127.0.0.1;port=3306;dbname=$db_name;charset=utf8mb4", $db_username, $db_password);
    $stmt = $pdo->prepare("INSERT INTO tblactivitylog (date, description, user, userid, ipaddr) VALUES (NOW(), :desc, 'System Backup', 0, '127.0.0.1')");
    $stmt->execute([':desc' => "Automated Database Backup: $filename ({$fileSizeMB} MB in {$duration}s)"]);
} catch (Throwable $e) {
    logMsg("Notice: Could not log to tblactivitylog: " . $e->getMessage(), $logFile);
}

// Retention Pruning: Delete backups older than $retentionDays
$prunedCount = 0;
$now = time();
$cutoff = $now - ($retentionDays * 86400);

$files = scandir($backupDir);
foreach ($files as $f) {
    if (strpos($f, 'whmcs_backup_') === 0 && substr($f, -7) === '.sql.gz') {
        $fp = $backupDir . '/' . $f;
        if (filemtime($fp) < $cutoff) {
            @unlink($fp);
            $prunedCount++;
            logMsg("Pruned old backup: $f", $logFile);
        }
    }
}
logMsg("Retention check complete. Pruned $prunedCount old backup(s).", $logFile);

// Generate secure 1-click download link
if (empty($cc_encryption_hash)) {
    logMsg("ERROR: cc_encryption_hash missing in configuration.php", $logFile);
    exit(1);
}
$secret = $cc_encryption_hash;
$token = hash_hmac('sha256', $filename, $secret);
$systemUrl = rtrim($SystemURL ?? 'https://creativeyadley.com/clientarea', '/') . '/';
$downloadUrl = $systemUrl . "get_db_backup.php?file=" . urlencode($filename) . "&token=" . $token;

// Build Branded Email Notification
$emailSubject = "[Backup Success] WHMCS Database Backup ({$fileSizeMB} MB) - $dateStr";
$emailHtml = buildBrandedInternalEmail([
    'eyebrow' => 'DATABASE BACKUP',
    'title' => 'WHMCS Database Backup Completed',
    'lead' => 'The daily automated WHMCS database backup for server2.creativeyadley.com completed successfully with verified gzip archive integrity.',
    'details' => [
        ['Status', '<span style="color:#166534;background:#DCFCE7;padding:3px 8px;border-radius:4px;font-size:12px;font-weight:700;">Verified (Gzip Test Passed)</span>'],
        ['Database', "{$db_name} (Optimized)"],
        ['Backup Archive', $filename, true],
        ['Archive Size', "{$fileSizeMB} MB (" . number_format($fileSizeBytes) . " bytes)"],
        ['Generation Time', "{$duration} seconds"],
        ['Timestamp (UTC)', $timeUTC],
        ['Timestamp (PHT)', $timePHT],
        ['Retention Policy', "{$retentionDays} rolling days ({$prunedCount} old backup(s) pruned)"],
    ],
    'note' => [
        'label' => 'SECURE DIRECT DOWNLOAD',
        'text' => 'This direct download link is cryptographically authenticated with your WHMCS security hash. Click below to download the compressed database dump directly to your workstation.'
    ],
    'ctaLabel' => 'Download Database Backup',
    'ctaUrl' => $downloadUrl,
    'footerNote' => 'Internal studio backup automation. Not a client message.'
]);

$emailHeaders = "From: WHMCS Backup System <noreply@creativeyadley.com>\\r\\n" .
    "Reply-To: {$notifyEmail}\\r\\n" .
    "MIME-Version: 1.0\\r\\n" .
    "Content-Type: text/html; charset=UTF-8\\r\\n" .
    "X-Mailer: CreativeYadley-BackupSystem/2.3.0";

if ($testClientId) {
    logMsg("Dispatching test backup notification for Client #{$testClientId}...", $logFile);
    if (file_exists($whmcsPath . '/init.php')) {
        require_once $whmcsPath . '/init.php';
        if (function_exists('localAPI')) {
            $apiRes = localAPI('SendEmail', [
                'id' => $testClientId,
                'customtype' => 'general',
                'customsubject' => $emailSubject,
                'custommessage' => '{literal}' . $emailHtml . '{/literal}'
            ]);
            logMsg("localAPI SendEmail result: " . json_encode($apiRes), $logFile);
        }
    }
    // Also record in mod_cy_studio_automations if table exists
    try {
        if (!isset($pdo)) {
            $pdo = new PDO("mysql:host=127.0.0.1;port=3306;dbname=$db_name;charset=utf8mb4", $db_username, $db_password);
        }
        $cStmt = $pdo->prepare("SELECT email FROM tblclients WHERE id = :id");
        $cStmt->execute([':id' => $testClientId]);
        $clientEmail = $cStmt->fetchColumn() ?: 'tinasheyadley@outlook.com';
        
        $aStmt = $pdo->prepare("INSERT INTO mod_cy_studio_automations (booking_code, recipient_email, template_filename, template_label, status, created_at) VALUES (:code, :email, 'server-backup-notification', 'WHMCS Database Backup Notification', 'Sent', NOW())");
        $aStmt->execute([
            ':code' => "BKUP-" . substr(md5($filename), 0, 10),
            ':email' => $clientEmail
        ]);
        logMsg("Logged to mod_cy_studio_automations successfully.", $logFile);
    } catch (Throwable $e) {
        logMsg("Notice: mod_cy_studio_automations logging error: " . $e->getMessage(), $logFile);
    }
} else {
    $mailSent = @mail($notifyEmail, $emailSubject, $emailHtml, $emailHeaders, "-f noreply@creativeyadley.com");
    if ($mailSent) {
        logMsg("Notification email delivered to $notifyEmail", $logFile);
    } else {
        logMsg("WARNING: Failed to deliver notification email to $notifyEmail", $logFile);
    }
}

logMsg("----------------------------------------------------------------", $logFile);
`;

  console.log('Deploying updated backup script to /home/creativeyadley/bin/backup_whmcs_db.php...');
  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'save_file_content',
    dir: 'bin',
    file: 'backup_whmcs_db.php',
    content: scriptContent
  });

  console.log('Successfully deployed /home/creativeyadley/bin/backup_whmcs_db.php with Design System v2.3.0 email layout!');
}

main().catch(console.error);
