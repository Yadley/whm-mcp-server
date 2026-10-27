require('dotenv').config();
const WHMService = require('../src/services/whm.service');
const w = new WHMService();
const axios = require('axios');

async function main() {
  const code = `<?php
require_once __DIR__ . '/init.php';

try {
    $classes = get_declared_classes();
    $rewriteClasses = array_filter($classes, function($c) {
        return stripos($c, 'rewrite') !== false;
    });
    echo "Rewrite classes:\n" . implode("\n", $rewriteClasses) . "\n";
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
    file: 'find_rewrite_class.php',
    content: code
  });

  const res = await axios.get('https://creativeyadley.com/clientarea/find_rewrite_class.php', {
    httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false })
  });

  console.log(res.data);
}

main().catch(console.error);
