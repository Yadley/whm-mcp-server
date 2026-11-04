require('dotenv').config();
const fs = require('fs');
const path = require('path');
const WHMService = require('../src/services/whm.service');
const w = new WHMService();
const axios = require('axios');

async function main() {
  console.log('====================================================');
  console.log('Deploying Migration Scanner to Server 2');
  console.log('====================================================');

  const localPhpScript = path.join(__dirname, 'scan-migrated-sites.php');
  if (!fs.existsSync(localPhpScript)) {
    console.error('Error: local script not found at', localPhpScript);
    process.exit(1);
  }

  const scriptContent = fs.readFileSync(localPhpScript, 'utf8');

  console.log('1. Uploading scan_migrated_sites.php to /home/creativeyadley/bin/...');
  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'save_file_content',
    dir: 'bin',
    file: 'scan_migrated_sites.php',
    content: scriptContent
  });
  console.log('   Uploaded successfully!');

  console.log('2. Running dry-run test on Server 2...');
  const crypto = require('crypto');
  const authToken = crypto.randomBytes(16).toString('hex');
  const tempFilename = `test_scanner_${crypto.randomBytes(8).toString('hex')}.php`;

  const runnerCode = `<?php
header('Content-Type: text/plain');

if (($_GET['auth'] ?? '') !== '${authToken}') {
    http_response_code(403);
    die("Forbidden\\n");
}

$descriptors = [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']];
$proc = proc_open('/usr/local/bin/php /home/creativeyadley/bin/scan_migrated_sites.php --dry-run', $descriptors, $pipes);
if (is_resource($proc)) {
    echo stream_get_contents($pipes[1]);
    echo stream_get_contents($pipes[2]);
    proc_close($proc);
} else {
    echo "Failed to execute proc_open";
}
`;

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'save_file_content',
    dir: 'public_html/clientarea',
    file: tempFilename,
    content: runnerCode
  });

  try {
    const res = await axios.get(`https://creativeyadley.com/clientarea/${tempFilename}?auth=${authToken}`, {
      timeout: 120000
    });
    console.log('\n--- Output from Server 2 Test Run ---\n');
    console.log(res.data);
  } catch (err) {
    console.log('Notice during test execution:', err.message);
  } finally {
    // Cleanup temporary runner
    await w.get('cpanel', {
      cpanel_jsonapi_user: 'creativeyadley',
      cpanel_jsonapi_apiversion: '3',
      cpanel_jsonapi_module: 'Fileman',
      cpanel_jsonapi_func: 'fileop',
      op: 'unlink',
      sourcefiles: `public_html/clientarea/${tempFilename}`
    });
  }

  console.log('\n====================================================');
  console.log('Deployment Complete!');
  console.log('Script location: /home/creativeyadley/bin/scan_migrated_sites.php');
  console.log('Recommended Daily Cron Job (Run daily at 8:00 AM):');
  console.log('0 8 * * * /usr/local/bin/php /home/creativeyadley/bin/scan_migrated_sites.php >/dev/null 2>&1');
  console.log('====================================================');
}

main().catch(console.error);

