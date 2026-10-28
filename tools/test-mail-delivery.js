require('dotenv').config();
const WHMService = require('../src/services/whm.service');
const w = new WHMService();
const axios = require('axios');

async function main() {
  const code = `<?php
header('Content-Type: text/plain');
require_once __DIR__ . '/init.php';

echo "=== Testing WHMCS localAPI SendAdminEmail ===\\n";
$res = localAPI('SendAdminEmail', [
    'type' => 'system',
    'customsubject' => 'Test Migration Alert via WHMCS API',
    'custommessage' => '<p>This is a test notification from the Migration Scanner via WHMCS internal mailer.</p>',
    'deptid' => 1
]);
print_r($res);

echo "\\n=== Testing direct PHP mail() with debug ===\\n";
$headers = "From: noreply@creativeyadley.com\\r\\nReply-To: info@creativeyadley.com\\r\\nContent-Type: text/plain; charset=UTF-8";
$res2 = mail('info@creativeyadley.com', 'Direct PHP mail() test', 'Test body from PHP mail()', $headers);
echo "mail() result: " . ($res2 ? "TRUE" : "FALSE") . "\\n";

echo "\\n=== Checking recent entries in tblactivitylog for this minute ===\\n";
require_once __DIR__ . '/configuration.php';
$pdo = new PDO("mysql:host=127.0.0.1;port=3306;dbname=$db_name;charset=utf8mb4", $db_username, $db_password);
$stmt = $pdo->query("SELECT date, description, user FROM tblactivitylog ORDER BY id DESC LIMIT 5");
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
`;

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'save_file_content',
    dir: 'public_html/clientarea',
    file: 'test_mail_delivery.php',
    content: code
  });

  const res = await axios.get('https://creativeyadley.com/clientarea/test_mail_delivery.php', {
    httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false })
  });

  console.log(res.data);

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'fileop',
    op: 'unlink',
    sourcefiles: 'public_html/clientarea/test_mail_delivery.php'
  });
}

main().catch(console.error);

