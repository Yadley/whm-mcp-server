require('dotenv').config();
const WHMService = require('../src/services/whm.service');
const w = new WHMService();
const axios = require('axios');

async function main() {
  const code = `<?php
header('Content-Type: application/json');
echo json_encode([
  'has_ioncube' => extension_loaded('ionCube Loader'),
  'ioncube_version' => function_exists('ioncube_loader_version') ? ioncube_loader_version() : 'unknown',
  'ioncube_version_numbers' => function_exists('ioncube_loader_version_numbers') ? ioncube_loader_version_numbers() : null,
  'php_version' => PHP_VERSION
]);
`;

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'save_file_content',
    dir: 'public_html/clientarea',
    file: 'ioncube_check.php',
    content: code
  });

  const res = await axios.get('https://creativeyadley.com/clientarea/ioncube_check.php', {
    httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false })
  });

  console.log('ionCube Check Result:', res.data);
}

main().catch(console.error);
