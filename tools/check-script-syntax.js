require('dotenv').config();
const WHMService = require('../src/services/whm.service');
const w = new WHMService();
const axios = require('axios');
const crypto = require('crypto');

async function main() {
  const token = crypto.randomBytes(8).toString('hex');
  const tempFile = `check_syntax_${token}.php`;
  const code = `<?php
header('Content-Type: text/plain');
$descriptors = [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']];

echo "=== 1. Checking backup_whmcs_db.php ===\\n";
$p1 = proc_open('/opt/cpanel/ea-php82/root/usr/bin/php -l /home/creativeyadley/bin/backup_whmcs_db.php 2>&1', $descriptors, $pipes1);
if (is_resource($p1)) {
    echo stream_get_contents($pipes1[1]);
    proc_close($p1);
}

echo "\\n=== 2. Checking scan_migrated_sites.php ===\\n";
$p2 = proc_open('/usr/local/bin/php -l /home/creativeyadley/bin/scan_migrated_sites.php 2>&1', $descriptors, $pipes2);
if (is_resource($p2)) {
    echo stream_get_contents($pipes2[1]);
    proc_close($p2);
}
`;

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'save_file_content',
    dir: 'public_html/clientarea',
    file: tempFile,
    content: code
  });

  try {
    const res = await axios.get(`https://creativeyadley.com/clientarea/${tempFile}`, {
      httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false })
    });
    console.log(res.data);
  } finally {
    await w.get('cpanel', {
      cpanel_jsonapi_user: 'creativeyadley',
      cpanel_jsonapi_apiversion: '3',
      cpanel_jsonapi_module: 'Fileman',
      cpanel_jsonapi_func: 'fileop',
      op: 'unlink',
      sourcefiles: `public_html/clientarea/${tempFile}`
    });
  }
}

main().catch(console.error);
