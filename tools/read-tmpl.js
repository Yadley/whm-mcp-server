require('dotenv').config();
const WHMService = require('../src/services/whm.service');
const w = new WHMService();
const axios = require('axios');
const https = require('https');

async function main() {
  const code = `<?php
header('Content-Type: text/plain');

echo "=== wrapper/main.html.tmpl ===\\n";
if (file_exists('/usr/local/cpanel/etc/icontact_templates/wrapper/main.html.tmpl')) {
    echo file_get_contents('/usr/local/cpanel/etc/icontact_templates/wrapper/main.html.tmpl');
}

echo "\\n\\n=== suspendacct/Notify.html.tmpl ===\\n";
if (file_exists('/usr/local/cpanel/etc/icontact_templates/suspendacct/Notify.html.tmpl')) {
    echo file_get_contents('/usr/local/cpanel/etc/icontact_templates/suspendacct/Notify.html.tmpl');
}
`;

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'save_file_content',
    dir: 'public_html/clientarea',
    file: 'temp_read_tmpl.php',
    content: code
  });

  const res = await axios.get('https://creativeyadley.com/clientarea/temp_read_tmpl.php', {
    httpsAgent: new https.Agent({ rejectUnauthorized: false })
  });

  console.log(res.data);

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'fileop',
    op: 'unlink',
    sourcefiles: 'public_html/clientarea/temp_read_tmpl.php'
  });
}

main().catch(console.error);
