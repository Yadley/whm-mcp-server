require('dotenv').config();
const WHMService = require('../src/services/whm.service');
const w = new WHMService();
const axios = require('axios');

async function main() {
  const code = `<?php
header('Content-Type: text/plain');
$log = __DIR__ . '/error_log';
if (file_exists($log)) {
    $lines = file($log);
    echo implode("", array_slice($lines, -50));
} else {
    echo "No error_log found";
}
`;

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'save_file_content',
    dir: 'public_html/clientarea',
    file: 'tail_log.php',
    content: code
  });

  const res = await axios.get('https://creativeyadley.com/clientarea/tail_log.php', {
    httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false })
  });

  console.log('Error Log Tail:\n', res.data);
}

main().catch(console.error);
