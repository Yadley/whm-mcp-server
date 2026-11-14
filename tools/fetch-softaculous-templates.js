require('dotenv').config();
const WHMService = require('../src/services/whm.service');
const w = new WHMService();
const axios = require('axios');
const https = require('https');

async function main() {
  const sessionRes = await w.get('create_user_session', { user: 'root', service: 'whostmgrd' });
  const token = sessionRes.data.cp_security_token;
  const loginUrl = sessionRes.data.url;
  const httpsAgent = new https.Agent({ rejectUnauthorized: false });
  let cookieMap = {};

  function updateCookies(res) {
    (res.headers['set-cookie'] || []).forEach(sc => {
      const part = sc.split(';')[0];
      const [k, v] = part.split('=');
      cookieMap[k.trim()] = v;
    });
  }

  let curUrl = loginUrl;
  for (let i = 0; i < 5; i++) {
    const r = await axios.get(curUrl, {
      httpsAgent,
      maxRedirects: 0,
      validateStatus: s => s >= 200 && s < 400,
      headers: { 'Cookie': Object.entries(cookieMap).map(([k, v]) => k + '=' + v).join('; ') }
    });
    updateCookies(r);
    if (r.headers.location) {
      curUrl = r.headers.location.startsWith('/') ? 'https://server2.creativeyadley.com:2087' + r.headers.location : r.headers.location;
    } else break;
  }

  const temps = ['install_php', 'clone', 'staging', 'pushtolive', 'backup', 'autoupgrade_success_user'];
  for (const t of temps) {
    const editUrl = `https://server2.creativeyadley.com:2087${token}/cgi/softaculous/index.php?act=editemailtemp&temp=${t}`;
    const r = await axios.get(editUrl, {
      httpsAgent,
      headers: { 'Cookie': Object.entries(cookieMap).map(([k, v]) => k + '=' + v).join('; ') }
    });
    const subMatch = /<input[^>]*name=["']tempsub["'][^>]*value=["']([^"']*)["']/i.exec(r.data);
    const bodyMatch = /<textarea[^>]*name=["']tempcontent["'][^>]*>([\s\S]*?)<\/textarea>/i.exec(r.data);
    console.log(`=== Template: ${t} ===`);
    console.log(`Subject: ${subMatch ? subMatch[1] : 'NOT FOUND'}`);
    console.log(`Body length: ${bodyMatch ? bodyMatch[1].length : 0}`);
    if (bodyMatch) {
      // Print first 400 chars of body
      console.log(bodyMatch[1].slice(0, 400));
      console.log('...\n');
    }
  }
}

main().catch(console.error);
