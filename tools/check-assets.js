require('dotenv').config();
const WHMService = require('../src/services/whm.service');
const w = new WHMService();
const axios = require('axios');
const https = require('https');

async function main() {
  const code = `<?php
header('Content-Type: text/plain');

echo "=== Files in public_html/clientarea/assets/img ===\\n";
$dir = __DIR__ . '/assets/img';
if (is_dir($dir)) {
    print_r(scandir($dir));
}

echo "\\n=== Files in public_html/clientarea/templates/creative-yadley/assets/img/email ===\\n";
$dir2 = __DIR__ . '/templates/creative-yadley/assets/img/email';
if (is_dir($dir2)) {
    print_r(scandir($dir2));
}
`;

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'save_file_content',
    dir: 'public_html/clientarea',
    file: 'temp_check_assets.php',
    content: code
  });

  const res = await axios.get('https://creativeyadley.com/clientarea/temp_check_assets.php', {
    httpsAgent: new https.Agent({ rejectUnauthorized: false })
  });

  console.log(res.data);

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'fileop',
    op: 'unlink',
    sourcefiles: 'public_html/clientarea/temp_check_assets.php'
  });
}

main().catch(console.error);
