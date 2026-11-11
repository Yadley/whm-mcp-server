require('dotenv').config();
const WHMService = require('../src/services/whm.service');
const w = new WHMService();
const axios = require('axios');

async function main() {
  const code = `<?php
header('Content-Type: application/json');
set_time_limit(600);
ini_set('memory_limit', '512M');

try {
    require_once __DIR__ . '/init.php';
    
    $updater = new \\WHMCS\\Installer\\Update\\Updater();
    
    $statusBefore = [
        'is_available' => $updater->isUpdateAvailable(),
        'latest' => $updater->getLatestVersion()->getCasual(),
        'in_progress' => \\WHMCS\\Installer\\Update\\Updater::isAutoUpdateInProgress(),
    ];
    
    // Call performFileUpdate()
    $res = $updater->performFileUpdate();
    
    $statusAfter = [
        'res' => $res,
        'in_progress' => \\WHMCS\\Installer\\Update\\Updater::isAutoUpdateInProgress(),
        'installed_version' => \\App::getVersion()->getCasual()
    ];
    
    echo json_encode(['before' => $statusBefore, 'after' => $statusAfter], JSON_PRETTY_PRINT);
} catch (Throwable $e) {
    echo json_encode([
        'error' => $e->getMessage(),
        'class' => get_class($e),
        'file' => $e->getFile(),
        'line' => $e->getLine(),
        'trace' => explode("\\n", $e->getTraceAsString())
    ], JSON_PRETTY_PRINT);
}
`;

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'save_file_content',
    dir: 'public_html/clientarea',
    file: 'run_file_update.php',
    content: code
  });

  console.log('Script uploaded. Calling performFileUpdate with 180s timeout...');
  try {
    const res = await axios.get('https://creativeyadley.com/clientarea/run_file_update.php', {
      httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }),
      timeout: 180000
    });
    console.log('Result:\n', res.data);
  } catch (err) {
    console.error('Request error:', err.message);
    if (err.response) {
      console.error('Response status:', err.response.status);
      console.error('Response data:', err.response.data);
    }
  } finally {
    await w.get('cpanel', {
      cpanel_jsonapi_user: 'creativeyadley',
      cpanel_jsonapi_apiversion: '3',
      cpanel_jsonapi_module: 'Fileman',
      cpanel_jsonapi_func: 'fileop',
      op: 'unlink',
      sourcefiles: 'public_html/clientarea/run_file_update.php'
    });
  }
}

main().catch(console.error);
