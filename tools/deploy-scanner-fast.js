require('dotenv').config();
const fs = require('fs');
const path = require('path');
const WHMService = require('../src/services/whm.service');
const w = new WHMService();

async function main() {
  const content = fs.readFileSync(path.join(__dirname, 'scan-migrated-sites.php'), 'utf8');
  console.log('Uploading scan_migrated_sites.php to /home/creativeyadley/bin/...');
  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'save_file_content',
    dir: 'bin',
    file: 'scan_migrated_sites.php',
    content: content
  });
  console.log('Successfully deployed /home/creativeyadley/bin/scan_migrated_sites.php!');
}

main().catch(console.error);

