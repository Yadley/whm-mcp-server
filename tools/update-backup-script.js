require('dotenv').config();
const fs = require('fs');
const path = require('path');
const WHMService = require('../src/services/whm.service');
const w = new WHMService();

async function main() {
  const scriptContent = fs.readFileSync(path.join(__dirname, 'backup-whmcs-db.php'), 'utf8');

  console.log('Deploying updated backup script to /home/creativeyadley/bin/backup_whmcs_db.php...');
  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'save_file_content',
    dir: 'bin',
    file: 'backup_whmcs_db.php',
    content: scriptContent
  });

  console.log('Successfully deployed /home/creativeyadley/bin/backup_whmcs_db.php with Design System v2.3.0 email layout!');
}

main().catch(console.error);
