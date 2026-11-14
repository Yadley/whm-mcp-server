require('dotenv').config();
const WHMService = require('../src/services/whm.service');
const w = new WHMService();
const axios = require('axios');
const https = require('https');

async function main() {
  const code = `<?php
header('Content-Type: text/plain');

$src = __DIR__ . '/assets/img/logo-on-light.png';
if (!file_exists($src)) {
    die("Source $src does not exist\\n");
}

$data = file_get_contents($src);

// Overwrite legacy logo-dark.png and logo.png with logo-on-light.png content
file_put_contents(__DIR__ . '/assets/img/logo-dark.png', $data);
file_put_contents(__DIR__ . '/assets/img/logo.png', $data);

echo "Replaced assets/img/logo-dark.png: " . filesize(__DIR__ . '/assets/img/logo-dark.png') . " bytes\\n";
echo "Replaced assets/img/logo.png: " . filesize(__DIR__ . '/assets/img/logo.png') . " bytes\\n";
`;

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'save_file_content',
    dir: 'public_html/clientarea',
    file: 'temp_replace_legacy_logos.php',
    content: code
  });

  const res = await axios.get('https://creativeyadley.com/clientarea/temp_replace_legacy_logos.php', {
    httpsAgent: new https.Agent({ rejectUnauthorized: false })
  });

  console.log(res.data);

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'fileop',
    op: 'unlink',
    sourcefiles: 'public_html/clientarea/temp_replace_legacy_logos.php'
  });
}

main().catch(console.error);
