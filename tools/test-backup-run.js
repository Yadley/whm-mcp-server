require('dotenv').config();
const WHMService = require('../src/services/whm.service');
const w = new WHMService();
const axios = require('axios');

async function main() {
  const code = `<?php
header('Content-Type: text/plain');
ini_set('display_errors', 1);
error_reporting(E_ALL);

require_once __DIR__ . '/configuration.php';

$startTime = microtime(true);
$backupDir = '/home/creativeyadley/backups/whmcs_db';
$outFile = $backupDir . '/test_backup_' . date('Ymd_His') . '.sql.gz';

$cmd = sprintf(
    '/usr/bin/mysqldump --single-transaction --quick --max-allowed-packet=512M -h %s -u %s %s | /usr/bin/gzip -c > %s',
    escapeshellarg($db_host ?: '127.0.0.1'),
    escapeshellarg($db_username),
    escapeshellarg($db_name),
    escapeshellarg($outFile)
);

echo "Running backup command...\\n";
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
if (is_resource($proc)) {
    fclose($pipes[0]);
    $out = stream_get_contents($pipes[1]);
    $err = stream_get_contents($pipes[2]);
    fclose($pipes[1]);
    fclose($pipes[2]);
    $exitCode = proc_close($proc);
    $elapsed = round(microtime(true) - $startTime, 2);
    
    echo "Exit Code: $exitCode\\n";
    echo "Elapsed Time: {$elapsed}s\\n";
    if ($err) echo "Stderr: $err\\n";
    
    if (file_exists($outFile)) {
        $sizeBytes = filesize($outFile);
        $sizeMB = round($sizeBytes / 1024 / 1024, 2);
        echo "Created backup file: $outFile\\n";
        echo "File size: {$sizeMB} MB ({$sizeBytes} bytes)\\n";
    } else {
        echo "File was NOT created\\n";
    }
} else {
    echo "proc_open failed\\n";
}
`;

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'save_file_content',
    dir: 'public_html/clientarea',
    file: 'test_backup_run.php',
    content: code
  });

  console.log('Running test backup...');
  const res = await axios.get('https://creativeyadley.com/clientarea/test_backup_run.php', {
    httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }),
    timeout: 120000
  });

  console.log(res.data);

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'fileop',
    op: 'unlink',
    sourcefiles: 'public_html/clientarea/test_backup_run.php'
  });
}
main().catch(console.error);

