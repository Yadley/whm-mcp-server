require('dotenv').config();
const WHMService = require('../src/services/whm.service');
const w = new WHMService();

async function main() {
  const code = `<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

$info = [
    'php_version' => PHP_VERSION,
    'disable_functions' => ini_get('disable_functions'),
    'has_shell_exec' => function_exists('shell_exec'),
    'has_exec' => function_exists('exec'),
    'has_system' => function_exists('system'),
    'has_passthru' => function_exists('passthru')
];

if (function_exists('shell_exec')) {
    $info['whoami'] = @shell_exec('whoami');
}

echo "<pre>" . print_r($info, true) . "</pre>";
`;

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'save_file_content',
    dir: 'public_html/clientarea',
    file: 'exec_test.php',
    content: code
  });
  console.log('Saved exec_test.php');
}

main().catch(console.error);
