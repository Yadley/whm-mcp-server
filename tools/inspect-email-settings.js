require('dotenv').config();
const WHMService = require('../src/services/whm.service');
const w = new WHMService();
const axios = require('axios');
const https = require('https');

async function main() {
  const code = `<?php
header('Content-Type: text/plain');
require_once __DIR__ . '/configuration.php';
$pdo = new PDO("mysql:host=127.0.0.1;port=3306;dbname=$db_name;charset=utf8mb4", $db_username, $db_password);

echo "=== tblconfiguration (Logo / Email) ===\\n";
$stmt = $pdo->query("SELECT setting, value FROM tblconfiguration WHERE setting LIKE '%logo%' OR setting LIKE '%email%' LIMIT 50");
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));

echo "\\n=== Daily Cron / Admin Email Template in tblemailtemplates ===\\n";
$stmt = $pdo->query("SELECT id, type, name, subject, message FROM tblemailtemplates WHERE name LIKE '%cron%' OR name LIKE '%daily%' OR subject LIKE '%cron%'");
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));

echo "\\n=== Global Email Header/Footer if any in tblemailtemplates ===\\n";
$stmt = $pdo->query("SELECT id, type, name, subject FROM tblemailtemplates WHERE type='admin' OR name LIKE '%header%' OR name LIKE '%footer%'");
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
`;

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'save_file_content',
    dir: 'public_html/clientarea',
    file: 'temp_inspect_emails.php',
    content: code
  });

  const res = await axios.get('https://creativeyadley.com/clientarea/temp_inspect_emails.php', {
    httpsAgent: new https.Agent({ rejectUnauthorized: false })
  });

  console.log(res.data);

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'fileop',
    op: 'unlink',
    sourcefiles: 'public_html/clientarea/temp_inspect_emails.php'
  });
}

main().catch(console.error);
