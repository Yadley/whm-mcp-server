require('dotenv').config();
const WHMService = require('../src/services/whm.service');
const w = new WHMService();
const axios = require('axios');

async function main() {
  const code = `<?php
require_once __DIR__ . '/configuration.php';
$pdo = new PDO("mysql:host=127.0.0.1;port=3306;dbname=" . $db_name, $db_username, $db_password);
$stmt = $pdo->query("SELECT setting, value FROM tblconfiguration WHERE setting LIKE '%Maintenance%' OR setting IN ('Version', 'SystemURL')");
echo json_encode($stmt->fetchAll(PDO::FETCH_KEY_PAIR), JSON_PRETTY_PRINT);
`;

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'save_file_content',
    dir: 'public_html/clientarea',
    file: 'check_maint.php',
    content: code
  });

  const res = await axios.get('https://creativeyadley.com/clientarea/check_maint.php', {
    httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false })
  });

  console.log('Maintenance & Config settings:\n', res.data);
}

main().catch(console.error);
