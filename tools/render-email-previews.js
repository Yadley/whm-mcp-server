const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Design System Tokens (Creative Yadley v2.3.0)
const C = {
  ink: '#08090B',
  body: '#434745',
  muted: '#5E6463',
  hair: '#D2D6D0',
  panel: '#F4F5F2',
  page: '#ECEEE9',
  lime: '#AFE139',
  limeInk: '#0B0D0E',
  white: '#FFFFFF',
  silver: '#C4C6C1',
  alertBg: '#FEF2F2',
  alertBorder: '#FECACA',
  alertInk: '#991B1B',
  successBg: '#F0FDF4',
  successBorder: '#BBF7D0',
  successInk: '#166534',
  warnBg: '#FFFBEB',
  warnBorder: '#FDE68A',
  warnInk: '#92400E',
  greyBg: '#F3F4F6',
  greyBorder: '#E5E7EB',
  greyInk: '#4B5563',
};

const F = {
  display: "'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",
  sans: "'Nunito Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",
  mono: "'JetBrains Mono',Consolas,'Courier New',monospace",
};

function titleCase(str) {
  const small = ['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'from', 'in', 'into', 'nor', 'of', 'on', 'onto', 'or', 'over', 'per', 'the', 'to', 'up', 'via', 'vs', 'with'];
  return str.split(' ').map((word, i) => {
    if (!word) return '';
    const lower = word.toLowerCase();
    if (i > 0 && small.includes(lower)) return lower;
    return word.charAt(0).toUpperCase() + word.slice(1);
  }).join(' ');
}

function buttonCase(str) {
  return str.trim().split(/\s+/).map(word => {
    if (!word) return '';
    return word.charAt(0).toUpperCase() + word.slice(1);
  }).join(' ');
}

/**
 * Compacts HTML to prevent email parsers (and WHMCS nl2br) from inserting
 * extraneous linebreaks and causing massive vertical gaps.
 */
function compactHtml(html) {
  return html
    .replace(/>\r?\n\s*</g, '><')
    .replace(/\r?\n\s*/g, ' ')
    .trim();
}

/**
 * Clean 2x2 Metric Cards Grid with rich color coding
 */
function render2x2MetricGrid(metrics) {
  const [m1, m2, m3, m4] = metrics;
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;">
      <tr>
        <td class="cy-col" width="48.5%" valign="top" style="background:${m1.bg};border:1px solid ${m1.border};border-radius:12px;padding:16px 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td>
                <div style="font-family:${F.display};font-size:11px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:${m1.labelColor};">${m1.label}</div>
                <div style="font-family:${F.display};font-size:28px;font-weight:800;color:${m1.numberColor};line-height:1.15;margin:6px 0 2px;">${m1.value}</div>
                <div style="font-family:${F.sans};font-size:12px;line-height:1.4;color:${m1.subColor};">${m1.subtitle}</div>
              </td>
            </tr>
          </table>
        </td>
        <td class="cy-col-gap" width="3%" style="width:3%;font-size:0;line-height:0;">&nbsp;</td>
        <td class="cy-col" width="48.5%" valign="top" style="background:${m2.bg};border:1px solid ${m2.border};border-radius:12px;padding:16px 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td>
                <div style="font-family:${F.display};font-size:11px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:${m2.labelColor};">${m2.label}</div>
                <div style="font-family:${F.display};font-size:28px;font-weight:800;color:${m2.numberColor};line-height:1.15;margin:6px 0 2px;">${m2.value}</div>
                <div style="font-family:${F.sans};font-size:12px;line-height:1.4;color:${m2.subColor};">${m2.subtitle}</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr><td class="cy-row-gap" colspan="3" height="12" style="height:12px;line-height:12px;font-size:0;">&nbsp;</td></tr>
      <tr>
        <td class="cy-col" width="48.5%" valign="top" style="background:${m3.bg};border:1px solid ${m3.border};border-radius:12px;padding:16px 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td>
                <div style="font-family:${F.display};font-size:11px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:${m3.labelColor};">${m3.label}</div>
                <div style="font-family:${F.display};font-size:28px;font-weight:800;color:${m3.numberColor};line-height:1.15;margin:6px 0 2px;">${m3.value}</div>
                <div style="font-family:${F.sans};font-size:12px;line-height:1.4;color:${m3.subColor};">${m3.subtitle}</div>
              </td>
            </tr>
          </table>
        </td>
        <td class="cy-col-gap" width="3%" style="width:3%;font-size:0;line-height:0;">&nbsp;</td>
        <td class="cy-col" width="48.5%" valign="top" style="background:${m4.bg};border:1px solid ${m4.border};border-radius:12px;padding:16px 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td>
                <div style="font-family:${F.display};font-size:11px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:${m4.labelColor};">${m4.label}</div>
                <div style="font-family:${F.display};font-size:28px;font-weight:800;color:${m4.numberColor};line-height:1.15;margin:6px 0 2px;">${m4.value}</div>
                <div style="font-family:${F.sans};font-size:12px;line-height:1.4;color:${m4.subColor};">${m4.subtitle}</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;
}

/**
 * Builds an Internal Admin Email conforming to Creative Yadley Email Design System 1.0 / Design System v2.3.0
 */
function renderInternalShell({ eyebrow, title, lead, details, note, contentHtml, ctaLabel, ctaUrl, footerNote }) {
  const detailRows = (details || []).map(row => {
    const isMono = !!row[2];
    const font = isMono ? `font-family:${F.mono};font-size:14px;` : `font-family:${F.sans};font-size:14px;`;
    return `<tr>
      <td class="cy-dl" width="38%" valign="top" style="padding:10px 16px 10px 0;border-bottom:1px solid ${C.hair};font-family:${F.sans};font-size:13px;line-height:1.4;color:${C.muted};">${row[0]}</td>
      <td class="cy-dv" valign="top" style="padding:10px 0;border-bottom:1px solid ${C.hair};${font}line-height:1.4;font-weight:600;color:${C.ink};">${row[1]}</td>
    </tr>`;
  }).join('');

  const detailsTable = details && details.length > 0 ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px;background:${C.panel};border:1px solid ${C.hair};border-radius:12px;border-collapse:separate;border-spacing:0;">
      <tr>
        <td style="padding:4px 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            ${detailRows}
          </table>
        </td>
      </tr>
    </table>` : '';

  const noteBox = note ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px;background:${note.bg || C.panel};border:1px solid ${note.border || C.hair};border-radius:12px;border-collapse:separate;border-spacing:0;">
      <tr>
        <td style="padding:18px 22px;">
          <p style="margin:0 0 4px;font-family:${F.display};font-size:11px;line-height:1.4;font-weight:700;letter-spacing:1.3px;text-transform:uppercase;color:${note.labelColor || C.muted};">${note.label}</p>
          <div style="margin:0;font-family:${F.sans};font-size:14px;line-height:1.55;color:${note.textColor || C.body};">${note.html || note.text}</div>
        </td>
      </tr>
    </table>` : '';

  const ctaBlock = ctaLabel && ctaUrl ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td height="18" style="height:18px;line-height:18px;font-size:0;">&nbsp;</td></tr>
      <tr>
        <td align="left">
          <!--[if mso]>
          <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${ctaUrl}" style="height:50px;v-text-anchor:middle;width:270px;" arcsize="50%" fillcolor="${C.lime}" stroke="f">
            <w:anchorlock/>
            <center style="color:${C.limeInk};font-family:Arial,sans-serif;font-size:15px;font-weight:bold;">${buttonCase(ctaLabel)}</center>
          </v:roundrect>
          <![endif]-->
          <!--[if !mso]><!-->
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;">
            <tr>
              <td bgcolor="${C.lime}" style="background-color:${C.lime};border-radius:9999px;">
                <a href="${ctaUrl}" class="cy-btn" style="display:inline-block;padding:16px 36px;font-family:${F.display};font-size:15px;line-height:1;font-weight:700;color:${C.limeInk};background-color:${C.lime};border:1px solid ${C.lime};text-decoration:none;border-radius:9999px;text-align:center;">${buttonCase(ctaLabel)}</a>
              </td>
            </tr>
          </table>
          <!--<![endif]-->
        </td>
      </tr>
      <tr><td height="20" style="height:20px;line-height:20px;font-size:0;">&nbsp;</td></tr>
    </table>` : '';

  const fNote = footerNote || 'Internal studio notification. Not a client message.';

  const fullHtml = `<!doctype html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" lang="en" dir="ltr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${titleCase(title)}</title>
<!--[if mso]>
<noscript><xml><o:OfficeDocumentSettings><o:AllowPNG/><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
<![endif]-->
<style type="text/css">
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&family=Nunito+Sans:wght@400;600;700&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap');
  html,body{margin:0!important;padding:0!important;width:100%!important;}
  table{border-collapse:collapse;}
  img{-ms-interpolation-mode:bicubic;}
  a{text-decoration:none;}
  .cy-inline-link{color:${C.ink}!important;text-decoration:underline!important;text-decoration-color:${C.lime}!important;text-underline-offset:3px!important;font-weight:700!important;}
  @media only screen and (max-width:620px){
    .cy-shell{width:100%!important;}
    .cy-px{padding-left:20px!important;padding-right:20px!important;padding-top:28px!important;padding-bottom:24px!important;}
    .cy-h1{font-size:22px!important;line-height:1.25!important;}
    .cy-dl,.cy-dv{display:block!important;width:auto!important;padding:0 0 2px!important;border-bottom:none!important;}
    .cy-dl{padding-top:8px!important;}
    .cy-dv{padding-bottom:8px!important;border-bottom:1px solid ${C.hair}!important;}
    .cy-btn{display:block!important;width:100%!important;box-sizing:border-box!important;text-align:center!important;padding:16px 20px!important;}
    .cy-col{display:block!important;width:100%!important;box-sizing:border-box!important;margin-bottom:10px!important;}
    .cy-col-gap{display:none!important;}
    .cy-row-gap{display:none!important;}
  }
</style>
</head>
<body style="margin:0;padding:0;background:${C.page};-webkit-text-size-adjust:100%;">
<div style="display:none;font-size:1px;color:${C.page};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${titleCase(title)} - Server 2 Notification</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.page}" style="background:${C.page};">
  <tr>
    <td align="center" style="padding:16px 10px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" class="cy-shell" style="width:600px;max-width:600px;background:${C.white};border-radius:14px;overflow:hidden;">
        <!-- Internal Admin Content-Only Surface: No Hero, No Logo, No Footer -->
        <tr>
          <td class="cy-px" bgcolor="${C.white}" style="background:${C.white};padding:32px 36px 28px;">
            <p style="margin:0 0 6px;font-family:${F.display};font-size:11px;line-height:1.4;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${C.muted};">${eyebrow}</p>
            <h1 class="cy-h1" style="margin:0 0 10px;font-family:${F.display};font-size:24px;line-height:1.22;letter-spacing:-0.4px;font-weight:700;color:${C.ink};">${titleCase(title)}</h1>
            ${lead ? `<p style="margin:0 0 18px;font-family:${F.sans};font-size:15px;line-height:1.5;color:${C.body};">${lead}</p>` : ''}
            
            ${detailsTable}
            ${noteBox}
            ${contentHtml || ''}
            
            ${ctaBlock}

            <p style="margin:16px 0 0;font-family:${F.sans};font-size:12px;line-height:1.55;color:${C.muted};border-top:1px solid ${C.hair};padding-top:14px;">
              ${fNote} &middot; <a href="https://creativeyadley.com/clientarea/admin/" style="color:${C.muted};text-decoration:underline;">Admin Area</a> &middot; server2.creativeyadley.com
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

  return compactHtml(fullHtml);
}

// 1. Build Backup Notification HTML
function generateBackupEmailHtml() {
  const filename = 'whmcs_backup_20261107_020000.sql.gz';
  const fileSizeMB = 36.42;
  const fileSizeBytes = 38189124;
  const duration = 4.82;
  const dbName = 'creative_whmcs';
  const downloadUrl = 'https://creativeyadley.com/clientarea/get_db_backup.php?file=' + encodeURIComponent(filename) + '&token=67b620b22a0888d3e23048995a8e0cb702f3c054045f4cbda1f0d3b664d924ad';

  return renderInternalShell({
    eyebrow: 'DATABASE BACKUP',
    title: 'WHMCS Database Backup Completed',
    lead: 'The daily automated WHMCS database backup for server2.creativeyadley.com completed successfully with verified gzip archive integrity.',
    details: [
      ['Status', '<span style="color:#166534;background:#DCFCE7;padding:3px 8px;border-radius:4px;font-size:12px;font-weight:700;">Verified (Gzip Test Passed)</span>'],
      ['Database', `${dbName} (Optimized)`],
      ['Backup Archive', filename, true],
      ['Archive Size', `${fileSizeMB} MB (${fileSizeBytes.toLocaleString()} bytes)`],
      ['Generation Time', `${duration} seconds`],
      ['Timestamp (UTC)', '2026-11-07 02:00:04 UTC'],
      ['Timestamp (PHT)', '2026-11-07 10:00:04 PHT'],
      ['Retention Policy', '14 rolling days (1 old backup pruned)'],
    ],
    note: {
      label: 'SECURE DIRECT DOWNLOAD',
      text: 'This direct download link is cryptographically authenticated with your WHMCS security hash. Click below to securely download the compressed database dump directly to your workstation.',
    },
    ctaLabel: 'Download Database Backup',
    ctaUrl: downloadUrl,
    footerNote: 'Internal studio backup automation. Not a client message.',
  });
}

// 2. Build Migration Digest HTML with 2x2 Metric Cards and Generous Padding
function generateMigrationDigestHtml() {
  const metrics = [
    {
      label: 'Total Audited',
      value: '29',
      subtitle: 'Monitored cPanel accounts',
      bg: '#F8FAFC',
      border: '#E2E8F0',
      labelColor: '#475569',
      numberColor: '#0F172A',
      subColor: '#64748B',
    },
    {
      label: 'Active on Server',
      value: '1',
      subtitle: 'Resolving to 66.29.147.164',
      bg: '#F0FDF4',
      border: '#BBF7D0',
      labelColor: '#166534',
      numberColor: '#15803D',
      subColor: '#166534',
    },
    {
      label: 'Action Required',
      value: '0',
      subtitle: 'No domains routed away',
      bg: '#FFFBEB',
      border: '#FDE68A',
      labelColor: '#92400E',
      numberColor: '#D97706',
      subColor: '#B45309',
    },
    {
      label: 'Inactive / Excluded',
      value: '28',
      subtitle: 'Core platform & dormant',
      bg: '#F3F4F6',
      border: '#E5E7EB',
      labelColor: '#6B7280',
      numberColor: '#4B5563',
      subColor: '#6B7280',
    },
  ];

  const metricGrid = render2x2MetricGrid(metrics);

  const noticeBox = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;background:#F0FDF4;border:1px solid #BBF7D0;border-radius:12px;border-collapse:separate;">
      <tr>
        <td style="padding:20px 24px;font-family:${F.sans};font-size:14px;line-height:1.6;color:#166534;">
          <div style="font-family:${F.display};font-size:14px;font-weight:700;color:#166534;margin-bottom:4px;">0 New Migrations Detected Today</div>
          <div style="font-family:${F.sans};font-size:14px;line-height:1.55;color:#166534;">No client website DNS changes were detected in the last 24-hour audit cycle.</div>
        </td>
      </tr>
    </table>`;

  const auditResults = [
    { domain: 'creativestudio.com', client: 'Studio Media (#1012)', status: 'Active in WHMCS', dest: 'ns1.digitalocean.com, ns2.digitalocean.com (IP: 159.203.11.22)', action: 'Cancel & Archive' },
    { domain: 'apexbrand.net', client: 'Apex Brand LLC (#1024)', status: 'Active in WHMCS', dest: 'ns1.bluehost.com, ns2.bluehost.com (IP: 162.241.11.44)', action: 'Cancel & Archive' }
  ];

  const actionRows = auditResults.map(item => `
    <tr>
      <td style="padding:12px 14px;border-bottom:1px solid ${C.hair};vertical-align:top;word-break:break-all;">
        <a href="https://${item.domain}" target="_blank" class="cy-inline-link">${item.domain}</a>
      </td>
      <td style="padding:12px 14px;border-bottom:1px solid ${C.hair};vertical-align:top;font-family:${F.sans};font-size:13px;color:${C.body};">${item.client}</td>
      <td style="padding:12px 14px;border-bottom:1px solid ${C.hair};vertical-align:top;">
        <span style="background:${C.alertBg};color:${C.alertInk};padding:3px 8px;border-radius:4px;font-size:11px;font-weight:700;letter-spacing:0.3px;">ACTIVE IN WHMCS</span>
      </td>
      <td style="padding:12px 14px;border-bottom:1px solid ${C.hair};vertical-align:top;font-family:${F.sans};font-size:13px;color:${C.body};word-break:break-word;">
        <div style="font-weight:600;color:${C.ink};">${item.dest.split(' (IP:')[0]}</div>
        <div style="color:${C.muted};font-size:11px;margin-top:2px;">IP: ${item.dest.split(' (IP:')[1].replace(')', '')}</div>
      </td>
      <td style="padding:12px 14px;border-bottom:1px solid ${C.hair};vertical-align:top;font-family:${F.sans};font-size:13px;font-weight:700;color:${C.alertInk};">
        ${item.action}
      </td>
    </tr>
  `).join('');

  const contentHtml = `
    ${noticeBox}
    ${metricGrid}
    
    <div style="margin:0 0 10px;font-family:${F.display};font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${C.ink};">Pending Action Items (2)</div>
    <div style="border:1px solid ${C.hair};border-radius:12px;overflow:hidden;margin-bottom:18px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FFFFFF;">
        <thead>
          <tr bgcolor="${C.panel}">
            <th align="left" style="padding:10px 14px;font-family:${F.display};font-size:11px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;color:${C.muted};border-bottom:1px solid ${C.hair};">Domain</th>
            <th align="left" style="padding:10px 14px;font-family:${F.display};font-size:11px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;color:${C.muted};border-bottom:1px solid ${C.hair};">Client</th>
            <th align="left" style="padding:10px 14px;font-family:${F.display};font-size:11px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;color:${C.muted};border-bottom:1px solid ${C.hair};">WHMCS</th>
            <th align="left" style="padding:10px 14px;font-family:${F.display};font-size:11px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;color:${C.muted};border-bottom:1px solid ${C.hair};">Nameservers</th>
            <th align="left" style="padding:10px 14px;font-family:${F.display};font-size:11px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;color:${C.muted};border-bottom:1px solid ${C.hair};">Action</th>
          </tr>
        </thead>
        <tbody>
          ${actionRows}
        </tbody>
      </table>
    </div>`;

  return renderInternalShell({
    eyebrow: 'SERVER 2 MONITORING',
    title: 'Creative Yadley Migration Digest',
    lead: 'Automated DNS and nameserver audit report for server2.creativeyadley.com. Monitored client accounts, external routing changes, and recommended service cleanups are detailed below.',
    contentHtml,
    ctaLabel: 'Review Migrated Accounts',
    ctaUrl: 'https://creativeyadley.com/clientarea/admin/clients.php',
    footerNote: 'Internal server monitoring report. Generated daily via cron on server2.creativeyadley.com.',
  });
}

function captureScreenshot(chromePath, htmlPath, outPngPath, width, height) {
  const fileUrl = 'file:///' + htmlPath.replace(/\\/g, '/');
  const cmd = `"${chromePath}" --headless=new --disable-gpu --no-sandbox --hide-scrollbars --window-size=${width},${height} --screenshot="${outPngPath}" "${fileUrl}"`;
  execSync(cmd, { stdio: 'inherit' });
}

function main() {
  const outDir = path.resolve(__dirname, '../docs/previews');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const backupHtml = generateBackupEmailHtml();
  const backupHtmlPath = path.join(outDir, 'whmcs-database-backup.html');
  fs.writeFileSync(backupHtmlPath, backupHtml, 'utf8');
  console.log(`Wrote: ${backupHtmlPath}`);

  const digestHtml = generateMigrationDigestHtml();
  const digestHtmlPath = path.join(outDir, 'migration-digest.html');
  fs.writeFileSync(digestHtmlPath, digestHtml, 'utf8');
  console.log(`Wrote: ${digestHtmlPath}`);

  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  if (!fs.existsSync(chromePath)) {
    console.error('Chrome not found at', chromePath);
    return;
  }

  console.log('Capturing screenshots for Backup Email...');
  captureScreenshot(chromePath, backupHtmlPath, path.join(outDir, 'backup-desktop-700.png'), 700, 780);
  captureScreenshot(chromePath, backupHtmlPath, path.join(outDir, 'backup-mobile-390.png'), 390, 880);

  console.log('Capturing screenshots for Migration Digest Email...');
  captureScreenshot(chromePath, digestHtmlPath, path.join(outDir, 'digest-desktop-700.png'), 700, 950);
  captureScreenshot(chromePath, digestHtmlPath, path.join(outDir, 'digest-mobile-390.png'), 390, 1150);

  console.log('Done rendering and capturing preview screenshots!');
}

main();
