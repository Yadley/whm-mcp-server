require('dotenv').config();
const WHMService = require('../src/services/whm.service');
const w = new WHMService();
const axios = require('axios');

async function main() {
  const code = `<?php
header('Content-Type: text/plain');
$stateFile = '/home/creativeyadley/bin/migration_state.json';
if (file_exists($stateFile)) {
    $data = json_decode(file_get_contents($stateFile), true);
    if (isset($data['fusionfitnessvt.com'])) {
        print_r($data['fusionfitnessvt.com']);
    } else {
        echo "fusionfitnessvt.com NOT in state\\n";
    }
} else {
    echo "State file not found";
}
`;

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'save_file_content',
    dir: 'public_html/clientarea',
    file: 'read_fusion_state.php',
    content: code
  });

  const res = await axios.get('https://creativeyadley.com/clientarea/read_fusion_state.php', {
    httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false })
  });

  console.log(res.data);

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'fileop',
    op: 'unlink',
    sourcefiles: 'public_html/clientarea/read_fusion_state.php'
  });
}

main().catch(console.error);

