require('dotenv').config();
const WHMService = require('../src/services/whm.service');
const w = new WHMService();
const axios = require('axios');

async function main() {
  const code = `<?php
header('Content-Type: text/plain');

echo "=== 1. Checking /etc/remotedomains & /etc/localdomains for creativeyadley.com ===\\n";
if (file_exists('/etc/localdomains')) {
    echo "In /etc/localdomains: " . (in_array("creativeyadley.com", file('/etc/localdomains', FILE_IGNORE_NEW_LINES)) ? "YES" : "NO") . "\\n";
}
if (file_exists('/etc/remotedomains')) {
    echo "In /etc/remotedomains: " . (in_array("creativeyadley.com", file('/etc/remotedomains', FILE_IGNORE_NEW_LINES)) ? "YES" : "NO") . "\\n";
}

echo "\\n=== 2. Checking local mailbox for info@creativeyadley.com ===\\n";
$localMailDir = '/home/creativeyadley/mail/creativeyadley.com/info/new';
if (is_dir($localMailDir)) {
    $emails = scandir($localMailDir);
    echo "Local mailbox files count: " . count($emails) . "\\n";
    foreach ($emails as $em) {
        if ($em != '.' && $em != '..') {
            echo "Found local email: $em\\n";
        }
    }
} else {
    echo "Local mailbox dir does not exist: $localMailDir\\n";
}

echo "\\n=== 3. Checking Exim log for info@creativeyadley.com ===\\n";
$descriptors = [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']];
$proc = proc_open('grep -i "info@creativeyadley.com" /var/log/exim_mainlog | tail -n 10', $descriptors, $pipes);
if (is_resource($proc)) {
    echo stream_get_contents($pipes[1]);
    proc_close($proc);
}
`;

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'save_file_content',
    dir: 'public_html/clientarea',
    file: 'check_exim_mail.php',
    content: code
  });

  const res = await axios.get('https://creativeyadley.com/clientarea/check_exim_mail.php', {
    httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false })
  });

  console.log(res.data);

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'fileop',
    op: 'unlink',
    sourcefiles: 'public_html/clientarea/check_exim_mail.php'
  });
}

main().catch(console.error);

