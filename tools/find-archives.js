require('dotenv').config();
const WHMService = require('../src/services/whm.service');
const w = new WHMService();
const axios = require('axios');

async function main() {
  const code = `<?php
header('Content-Type: application/json');
$homedir = '/home/creativeyadley';

function findArchives($dir, &$results, $depth = 0) {
    if ($depth > 4) return;
    $files = @scandir($dir);
    if (!$files) return;
    foreach ($files as $file) {
        if ($file === '.' || $file === '..') continue;
        $path = $dir . '/' . $file;
        if (is_dir($path)) {
            if ($file === 'mail' || $file === '.trash' || $file === 'perl5') continue;
            findArchives($path, $results, $depth + 1);
        } else {
            if (preg_match('/(whmcs.*\\.(zip|tar\\.gz|tgz)|ioncube.*\\.(tar\\.gz|zip))$/i', $file)) {
                $results[] = [
                    'path' => $path,
                    'size' => round(filesize($path) / (1024 * 1024), 2) . ' MB',
                    'mtime' => date('Y-m-d H:i:s', filemtime($path))
                ];
            }
        }
    }
}

$results = [];
findArchives($homedir, $results);
echo json_encode($results, JSON_PRETTY_PRINT);
`;

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'save_file_content',
    dir: 'public_html/clientarea',
    file: 'find_archives.php',
    content: code
  });

  const res = await axios.get('https://creativeyadley.com/clientarea/find_archives.php', {
    httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false })
  });

  console.log('Found Archives:', res.data);
}

main().catch(console.error);
