require('dotenv').config();
const WHMService = require('../src/services/whm.service');
const w = new WHMService();
const axios = require('axios');

async function main() {
  const code = `<?php
header('Content-Type: text/plain');
require_once __DIR__ . '/configuration.php';
$pdo = new PDO("mysql:host=127.0.0.1;port=3306;dbname=$db_name;charset=utf8mb4", $db_username, $db_password);

echo "=== Recent Email Logs in tblactivitylog ===\\n";
$stmt = $pdo->query("SELECT date, description, user FROM tblactivitylog WHERE description LIKE '%Email%' ORDER BY id DESC LIMIT 5");
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));

echo "\\n=== Checking tbladmins for info@creativeyadley.com ===\\n";
$stmt = $pdo->query("SELECT id, username, email FROM tbladmins");
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
`;

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'save_file_content',
    dir: 'public_html/clientarea',
    file: 'check_whmcs_admins.php',
    content: code
  });

  const res = await axios.get('https://creativeyadley.com/clientarea/check_whmcs_admins.php', {
    httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false })
  });

  console.log(res.data);

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'fileop',
    op: 'unlink',
    sourcefiles: 'public_html/clientarea/check_whmcs_admins.php'
  });
}

main().catch(console.error);

