require('dotenv').config();
const WHMService = require('../src/services/whm.service');
const w = new WHMService();

async function main() {
  const res = await w.get('cpanel', {
    cpanel_jsonapi_user: 'fusionfitness',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'DomainInfo',
    cpanel_jsonapi_func: 'list_domains'
  });
  console.log('cPanel domains for fusionfitness:', JSON.stringify(res, null, 2));
}

main().catch(console.error);

