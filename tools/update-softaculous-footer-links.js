require('dotenv').config();
const WHMService = require('../src/services/whm.service');
const w = new WHMService();
const axios = require('axios');
const https = require('https');
const querystring = require('querystring');

async function main() {
  console.log('=== Step 1: WHM Authentication ===');
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

  function getCookieHeader() {
    return Object.entries(cookieMap).map(([k, v]) => `${k}=${v}`).join('; ');
  }

  let curUrl = loginUrl;
  for (let i = 0; i < 5; i++) {
    const r = await axios.get(curUrl, {
      httpsAgent,
      maxRedirects: 0,
      validateStatus: s => s >= 200 && s < 400,
      headers: { 'Cookie': getCookieHeader() }
    });
    updateCookies(r);
    if (r.headers.location) {
      curUrl = r.headers.location.startsWith('/') ? 'https://server2.creativeyadley.com:2087' + r.headers.location : r.headers.location;
    } else break;
  }

  console.log('Authenticated with WHM session.');

  const temps = ['install_php', 'clone', 'staging', 'pushtolive', 'backup', 'autoupgrade_success_user'];

  console.log('\n=== Step 2: Removing 4th link (Open a Ticket) from Softaculous Footers ===');
  for (const t of temps) {
    const editUrl = `https://server2.creativeyadley.com:2087${token}/cgi/softaculous/index.php?act=editemailtemp&temp=${t}`;
    const r = await axios.get(editUrl, {
      httpsAgent,
      headers: { 'Cookie': getCookieHeader() }
    });

    const subMatch = /<input[^>]*name=["']tempsub["'][^>]*value=["']([^"']*)["']/i.exec(r.data);
    const bodyMatch = /<textarea[^>]*name=["']tempcontent["'][^>]*>([\s\S]*?)<\/textarea>/i.exec(r.data);

    if (!subMatch || !bodyMatch) {
      console.error(`Failed to parse template [${t}]`);
      continue;
    }

    const currentSubject = subMatch[1];
    let body = bodyMatch[1]
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&amp;/g, '&');

    // Remove the Open a Ticket link & separator
    // Target:
    // <span style="color:#5E6463;padding:0 8px;">&middot;</span>\s*<a href="https://creativeyadley.com/clientarea/submitticket.php[^"]*" style="color:#FFFFFF;text-decoration:none;">Open a Ticket</a>
    const ticketRegex = /<span style="color:#5E6463;padding:0 8px;">&middot;<\/span>\s*<a href="https:\/\/creativeyadley\.com\/clientarea\/submitticket\.php[^"]*" style="color:#FFFFFF;text-decoration:none;">Open a Ticket<\/a>/gi;

    if (ticketRegex.test(body)) {
      body = body.replace(ticketRegex, '');
      console.log(`[${t}] Removed 'Open a Ticket' link successfully.`);
    } else {
      console.warn(`[${t}] Warning: 'Open a Ticket' pattern not matched!`);
    }

    // Save template
    const postData = querystring.stringify({
      changelang: 'english',
      tempsub: currentSubject,
      ishtml: 'on',
      tempcontent: body,
      savetemplate: 'Save Email Template'
    });

    const postRes = await axios.post(editUrl, postData, {
      httpsAgent,
      headers: {
        'Cookie': getCookieHeader(),
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    });

    const isSuccess = postRes.data.includes('The email template was saved successfully');
    console.log(`  -> ${t}: ${isSuccess ? 'SAVED SUCCESSFULLY' : 'FAILED'} (HTTP ${postRes.status})`);
  }

  console.log('\n=== Step 3: Verification of Footer Links ===');
  for (const t of temps) {
    const editUrl = `https://server2.creativeyadley.com:2087${token}/cgi/softaculous/index.php?act=editemailtemp&temp=${t}`;
    const r = await axios.get(editUrl, {
      httpsAgent,
      headers: { 'Cookie': getCookieHeader() }
    });
    const bodyMatch = /<textarea[^>]*name=["']tempcontent["'][^>]*>([\s\S]*?)<\/textarea>/i.exec(r.data);
    const content = bodyMatch ? bodyMatch[1] : '';

    const hasClientArea = content.includes('clientarea');
    const hasKb = content.includes('knowledgebase');
    const hasStatus = content.includes('serverstatus.php');
    const hasTicket = content.includes('submitticket.php');

    console.log(`[${t}] Link verification:`);
    console.log(`  Client Area: ${hasClientArea}`);
    console.log(`  Knowledgebase: ${hasKb}`);
    console.log(`  Network Status: ${hasStatus}`);
    console.log(`  Open a Ticket (should be false): ${hasTicket}`);
  }
}

main().catch(console.error);
