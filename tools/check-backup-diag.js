require('dotenv').config();
const WHMService = require('../src/services/whm.service');
const w = new WHMService();
const axios = require('axios');

async function main() {
  const code = `<?php
header('Content-Type: text/plain');

function runCmd($cmd) {
    $descriptors = [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']];
    $proc = proc_open($cmd, $descriptors, $pipes);
    if (is_resource($proc)) {
        fclose($pipes[0]);
        $out = stream_get_contents($pipes[1]);
        $err = stream_get_contents($pipes[2]);
        fclose($pipes[1]); fclose($pipes[2]);
        proc_close($proc);
        return trim($out . ($err ? "\\nSTDERR: " . $err : ""));
    }
    return "FAILED TO RUN";
}

echo "=== SERVER DATE/TIME ===\\n";
echo runCmd('date') . "\\n\\n";

echo "=== CPBACKUP PROCESSES ===\\n";
echo runCmd('pgrep -a -f backup || echo "No backup process running"') . "\\n\\n";

echo "=== CPBACKUP LOG DIRECTORY ===\\n";
echo runCmd('ls -la /usr/local/cpanel/logs/cpbackup/ 2>&1') . "\\n\\n";

echo "=== /backup DIRECTORY CONTENTS ===\\n";
echo runCmd('ls -la /backup 2>&1') . "\\n\\n";

echo "=== LATEST CPBACKUP LOG FILES ===\\n";
echo runCmd('find /usr/local/cpanel/logs/cpbackup/ -maxdepth 1 -type f 2>&1') . "\\n\\n";
`;

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'save_file_content',
    dir: 'public_html/clientarea',
    file: 'check_backup_diag.php',
    content: code
  });

  try {
    const res = await axios.get('https://creativeyadley.com/clientarea/check_backup_diag.php', {
      httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }),
      timeout: 15000
    });
    console.log(res.data);
  } finally {
    await w.get('cpanel', {
      cpanel_jsonapi_user: 'creativeyadley',
      cpanel_jsonapi_apiversion: '2',
      cpanel_jsonapi_module: 'Fileman',
      cpanel_jsonapi_func: 'fileop',
      op: 'unlink',
      sourcefiles: 'public_html/clientarea/check_backup_diag.php'
    });
  }
}
main().catch(console.error);
