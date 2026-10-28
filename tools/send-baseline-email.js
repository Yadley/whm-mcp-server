require('dotenv').config();
const WHMService = require('../src/services/whm.service');
const w = new WHMService();
const axios = require('axios');

async function main() {
  console.log('Sending live baseline email to info@creativeyadley.com with SPF-aligned sender...');
  
  const runnerCode = `<?php
header('Content-Type: text/plain');
$descriptors = [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']];
$proc = proc_open('/usr/local/bin/php /home/creativeyadley/bin/scan_migrated_sites.php --notify-only', $descriptors, $pipes);
if (is_resource($proc)) {
    echo stream_get_contents($pipes[1]);
    echo stream_get_contents($pipes[2]);
    proc_close($proc);
}
`;

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'save_file_content',
    dir: 'public_html/clientarea',
    file: 'send_baseline_email.php',
    content: runnerCode
  });

  const res = await axios.get('https://creativeyadley.com/clientarea/send_baseline_email.php', {
    timeout: 120000,
    httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false })
  });

  console.log(res.data);

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'fileop',
    op: 'unlink',
    sourcefiles: 'public_html/clientarea/send_baseline_email.php'
  });

  console.log('Baseline email dispatched successfully!');
}

main().catch(console.error);

