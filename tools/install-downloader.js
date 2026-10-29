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

if (empty($cc_encryption_hash)) {
    http_response_code(500);
    die('Server configuration error: encryption secret missing.');
}

$secret = $cc_encryption_hash;
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

$fileSize = filesize($fullPath);
$start = 0;
$end = $fileSize - 1;
$isRange = false;

if (isset($_SERVER['HTTP_RANGE'])) {
    if (preg_match('/^bytes=(\\d*)-(\\d*)$/', $_SERVER['HTTP_RANGE'], $matches)) {
        $rangeStart = $matches[1];
        $rangeEnd = $matches[2];

        if ($rangeStart === '' && $rangeEnd === '') {
            http_response_code(416);
            header("Content-Range: bytes */$fileSize");
            exit;
        }

        if ($rangeStart === '') {
            $suffix = (int)$rangeEnd;
            if ($suffix === 0) {
                http_response_code(416);
                header("Content-Range: bytes */$fileSize");
                exit;
            }
            $start = max(0, $fileSize - $suffix);
            $end = $fileSize - 1;
        } else {
            $start = (int)$rangeStart;
            if ($rangeEnd !== '') {
                $end = (int)$rangeEnd;
            }
        }

        if ($start > $end || $start >= $fileSize) {
            http_response_code(416);
            header("Content-Range: bytes */$fileSize");
            exit;
        }

        if ($end >= $fileSize) {
            $end = $fileSize - 1;
        }

        $isRange = true;
    }
}

$length = $end - $start + 1;

header('Content-Description: File Transfer');
header('Content-Type: application/gzip');
header('Content-Disposition: attachment; filename="' . $file . '"');
header('Accept-Ranges: bytes');
header('Expires: 0');
header('Cache-Control: must-revalidate');
header('Pragma: public');

if ($isRange) {
    http_response_code(206);
    header("Content-Range: bytes $start-$end/$fileSize");
    header("Content-Length: $length");
} else {
    http_response_code(200);
    header("Content-Length: $fileSize");
}

$fp = fopen($fullPath, 'rb');
if (!$fp) {
    http_response_code(500);
    die('Cannot open file.');
}

fseek($fp, $start);
$bytesRemaining = $length;
$chunkSize = 8192;

while ($bytesRemaining > 0 && !feof($fp)) {
    $readSize = min($chunkSize, $bytesRemaining);
    $data = fread($fp, $readSize);
    if ($data === false) {
        break;
    }
    echo $data;
    $bytesRemaining -= strlen($data);
    flush();
}

fclose($fp);
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
