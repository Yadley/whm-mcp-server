require('dotenv').config();
const WHMService = require('../src/services/whm.service');
const w = new WHMService();
const axios = require('axios');

async function main() {
  const code = `<?php
header('Content-Type: application/json');

function rmrf($dir) {
    if (!is_dir($dir)) return false;
    $it = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($dir, RecursiveDirectoryIterator::SKIP_DOTS),
        RecursiveIteratorIterator::CHILD_FIRST
    );
    foreach ($it as $file) {
        if ($file->isDir()) rmdir($file->getRealPath());
        else unlink($file->getRealPath());
    }
    return rmdir($dir);
}

$installCompleted = __DIR__ . '/install.completed';
$removed = false;
if (is_dir($installCompleted)) {
    $removed = rmrf($installCompleted);
}

echo json_encode([
    'install_completed_removed' => $removed,
    'install_exists' => is_dir(__DIR__ . '/install'),
    'install_completed_exists' => is_dir($installCompleted)
]);
`;

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'save_file_content',
    dir: 'public_html/clientarea',
    file: 'cleanup_install.php',
    content: code
  });

  try {
    const res = await axios.get('https://creativeyadley.com/clientarea/cleanup_install.php', {
      httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }),
      timeout: 15000
    });
    console.log('Cleanup result:', res.data);
  } finally {
    await w.get('cpanel', {
      cpanel_jsonapi_user: 'creativeyadley',
      cpanel_jsonapi_apiversion: '3',
      cpanel_jsonapi_module: 'Fileman',
      cpanel_jsonapi_func: 'fileop',
      op: 'unlink',
      sourcefiles: 'public_html/clientarea/cleanup_install.php'
    });
  }
}

main().catch(console.error);
