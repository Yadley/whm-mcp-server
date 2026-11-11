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
    // Delete install.completed if previously existing
    $completedDir = __DIR__ . '/install.completed';
    if (is_dir($completedDir)) {
        // remove recursive
        $it = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($completedDir, RecursiveDirectoryIterator::SKIP_DOTS),
            RecursiveIteratorIterator::CHILD_FIRST
        );
        foreach ($it as $file) {
            if ($file->isDir()) rmdir($file->getRealPath());
            else unlink($file->getRealPath());
        }
        rmdir($completedDir);
    }
    $results['rename_install'] = rename($installDir, $completedDir);
} else {
    $results['rename_install'] = 'already_removed';
}

// 2. Clear update locks and disable Maintenance Mode
$stmt = $pdo->prepare("UPDATE tblconfiguration SET value = '' WHERE setting = 'AutoUpdateInProgress'");
$results['clear_auto_update_lock'] = $stmt->execute();

$stmt = $pdo->prepare("UPDATE tblconfiguration SET value = '' WHERE setting = 'MaintenanceMode'");
$results['disable_maintenance'] = $stmt->execute();

// 3. Clear compiled template cache
$templatesC = __DIR__ . '/templates_c';
if (is_dir($templatesC)) {
    $files = glob($templatesC . '/*');
    $clearedCount = 0;
    foreach ($files as $f) {
        if (is_file($f) && basename($f) !== 'index.php') {
            @unlink($f);
            $clearedCount++;
        }
    }
    $results['cleared_templates_c'] = $clearedCount;
}

// 4. Verification
$stmt = $pdo->query("SELECT setting, value FROM tblconfiguration WHERE setting IN ('Version', 'MaintenanceMode', 'AutoUpdateInProgress', 'UpdatesLastChecked')");
$results['verified_config'] = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);

echo json_encode($results, JSON_PRETTY_PRINT);
`;

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'save_file_content',
    dir: 'public_html/clientarea',
    file: 'finalize_911.php',
    content: code
  });

  try {
    const res = await axios.get('https://creativeyadley.com/clientarea/finalize_911.php', {
      httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false })
    });
    console.log('Finalize Result:\n', res.data);
  } finally {
    await w.get('cpanel', {
      cpanel_jsonapi_user: 'creativeyadley',
      cpanel_jsonapi_apiversion: '3',
      cpanel_jsonapi_module: 'Fileman',
      cpanel_jsonapi_func: 'fileop',
      op: 'unlink',
      sourcefiles: 'public_html/clientarea/finalize_911.php'
    });
  }
}

main().catch(console.error);

