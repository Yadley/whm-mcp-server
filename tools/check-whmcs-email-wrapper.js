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

echo "=== Checking tblconfiguration EmailGlobalHeader / Footer ===\\n";
$stmt = $pdo->query("SELECT setting, value FROM tblconfiguration WHERE setting LIKE 'EmailGlobal%' OR setting LIKE 'Email%' OR setting='LogoURL'");
while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    echo $row['setting'] . " => " . substr($row['value'], 0, 100) . "\\n";
}

echo "\\n=== Checking for email header/footer templates in files ===\\n";
$themeDir = __DIR__ . '/templates/creative-yadley';
if (is_dir($themeDir)) {
    $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($themeDir));
    foreach ($it as $f) {
        if (stripos($f->getPathname(), 'email') !== false || stripos($f->getPathname(), 'mail') !== false) {
            echo $f->getPathname() . "\\n";
        }
    }
}
`;

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'save_file_content',
    dir: 'public_html/clientarea',
    file: 'temp_whmcs_email_check.php',
    content: code
  });

  const res = await axios.get('https://creativeyadley.com/clientarea/temp_whmcs_email_check.php', {
    httpsAgent: new https.Agent({ rejectUnauthorized: false })
  });

  console.log(res.data);

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'fileop',
    op: 'unlink',
    sourcefiles: 'public_html/clientarea/temp_whmcs_email_check.php'
  });
}

main().catch(console.error);
