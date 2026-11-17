<?php
declare(strict_types=1);
require __DIR__.'/lib/bootstrap.php';
require __DIR__.'/lib/access.php';
header('Content-Type: application/json; charset=utf-8');
header('Permissions-Policy: camera=(), microphone=(), geolocation=()');
function access_reply(array $data,int $status=200): never {http_response_code($status);echo json_encode($data,JSON_UNESCAPED_UNICODE);exit;}
try {
    if ($_SERVER['REQUEST_METHOD']!=='POST') {header('Allow: POST');access_reply(['error'=>'Metode tidak diizinkan.'],405);}
    csrf();
    $raw=file_get_contents('php://input',false,null,0,1025);
    if (strlen($raw)>1024) throw new InvalidArgumentException('Permintaan terlalu besar.');
    $b=json_decode($raw,true,8,JSON_THROW_ON_ERROR);
    if (!is_array($b)) throw new InvalidArgumentException('Permintaan tidak valid.');
    if (($b['action']??null)==='logout') {
        $_SESSION=[];session_regenerate_id(true);$_SESSION['csrf']=bin2hex(random_bytes(32));access_reply(['ok'=>true]);
    }
    if (($b['action']??null)!=='login' || !in_array($b['role']??null,['staff','admin'],true) || !is_string($b['pin']??null)) throw new InvalidArgumentException('Permintaan tidak valid.');
    if (!access_configured()) access_reply(['error'=>'PIN akses belum diatur. Hubungi koordinator.'],503);
    $result=access_attempt(database(),$b['role'],$b['pin']);
    if ($result['retry']>0) {header('Retry-After: '.$result['retry']);access_reply(['error'=>'Terlalu banyak percobaan. Coba lagi dalam '.$result['retry'].' detik.','retry_after'=>$result['retry']],429);}
    if (!$result['ok']) access_reply(['error'=>'PIN tidak sesuai.'],401);
    session_regenerate_id(true);$_SESSION['csrf']=bin2hex(random_bytes(32));
    $_SESSION['access']=['role'=>$b['role'],'expires'=>time()+43200,'fingerprint'=>access_fingerprint($b['role'])];
    access_reply(['ok'=>true]);
} catch (InvalidArgumentException|JsonException $e) {access_reply(['error'=>$e->getMessage()],422);
} catch (Throwable $e) {error_log('RSAS access error: '.get_class($e).' '.$e->getCode());access_reply(['error'=>'Akses belum dapat diproses. Periksa koneksi dan migrasi database.'],503);}
