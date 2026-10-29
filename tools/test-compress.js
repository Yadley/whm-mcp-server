require('dotenv').config();
const WHMService = require('../src/services/whm.service');
const w = new WHMService();
const axios = require('axios');
const crypto = require('crypto');

async function main() {
  const authToken = crypto.randomBytes(16).toString('hex');
  const tempFilename = `test_compress_${crypto.randomBytes(8).toString('hex')}.php`;

  const code = `<?php
header('Content-Type: text/plain');

if (($_GET['auth'] ?? '') !== '${authToken}') {
    http_response_code(403);
    die("Forbidden\\n");
}

echo "Checking xz / bzip2 / zip / gzip:\\n";
echo "gzip: " . (file_exists('/usr/bin/gzip') ? "YES" : "NO") . "\\n";
echo "xz: " . (file_exists('/usr/bin/xz') ? "YES" : "NO") . "\\n";
echo "bzip2: " . (file_exists('/usr/bin/bzip2') ? "YES" : "NO") . "\\n";
echo "zip: " . (file_exists('/usr/bin/zip') ? "YES" : "NO") . "\\n";

$backupDir = '/home/creativeyadley/backups/whmcs_db';
$gzFile = null;

// Accept a validated backup path from GET if specified and safe, else find latest in $backupDir
$reqFile = basename($_GET['file'] ?? '');
if (!empty($reqFile) && file_exists("$backupDir/$reqFile") && str_ends_with($reqFile, '.sql.gz')) {
    $gzFile = "$backupDir/$reqFile";
} else {
    $files = glob("$backupDir/whmcs_backup_*.sql.gz");
    if (!empty($files)) {
        usort($files, fn($a, $b) => filemtime($b) <=> filemtime($a));
        $gzFile = $files[0];
    }
}

if (!$gzFile || !file_exists($gzFile)) {
    http_response_code(404);
    die("ERROR: No valid backup file available for compression test.\\n");
}

echo "Testing compression with input: " . basename($gzFile) . "\\n";
echo "Current gzip size: " . filesize($gzFile) . " bytes (" . round(filesize($gzFile)/1024/1024, 2) . " MB)\\n";

// Verify gzip input integrity
$descriptors = [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']];
$testGz = proc_open("/usr/bin/gzip -t " . escapeshellarg($gzFile), $descriptors, $gzPipes);
if (!is_resource($testGz)) {
    http_response_code(500);
    die("ERROR: Failed to run gzip test on input file.\\n");
}
fclose($gzPipes[0]);
fclose($gzPipes[1]);
fclose($gzPipes[2]);
$gzCode = proc_close($testGz);
if ($gzCode !== 0) {
    http_response_code(500);
    die("ERROR: Input gzip file failed integrity check (exit code: $gzCode).\\n");
}

if (!file_exists('/usr/bin/xz')) {
    http_response_code(500);
    die("ERROR: /usr/bin/xz not installed.\\n");
}

$xzFile = $backupDir . '/test_' . uniqid() . '.sql.xz';
$cmd = "/bin/bash -o pipefail -c " . escapeshellarg(
    "/usr/bin/gzip -dc " . escapeshellarg($gzFile) . " | /usr/bin/xz -9c > " . escapeshellarg($xzFile)
);
$proc = proc_open($cmd, $descriptors, $pipes);
if (!is_resource($proc)) {
    http_response_code(500);
    die("ERROR: Failed to start compression process.\\n");
}
fclose($pipes[0]);
$stdout = stream_get_contents($pipes[1]);
$stderr = stream_get_contents($pipes[2]);
fclose($pipes[1]);
fclose($pipes[2]);
$exitCode = proc_close($proc);

if ($exitCode !== 0) {
    if (file_exists($xzFile)) @unlink($xzFile);
    http_response_code(500);
    die("ERROR: Compression process failed with exit code $exitCode. Stderr: $stderr\\n");
}

if (!file_exists($xzFile) || filesize($xzFile) === 0) {
    if (file_exists($xzFile)) @unlink($xzFile);
    http_response_code(500);
    die("ERROR: XZ output file is missing or empty.\\n");
}

// Validate XZ output before reporting size
$testProc = proc_open("/usr/bin/xz -t " . escapeshellarg($xzFile), $descriptors, $testPipes);
if (!is_resource($testProc)) {
    if (file_exists($xzFile)) @unlink($xzFile);
    http_response_code(500);
    die("ERROR: Failed to start XZ validation process.\\n");
}
fclose($testPipes[0]);
fclose($testPipes[1]);
fclose($testPipes[2]);
$xzCheckCode = proc_close($testProc);

if ($xzCheckCode !== 0) {
    if (file_exists($xzFile)) @unlink($xzFile);
    http_response_code(500);
    die("ERROR: XZ output failed integrity check (exit code: $xzCheckCode).\\n");
}

echo "XZ size: " . filesize($xzFile) . " bytes (" . round(filesize($xzFile)/1024/1024, 2) . " MB)\\n";
@unlink($xzFile);
`;

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'save_file_content',
    dir: 'public_html/clientarea',
    file: tempFilename,
    content: code
  });

  try {
    const res = await axios.get(`https://creativeyadley.com/clientarea/${tempFilename}?auth=${authToken}`, {
      timeout: 120000
    });
    console.log(res.data);
  } finally {
    await w.get('cpanel', {
      cpanel_jsonapi_user: 'creativeyadley',
      cpanel_jsonapi_apiversion: '3',
      cpanel_jsonapi_module: 'Fileman',
      cpanel_jsonapi_func: 'fileop',
      op: 'unlink',
      sourcefiles: `public_html/clientarea/${tempFilename}`
    });
  }
}

main().catch(console.error);
