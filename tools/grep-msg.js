require('dotenv').config();
const WHMService = require('../src/services/whm.service');
const w = new WHMService();
const axios = require('axios');

async function main() {
  const code = `<?php
header('Content-Type: text/plain');
$descriptors = [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']];
$proc = proc_open('/usr/sbin/exigrep 1xPthH-0000000FwCm-1qo6 /var/log/exim_mainlog 2>&1', $descriptors, $pipes);
if (is_resource($proc)) {
    fclose($pipes[0]);
    echo stream_get_contents($pipes[1]);
    fclose($pipes[1]); fclose($pipes[2]);
    proc_close($proc);
}
`;

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'save_file_content',
    dir: 'public_html/clientarea',
    file: 'grep_mail_msg.php',
    content: code
  });

  try {
    const res = await axios.get('https://creativeyadley.com/clientarea/grep_mail_msg.php', {
      httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }),
      timeout: 10000
    });
    console.log(res.data);
  } finally {
    await w.get('cpanel', {
      cpanel_jsonapi_user: 'creativeyadley',
      cpanel_jsonapi_apiversion: '2',
      cpanel_jsonapi_module: 'Fileman',
      cpanel_jsonapi_func: 'fileop',
      op: 'unlink',
      sourcefiles: 'public_html/clientarea/grep_mail_msg.php'
    });
  }
}
main().catch(console.error);

