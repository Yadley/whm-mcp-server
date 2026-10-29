require('dotenv').config();
const WHMService = require('../src/services/whm.service');
const w = new WHMService();
const axios = require('axios');

async function main() {
  const code = `<?php
header('Content-Type: text/plain');

echo "Checking xz / bzip2 / zip / gzip:\\n";
echo "gzip: " . (file_exists('/usr/bin/gzip') ? "YES" : "NO") . "\\n";
echo "xz: " . (file_exists('/usr/bin/xz') ? "YES" : "NO") . "\\n";
echo "bzip2: " . (file_exists('/usr/bin/bzip2') ? "YES" : "NO") . "\\n";
echo "zip: " . (file_exists('/usr/bin/zip') ? "YES" : "NO") . "\\n";

// Let's test compressing the existing .sql from the gz file to xz
$gzFile = '/home/creativeyadley/backups/whmcs_db/whmcs_backup_20261029_020001.sql.gz';
if (file_exists($gzFile)) {
    echo "Current gzip size: " . filesize($gzFile) . " bytes (" . round(filesize($gzFile)/1024/1024, 2) . " MB)\\n";
    if (file_exists('/usr/bin/xz')) {
        $descriptors = [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']];
        $cmd = "/usr/bin/gzip -dc " . escapeshellarg($gzFile) . " | /usr/bin/xz -9c > /home/creativeyadley/backups/whmcs_db/test.sql.xz";
        $proc = proc_open($cmd, $descriptors, $pipes);
        if (is_resource($proc)) {
            proc_close($proc);
            $xzFile = '/home/creativeyadley/backups/whmcs_db/test.sql.xz';
            if (file_exists($xzFile)) {
                echo "XZ size: " . filesize($xzFile) . " bytes (" . round(filesize($xzFile)/1024/1024, 2) . " MB)\\n";
                unlink($xzFile);
            }
        }
    }
}
`;

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'save_file_content',
    dir: 'public_html/clientarea',
    file: 'test_compress.php',
    content: code
  });

  const res = await axios.get('https://creativeyadley.com/clientarea/test_compress.php', {
    httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }),
    timeout: 60000
  });

  console.log(res.data);

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'fileop',
    op: 'unlink',
    sourcefiles: 'public_html/clientarea/test_compress.php'
  });
}
main().catch(console.error);

