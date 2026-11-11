require('dotenv').config();
const WHMService = require('../src/services/whm.service');
const w = new WHMService();
const axios = require('axios');

async function main() {
  const code = `<?php
header('Content-Type: text/plain');
require_once __DIR__ . '/configuration.php';

function runCmd($cmd) {
    $descriptors = [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']];
    $proc = proc_open($cmd, $descriptors, $pipes);
    if (is_resource($proc)) {
        fclose($pipes[0]);
        $out = stream_get_contents($pipes[1]);
        $err = stream_get_contents($pipes[2]);
        fclose($pipes[1]); fclose($pipes[2]);
        $status = proc_close($proc);
        return ['status' => $status, 'out' => trim($out), 'err' => trim($err)];
    }
    return ['status' => -1, 'out' => '', 'err' => 'proc_open failed'];
}

$backupDir = '/home/creativeyadley/backups/whmcs_db';
if (!is_dir($backupDir)) {
    mkdir($backupDir, 0700, true);
}

$destFile = $backupDir . '/pre_update_9.1.1_' . date('Ymd_His') . '.sql.gz';
$cmd = sprintf(
    'mysqldump --no-tablespaces -u %s -p%s -h %s %s | gzip > %s',
    escapeshellarg($db_username),
    escapeshellarg($db_password),
    escapeshellarg($db_host ?: '127.0.0.1'),
    escapeshellarg($db_name),
    escapeshellarg($destFile)
);

$res = runCmd($cmd);
echo "Dump status: " . $res['status'] . "\\n";
echo "Error: " . $res['err'] . "\\n";
if (file_exists($destFile)) {
    echo "Backup created successfully: " . $destFile . " (" . filesize($destFile) . " bytes)\\n";
} else {
    echo "Backup file not found!\\n";
}
`;

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'save_file_content',
    dir: 'public_html/clientarea',
    file: 'take_db_backup.php',
    content: code
  });

  try {
    const res = await axios.get('https://creativeyadley.com/clientarea/take_db_backup.php', {
      httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }),
      timeout: 60000
    });
    console.log(res.data);
  } finally {
    await w.get('cpanel', {
      cpanel_jsonapi_user: 'creativeyadley',
      cpanel_jsonapi_apiversion: '3',
      cpanel_jsonapi_module: 'Fileman',
      cpanel_jsonapi_func: 'fileop',
      op: 'unlink',
      sourcefiles: 'public_html/clientarea/take_db_backup.php'
    });
  }
}

main().catch(console.error);

