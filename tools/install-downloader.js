require('dotenv').config();
const WHMService = require('../src/services/whm.service');
const w = new WHMService();

async function main() {
  const code = `<?php
/**
 * Secure WHMCS Database Backup Downloader
 */
require_once __DIR__ . '/configuration.php';

$file = $_GET['file'] ?? '';
$token = $_GET['token'] ?? '';

// Sanitize filename to prevent directory traversal
$file = basename($file);

if (empty($file) || empty($token)) {
    http_response_code(400);
    die('Missing parameters.');
}

if (!str_starts_with($file, 'whmcs_backup_') || !str_ends_with($file, '.sql.gz')) {
    http_response_code(400);
    die('Invalid file requested.');
}

$secret = $cc_encryption_hash ?? 'backup_salt_2026';
// Token valid for file
$validToken = hash_hmac('sha256', $file, $secret);

if (!hash_equals($validToken, $token)) {
    http_response_code(403);
    die('Invalid or expired security token.');
}

$fullPath = '/home/creativeyadley/backups/whmcs_db/' . $file;
if (!file_exists($fullPath)) {
    http_response_code(404);
    die('Backup file not found on server.');
}

header('Content-Description: File Transfer');
header('Content-Type: application/gzip');
header('Content-Disposition: attachment; filename="' . $file . '"');
header('Expires: 0');
header('Cache-Control: must-revalidate');
header('Pragma: public');
header('Content-Length: ' . filesize($fullPath));

readfile($fullPath);
exit;
`;

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'save_file_content',
    dir: 'public_html/clientarea',
    file: 'get_db_backup.php',
    content: code
  });

  console.log('Saved get_db_backup.php');
}

main().catch(console.error);

