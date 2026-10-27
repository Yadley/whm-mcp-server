require('dotenv').config();
const WHMService = require('../src/services/whm.service');
const w = new WHMService();
const axios = require('axios');

async function main() {
  const code = `<?php
require_once __DIR__ . '/configuration.php';
$pdo = new PDO("mysql:host=127.0.0.1;port=3306;dbname=$db_name;charset=utf8mb4", $db_username, $db_password);

$results = [];

// 1. Rename or delete install folder
$installDir = __DIR__ . '/install';
if (is_dir($installDir)) {
    $results['rename_install'] = rename($installDir, __DIR__ . '/install.completed');
} else {
    $results['rename_install'] = 'already_removed';
}

// 2. Check and disable Maintenance Mode
$stmt = $pdo->prepare("UPDATE tblconfiguration SET value = '' WHERE setting = 'MaintenanceMode'");
$results['disable_maintenance'] = $stmt->execute();

// 3. Clear compiled template cache
$templatesC = __DIR__ . '/templates_c';
if (is_dir($templatesC)) {
    $files = glob($templatesC . '/*');
    foreach ($files as $f) {
        if (is_file($f) && basename($f) !== 'index.php') {
            @unlink($f);
        }
    }
    $results['cleared_templates_c'] = true;
}

echo json_encode($results, JSON_PRETTY_PRINT);
`;

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'save_file_content',
    dir: 'public_html/clientarea',
    file: 'finalize.php',
    content: code
  });

  const res = await axios.get('https://creativeyadley.com/clientarea/finalize.php', {
    httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false })
  });

  console.log('Finalize Result:', res.data);
}

main().catch(console.error);
