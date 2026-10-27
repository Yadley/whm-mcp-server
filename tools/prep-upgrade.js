require('dotenv').config();
const WHMService = require('../src/services/whm.service');
const w = new WHMService();
const axios = require('axios');

async function main() {
  const code = `<?php
header('Content-Type: application/json');
$base = __DIR__;

$results = [];

// 1. Ensure admin dir exists
$adminDir = $base . '/admin';
if (!is_dir($adminDir)) {
    $results['mkdir_admin'] = mkdir($adminDir, 0755, true);
} else {
    $results['mkdir_admin'] = 'already_exists';
}

// 2. Put minimal files Softaculous checks for
if (!file_exists($adminDir . '/index.php')) {
    $results['admin_index'] = file_put_contents($adminDir . '/index.php', '<?php // WHMCS Admin');
}
if (!file_exists($base . '/index.php')) {
    $results['base_index'] = file_put_contents($base . '/index.php', '<?php // WHMCS');
}
if (!file_exists($base . '/init.php')) {
    $results['base_init'] = file_put_contents($base . '/init.php', '<?php // WHMCS Init');
}

// Check configuration.php
$results['has_configuration_php'] = file_exists($base . '/configuration.php');
$results['is_admin_dir'] = is_dir($adminDir);

echo json_encode($results, JSON_PRETTY_PRINT);
`;

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'save_file_content',
    dir: 'public_html/clientarea',
    file: 'prep_upgrade.php',
    content: code
  });

  const res = await axios.get('https://creativeyadley.com/clientarea/prep_upgrade.php', {
    httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false })
  });

  console.log('Prep Upgrade Result:', res.data);
}

main().catch(console.error);
