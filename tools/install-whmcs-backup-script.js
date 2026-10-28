require('dotenv').config();
const WHMService = require('../src/services/whm.service');
const w = new WHMService();

async function main() {
  const scriptContent = `<?php
/**
 * WHMCS Automated Database Backup Script
 * Server: server2.creativeyadley.com
 * Account: creativeyadley
 */

$retentionDays = 14; // Keep 14 days of daily backups
$backupDir = '/home/creativeyadley/backups/whmcs_db';
$logFile = $backupDir . '/backup.log';

function logMsg($msg, $file) {
    $entry = "[" . date('Y-m-d H:i:s') . "] " . $msg . "\\n";
    echo $entry;
    @file_put_contents($file, $entry, FILE_APPEND);
}

if (!is_dir($backupDir)) {
    mkdir($backupDir, 0700, true);
}

logMsg("Starting WHMCS Database Backup...", $logFile);

$configPath = '/home/creativeyadley/public_html/clientarea/configuration.php';
if (!file_exists($configPath)) {
    logMsg("ERROR: Configuration file not found at $configPath", $logFile);
    exit(1);
}

require_once $configPath;

if (empty($db_name) || empty($db_username)) {
    logMsg("ERROR: Database credentials missing in configuration.php", $logFile);
    exit(1);
}

$startTime = microtime(true);
$timestamp = date('Ymd_His');
$filename = "whmcs_backup_{$timestamp}.sql.gz";
$targetPath = $backupDir . '/' . $filename;

$cmd = sprintf(
    '/usr/bin/mysqldump --single-transaction --quick --max-allowed-packet=512M -h %s -u %s %s | /usr/bin/gzip -c > %s',
    escapeshellarg($db_host ?: '127.0.0.1'),
    escapeshellarg($db_username),
    escapeshellarg($db_name),
    escapeshellarg($targetPath)
);

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
    logMsg("ERROR: Backup failed with exit code $exitCode. Stderr: $stderr", $logFile);
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
    logMsg("ERROR: Backup file $filename failed integrity check!", $logFile);
    exit(1);
}

$fileSizeMB = round(filesize($targetPath) / 1024 / 1024, 2);
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
logMsg("----------------------------------------------------------------", $logFile);
`;

  console.log('Writing /home/creativeyadley/bin/backup_whmcs_db.php...');
  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'save_file_content',
    dir: 'bin',
    file: 'backup_whmcs_db.php',
    content: scriptContent
  });

  console.log('Script written successfully!');
}

main().catch(console.error);

