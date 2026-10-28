require('dotenv').config();
const WHMService = require('../src/services/whm.service');
const w = new WHMService();
const axios = require('axios');

async function main() {
  const code = `<?php
header('Content-Type: text/plain');
$descriptors = [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']];
$proc = proc_open('/usr/sbin/exim -v -f noreply@creativeyadley.com info@creativeyadley.com', $descriptors, $pipes);
if (is_resource($proc)) {
    fwrite($pipes[0], "From: noreply@creativeyadley.com\\nTo: info@creativeyadley.com\\nSubject: Exim Verbose SMTP Test\\n\\nTest body\\n");
    fclose($pipes[0]);
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
    file: 'test_exim_verbose.php',
    content: code
  });

  const res = await axios.get('https://creativeyadley.com/clientarea/test_exim_verbose.php', {
    httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false })
  });

  console.log(res.data);

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'fileop',
    op: 'unlink',
    sourcefiles: 'public_html/clientarea/test_exim_verbose.php'
  });
}

main().catch(console.error);

