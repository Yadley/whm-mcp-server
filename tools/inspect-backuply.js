require('dotenv').config();
const WHMService = require('../src/services/whm.service');
const w = new WHMService();
const axios = require('axios');

async function main() {
  const code = `<?php
ini_set('display_errors', 1);
error_reporting(E_ALL);
header('Content-Type: text/plain');

echo "=== Backuply Details ===\\n";
$dirs = [
    '/var/backuply/conf',
    '/var/backuply/data',
    '/var/backuply/db',
    '/var/backuply/logs',
    '/var/backuply/tasks'
];

foreach ($dirs as $d) {
    echo "--- Dir: $d ---\\n";
    $files = @scandir($d);
    if ($files) {
        foreach ($files as $f) {
            if ($f === '.' || $f === '..') continue;
            $fp = "$d/$f";
            echo "$f (" . filesize($fp) . " bytes)\\n";
            if (!is_dir($fp) && filesize($fp) < 10000) {
                echo file_get_contents($fp) . "\\n";
            }
        }
    } else {
        echo "Could not list $d\\n";
    }
}
`;

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'save_file_content',
    dir: 'public_html/clientarea',
    file: 'backuply_inspect.php',
    content: code
  });

  const res = await axios.get('https://creativeyadley.com/clientarea/backuply_inspect.php', {
    httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false })
  });

  console.log(res.data);

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'fileop',
    op: 'unlink',
    sourcefiles: 'public_html/clientarea/backuply_inspect.php'
  });
}

main().catch(console.error);

