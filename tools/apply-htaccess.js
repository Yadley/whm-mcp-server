require('dotenv').config();
const WHMService = require('../src/services/whm.service');
const w = new WHMService();

const htaccessContent = `# WHMCS Modern Rewrite Rules
<IfModule mod_rewrite.c>
RewriteEngine On
RewriteBase /clientarea/

# Redirect directories to an address with a trailing slash
RewriteCond %{REQUEST_FILENAME} -d
RewriteRule ^(.+[^/])$ $1/ [R]

# Admin routing
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^admin/(.*)$ admin/index.php?rp=/admin/$1 [QSA,L]

# Client Area routing
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^(.*)$ index.php?rp=/$1 [QSA,L]
</IfModule>
`;

async function main() {
  const res = await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'save_file_content',
    dir: 'public_html/clientarea',
    file: '.htaccess',
    content: htaccessContent
  });
  console.log('Saved .htaccess:', res);
}

main().catch(console.error);
