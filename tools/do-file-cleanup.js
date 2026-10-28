require('dotenv').config();
const WHMService = require('../src/services/whm.service');
const w = new WHMService();
const axios = require('axios');

async function main() {
  const code = `<?php
header('Content-Type: text/plain');

echo "=== 1. Truncating /home/creativeyadley/public_html/error_log ===\\n";
$errLog = '/home/creativeyadley/public_html/error_log';
if (file_exists($errLog)) {
    $before = filesize($errLog);
    file_put_contents($errLog, '');
    clearstatcache();
    $after = filesize($errLog);
    echo "error_log before: " . round($before/1024/1024, 2) . " MB, after: $after bytes (Saved: " . round(($before - $after)/1024/1024, 2) . " MB)\\n";
}

echo "\\n=== 2. Cleaning stale /home/creativeyadley/tmp/analog cache (from Feb 2025) ===\\n";
$cacheFiles = [
    '/home/creativeyadley/tmp/analog/ssl/creativeyadley.com/cache',
    '/home/creativeyadley/tmp/analog/ssl/creativeyadley.com/cache.out'
];
$freedAnalog = 0;
foreach ($cacheFiles as $cf) {
    if (file_exists($cf)) {
        $size = filesize($cf);
        if (@unlink($cf)) {
            $freedAnalog += $size;
            echo "Deleted $cf (" . round($size/1024/1024, 2) . " MB)\\n";
        }
    }
}
echo "Total freed from analog cache: " . round($freedAnalog/1024/1024, 2) . " MB (~" . round($freedAnalog/1024/1024/1024, 2) . " GB)\\n";
`;

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'save_file_content',
    dir: 'public_html/clientarea',
    file: 'do_file_cleanup.php',
    content: code
  });

  const res = await axios.get('https://creativeyadley.com/clientarea/do_file_cleanup.php', {
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
    sourcefiles: 'public_html/clientarea/do_file_cleanup.php'
  });
}
main().catch(console.error);

