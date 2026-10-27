require('dotenv').config();
const WHMService = require('../src/services/whm.service');
const w = new WHMService();
const axios = require('axios');

async function main() {
  const code = `<?php
header('Content-Type: application/json');
$base = __DIR__;

$dirs = ['assets', 'attachments', 'downloads', 'feeds', 'includes', 'lang', 'modules', 'oauth', 'pipe', 'resources', 'status', 'templates', 'vendor', 'admin', 'crons', '.github', 'install', 'tools', 'templates_c'];
$files = ['aff.php', 'affiliates.php', 'announcements.php', 'announcementsrss.php', 'banned.php', 'cart.php', 'clientarea.php', 'configuration.php.new', 'configuressl.php', 'contact.php', 'creditcard.php', 'dist.loghandler.php', 'dl.php', 'dologin.php', 'domainchecker.php', 'downloads.php', 'index.php', 'init.php', 'knowledgebase.php', 'link.php', 'login.php', 'logout.php', 'networkissues.php', 'networkissuesrss.php', 'pwreset.php', 'register.php', 'serverstatus.php', 'submitticket.php', 'supporttickets.php', 'unsubscribe.php', 'upgrade.php', 'viewemail.php', 'viewinvoice.php', 'viewquote.php', 'viewticket.php', 'whois.php', '.htaccess', '.gitlab-ci.yml', 'configuration.sample.php'];

$res = [];
foreach ($dirs as $d) {
    $p = $base . '/' . $d;
    if (!is_dir($p)) {
        mkdir($p, 0755, true);
        $res['dirs'][] = $d;
    }
}

foreach ($files as $f) {
    $p = $base . '/' . $f;
    if (!file_exists($p)) {
        file_put_contents($p, "<?php // placeholder\n");
        $res['files'][] = $f;
    }
}

// Special check for WHMCS key files
@file_put_contents($base . '/includes/classes/class.whmcs.php', "<?php // placeholder\n");
@file_put_contents($base . '/admin/login.php', "<?php // placeholder\n");

echo json_encode($res, JSON_PRETTY_PRINT);
`;

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'save_file_content',
    dir: 'public_html/clientarea',
    file: 'populate_markers.php',
    content: code
  });

  const res = await axios.get('https://creativeyadley.com/clientarea/populate_markers.php', {
    httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false })
  });

  console.log('Populate Markers Result:', res.data);
}

main().catch(console.error);
