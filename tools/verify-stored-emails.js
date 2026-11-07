require('dotenv').config();
const WHMService = require('../src/services/whm.service');
const w = new WHMService();
const axios = require('axios');
const crypto = require('crypto');

async function main() {
  const token = crypto.randomBytes(8).toString('hex');
  const tempRunner = `inspect_emails_${token}.php`;

  const runnerCode = `<?php
header('Content-Type: application/json');
require_once __DIR__ . '/configuration.php';

$pdo = new PDO("mysql:host=" . ($db_host ?: '127.0.0.1') . ";port=" . ($db_port ?: '3306') . ";dbname={$db_name};charset=utf8mb4", $db_username, $db_password, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
]);

$stmt = $pdo->query("SELECT id, userid, \`to\`, \`date\`, subject, message FROM tblemails WHERE id IN (21738, 21740) ORDER BY id ASC");
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

$out = [];
foreach ($rows as $r) {
    $out[] = [
        'id' => $r['id'],
        'subject' => $r['subject'],
        'has_lime_bg' => (strpos($r['message'], 'background-color:#AFE139') !== false || strpos($r['message'], 'background-color: #AFE139') !== false),
        'has_2x2_grid' => (strpos($r['message'], 'cy-col') !== false),
        'has_notice_padding' => (strpos($r['message'], 'padding: 20px 24px') !== false || strpos($r['message'], 'padding:20px 24px') !== false),
        'br_count' => substr_count($r['message'], '<br />'),
        'message_len' => strlen($r['message'])
    ];
}

echo json_encode($out, JSON_PRETTY_PRINT);
`;

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'save_file_content',
    dir: 'public_html/clientarea',
    file: tempRunner,
    content: runnerCode
  });

  try {
    const res = await axios.get(`https://creativeyadley.com/clientarea/${tempRunner}`, {
      httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false })
    });
    console.log(JSON.stringify(res.data, null, 2));
  } finally {
    await w.get('cpanel', {
      cpanel_jsonapi_user: 'creativeyadley',
      cpanel_jsonapi_apiversion: '3',
      cpanel_jsonapi_module: 'Fileman',
      cpanel_jsonapi_func: 'fileop',
      op: 'unlink',
      sourcefiles: `public_html/clientarea/${tempRunner}`
    });
  }
}

main().catch(console.error);
