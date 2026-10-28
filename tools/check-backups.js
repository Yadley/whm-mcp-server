require('dotenv').config();
const WHMService = require('../src/services/whm.service');
const w = new WHMService();
const axios = require('axios');

async function main() {
  const code = `<?php
ini_set('display_errors', 1);
error_reporting(E_ALL);
header('Content-Type: text/plain');

echo "=== 1. WHMCS Logs around 2026-10-27 17:04 ===\\n";
require_once __DIR__ . '/configuration.php';
$pdo = new PDO("mysql:host=127.0.0.1;port=3306;dbname=$db_name;charset=utf8mb4", $db_username, $db_password);
$stmt = $pdo->query("SELECT id, date, description, user FROM tblactivitylog WHERE date BETWEEN '2026-10-27 17:00:00' AND '2026-10-27 17:10:00' ORDER BY id ASC");
foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
    echo "[{$row['date']}] {$row['description']} ({$row['user']})\\n";
}

echo "\\n=== 2. Backuply Detailed Directory Check (/var/backuply) ===\\n";
$bSubDirs = ['conf', 'data', 'db', 'logs', 'tasks', 'backups'];
foreach ($bSubDirs as $sd) {
    $path = "/var/backuply/$sd";
    echo "--- $path ---\\n";
    if (is_dir($path)) {
        $files = @scandir($path);
        if ($files) {
            foreach ($files as $f) {
                if ($f === '.' || $f === '..') continue;
                $fpath = "$path/$f";
                $type = is_dir($fpath) ? "DIR" : "FILE (" . filesize($fpath) . " bytes)";
                echo "  $f: $type\\n";
                // If it's a small file or json/conf/log, print it
                if (!is_dir($fpath) && filesize($fpath) < 5000) {
                    echo "    Content: " . str_replace("\\n", "\\n    ", trim(@file_get_contents($fpath))) . "\\n";
                }
            }
        } else {
            echo "  Cannot read directory (permission denied)\\n";
        }
    }
}

echo "\\n=== 3. WHM native /backup directory check ===\\n";
if (is_dir('/backup')) {
    $bfiles = @scandir('/backup');
    echo "Files in /backup:\\n";
    print_r($bfiles);
} else {
    echo "/backup is not a readable directory\\n";
}

echo "\\n=== 4. Cron table for root & system ===\\n";
// Let's check /etc/cron* if readable
$cronDirs = ['/etc/cron.d', '/etc/cron.daily', '/etc/cron.hourly', '/var/spool/cron'];
foreach ($cronDirs as $cd) {
    echo "--- $cd ---\\n";
    $files = @scandir($cd);
    if ($files) {
        foreach ($files as $f) {
            if ($f === '.' || $f === '..') continue;
            echo "  $f\\n";
            if ($cd === '/etc/cron.d' && is_file("$cd/$f")) {
                echo "    " . str_replace("\\n", "\\n    ", trim(@file_get_contents("$cd/$f"))) . "\\n";
            }
        }
    } else {
        echo "  Cannot read\\n";
    }
}
`;

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'save_file_content',
    dir: 'public_html/clientarea',
    file: 'backup_diag3.php',
    content: code
  });

  const res = await axios.get('https://creativeyadley.com/clientarea/backup_diag3.php', {
    httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false })
  });

  console.log(res.data);

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'fileop',
    op: 'unlink',
    sourcefiles: 'public_html/clientarea/backup_diag3.php'
  });
}

main().catch(console.error);

