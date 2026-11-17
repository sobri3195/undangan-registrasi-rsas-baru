<?php
// CLI only, with disposable environment values. Never serves a configuration tool.
if (PHP_SAPI!=='cli') {http_response_code(404);exit;}
require __DIR__.'/../public/lib/bootstrap.php';
require __DIR__.'/../public/lib/access.php';
function check(bool $condition): void {if (!$condition) throw new RuntimeException('Access configuration assertion failed');}
if (($argv[1]??'')==='invalid') {
    check(!access_configured());$_SESSION['access']=['role'=>'admin','expires'=>time()+60,'fingerprint'=>hash_hmac('sha256','rsas-access:admin',(string)configuration()['ADMIN_PIN'])];
    check(access_role()===null);check(!access_allowed('staff'));echo "PASS invalid/empty PIN configuration fails closed\n";exit;
}
check(access_configured());
foreach (['staff','admin'] as $role) {
    $_SESSION['access']=['role'=>$role,'expires'=>time()+60,'fingerprint'=>access_fingerprint($role)];check(access_role()===$role);check(access_allowed('staff'));check(access_allowed('admin')===($role==='admin'));
    $_SESSION['access']['fingerprint']=hash_hmac('sha256','rsas-access:'.$role,'old-rotated-pin');check(access_role()===null);
    $_SESSION['access']=['role'=>$role,'expires'=>time()-1,'fingerprint'=>access_fingerprint($role)];check(access_role()===null);
}
echo "PASS role separation, expiry and changed credential fingerprints\n";
