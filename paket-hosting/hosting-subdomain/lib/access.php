<?php
declare(strict_types=1);

function access_configured(): bool {
    $c=configuration();
    return is_string($c['ADMIN_PIN']) && is_string($c['STAFF_PIN'])
        && preg_match('/\A[0-9]{8,12}\z/',$c['ADMIN_PIN'])===1
        && preg_match('/\A[0-9]{8,12}\z/',$c['STAFF_PIN'])===1
        && !hash_equals($c['ADMIN_PIN'],$c['STAFF_PIN']);
}
function access_fingerprint(string $role): string {
    return hash_hmac('sha256','rsas-access:'.$role,configuration()[$role==='admin'?'ADMIN_PIN':'STAFF_PIN']);
}
function access_role(): ?string {
    $a=$_SESSION['access']??null;
    if (!access_configured() || !is_array($a) || !in_array($a['role']??null,['staff','admin'],true)
        || !is_int($a['expires']??null) || $a['expires']<=time()
        || !is_string($a['fingerprint']??null) || !hash_equals(access_fingerprint($a['role']),$a['fingerprint'])) {
        unset($_SESSION['access']);return null;
    }
    return $a['role'];
}
function access_allowed(string $required): bool {
    $role=access_role();return $role==='admin' || ($role==='staff' && $required==='staff');
}
function access_guard(string $required): void {
    if (access_allowed($required)) return;
    http_response_code(access_role()===null?401:403);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error'=>access_role()===null?'Masukkan PIN panitia untuk melanjutkan.':'Fungsi ini memerlukan akses Admin.'],JSON_UNESCAPED_UNICODE);exit;
}
// Both limits are shared in MySQL, so new cookies/sessions do not reset attempts.
// REMOTE_ADDR comes from the web server; untrusted forwarded headers are ignored.
function access_attempt(PDO $db,string $role,string $pin): array {
    $now=time();$limits=[
        hash('sha256',APP_BASE_URL.'|'.$role.'|ip|'.($_SERVER['REMOTE_ADDR']??'unknown'))=>[5,300],
        hash('sha256',APP_BASE_URL.'|'.$role.'|global')=>[50,60],
    ];ksort($limits);
    $db->beginTransaction();
    try {
        $db->prepare('DELETE FROM scan_access_limits WHERE reset_at<? LIMIT 100')->execute([$now-86400]);
        $states=[];$retry=0;
        foreach ($limits as $bucket=>[$max,$seconds]) {
            $q=$db->prepare('INSERT INTO scan_access_limits(bucket,failures,reset_at) VALUES (?,0,?) ON DUPLICATE KEY UPDATE bucket=VALUES(bucket)');$q->execute([$bucket,$now+$seconds]);
            $q=$db->prepare('SELECT failures,reset_at FROM scan_access_limits WHERE bucket=? FOR UPDATE');$q->execute([$bucket]);$r=$q->fetch();
            if ((int)$r['reset_at']<=$now) {$r=['failures'=>0,'reset_at'=>$now+$seconds];$db->prepare('UPDATE scan_access_limits SET failures=0,reset_at=? WHERE bucket=?')->execute([$r['reset_at'],$bucket]);}
            if ((int)$r['failures']>=$max) $retry=max($retry,(int)$r['reset_at']-$now);
            $states[$bucket]=$r;
        }
        if ($retry>0) {$db->commit();return ['ok'=>false,'retry'=>$retry];}
        $expected=configuration()[$role==='admin'?'ADMIN_PIN':'STAFF_PIN'];
        $valid=preg_match('/\A[0-9]{8,12}\z/',$pin)===1 && hash_equals($expected,$pin);
        if ($valid) {
            $bucket=hash('sha256',APP_BASE_URL.'|'.$role.'|ip|'.($_SERVER['REMOTE_ADDR']??'unknown'));
            $db->prepare('DELETE FROM scan_access_limits WHERE bucket=?')->execute([$bucket]);
        } else foreach ($states as $bucket=>$r) $db->prepare('UPDATE scan_access_limits SET failures=failures+1 WHERE bucket=?')->execute([$bucket]);
        $db->commit();return ['ok'=>$valid,'retry'=>0];
    } catch (Throwable $e) {if ($db->inTransaction()) $db->rollBack();throw $e;}
}
