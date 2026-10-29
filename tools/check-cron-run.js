require('dotenv').config();
const WHMService = require('../src/services/whm.service');
const w = new WHMService();
const axios = require('axios');

async function main() {
  const code = `<?php
header('Content-Type: text/plain');

echo "=== 1. Backups in /home/creativeyadley/backups/whmcs_db ===\\n";
$dir = '/home/creativeyadley/backups/whmcs_db';
if (is_dir($dir)) {
    foreach (scandir($dir) as $f) {
        if ($f === '.' || $f === '..') continue;
        $fp = "$dir/$f";
        echo "$f (" . filesize($fp) . " bytes, modified: " . date("Y-m-d H:i:s", filemtime($fp)) . ")\\n";
    }
}

echo "\\n=== 2. backup.log ===\\n";
$log = "$dir/backup.log";
if (file_exists($log)) {
    echo file_get_contents($log);
} else {
    echo "backup.log not found\\n";
}

echo "\\n=== 3. cron.log ===\\n";
$cronLog = "$dir/cron.log";
if (file_exists($cronLog)) {
    echo file_get_contents($cronLog);
} else {
    echo "cron.log not found\\n";
}

echo "\\n=== 4. Recent tblactivitylog around 02:00 UTC today ===\\n";
require_once __DIR__ . '/configuration.php';
$pdo = new PDO("mysql:host=127.0.0.1;port=3306;dbname=$db_name;charset=utf8mb4", $db_username, $db_password);
$stmt = $pdo->query("SELECT date, description, user FROM tblactivitylog WHERE date >= '2026-10-29 00:00:00' ORDER BY id ASC");
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
if (empty($rows)) {
    echo "No activity log entries for today yet.\\n";
} else {
    foreach ($rows as $r) {
        echo "[{$r['date']}] {$r['description']} ({$r['user']})\\n";
    }
}

echo "\\n=== 5. Current cPanel Cron List ===\\n";
`;

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'save_file_content',
    dir: 'public_html/clientarea',
    file: 'check_cron_run.php',
    content: code
  });

  const res = await axios.get('https://creativeyadley.com/clientarea/check_cron_run.php', {
    httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false })
  });

  console.log(res.data);

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'fileop',
    op: 'unlink',
    sourcefiles: 'public_html/clientarea/check_cron_run.php'
  });
}
main().catch(console.error);

