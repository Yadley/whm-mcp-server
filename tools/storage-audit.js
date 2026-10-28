require('dotenv').config();
const WHMService = require('../src/services/whm.service');
const w = new WHMService();
const axios = require('axios');

async function main() {
  const code = `<?php
header('Content-Type: text/plain');

echo "=== 1. Checking disk usage of directories in /home/creativeyadley ===\\n";
$targetDirs = [
    '/home/creativeyadley/softaculous_backups',
    '/home/creativeyadley/wordpress-backups',
    '/home/creativeyadley/updater_tmp_dir',
    '/home/creativeyadley/cache',
    '/home/creativeyadley/tmp',
    '/home/creativeyadley/error_log',
    '/home/creativeyadley/public_html/clientarea/templates_c',
    '/home/creativeyadley/public_html/clientarea/downloads',
    '/home/creativeyadley/public_html/clientarea/attachments',
    '/home/creativeyadley/backups/whmcs_db'
];

foreach ($targetDirs as $d) {
    if (file_exists($d)) {
        if (is_file($d)) {
            $bytes = filesize($d);
            $mb = round($bytes / 1024 / 1024, 2);
            echo "$d: FILE {$mb} MB ({$bytes} bytes)\\n";
        } else {
            $descriptors = [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']];
            $proc = proc_open("du -sh " . escapeshellarg($d), $descriptors, $pipes);
            if (is_resource($proc)) {
                $out = trim(stream_get_contents($pipes[1]));
                proc_close($proc);
                echo "$out\\n";
            }
        }
    } else {
        echo "$d: NOT FOUND\\n";
    }
}

echo "\\n=== 2. WHMCS tbllog_register Age Breakdown ===\\n";
require_once __DIR__ . '/configuration.php';
$pdo = new PDO("mysql:host=127.0.0.1;port=3306;dbname=$db_name;charset=utf8mb4", $db_username, $db_password);

$stmt = $pdo->query("SELECT 
    COUNT(CASE WHEN created_at < DATE_SUB(NOW(), INTERVAL 90 DAY) THEN 1 END) as older_than_90d,
    COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY) THEN 1 END) as last_90d,
    COUNT(*) as total
    FROM tbllog_register");
print_r($stmt->fetch(PDO::FETCH_ASSOC));

echo "\\n=== 3. WHMCS tblcarts Breakdown ===\\n";
$stmt2 = $pdo->query("SELECT 
    COUNT(CASE WHEN updated_at < DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 END) as older_than_7d,
    COUNT(CASE WHEN updated_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 END) as last_7d,
    COUNT(*) as total
    FROM tblcarts");
print_r($stmt2->fetch(PDO::FETCH_ASSOC));

echo "\\n=== 4. Checking error_log files in public_html ===\\n";
$errFiles = [
    '/home/creativeyadley/public_html/error_log',
    '/home/creativeyadley/public_html/clientarea/error_log'
];
foreach ($errFiles as $ef) {
    if (file_exists($ef)) {
        $mb = round(filesize($ef) / 1024 / 1024, 2);
        echo "$ef: {$mb} MB\\n";
    } else {
        echo "$ef: none\\n";
    }
}
`;

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'save_file_content',
    dir: 'public_html/clientarea',
    file: 'storage_audit.php',
    content: code
  });

  const res = await axios.get('https://creativeyadley.com/clientarea/storage_audit.php', {
    httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }),
    timeout: 60000
  });

  console.log(res.data);

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'fileop',
    op: 'unlink',
    sourcefiles: 'public_html/clientarea/storage_audit.php'
  });
}
main().catch(console.error);

