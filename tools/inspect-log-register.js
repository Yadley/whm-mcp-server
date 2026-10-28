require('dotenv').config();
const WHMService = require('../src/services/whm.service');
const w = new WHMService();
const axios = require('axios');

async function main() {
  const code = `<?php
header('Content-Type: text/plain');
require_once __DIR__ . '/configuration.php';
$pdo = new PDO("mysql:host=127.0.0.1;port=3306;dbname=$db_name;charset=utf8mb4", $db_username, $db_password);

$stmt = $pdo->query("DESCRIBE tbllog_register");
echo "Columns in tbllog_register:\\n";
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));

$stmt2 = $pdo->query("SELECT MIN(created_at), MAX(created_at), COUNT(*) FROM tbllog_register");
echo "Date range and count in tbllog_register:\\n";
print_r($stmt2->fetch(PDO::FETCH_ASSOC));

$stmt3 = $pdo->query("SELECT namespace, COUNT(*) as cnt FROM tbllog_register GROUP BY namespace ORDER BY cnt DESC LIMIT 10");
echo "Top namespaces in tbllog_register:\\n";
print_r($stmt3->fetchAll(PDO::FETCH_ASSOC));
`;

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'save_file_content',
    dir: 'public_html/clientarea',
    file: 'log_reg_check.php',
    content: code
  });

  const res = await axios.get('https://creativeyadley.com/clientarea/log_reg_check.php', {
    httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false })
  });

  console.log(res.data);

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'fileop',
    op: 'unlink',
    sourcefiles: 'public_html/clientarea/log_reg_check.php'
  });
}
main().catch(console.error);

