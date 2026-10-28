require('dotenv').config();
const WHMService = require('../src/services/whm.service');
const w = new WHMService();
const axios = require('axios');

async function main() {
  const code = `<?php
header('Content-Type: text/plain');
require_once __DIR__ . '/configuration.php';
$pdo = new PDO("mysql:host=127.0.0.1;port=3306;dbname=$db_name;charset=utf8mb4", $db_username, $db_password);

echo "=== Breakdown of tblhosting by domainstatus ===\\n";
$stmt = $pdo->query("SELECT domainstatus, COUNT(*) as cnt FROM tblhosting GROUP BY domainstatus");
print_r($stmt->fetchAll(PDO::FETCH_KEY_PAIR));

echo "\\n=== Checking domains in tblhosting with slashes or urls ===\\n";
$stmt = $pdo->query("SELECT id, domain, username, domainstatus FROM tblhosting WHERE domain LIKE '%/%' OR domain LIKE 'http%'");
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));

echo "\\n=== Checking tbldomains status breakdown ===\\n";
$stmt = $pdo->query("SELECT status, COUNT(*) as cnt FROM tbldomains GROUP BY status");
print_r($stmt->fetchAll(PDO::FETCH_KEY_PAIR));
`;

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'save_file_content',
    dir: 'public_html/clientarea',
    file: 'check_domain_breakdown.php',
    content: code
  });

  const res = await axios.get('https://creativeyadley.com/clientarea/check_domain_breakdown.php', {
    httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false })
  });

  console.log(res.data);

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'fileop',
    op: 'unlink',
    sourcefiles: 'public_html/clientarea/check_domain_breakdown.php'
  });
}

main().catch(console.error);

