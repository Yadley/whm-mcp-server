require('dotenv').config();
const WHMService = require('../src/services/whm.service');
const w = new WHMService();
const axios = require('axios');
const crypto = require('crypto');

async function main() {
  const filename = 'whmcs_backup_20261029_042134.sql.gz';

  // Ensure any previously deployed test_token.php is removed
  try {
    await w.get('cpanel', {
      cpanel_jsonapi_user: 'creativeyadley',
      cpanel_jsonapi_apiversion: '3',
      cpanel_jsonapi_module: 'Fileman',
      cpanel_jsonapi_func: 'fileop',
      op: 'unlink',
      sourcefiles: 'public_html/clientarea/test_token.php'
    });
  } catch (e) {
    // Ignore error if file doesn't exist
  }

  // Obtain secret through authenticated WHM Fileman API
  const configRes = await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'get_file_content',
    dir: 'public_html/clientarea',
    file: 'configuration.php'
  });

  const content = configRes.result?.data?.content || configRes.data?.content || '';
  const match = content.match(/\$cc_encryption_hash\s*=\s*['"]([^'"]+)['"]/);
  if (!match || !match[1]) {
    throw new Error('cc_encryption_hash could not be retrieved from configuration.php via authenticated channel');
  }

  const secret = match[1];
  const token = crypto.createHmac('sha256', secret).update(filename).digest('hex');

  console.log('Testing download URL with token for:', filename);
  const downloadUrl = `https://creativeyadley.com/clientarea/get_db_backup.php?file=${encodeURIComponent(filename)}&token=${token}`;

  // Request byte range with TLS verification enabled (no rejectUnauthorized: false)
  const dlRes = await axios.get(downloadUrl, {
    headers: { 'Range': 'bytes=0-100' }
  });

  console.log('Download test status:', dlRes.status);
  console.log('Content-Range:', dlRes.headers['content-range']);
  console.log('Content-Type:', dlRes.headers['content-type']);
  console.log('Content-Disposition:', dlRes.headers['content-disposition']);

  if (dlRes.status !== 206) {
    throw new Error(`Expected HTTP status 206 Partial Content, received ${dlRes.status}`);
  }

  console.log('Success! Download endpoint returned 206 Partial Content with valid byte range.');
}

main().catch(console.error);
