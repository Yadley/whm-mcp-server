require('dotenv').config();
const WHMService = require('../src/services/whm.service');
const w = new WHMService();
const axios = require('axios');
const https = require('https');

async function main() {
  const code = `<?php
header('Content-Type: text/plain');

$files = [
    'assets/img/logo-dark.png',
    'assets/img/logo.png',
    'assets/img/logo-on-light.png',
    'templates/creative-yadley/assets/img/logo-on-light.png',
    'templates/creative-yadley/assets/img/logo-on-dark.png'
];

foreach ($files as $f) {
    $p = __DIR__ . '/' . $f;
    if (file_exists($p)) {
        echo "$f => size: " . filesize($p) . " bytes, md5: " . md5_file($p) . "\\n";
    } else {
        echo "$f => NOT FOUND\\n";
    }
}
`;

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'save_file_content',
    dir: 'public_html/clientarea',
    file: 'temp_check_logos.php',
    content: code
  });

  const res = await axios.get('https://creativeyadley.com/clientarea/temp_check_logos.php', {
    httpsAgent: new https.Agent({ rejectUnauthorized: false })
  });

  console.log(res.data);

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'fileop',
    op: 'unlink',
    sourcefiles: 'public_html/clientarea/temp_check_logos.php'
  });
}

main().catch(console.error);
