require('dotenv').config();
const WHMService = require('../src/services/whm.service');
const w = new WHMService();
const axios = require('axios');
const crypto = require('crypto');

async function main() {
  const filename = 'whmcs_backup_20261107_111516.sql.gz';

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
    throw new Error('cc_encryption_hash could not be retrieved from configuration.php');
  }

  const secret = match[1];
  const token = crypto.createHmac('sha256', secret).update(filename).digest('hex');

  const downloadUrl = `https://creativeyadley.com/clientarea/get_db_backup.php?file=${encodeURIComponent(filename)}&token=${token}`;
  console.log('Testing download URL:', downloadUrl);

  const dlRes = await axios.get(downloadUrl, {
    headers: { 'Range': 'bytes=0-200' }
  });

  console.log('HTTP Status:', dlRes.status);
  console.log('Content-Type:', dlRes.headers['content-type']);
  console.log('Content-Length:', dlRes.headers['content-length']);
  console.log('Content-Range:', dlRes.headers['content-range']);
  console.log('Content-Disposition:', dlRes.headers['content-disposition']);

  if (dlRes.status === 206) {
    console.log('VERIFICATION SUCCESSFUL: 206 Partial Content returned with valid backup archive data!');
  } else {
    throw new Error('Unexpected status: ' + dlRes.status);
  }
}

main().catch(console.error);
