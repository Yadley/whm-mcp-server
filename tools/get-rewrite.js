require('dotenv').config();
const WHMService = require('../src/services/whm.service');
const w = new WHMService();
const axios = require('axios');

async function main() {
  const code = `<?php
require_once __DIR__ . '/init.php';

try {
    $rewrite = new \\WHMCS\\Utility\\Environment\\Rewrite();
    echo "--- RULES ---\n";
    echo $rewrite->getRewriteRules();
    echo "\n--- END ---\n";
} catch (Throwable $e) {
    echo "Error: " . $e->getMessage();
}
`;

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'save_file_content',
    dir: 'public_html/clientarea',
    file: 'get_rewrite.php',
    content: code
  });

  const res = await axios.get('https://creativeyadley.com/clientarea/get_rewrite.php', {
    httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false })
  });

  console.log('WHMCS Generated Rules:\n', res.data);
}

main().catch(console.error);
