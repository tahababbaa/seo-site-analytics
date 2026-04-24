<?php
session_start();

define('ADMIN_USER', 'admin');
define('ADMIN_PASS', '$2y$12$PQv9Z3KxM8Lz5Wf4R1tN2OqYjHsEbDcAuVwXn6T7IpGeMoKfBrClY'); // admin123

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $user = trim($_POST['username'] ?? '');
    $pass = trim($_POST['password'] ?? '');
    if ($user === ADMIN_USER && password_verify($pass, ADMIN_PASS)) {
        $_SESSION['admin_logged_in'] = true;
        header('Location: dashboard.php');
        exit;
    }
    $error = 'Kullanıcı adı veya şifre hatalı.';
}

if (!empty($_SESSION['admin_logged_in'])) {
    header('Location: dashboard.php');
    exit;
}
?><!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Admin Girişi</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{min-height:100vh;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#1a0d2e,#16213e,#0f0f23)}
.card{background:#fff;border-radius:16px;padding:48px 40px;width:100%;max-width:400px;box-shadow:0 20px 60px rgba(0,0,0,.4)}
h1{font-size:22px;color:#2d1b4e;margin-bottom:32px;text-align:center;font-family:'Segoe UI',sans-serif}
label{display:block;font-size:13px;color:#555;margin-bottom:6px;font-family:'Segoe UI',sans-serif}
input[type=text],input[type=password]{width:100%;padding:12px 16px;border:2px solid #e5e5e5;border-radius:8px;font-size:15px;outline:none;transition:.2s;font-family:'Segoe UI',sans-serif}
input:focus{border-color:#40e0d0}
.field{margin-bottom:20px}
button{width:100%;padding:14px;background:linear-gradient(135deg,#2d1b4e,#1a0d2e);color:#40e0d0;border:none;border-radius:8px;font-size:16px;cursor:pointer;font-family:'Segoe UI',sans-serif;transition:.2s}
button:hover{opacity:.9;transform:translateY(-1px)}
.error{background:#fff0f0;border:1px solid #ffcdd2;color:#c62828;padding:12px;border-radius:8px;margin-bottom:20px;font-size:14px;font-family:'Segoe UI',sans-serif}
</style>
</head>
<body>
<div class="card">
  <h1>🔐 Admin Paneli</h1>
  <?php if (!empty($error)): ?>
  <div class="error"><?= htmlspecialchars($error) ?></div>
  <?php endif; ?>
  <form method="POST">
    <div class="field">
      <label>Kullanıcı Adı</label>
      <input type="text" name="username" autocomplete="username" required>
    </div>
    <div class="field">
      <label>Şifre</label>
      <input type="password" name="password" autocomplete="current-password" required>
    </div>
    <button type="submit">Giriş Yap</button>
  </form>
</div>
</body>
</html>
