require('dotenv').config();
const WHMService = require('../src/services/whm.service');
const w = new WHMService();
const axios = require('axios');

async function main() {
  const code = `<?php
header('Content-Type: text/plain');
$testFile = '/home/creativeyadley/backups/whmcs_db/test_backup_20261028_054607.sql.gz';
$descriptors = [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']];
$proc = proc_open("/usr/bin/gzip -t " . escapeshellarg($testFile), $descriptors, $pipes);
if (is_resource($proc)) {
    $err = stream_get_contents($pipes[2]);
    $code = proc_close($proc);
    echo "gzip test exit code: $code (0 means valid!)\\n";
    if ($err) echo "Stderr: $err\\n";
}
`;

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'save_file_content',
    dir: 'public_html/clientarea',
    file: 'test_gzip.php',
    content: code
  });

  const res = await axios.get('https://creativeyadley.com/clientarea/test_gzip.php', {
    httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false })
  });

  console.log(res.data);

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'fileop',
    op: 'unlink',
    sourcefiles: 'public_html/clientarea/test_gzip.php'
  });
}
main().catch(console.error);

