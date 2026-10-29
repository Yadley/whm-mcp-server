require('dotenv').config();
const WHMService = require('../src/services/whm.service');
const w = new WHMService();
const axios = require('axios');
const crypto = require('crypto');

async function main() {
  const authToken = crypto.randomBytes(16).toString('hex');
  const code = `<?php
header('Content-Type: text/plain');

if (($_GET['auth'] ?? '') !== '${authToken}') {
    http_response_code(403);
    die('Forbidden');
}

$to = 'info@creativeyadley.com';
$subject = '[Test] Server2 WHMCS Backup Notification System';
$message = "Hello,\\n\\nThis is a test notification from server2.creativeyadley.com to verify that automated backup notification emails are delivering properly to info@creativeyadley.com.\\n\\nTime: " . date('Y-m-d H:i:s T') . "\\n";
$headers = 'From: WHMCS Backup System <cpanel@server2.creativeyadley.com>' . "\\r\\n" .
    'Reply-To: support@creativeyadley.com' . "\\r\\n" .
    'X-Mailer: PHP/' . phpversion();

$sent = mail($to, $subject, $message, $headers);
echo "Mail sent result: " . ($sent ? "SUCCESS" : "FAILED") . "\\n";
`;

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'save_file_content',
    dir: 'public_html/clientarea',
    file: 'test_mail.php',
    content: code
  });

  try {
    const res = await axios.get(`https://creativeyadley.com/clientarea/test_mail.php?auth=${authToken}`, {
      httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false })
    });
    console.log(res.data);
  } finally {
    await w.get('cpanel', {
      cpanel_jsonapi_user: 'creativeyadley',
      cpanel_jsonapi_apiversion: '3',
      cpanel_jsonapi_module: 'Fileman',
      cpanel_jsonapi_func: 'fileop',
      op: 'unlink',
      sourcefiles: 'public_html/clientarea/test_mail.php'
    }).catch(console.error);
  }
}
main().catch(console.error);

