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

  const canonicalMasthead = `<!-- Obsidian Masthead -->
          <tr>
            <td bgcolor="#08090B" style="background:#08090B;padding:26px 40px;border-radius:16px 16px 0 0;">
              <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="left" valign="middle" style="line-height:0;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="padding-right:12px;" valign="middle">
                          <a href="https://creativeyadley.com" target="_blank" style="text-decoration:none;">
                            <img src="https://creativeyadley.com/clientarea/templates/creative-yadley/assets/img/email/cy-mark-light.png" width="40" height="40" alt="Creative Yadley" style="display:block;width:40px;height:40px;border-radius:50%;border:0;">
                          </a>
                        </td>
                        <td valign="middle">
                          <a href="https://creativeyadley.com" target="_blank" style="text-decoration:none;">
                            <span style="display:block;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:16px;line-height:1.2;font-weight:700;letter-spacing:-0.2px;color:#FFFFFF;">Creative Yadley</span>
                            <span style="display:block;margin-top:3px;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:11px;line-height:1.3;font-weight:600;letter-spacing:0.3px;color:rgba(255,255,255,0.62);">Big Ideas. Beautifully Built.</span>
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td align="right" valign="middle" style="white-space:nowrap;">
                    <a href="https://creativeyadley.com/clientarea" target="_blank" style="display:inline-block;padding:11px 20px;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:12px;line-height:1;font-weight:700;letter-spacing:0.4px;color:#FFFFFF;border:1px solid rgba(255,255,255,0.28);border-radius:999px;text-decoration:none;">Client Area</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;

  const temps = ['install_php', 'clone', 'staging', 'pushtolive', 'backup', 'autoupgrade_success_user'];

  console.log('\n=== Step 2: Updating Masthead in all Softaculous Templates ===');
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

    // Replace the old masthead
    // Old masthead pattern: from <!-- Obsidian Masthead --> to <!-- 3px Signature Lime Accent Rule -->
    const oldMastheadRegex = /<!-- Obsidian Masthead -->[\s\S]*?(?=<!-- 3px Signature Lime Accent Rule -->)/;
    if (oldMastheadRegex.test(body)) {
      body = body.replace(oldMastheadRegex, canonicalMasthead + '\n\n          ');
      console.log(`[${t}] Replaced existing Obsidian Masthead.`);
    } else {
      console.warn(`[${t}] Warning: Obsidian Masthead pattern not found!`);
    }

    // Now save back to Softaculous
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

  console.log('\n=== Step 3: Verification of Deployed Mastheads ===');
  for (const t of temps) {
    const editUrl = `https://server2.creativeyadley.com:2087${token}/cgi/softaculous/index.php?act=editemailtemp&temp=${t}`;
    const r = await axios.get(editUrl, {
      httpsAgent,
      headers: { 'Cookie': getCookieHeader() }
    });
    const bodyMatch = /<textarea[^>]*name=["']tempcontent["'][^>]*>([\s\S]*?)<\/textarea>/i.exec(r.data);
    const content = bodyMatch ? bodyMatch[1] : '';

    const hasMark = content.includes('cy-mark-light.png');
    const hasLockup = content.includes('cy-lockup-light.png');
    const hasLiveText = content.includes('Big Ideas. Beautifully Built.');
    const hasLiveName = content.includes('Creative Yadley</span>');

    console.log(`[${t}] Verification:`);
    console.log(`  Emblem (cy-mark-light.png) present: ${hasMark}`);
    console.log(`  Deprecated lockup (cy-lockup-light.png) gone: ${!hasLockup}`);
    console.log(`  Live Name present: ${hasLiveName}`);
    console.log(`  Live Tagline present: ${hasLiveText}`);
  }
}

main().catch(console.error);
