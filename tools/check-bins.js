require('dotenv').config();
const WHMService = require('../src/services/whm.service');
const w = new WHMService();
const axios = require('axios');

async function main() {
  const code = `<?php
header('Content-Type: text/plain');
echo "mysqldump: " . (file_exists('/usr/bin/mysqldump') ? "EXISTS" : "NOT FOUND") . "\\n";
echo "gzip: " . (file_exists('/usr/bin/gzip') ? "EXISTS" : "NOT FOUND") . "\\n";
echo "home dir: " . (is_dir('/home/creativeyadley') ? "EXISTS" : "NOT FOUND") . "\\n";
echo "whmcsdata: " . (is_dir('/home/creativeyadley/whmcsdata') ? "EXISTS" : "NOT FOUND") . "\\n";
`;

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'save_file_content',
    dir: 'public_html/clientarea',
    file: 'check_bins.php',
    content: code
  });

  const res = await axios.get('https://creativeyadley.com/clientarea/check_bins.php', {
    httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false })
  });

  console.log(res.data);

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'fileop',
    op: 'unlink',
    sourcefiles: 'public_html/clientarea/check_bins.php'
  });
}
main().catch(console.error);

