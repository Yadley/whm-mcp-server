require('dotenv').config();
const WHMService = require('../src/services/whm.service');
const w = new WHMService();
const axios = require('axios');

async function main() {
  const code = `<?php
header('Content-Type: text/plain');
require_once __DIR__ . '/configuration.php';
$pdo = new PDO("mysql:host=127.0.0.1;port=3306;dbname=$db_name;charset=utf8mb4", $db_username, $db_password);

echo "=== 1. Checking WHMCS tblhosting for fusion% ===\\n";
$stmt = $pdo->query("SELECT id, userid, domain, username, domainstatus FROM tblhosting WHERE domain LIKE '%fusion%' OR username LIKE '%fusion%'");
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));

echo "\\n=== 2. Checking WHMCS tbldomains for fusion% ===\\n";
$stmt = $pdo->query("SELECT id, userid, domain, status FROM tbldomains WHERE domain LIKE '%fusion%'");
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));

echo "\\n=== 3. Checking /etc/userdomains on server for fusion ===\\n";
if (file_exists('/etc/userdomains')) {
    $lines = file('/etc/userdomains');
    foreach ($lines as $line) {
        if (stripos($line, 'fusion') !== false) {
            echo $line;
        }
    }
} else {
    echo "/etc/userdomains not found\\n";
}

echo "\\n=== 4. Checking /var/cpanel/userdata/fusionfitness ===\\n";
$userdataDir = '/var/cpanel/userdata/fusionfitness';
if (is_dir($userdataDir)) {
    print_r(scandir($userdataDir));
} else {
    echo "$userdataDir not found or not readable\\n";
}

echo "\\n=== 5. Mail routing for creativeyadley.com ===\\n";
$stmt = $pdo->query("SELECT setting, value FROM tblconfiguration WHERE setting LIKE '%Mail%' OR setting LIKE '%SMTP%'");
print_r($stmt->fetchAll(PDO::FETCH_KEY_PAIR));
`;

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'save_file_content',
    dir: 'public_html/clientarea',
    file: 'debug_fusion_mail.php',
    content: code
  });

  const res = await axios.get('https://creativeyadley.com/clientarea/debug_fusion_mail.php', {
    httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false })
  });

  console.log(res.data);

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'fileop',
    op: 'unlink',
    sourcefiles: 'public_html/clientarea/debug_fusion_mail.php'
  });
}

main().catch(console.error);

