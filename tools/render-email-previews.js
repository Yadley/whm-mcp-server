const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Design System Tokens
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
};

const F = {
  display: "'Plus Jakarta Sans','Segoe UI',Roboto,Helvetica,Arial,sans-serif",
  sans: "'Nunito Sans','Segoe UI',Roboto,Helvetica,Arial,sans-serif",
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
 * Builds an Internal Admin Email conforming to Creative Yadley Email Design System 1.0 / Design System v2.3.0:
 * - Content-only fragment architecture: NO hero image, NO logo lockup, NO client footer.
 * - Wrapped in a 600px shell on #ECEEE9 canvas for standalone email client delivery.
 * - Reading surface with 40px desktop / 24px mobile padding.
 * - Title Case title, Action Case button.
 * - Single lime primary CTA: 24px above, 28px below, 18px x 34px padding.
 * - Lime links on dark; ink with lime underline on white surfaces.
 * - Warm canvas panel #F4F5F2 with 1px hairline #D2D6D0 and 14px radius.
 */
function renderInternalShell({ eyebrow, title, lead, details, note, contentHtml, ctaLabel, ctaUrl, footerNote }) {
  const detailRows = (details || []).map(row => {
    const isMono = !!row[2];
    const font = isMono ? `font-family:${F.mono};font-size:14px;` : `font-family:${F.sans};font-size:15px;`;
    return `<tr>
      <td class="cy-dl" width="38%" valign="top" style="padding:12px 16px 12px 0;border-bottom:1px solid ${C.hair};font-family:${F.sans};font-size:14px;line-height:1.45;color:${C.muted};">${row[0]}</td>
      <td class="cy-dv" valign="top" style="padding:12px 0;border-bottom:1px solid ${C.hair};${font}line-height:1.45;font-weight:600;color:${C.ink};">${row[1]}</td>
    </tr>`;
  }).join('\n');

  const detailsTable = details && details.length > 0 ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 24px;background:${C.panel};border:1px solid ${C.hair};border-radius:14px;border-collapse:separate;border-spacing:0;">
      <tr>
        <td style="padding:6px 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            ${detailRows}
          </table>
        </td>
      </tr>
    </table>` : '';

  const noteBox = note ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;background:${note.bg || C.panel};border:1px solid ${note.border || C.hair};border-radius:14px;border-collapse:separate;border-spacing:0;">
      <tr>
        <td style="padding:18px 20px;">
          <p style="margin:0 0 6px;font-family:${F.display};font-size:12px;line-height:1.4;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:${note.labelColor || C.muted};">${note.label}</p>
          <div style="margin:0;font-family:${F.sans};font-size:14px;line-height:1.6;color:${note.textColor || C.body};">${note.html || note.text}</div>
        </td>
      </tr>
    </table>` : '';

  const ctaBlock = ctaLabel && ctaUrl ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td height="24" style="height:24px;line-height:24px;font-size:0;">&nbsp;</td></tr>
      <tr>
        <td align="left">
          <!--[if mso]>
          <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${ctaUrl}" style="height:54px;v-text-anchor:middle;width:260px;" arcsize="50%" fillcolor="${C.lime}" stroke="f">
            <w:anchorlock/>
            <center style="color:${C.limeInk};font-family:'Plus Jakarta Sans',Arial,sans-serif;font-size:16px;font-weight:bold;">${buttonCase(ctaLabel)}</center>
          </v:roundrect>
          <![endif]-->
          <!--[if !mso]><!-->
          <a href="${ctaUrl}" class="cy-btn" style="display:inline-block;padding:18px 34px;font-family:${F.display};font-size:16px;line-height:1;font-weight:700;color:${C.limeInk};background:${C.lime};border:1px solid ${C.lime};text-decoration:none;border-radius:999px;">${buttonCase(ctaLabel)}</a>
          <!--<![endif]-->
        </td>
      </tr>
      <tr><td height="28" style="height:28px;line-height:28px;font-size:0;">&nbsp;</td></tr>
    </table>` : '';

  const fNote = footerNote || 'Internal studio notification. Not a client message.';

  return `<!doctype html>
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
  .cy-inline-link{color:${C.ink}!important;text-decoration:underline!important;text-decoration-color:${C.lime}!important;text-underline-offset:3px!important;font-weight:600!important;}
  @media only screen and (max-width:620px){
    .cy-shell{width:100%!important;}
    .cy-px{padding-left:24px!important;padding-right:24px!important;}
    .cy-h1{font-size:22px!important;line-height:1.25!important;}
    .cy-dl,.cy-dv{display:block!important;width:auto!important;padding:0 0 2px!important;border-bottom:none!important;}
    .cy-dl{padding-top:10px!important;}
    .cy-dv{padding-bottom:10px!important;border-bottom:1px solid ${C.hair}!important;}
    .cy-btn{display:block!important;text-align:center!important;padding:18px 24px!important;}
    .cy-metric-cell{display:block!important;width:100%!important;margin-bottom:8px!important;}
  }
</style>
</head>
<body style="margin:0;padding:0;background:${C.page};-webkit-text-size-adjust:100%;">
<div style="display:none;font-size:1px;color:${C.page};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${titleCase(title)} - Server 2 Notification</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.page}" style="background:${C.page};">
  <tr>
    <td align="center" style="padding:24px 12px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" class="cy-shell" style="width:600px;max-width:600px;background:${C.white};border-radius:16px;overflow:hidden;">
        <!-- Internal Admin Content-Only Surface: No Hero, No Logo, No Footer -->
        <tr>
          <td class="cy-px" bgcolor="${C.white}" style="background:${C.white};padding:40px 40px 32px;">
            <p style="margin:0 0 10px;font-family:${F.display};font-size:12px;line-height:1.4;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:${C.muted};">${eyebrow}</p>
            <h1 class="cy-h1" style="margin:0 0 14px;font-family:${F.display};font-size:24px;line-height:1.22;letter-spacing:-0.4px;font-weight:700;color:${C.ink};">${titleCase(title)}</h1>
            ${lead ? `<p style="margin:0 0 20px;font-family:${F.sans};font-size:15px;line-height:1.55;color:${C.body};">${lead}</p>` : ''}
            
            ${detailsTable}
            ${noteBox}
            ${contentHtml || ''}
            
            ${ctaBlock}

            <p style="margin:20px 0 0;font-family:${F.sans};font-size:12px;line-height:1.6;color:${C.muted};border-top:1px solid ${C.hair};padding-top:16px;">
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

// 2. Build Migration Digest HTML
function generateMigrationDigestHtml() {
  const auditResults = [
    { domain: 'creativestudio.com', client: 'Studio Media (#1012)', status: 'Active in WHMCS', dest: 'ns1.digitalocean.com, ns2.digitalocean.com (IP: 159.203.11.22)', action: 'Cancel & Archive' },
    { domain: 'apexbrand.net', client: 'Apex Brand LLC (#1024)', status: 'Active in WHMCS', dest: 'ns1.bluehost.com, ns2.bluehost.com (IP: 162.241.11.44)', action: 'Cancel & Archive' }
  ];

  const actionRows = auditResults.map(item => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid ${C.hair};vertical-align:top;word-break:break-all;">
        <a href="https://${item.domain}" target="_blank" class="cy-inline-link">${item.domain}</a>
      </td>
      <td style="padding:10px 12px;border-bottom:1px solid ${C.hair};vertical-align:top;font-family:${F.sans};font-size:14px;color:${C.body};">${item.client}</td>
      <td style="padding:10px 12px;border-bottom:1px solid ${C.hair};vertical-align:top;">
        <span style="background:${C.alertBg};color:${C.alertInk};padding:3px 8px;border-radius:4px;font-size:11px;font-weight:700;letter-spacing:0.3px;">ACTIVE IN WHMCS</span>
      </td>
      <td style="padding:10px 12px;border-bottom:1px solid ${C.hair};vertical-align:top;font-family:${F.sans};font-size:13px;color:${C.body};word-break:break-word;">
        <div style="font-weight:600;color:${C.ink};">${item.dest.split(' (IP:')[0]}</div>
        <div style="color:${C.muted};font-size:12px;margin-top:2px;">IP: ${item.dest.split(' (IP:')[1].replace(')', '')}</div>
      </td>
      <td style="padding:10px 12px;border-bottom:1px solid ${C.hair};vertical-align:top;font-family:${F.sans};font-size:13px;font-weight:700;color:${C.alertInk};">
        ${item.action}
      </td>
    </tr>
  `).join('');

  const contentHtml = `
    <!-- Metrics Grid -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
      <tr>
        <td class="cy-metric-cell" width="20%" style="padding:4px;">
          <table role="presentation" width="100%" cellpadding="10" cellspacing="0" border="0" style="background:${C.panel};border:1px solid ${C.hair};border-radius:10px;text-align:center;">
            <tr><td>
              <div style="font-family:${F.display};font-size:22px;font-weight:800;color:${C.ink};line-height:1;">48</div>
              <div style="font-family:${F.sans};font-size:11px;font-weight:700;color:${C.muted};text-transform:uppercase;margin-top:4px;">Total Audited</div>
            </td></tr>
          </table>
        </td>
        <td class="cy-metric-cell" width="20%" style="padding:4px;">
          <table role="presentation" width="100%" cellpadding="10" cellspacing="0" border="0" style="background:${C.panel};border:1px solid ${C.hair};border-radius:10px;text-align:center;">
            <tr><td>
              <div style="font-family:${F.display};font-size:22px;font-weight:800;color:#166534;line-height:1;">38</div>
              <div style="font-family:${F.sans};font-size:11px;font-weight:700;color:${C.muted};text-transform:uppercase;margin-top:4px;">Active Here</div>
            </td></tr>
          </table>
        </td>
        <td class="cy-metric-cell" width="20%" style="padding:4px;">
          <table role="presentation" width="100%" cellpadding="10" cellspacing="0" border="0" style="background:${C.panel};border:1px solid ${C.hair};border-radius:10px;text-align:center;">
            <tr><td>
              <div style="font-family:${F.display};font-size:22px;font-weight:800;color:${C.alertInk};line-height:1;">2</div>
              <div style="font-family:${F.sans};font-size:11px;font-weight:700;color:${C.muted};text-transform:uppercase;margin-top:4px;">Action Needed</div>
            </td></tr>
          </table>
        </td>
        <td class="cy-metric-cell" width="20%" style="padding:4px;">
          <table role="presentation" width="100%" cellpadding="10" cellspacing="0" border="0" style="background:${C.panel};border:1px solid ${C.hair};border-radius:10px;text-align:center;">
            <tr><td>
              <div style="font-family:${F.display};font-size:22px;font-weight:800;color:${C.body};line-height:1;">8</div>
              <div style="font-family:${F.sans};font-size:11px;font-weight:700;color:${C.muted};text-transform:uppercase;margin-top:4px;">All Migrated</div>
            </td></tr>
          </table>
        </td>
        <td class="cy-metric-cell" width="20%" style="padding:4px;">
          <table role="presentation" width="100%" cellpadding="10" cellspacing="0" border="0" style="background:${C.panel};border:1px solid ${C.hair};border-radius:10px;text-align:center;">
            <tr><td>
              <div style="font-family:${F.display};font-size:22px;font-weight:800;color:${C.muted};line-height:1;">2</div>
              <div style="font-family:${F.sans};font-size:11px;font-weight:700;color:${C.muted};text-transform:uppercase;margin-top:4px;">Expired / Other</div>
            </td></tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Action Required Table -->
    <div style="margin:0 0 24px;border:1px solid ${C.alertBorder};border-radius:14px;background:#FFFBFB;padding:18px 20px;">
      <p style="margin:0 0 6px;font-family:${F.display};font-size:13px;line-height:1.4;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:${C.alertInk};">
        Action Required: Migrated but Active in WHMCS (2)
      </p>
      <p style="margin:0 0 16px;font-family:${F.sans};font-size:14px;line-height:1.55;color:${C.body};">
        The following client domains have migrated away to external nameservers, but their hosting service remains marked <strong>Active</strong> in WHMCS. Keeping migrated accounts active consumes server quotas and cPanel licenses.
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.white};border:1px solid ${C.alertBorder};border-radius:10px;overflow:hidden;border-collapse:collapse;">
        <thead>
          <tr style="background:#FEE2E2;">
            <th style="padding:10px 12px;text-align:left;font-family:${F.display};font-size:12px;font-weight:700;color:${C.alertInk};">Domain</th>
            <th style="padding:10px 12px;text-align:left;font-family:${F.display};font-size:12px;font-weight:700;color:${C.alertInk};">WHMCS Client</th>
            <th style="padding:10px 12px;text-align:left;font-family:${F.display};font-size:12px;font-weight:700;color:${C.alertInk};">Status</th>
            <th style="padding:10px 12px;text-align:left;font-family:${F.display};font-size:12px;font-weight:700;color:${C.alertInk};">Destination</th>
            <th style="padding:10px 12px;text-align:left;font-family:${F.display};font-size:12px;font-weight:700;color:${C.alertInk};">Action</th>
          </tr>
        </thead>
        <tbody>
          ${actionRows}
        </tbody>
      </table>
    </div>

    <!-- 0 New Migrations Notice -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;background:${C.successBg};border:1px solid ${C.successBorder};border-radius:12px;">
      <tr>
        <td style="padding:14px 18px;font-family:${F.sans};font-size:14px;line-height:1.55;color:${C.successInk};">
          <strong>0 New Migrations Detected Today:</strong> No client website DNS changes were detected in the last 24-hour cycle.
        </td>
      </tr>
    </table>
  `;

  return renderInternalShell({
    eyebrow: 'SERVER 2 MONITORING',
    title: 'Creative Yadley Migration Digest',
    lead: 'Automated DNS and nameserver audit report for server2.creativeyadley.com. Monitored accounts, external routing changes, and recommended service cleanups are detailed below.',
    contentHtml: contentHtml,
    ctaLabel: 'Review Migrated Accounts',
    ctaUrl: 'https://creativeyadley.com/clientarea/admin/clients.php',
    footerNote: 'Internal studio audit automation. Not a client message.',
  });
}

async function main() {
  const outDir = path.join(__dirname, '..', 'docs', 'previews');
  fs.mkdirSync(outDir, { recursive: true });

  const backupHtml = generateBackupEmailHtml();
  const digestHtml = generateMigrationDigestHtml();

  const backupHtmlPath = path.join(outDir, 'whmcs-database-backup.html');
  const digestHtmlPath = path.join(outDir, 'migration-digest.html');

  fs.writeFileSync(backupHtmlPath, backupHtml, 'utf8');
  fs.writeFileSync(digestHtmlPath, digestHtml, 'utf8');

  console.log('Saved HTML previews to:', outDir);

  // Chrome executable
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  if (!fs.existsSync(chromePath)) {
    console.error('Chrome not found at', chromePath);
    return;
  }

  // Generate screenshots for 700px (Desktop view) and 390px (Mobile view)
  const jobs = [
    { name: 'backup-desktop-700', html: backupHtmlPath, width: 700, height: 850 },
    { name: 'backup-mobile-390', html: backupHtmlPath, width: 390, height: 1050 },
    { name: 'digest-desktop-700', html: digestHtmlPath, width: 700, height: 1150 },
    { name: 'digest-mobile-390', html: digestHtmlPath, width: 390, height: 1450 },
  ];

  for (const j of jobs) {
    const pngPath = path.join(outDir, `${j.name}.png`);
    const fileUrl = 'file:///' + j.html.replace(/\\/g, '/');
    const cmd = `"${chromePath}" --headless=new --screenshot="${pngPath}" --window-size=${j.width},${j.height} --hide-scrollbars "${fileUrl}"`;
    console.log(`Rendering ${j.name} (${j.width}px)...`);
    execSync(cmd, { stdio: 'inherit' });
    console.log(`Saved screenshot: ${pngPath}`);
  }

  console.log('All email renders and screenshots generated successfully!');
}

main().catch(console.error);
