require('dotenv').config();
const WHMService = require('../src/services/whm.service');
const w = new WHMService();
const axios = require('axios');

async function main() {
  const code = `<?php
header('Content-Type: text/plain');

echo "=== Subdirectories and files in /home/creativeyadley/tmp ===\\n";
$descriptors = [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']];
$proc = proc_open("du -h --max-depth=1 /home/creativeyadley/tmp", $descriptors, $pipes);
if (is_resource($proc)) {
    echo stream_get_contents($pipes[1]);
    proc_close($proc);
}

echo "\\n=== Error log tail in /home/creativeyadley/public_html/error_log ===\\n";
$proc2 = proc_open("tail -n 20 /home/creativeyadley/public_html/error_log", $descriptors, $pipes2);
if (is_resource($proc2)) {
    echo stream_get_contents($pipes2[1]);
    proc_close($proc2);
}
`;

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'save_file_content',
    dir: 'public_html/clientarea',
    file: 'check_tmp.php',
    content: code
  });

  const res = await axios.get('https://creativeyadley.com/clientarea/check_tmp.php', {
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
    sourcefiles: 'public_html/clientarea/check_tmp.php'
  });
}
main().catch(console.error);

