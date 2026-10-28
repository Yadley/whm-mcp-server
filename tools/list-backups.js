require('dotenv').config();
const WHMService = require('../src/services/whm.service');
const w = new WHMService();
const axios = require('axios');

async function main() {
  const code = `<?php
header('Content-Type: text/plain');
$dir = '/home/creativeyadley/backups/whmcs_db';
$files = scandir($dir);
foreach ($files as $f) {
    if ($f === '.' || $f === '..') continue;
    $fp = "$dir/$f";
    echo "$f (" . filesize($fp) . " bytes, modified: " . date("Y-m-d H:i:s", filemtime($fp)) . ")\\n";
}
`;

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'save_file_content',
    dir: 'public_html/clientarea',
    file: 'list_backups.php',
    content: code
  });

  const res = await axios.get('https://creativeyadley.com/clientarea/list_backups.php', {
    httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false })
  });

  console.log(res.data);

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'fileop',
    op: 'unlink',
    sourcefiles: 'public_html/clientarea/list_backups.php'
  });
}

main().catch(console.error);

