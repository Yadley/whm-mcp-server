require('dotenv').config();
const WHMService = require('../src/services/whm.service');
const w = new WHMService();
const axios = require('axios');

async function main() {
  const code = `<?php
header('Content-Type: text/plain');
set_time_limit(600);

function runCmd($cmd) {
    $descriptors = [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']];
    $proc = proc_open($cmd, $descriptors, $pipes, dirname(__DIR__));
    if (is_resource($proc)) {
        fclose($pipes[0]);
        $out = stream_get_contents($pipes[1]);
        $err = stream_get_contents($pipes[2]);
        fclose($pipes[1]); fclose($pipes[2]);
        $status = proc_close($proc);
        return "EXIT CODE: $status\\nOUT:\\n$out\\nERR:\\n$err\\n";
    }
    return "proc_open failed";
}

$cmd = 'php ' . __DIR__ . '/install/bin/installer.php --upgrade --non-interactive --verbose';
echo runCmd($cmd);
`;

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'save_file_content',
    dir: 'public_html/clientarea',
    file: 'run_installer_upgrade.php',
    content: code
  });

  console.log('Script uploaded. Executing upgrade...');
  try {
    const res = await axios.get('https://creativeyadley.com/clientarea/run_installer_upgrade.php', {
      httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }),
      timeout: 300000
    });
    console.log(res.data);
  } finally {
    await w.get('cpanel', {
      cpanel_jsonapi_user: 'creativeyadley',
      cpanel_jsonapi_apiversion: '3',
      cpanel_jsonapi_module: 'Fileman',
      cpanel_jsonapi_func: 'fileop',
      op: 'unlink',
      sourcefiles: 'public_html/clientarea/run_installer_upgrade.php'
    });
  }
}

main().catch(console.error);
