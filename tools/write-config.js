require('dotenv').config();
const WHMService = require('../src/services/whm.service');
const w = new WHMService();

const configContent = `<?php
$license = 'WHMCS-06253e18ca533b9bc194';
$db_host = '127.0.0.1';
$db_port = '3306';
$db_username = 'creativeyadley_admin';
$db_password = '$20207digitgoals$$';
$db_name = 'creativeyadley_whmcs';
$cc_encryption_hash = 'V5V8Z6sBN3zPE2gM1pIuCBikstkgawXWsJUhGdJj79ZB15eTlMeOenZxG9DGwrtP';
$templates_compiledir = 'templates_c';
$mysql_charset = 'utf8';
$display_errors = true;
`;

async function main() {
  const res = await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'save_file_content',
    dir: 'public_html/clientarea',
    file: 'configuration.php',
    content: configContent
  });
  console.log('Result:', res);
}

main().catch(console.error);
