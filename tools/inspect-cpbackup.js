require('dotenv').config();
const WHMService = require('../src/services/whm.service');
const w = new WHMService();
const axios = require('axios');

async function main() {
  const code = `<?php
ini_set('display_errors', 1);
error_reporting(E_ALL);
header('Content-Type: text/plain');

echo "=== Checking /usr/local/cpanel/logs ===\\n";
$dirs = [
    '/usr/local/cpanel/logs',
    '/usr/local/cpanel/logs/cpbackup',
    '/var/cpanel/backups',
    '/etc/cpbackup.conf'
];

foreach ($dirs as $d) {
    echo "--- $d ---\\n";
    if (is_file($d)) {
        echo "FILE (" . filesize($d) . " bytes)\\n";
        echo file_get_contents($d) . "\\n";
    } elseif (is_dir($d)) {
        $files = @scandir($d);
        if ($files) {
            echo "DIR contains: " . implode(', ', array_slice($files, 0, 30)) . "\\n";
        } else {
            echo "DIR not readable (permissions)\\n";
        }
    } else {
        echo "Does not exist or not accessible\\n";
    }
}
`;

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'save_file_content',
    dir: 'public_html/clientarea',
    file: 'cpbackup_inspect.php',
    content: code
  });

  const res = await axios.get('https://creativeyadley.com/clientarea/cpbackup_inspect.php', {
    httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false })
  });

  console.log(res.data);

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'fileop',
    op: 'unlink',
    sourcefiles: 'public_html/clientarea/cpbackup_inspect.php'
  });
}

main().catch(console.error);

