require('dotenv').config();
const WHMService = require('../src/services/whm.service');
const w = new WHMService();
const axios = require('axios');

async function main() {
  const code = `<?php
header('Content-Type: text/plain');
echo "/usr/local/bin/php: " . (file_exists('/usr/local/bin/php') ? 'EXISTS' : 'NOT FOUND') . "\\n";
echo "/usr/bin/php: " . (file_exists('/usr/bin/php') ? 'EXISTS' : 'NOT FOUND') . "\\n";
echo "/opt/cpanel/ea-php82/root/usr/bin/php: " . (file_exists('/opt/cpanel/ea-php82/root/usr/bin/php') ? 'EXISTS' : 'NOT FOUND') . "\\n";
echo "Active PHP Version: " . phpversion() . "\\n";
`;

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'save_file_content',
    dir: 'public_html/clientarea',
    file: 'check_php_path.php',
    content: code
  });

  const res = await axios.get('https://creativeyadley.com/clientarea/check_php_path.php', {
    httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false })
  });

  console.log(res.data);

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'fileop',
    op: 'unlink',
    sourcefiles: 'public_html/clientarea/check_php_path.php'
  });
}

main().catch(console.error);

