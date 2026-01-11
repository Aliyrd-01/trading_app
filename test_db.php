<?php
$servername = "sql102.infinityfree.com";  // localhost
$username = "if0_38709423";          // из docker-compose.yml
$password = "qVUUsoKimSO";          // из docker-compose.yml
$database = "crypto_db";
$port = 3310;                // порт хоста, проброшенный в контейнер

$conn = new mysqli($servername, $username, $password, $database, $port);

if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}
echo "Connected successfully!";
?>
