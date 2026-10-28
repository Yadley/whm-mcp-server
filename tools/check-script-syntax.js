require('dotenv').config();
const WHMService = require('../src/services/whm.service');
const w = new WHMService();
const axios = require('axios');

async function main() {
  const code = `<?php
header('Content-Type: text/plain');
$descriptors = [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']];
$proc = proc_open('/usr/local/bin/php -l /home/creativeyadley/bin/scan_migrated_sites.php 2>&1', $descriptors, $pipes);
if (is_resource($proc)) {
    echo stream_get_contents($pipes[1]);
    proc_close($proc);
}
`;

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'save_file_content',
    dir: 'public_html/clientarea',
    file: 'check_syntax.php',
    content: code
  });

  const res = await axios.get('https://creativeyadley.com/clientarea/check_syntax.php', {
    httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false })
  });

  console.log('Syntax check output:', res.data);

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'fileop',
    op: 'unlink',
    sourcefiles: 'public_html/clientarea/check_syntax.php'
  });
}

main().catch(console.error);
