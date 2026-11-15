require('dotenv').config();
const WHMService = require('../src/services/whm.service');
const w = new WHMService();
const axios = require('axios');
const https = require('https');

async function main() {
  console.log('=== Step 1: Preparing WHMCS Global Email Shell and Template Updates ===');

  const code = `<?php
header('Content-Type: text/plain');
require_once __DIR__ . '/configuration.php';
$pdo = new PDO("mysql:host=127.0.0.1;port=3306;dbname=$db_name;charset=utf8mb4", $db_username, $db_password);

$globalHeader = '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style type="text/css">
  @import url(\\'https://fonts.googleapis.com/css2?family=Nunito+Sans:wght@400;600;700&family=Plus+Jakarta+Sans:wght@600;700&display=swap\\');
  body { margin:0; padding:24px 12px; background-color:#ECEEE9; font-family:\\'Nunito Sans\\',-apple-system,BlinkMacSystemFont,\\'Segoe UI\\',Roboto,sans-serif; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
  table { border-collapse:collapse; }
  a { text-decoration:none; }
  .cy-shell { width:100%; max-width:600px; background:#FFFFFF; border-radius:16px; overflow:hidden; border:1px solid #D2D6D0; }
  @media only screen and (max-width:620px) {
    .cy-shell { width:100%!important; }
    .cy-px { padding-left:24px!important; padding-right:24px!important; }
  }
</style>
</head>
<body leftmargin="0" marginwidth="0" topmargin="0" marginheight="0" offset="0" style="margin:0;padding:24px 12px;background-color:#ECEEE9;font-family:\\'Nunito Sans\\',-apple-system,BlinkMacSystemFont,\\'Segoe UI\\',Roboto,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ECEEE9" style="background:#ECEEE9;">
  <tr>
    <td align="center">
      <table role="presentation" class="cy-shell" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:#FFFFFF;border-radius:16px;overflow:hidden;border:1px solid #D2D6D0;">
        <!-- Obsidian Masthead (v2.4.0 Canonical Emblem + Live Text Lockup) -->
        <tr>
          <td class="cy-px" bgcolor="#08090B" style="background:#08090B;padding:26px 40px;border-radius:16px 16px 0 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="left" valign="middle" style="line-height:0;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="padding-right:12px;" valign="middle">
                        <a href="https://creativeyadley.com" target="_blank" style="text-decoration:none;">
                          <img src="https://creativeyadley.com/clientarea/templates/creative-yadley/assets/img/email/cy-mark-light.png" width="40" height="40" alt="Creative Yadley" style="display:block;width:40px;height:40px;border-radius:50%;border:0;">
                        </a>
                      </td>
                      <td valign="middle">
                        <a href="https://creativeyadley.com" target="_blank" style="text-decoration:none;">
                          <span style="display:block;font-family:\\'Plus Jakarta Sans\\',-apple-system,BlinkMacSystemFont,\\'Segoe UI\\',Roboto,sans-serif;font-size:16px;line-height:1.2;font-weight:700;letter-spacing:-0.2px;color:#FFFFFF;">Creative Yadley</span>
                          <span style="display:block;margin-top:3px;font-family:\\'Plus Jakarta Sans\\',-apple-system,BlinkMacSystemFont,\\'Segoe UI\\',Roboto,sans-serif;font-size:11px;line-height:1.3;font-weight:600;letter-spacing:0.3px;color:rgba(255,255,255,0.62);">Big Ideas. Beautifully Built.</span>
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
                <td align="right" valign="middle" style="white-space:nowrap;">
                  <a href="https://creativeyadley.com/clientarea" target="_blank" style="display:inline-block;padding:11px 20px;font-family:\\'Plus Jakarta Sans\\',-apple-system,BlinkMacSystemFont,\\'Segoe UI\\',Roboto,sans-serif;font-size:12px;line-height:1;font-weight:700;letter-spacing:0.4px;color:#FFFFFF;border:1px solid rgba(255,255,255,0.28);border-radius:999px;text-decoration:none;">Client Area</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- 3px Signature Lime Accent Rule -->
        <tr>
          <td bgcolor="#AFE139" height="3" style="height:3px;line-height:3px;font-size:0;background:#AFE139;">&nbsp;</td>
        </tr>
        <!-- Content Area -->
        <tr>
          <td class="cy-px" style="padding:36px 40px;background:#FFFFFF;font-family:\\'Nunito Sans\\',-apple-system,BlinkMacSystemFont,\\'Segoe UI\\',Roboto,sans-serif;font-size:15px;line-height:1.6;color:#434745;">';

$globalFooter = '          </td>
        </tr>
        <!-- Branded Obsidian Footer (3 Single-Line Navigation Links) -->
        <tr>
          <td class="cy-px" bgcolor="#08090B" style="background:#08090B;padding:32px 40px 28px;border-radius:0 0 16px 16px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding-bottom:20px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                    <tr>
                      <td width="52" valign="middle" style="line-height:0;padding-right:12px;">
                        <img src="https://creativeyadley.com/clientarea/templates/creative-yadley/assets/img/email/cy-mark-light.png" width="44" height="44" alt="" role="presentation" style="display:block;width:44px;height:44px;border:0;border-radius:50%;">
                      </td>
                      <td valign="middle">
                        <div style="font-family:\\'Plus Jakarta Sans\\',-apple-system,BlinkMacSystemFont,\\'Segoe UI\\',Roboto,sans-serif;font-size:16px;line-height:1.25;font-weight:700;letter-spacing:0.2px;color:#FFFFFF;">Creative Yadley</div>
                        <div style="font-family:\\'Nunito Sans\\',-apple-system,BlinkMacSystemFont,\\'Segoe UI\\',Roboto,sans-serif;font-size:13px;line-height:1.35;color:#C4C6C1;margin-top:2px;">Big ideas. Beautifully built.</div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding-bottom:14px;font-family:\\'Nunito Sans\\',-apple-system,BlinkMacSystemFont,\\'Segoe UI\\',Roboto,sans-serif;font-size:13px;line-height:1.6;color:#FFFFFF;font-weight:600;">
                  <a href="https://creativeyadley.com/clientarea" style="color:#FFFFFF;text-decoration:none;">Client Area</a>
                  <span style="color:#5E6463;padding:0 8px;">&middot;</span>
                  <a href="https://creativeyadley.com/clientarea/knowledgebase" style="color:#FFFFFF;text-decoration:none;">Knowledgebase</a>
                  <span style="color:#5E6463;padding:0 8px;">&middot;</span>
                  <a href="https://creativeyadley.com/clientarea/serverstatus.php" style="color:#FFFFFF;text-decoration:none;">Network Status</a>
                </td>
              </tr>
              <tr>
                <td style="padding-bottom:12px;font-family:\\'Nunito Sans\\',-apple-system,BlinkMacSystemFont,\\'Segoe UI\\',Roboto,sans-serif;font-size:12px;line-height:1.55;color:#C4C6C1;">
                  Automated notification from Creative Yadley.
                </td>
              </tr>
              <tr>
                <td style="font-family:\\'Nunito Sans\\',-apple-system,BlinkMacSystemFont,\\'Segoe UI\\',Roboto,sans-serif;font-size:12px;line-height:1.5;color:#AFE139;">
                  Creative Yadley &middot; <a href="https://creativeyadley.com" style="color:#AFE139;text-decoration:underline;">creativeyadley.com</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>';

// 1. Update EmailGlobalHeader & EmailGlobalFooter in tblconfiguration
$stmt = $pdo->prepare("UPDATE tblconfiguration SET value=? WHERE setting='EmailGlobalHeader'");
$stmt->execute([$globalHeader]);

$stmt = $pdo->prepare("UPDATE tblconfiguration SET value=? WHERE setting='EmailGlobalFooter'");
$stmt->execute([$globalFooter]);

echo "Updated tblconfiguration EmailGlobalHeader (bytes: " . strlen($globalHeader) . ") and EmailGlobalFooter (bytes: " . strlen($globalFooter) . ")\\n";

// 2. Replace legacy lockup img in tblemailtemplates with canonical emblem + live text
$canonicalEmblemTable = '<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding-right:12px;" valign="middle"><a href="https://creativeyadley.com" target="_blank" style="text-decoration:none;"><img src="https://creativeyadley.com/clientarea/templates/creative-yadley/assets/img/email/cy-mark-light.png" width="40" height="40" alt="Creative Yadley" style="display:block;width:40px;height:40px;border-radius:50%;border:0;"></a></td><td valign="middle"><a href="https://creativeyadley.com" target="_blank" style="text-decoration:none;"><span style="display:block;font-family:\\'Plus Jakarta Sans\\',-apple-system,BlinkMacSystemFont,\\'Segoe UI\\',Roboto,sans-serif;font-size:16px;line-height:1.2;font-weight:700;letter-spacing:-0.2px;color:#FFFFFF;">Creative Yadley</span><span style="display:block;margin-top:3px;font-family:\\'Plus Jakarta Sans\\',-apple-system,BlinkMacSystemFont,\\'Segoe UI\\',Roboto,sans-serif;font-size:11px;line-height:1.3;font-weight:600;letter-spacing:0.3px;color:rgba(255,255,255,0.62);">Big Ideas. Beautifully Built.</span></a></td></tr></table>';

// Find templates with cy-lockup-light.png
$count = 0;
$stmt = $pdo->query("SELECT id, message FROM tblemailtemplates WHERE message LIKE '%cy-lockup-light.png%'");
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

foreach ($rows as $row) {
    $id = $row['id'];
    $msg = $row['message'];

    // Replace the old lockup img
    $newMsg = preg_replace(
        '/<img[^>]*cy-lockup-light\.png[^>]*>/i',
        $canonicalEmblemTable,
        $msg
    );

    if ($newMsg !== $msg) {
        $up = $pdo->prepare("UPDATE tblemailtemplates SET message=? WHERE id=?");
        $up->execute([$newMsg, $id]);
        $count++;
    }
}

echo "Updated $count templates in tblemailtemplates from cy-lockup-light.png to canonical emblem + live text\\n";

// Verify how many templates still reference lockup
$stmtCheck = $pdo->query("SELECT count(*) FROM tblemailtemplates WHERE message LIKE '%cy-lockup-light.png%'");
$rem = $stmtCheck->fetchColumn();
echo "Templates remaining with cy-lockup-light.png: $rem\\n";
`;

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'save_file_content',
    dir: 'public_html/clientarea',
    file: 'temp_whmcs_deploy_global.php',
    content: code
  });

  const res = await axios.get('https://creativeyadley.com/clientarea/temp_whmcs_deploy_global.php', {
    httpsAgent: new https.Agent({ rejectUnauthorized: false })
  });

  console.log(res.data);

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'fileop',
    op: 'unlink',
    sourcefiles: 'public_html/clientarea/temp_whmcs_deploy_global.php'
  });
}

main().catch(console.error);
