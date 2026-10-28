require('dotenv').config();
const WHMService = require('../src/services/whm.service');
const w = new WHMService();
const axios = require('axios');

async function main() {
  const code = `<?php
header('Content-Type: text/plain');
$dir = '/home/creativeyadley/tmp/analog/ssl/creativeyadley.com';
$files = @scandir($dir);
echo "Count in $dir: " . count($files) . "\\n";
$samples = array_slice($files, 0, 20);
foreach ($samples as $s) {
    if ($s === '.' || $s === '..') continue;
    echo "$s (" . filesize("$dir/$s") . " bytes, modified: " . date("Y-m-d", filemtime("$dir/$s")) . ")\\n";
}
`;

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'save_file_content',
    dir: 'public_html/clientarea',
    file: 'check_analog_details.php',
    content: code
  });

  const res = await axios.get('https://creativeyadley.com/clientarea/check_analog_details.php', {
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
    sourcefiles: 'public_html/clientarea/check_analog_details.php'
  });
}
main().catch(console.error);

