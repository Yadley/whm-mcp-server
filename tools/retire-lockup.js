require('dotenv').config();
const WHMService = require('../src/services/whm.service');
const w = new WHMService();
const axios = require('axios');
const https = require('https');

async function main() {
  const code = `<?php
header('Content-Type: text/plain');

$mark = __DIR__ . '/templates/creative-yadley/assets/img/email/cy-mark-light.png';
$lockup = __DIR__ . '/templates/creative-yadley/assets/img/email/cy-lockup-light.png';

if (file_exists($mark)) {
    // Copy mark over lockup so no Bebas lockup can ever render
    copy($mark, $lockup);
    echo "Replaced cy-lockup-light.png with cy-mark-light.png: " . filesize($lockup) . " bytes\\n";
} else {
    echo "Mark not found\\n";
}
`;

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'save_file_content',
    dir: 'public_html/clientarea',
    file: 'temp_retire_lockup.php',
    content: code
  });

  const res = await axios.get('https://creativeyadley.com/clientarea/temp_retire_lockup.php', {
    httpsAgent: new https.Agent({ rejectUnauthorized: false })
  });

  console.log(res.data);

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'fileop',
    op: 'unlink',
    sourcefiles: 'public_html/clientarea/temp_retire_lockup.php'
  });
}

main().catch(console.error);
