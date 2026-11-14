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

$newLogo = 'https://creativeyadley.com/clientarea/templates/creative-yadley/assets/img/logo-on-light.png';

$stmt = $pdo->prepare("UPDATE tblconfiguration SET value = ? WHERE setting = 'LogoURL'");
$stmt->execute([$newLogo]);
echo "Updated LogoURL in tblconfiguration: rows affected = " . $stmt->rowCount() . "\\n";

$check = $pdo->query("SELECT value FROM tblconfiguration WHERE setting = 'LogoURL'")->fetchColumn();
echo "Current LogoURL: " . $check . "\\n";

// Ensure assets/img has logo-on-light.png as well
$src = __DIR__ . '/templates/creative-yadley/assets/img/logo-on-light.png';
$dst = __DIR__ . '/assets/img/logo-on-light.png';
if (file_exists($src)) {
    if (!is_dir(dirname($dst))) {
        @mkdir(dirname($dst), 0755, true);
    }
    copy($src, $dst);
    echo "Copied to $dst (size: " . filesize($dst) . ")\\n";
}
`;

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'save_file_content',
    dir: 'public_html/clientarea',
    file: 'temp_update_whmcs_logo.php',
    content: code
  });

  const res = await axios.get('https://creativeyadley.com/clientarea/temp_update_whmcs_logo.php', {
    httpsAgent: new https.Agent({ rejectUnauthorized: false })
  });

  console.log(res.data);

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'fileop',
    op: 'unlink',
    sourcefiles: 'public_html/clientarea/temp_update_whmcs_logo.php'
  });
}

main().catch(console.error);
