require('dotenv').config();
const WHMService = require('../src/services/whm.service');
const w = new WHMService();
const axios = require('axios');

async function main() {
  const code = `<?php
header('Content-Type: text/plain');
ini_set('max_execution_time', 300);
set_time_limit(300);

require_once __DIR__ . '/configuration.php';
$pdo = new PDO("mysql:host=127.0.0.1;port=3306;dbname=$db_name;charset=utf8mb4", $db_username, $db_password, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
]);

echo "=== 1. Database size before cleanup ===\\n";
$stmt = $pdo->prepare("SELECT table_name, ROUND((data_length + index_length)/1024/1024, 2) as size_mb FROM information_schema.TABLES WHERE table_schema = :db AND table_name IN ('tbllog_register', 'tblcarts')");
$stmt->execute([':db' => $db_name]);
print_r($stmt->fetchAll(PDO::FETCH_KEY_PAIR));

echo "\\n=== 2. Pruning tbllog_register (older than 90 days) in batches ===\\n";
$totalDeletedLog = 0;
$batchSize = 100000;
do {
    $stmt = $pdo->prepare("DELETE FROM tbllog_register WHERE created_at < DATE_SUB(NOW(), INTERVAL 90 DAY) LIMIT $batchSize");
    $stmt->execute();
    $affected = $stmt->rowCount();
    $totalDeletedLog += $affected;
    echo "  Deleted $affected rows (Total so far: $totalDeletedLog)\\n";
} while ($affected > 0 && $totalDeletedLog < 3000000);

echo "\\n=== 3. Pruning tblcarts (older than 14 days) in batches ===\\n";
$totalDeletedCarts = 0;
do {
    $stmt = $pdo->prepare("DELETE FROM tblcarts WHERE updated_at < DATE_SUB(NOW(), INTERVAL 14 DAY) LIMIT $batchSize");
    $stmt->execute();
    $affected = $stmt->rowCount();
    $totalDeletedCarts += $affected;
    echo "  Deleted $affected carts (Total so far: $totalDeletedCarts)\\n";
} while ($affected > 0 && $totalDeletedCarts < 1000000);

echo "\\n=== 4. Optimizing tables to reclaim disk space ===\\n";
$pdo->query("OPTIMIZE TABLE tbllog_register");
echo "Optimized tbllog_register\\n";
$pdo->query("OPTIMIZE TABLE tblcarts");
echo "Optimized tblcarts\\n";

echo "\\n=== 5. Database size after cleanup ===\\n";
$stmt = $pdo->prepare("SELECT table_name, ROUND((data_length + index_length)/1024/1024, 2) as size_mb FROM information_schema.TABLES WHERE table_schema = :db AND table_name IN ('tbllog_register', 'tblcarts')");
$stmt->execute([':db' => $db_name]);
print_r($stmt->fetchAll(PDO::FETCH_KEY_PAIR));

// Total DB size after
$stmtTotal = $pdo->prepare("SELECT ROUND(SUM(data_length + index_length)/1024/1024, 2) as total_db_mb FROM information_schema.TABLES WHERE table_schema = :db");
$stmtTotal->execute([':db' => $db_name]);
$totalAfter = $stmtTotal->fetch(PDO::FETCH_ASSOC);
echo "\\nTotal WHMCS Database Size: " . $totalAfter['total_db_mb'] . " MB\\n";
`;

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'save_file_content',
    dir: 'public_html/clientarea',
    file: 'prune_db.php',
    content: code
  });

  console.log('Running database pruning...');
  const res = await axios.get('https://creativeyadley.com/clientarea/prune_db.php', {
    httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }),
    timeout: 300000
  });

  console.log(res.data);

  await w.get('cpanel', {
    cpanel_jsonapi_user: 'creativeyadley',
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'fileop',
    op: 'unlink',
    sourcefiles: 'public_html/clientarea/prune_db.php'
  });
}
main().catch(console.error);

