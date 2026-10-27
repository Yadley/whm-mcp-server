require('dotenv').config();
const WHMService = require('../src/services/whm.service');
const w = new WHMService();
const axios = require('axios');

async function main() {
  const testPhp = `<?php
header('Content-Type: application/json');
echo json_encode([
  'disable_functions' => ini_get('disable_functions'),
  'has_shell_exec' => function_exists('shell_exec'),
  'whoami' => trim(@shell_exec('whoami') ?: ''),
  'uname' => trim(@shell_exec('uname -a') ?: '')
]);
`;

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'save_file_content',
    dir: 'public_html/clientarea',
    file: 'exec_test.php',
    content: testPhp
  });

  const res = await axios.get('https://creativeyadley.com/clientarea/exec_test.php', {
    httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false })
  });

  console.log('Server execution capabilities:', res.data);
}

main().catch(console.error);
