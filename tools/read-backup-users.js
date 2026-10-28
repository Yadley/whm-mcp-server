require('dotenv').config();
const WHMService = require('../src/services/whm.service');
const w = new WHMService();
const axios = require('axios');

async function main() {
  const code = `<?php
header('Content-Type: text/plain');
if (file_exists('/etc/cpbackup-users.conf')) {
    echo "=== /etc/cpbackup-users.conf ===\\n";
    echo file_get_contents('/etc/cpbackup-users.conf');
} else {
    echo "/etc/cpbackup-users.conf does not exist or not readable\\n";
}
`;

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'save_file_content',
    dir: 'public_html/clientarea',
    file: 'read_backup_users.php',
    content: code
  });

  const res = await axios.get('https://creativeyadley.com/clientarea/read_backup_users.php', {
    httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false })
  });

  console.log(res.data);

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'fileop',
    op: 'unlink',
    sourcefiles: 'public_html/clientarea/read_backup_users.php'
  });
}
main().catch(console.error);

