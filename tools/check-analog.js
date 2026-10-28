require('dotenv').config();
const WHMService = require('../src/services/whm.service');
const w = new WHMService();
const axios = require('axios');

async function main() {
  const code = `<?php
header('Content-Type: text/plain');
$dir = '/home/creativeyadley/tmp/analog';
$files = @scandir($dir);
echo "Files in $dir: " . count($files) . "\\n";
$samples = array_slice($files, 0, 15);
foreach ($samples as $s) {
    if ($s === '.' || $s === '..') continue;
    echo "$s (" . filesize("$dir/$s") . " bytes)\\n";
}
`;

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'save_file_content',
    dir: 'public_html/clientarea',
    file: 'check_analog.php',
    content: code
  });

  const res = await axios.get('https://creativeyadley.com/clientarea/check_analog.php', {
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
    sourcefiles: 'public_html/clientarea/check_analog.php'
  });
}
main().catch(console.error);

