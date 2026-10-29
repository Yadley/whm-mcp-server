require('dotenv').config();
const WHMService = require('../src/services/whm.service');
const w = new WHMService();
const axios = require('axios');
const crypto = require('crypto');

async function main() {
  const filename = 'whmcs_backup_20261029_040107.sql.gz';
  
  // Get cc_encryption_hash from configuration.php via a tiny script
  const testPhp = `<?php
require_once __DIR__ . '/configuration.php';
$secret = $cc_encryption_hash ?? 'backup_salt_2026';
echo hash_hmac('sha256', '${filename}', $secret);
`;

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'save_file_content',
    dir: 'public_html/clientarea',
    file: 'test_token.php',
    content: testPhp
  });

  const tokenRes = await axios.get('https://creativeyadley.com/clientarea/test_token.php', {
    httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false })
  });
  const token = tokenRes.data.trim();

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'fileop',
    op: 'unlink',
    sourcefiles: 'public_html/clientarea/test_token.php'
  });

  console.log('Testing download URL with token:', token);
  const downloadUrl = `https://creativeyadley.com/clientarea/get_db_backup.php?file=${encodeURIComponent(filename)}&token=${token}`;
  
  // Make a HEAD/GET request to test download
  const dlRes = await axios.get(downloadUrl, {
    httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }),
    headers: { 'Range': 'bytes=0-100' }
  });

  console.log('Download test status:', dlRes.status);
  console.log('Content-Type:', dlRes.headers['content-type']);
  console.log('Content-Disposition:', dlRes.headers['content-disposition']);
  console.log('Success! Download endpoint works 100%!');
}

main().catch(console.error);

