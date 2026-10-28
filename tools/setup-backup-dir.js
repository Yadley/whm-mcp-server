require('dotenv').config();
const WHMService = require('../src/services/whm.service');
const w = new WHMService();
const axios = require('axios');

async function main() {
  const code = `<?php
header('Content-Type: text/plain');

$backupDir = '/home/creativeyadley/backups/whmcs_db';
if (!is_dir($backupDir)) {
    if (@mkdir($backupDir, 0700, true)) {
        echo "Created backup directory: $backupDir\\n";
    } else {
        echo "Failed to create directory (permission issue)\\n";
    }
} else {
    echo "Backup directory already exists: $backupDir\\n";
}

$binDir = '/home/creativeyadley/bin';
if (!is_dir($binDir)) {
    @mkdir($binDir, 0755, true);
}
echo "binDir exists: " . (is_dir($binDir) ? "YES" : "NO") . "\\n";
`;

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'save_file_content',
    dir: 'public_html/clientarea',
    file: 'setup_check.php',
    content: code
  });

  const res = await axios.get('https://creativeyadley.com/clientarea/setup_check.php', {
    httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false })
  });

  console.log(res.data);

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'fileop',
    op: 'unlink',
    sourcefiles: 'public_html/clientarea/setup_check.php'
  });
}
main().catch(console.error);

