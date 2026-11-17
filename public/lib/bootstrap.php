<?php
declare(strict_types=1);
const APP_BASE_URL = 'https://undanganregistrasirsas.puskesau.com';
header("Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob: data:; media-src 'self' blob:; connect-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
header('Referrer-Policy: no-referrer');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Cache-Control: no-store');
ini_set('session.use_strict_mode', '1');
session_set_cookie_params(['httponly'=>true,'secure'=>!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off','samesite'=>'Strict','path'=>'/']);
session_start();
$_SESSION['csrf'] ??= bin2hex(random_bytes(32));
function esc(string $s): string { return htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }
function configuration(): array {
    static $config;
    if ($config !== null) return $config;
    $file = dirname(__DIR__) . '/private/database.php';
    // The hosting bundle is self-contained; keep the older external location as fallback.
    if (!is_file($file)) $file = dirname(__DIR__, 2) . '/config.local.php';
    $local = is_file($file) ? require $file : [];
    $config = [];
    foreach (['DB_HOST'=>'localhost','DB_PORT'=>'3306','DB_NAME'=>'','DB_USER'=>'','DB_PASS'=>''] as $key=>$default) {
        $env = getenv($key);
        $config[$key] = $env !== false ? $env : ($local[$key] ?? $default);
    }
    return $config;
}
function database(): PDO {
    $c=configuration();
    if ($c['DB_NAME']==='' || $c['DB_USER']==='') throw new RuntimeException('Database belum diatur. Ikuti README untuk pengaturan cPanel.');
    try {
        return new PDO('mysql:host='.$c['DB_HOST'].';port='.$c['DB_PORT'].';dbname='.$c['DB_NAME'].';charset=utf8mb4', $c['DB_USER'], $c['DB_PASS'], [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_EMULATE_PREPARES=>false,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
    } catch (PDOException $e) { error_log('RSAS database connection failed: '.$e->getCode()); throw new RuntimeException('Database belum dapat dihubungi. Periksa konfigurasi cPanel.'); }
}
function field($value, int $max=200): string {
    if (!is_string($value) || !preg_match('//u',$value) || preg_match('/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/',$value) || preg_match_all('/./us',$value)>$max) throw new InvalidArgumentException('Teks tidak valid atau terlalu panjang.');
    return trim($value);
}
function code($value): string {
    if (!is_string($value) || !preg_match('/\A[A-Za-z0-9_-]{1,64}\z/',$value)) throw new InvalidArgumentException('Kode undangan tidak valid.');
    return $value;
}
function csrf(): void {
    if (!hash_equals($_SESSION['csrf'], $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '')) throw new InvalidArgumentException('Sesi berubah. Muat ulang halaman lalu coba lagi.');
}
