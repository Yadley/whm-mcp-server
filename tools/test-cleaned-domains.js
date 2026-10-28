require('dotenv').config();
const WHMService = require('../src/services/whm.service');
const w = new WHMService();
const axios = require('axios');

async function main() {
  const code = `<?php
header('Content-Type: text/plain');
require_once __DIR__ . '/configuration.php';
$pdo = new PDO("mysql:host=127.0.0.1;port=3306;dbname=$db_name;charset=utf8mb4", $db_username, $db_password);

$stmt = $pdo->query("
    SELECT h.id, h.userid, h.domain, h.username, h.domainstatus
    FROM tblhosting h
    WHERE h.domain IS NOT NULL AND h.domain != ''
");
$all = $stmt->fetchAll(PDO::FETCH_ASSOC);

$cleaned = [];
foreach ($all as $row) {
    $raw = strtolower(trim($row['domain']));
    $d = preg_replace('#^https?://#', '', $raw);
    $d = rtrim($d, '/');
    $d = explode('/', $d)[0];
    if (filter_var($d, FILTER_VALIDATE_DOMAIN, FILTER_FLAG_HOSTNAME)) {
        $cleaned[$d] = $row['domainstatus'];
    }
}

echo "Total unique valid domains in tblhosting: " . count($cleaned) . "\\n";
echo "Status counts:\\n";
print_r(array_count_values($cleaned));

if (isset($cleaned['fusionfitnessvt.com'])) {
    echo "SUCCESS: fusionfitnessvt.com is found with status: " . $cleaned['fusionfitnessvt.com'] . "\\n";
} else {
    echo "NOT FOUND: fusionfitnessvt.com\\n";
}
`;

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'save_file_content',
    dir: 'public_html/clientarea',
    file: 'test_cleaned_domains.php',
    content: code
  });

  const res = await axios.get('https://creativeyadley.com/clientarea/test_cleaned_domains.php', {
    httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false })
  });

  console.log(res.data);

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'fileop',
    op: 'unlink',
    sourcefiles: 'public_html/clientarea/test_cleaned_domains.php'
  });
}

main().catch(console.error);

