require('dotenv').config();
const WHMService = require('../src/services/whm.service');
const w = new WHMService();
const axios = require('axios');

async function main() {
  const code = `<?php
header('Content-Type: text/plain');

echo "=== 1. Checking /etc/cron* for Backuply ===\\n";
$cronDirs = ['/etc/cron.d', '/etc/cron.daily', '/etc/cron.hourly', '/etc/cron.weekly'];
foreach ($cronDirs as $d) {
    if (is_dir($d)) {
        foreach (scandir($d) as $f) {
            if (stripos($f, 'backuply') !== false || stripos($f, 'softaculous') !== false) {
                echo "$d/$f:\\n";
                echo file_get_contents("$d/$f") . "\\n";
            }
        }
    }
}

echo "=== 2. Checking /var/cpanel/apps/ for Backuply ===\\n";
if (is_dir('/var/cpanel/apps')) {
    foreach (scandir('/var/cpanel/apps') as $f) {
        if (stripos($f, 'backuply') !== false) {
            echo "Found app: /var/cpanel/apps/$f\\n";
            echo file_get_contents("/var/cpanel/apps/$f") . "\\n";
        }
    }
}

echo "=== 3. Checking /usr/local/backuply files & scripts ===\\n";
// Let's check if we can read what files exist in /usr/local/backuply or /var/backuply
if (is_dir('/var/backuply')) {
    echo "Files in /var/backuply:\\n";
    print_r(scandir('/var/backuply'));
}

echo "=== 4. Checking Backuply settings or disable flag ===\\n";
$paths = [
    '/var/backuply/settings.json',
    '/var/backuply/conf/settings.json',
    '/var/backuply/conf/backuply.conf',
    '/etc/backuply.conf',
    '/var/softaculous/backuply'
];
foreach ($paths as $p) {
    if (file_exists($p)) {
        echo "Found $p: " . file_get_contents($p) . "\\n";
    }
}
`;

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'save_file_content',
    dir: 'public_html/clientarea',
    file: 'find_backuply.php',
    content: code
  });

  const res = await axios.get('https://creativeyadley.com/clientarea/find_backuply.php', {
    httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false })
  });

  console.log(res.data);

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'fileop',
    op: 'unlink',
    sourcefiles: 'public_html/clientarea/find_backuply.php'
  });
}
main().catch(console.error);

