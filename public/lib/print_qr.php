<?php
// Included only by the Admin route. No guest/token/attendance writes are performed.
declare(strict_types=1);
if (!defined('APP_BASE_URL')) {http_response_code(404);exit;}
header('Permissions-Policy: camera=(), microphone=(), geolocation=()');
$error='';$eventInfo=null;$guests=[];$total=0;$batch=1;$batchCount=1;$limit=20;
try {
    if (($_GET['print']??null)!=='qr') throw new InvalidArgumentException('Pilihan cetak tidak valid.');
    $event=code($_GET['event']??'');
    $rawBatch=$_GET['batch']??'1';
    if (!is_string($rawBatch) || !preg_match('/\A[1-9][0-9]{0,5}\z/',$rawBatch)) throw new InvalidArgumentException('Nomor batch tidak valid.');
    $batch=(int)$rawBatch;
    session_write_close();$db=database();$db->exec('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');$db->beginTransaction();
    $q=$db->prepare('SELECT kode,nama,tanggal,lokasi FROM scan_acara WHERE kode=?');$q->execute([$event]);$eventInfo=$q->fetch();
    if (!$eventInfo) {http_response_code(404);throw new OutOfBoundsException('Acara tidak ditemukan.');}
    $q=$db->prepare('SELECT COUNT(*) FROM scan_tamu WHERE acara=?');$q->execute([$event]);$total=(int)$q->fetchColumn();
    $batchCount=max(1,(int)ceil($total/$limit));
    if ($batch>$batchCount) {http_response_code(404);throw new OutOfBoundsException('Batch tidak ditemukan.');}
    $q=$db->prepare('SELECT kode,nama,perusahaan,jabatan,token FROM scan_tamu WHERE acara=? ORDER BY kode LIMIT ? OFFSET ?');
    $q->bindValue(1,$event);$q->bindValue(2,$limit,PDO::PARAM_INT);$q->bindValue(3,($batch-1)*$limit,PDO::PARAM_INT);$q->execute();$guests=$q->fetchAll();$db->commit();
} catch (InvalidArgumentException $e) {http_response_code(422);$error=$e->getMessage();
} catch (OutOfBoundsException $e) {$error=$e->getMessage();
} catch (Throwable $e) {http_response_code(503);$error='Data cetak belum dapat dimuat. Periksa koneksi dan konfigurasi database.';}
if (isset($db)&&$db->inTransaction()) $db->rollBack();
function print_batch_url(string $event,int $batch): string {
    return APP_BASE_URL.'/index.php?'.http_build_query(['page'=>'admin','print'=>'qr','event'=>$event,'batch'=>$batch],'','&',PHP_QUERY_RFC3986);
}
?><!doctype html>
<html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Cetak QR Undangan · <?= esc($eventInfo['nama']??'RSAS') ?></title><link rel="icon" href="/assets/logo-rsas.png"><link rel="stylesheet" href="/assets/print-qr.css"><script defer src="/assets/vendor/qrcode.js"></script><script defer src="/assets/vendor/qrcode_UTF8.js"></script><script defer src="/assets/print-qr.js"></script></head><body data-print-ready="false">
<div class="print-toolbar"><a href="<?= esc(APP_BASE_URL) ?>/index.php?page=admin">← Kembali ke Admin</a><button id="print-qr" disabled>Cetak / Simpan PDF</button></div>
<main><header class="print-heading"><h1>Cetak QR undangan</h1><p><?= esc($eventInfo['nama']??'') ?></p><?php if(!$error): ?><p class="batch-info">Batch <?= $batch ?> dari <?= $batchCount ?> · <?= count($guests) ?> kartu dari <?= $total ?> undangan</p><?php endif ?></header>
<?php if($error): ?><p class="error" role="alert"><?= esc($error) ?></p><?php else: ?>
<p id="print-status" class="screen-only" role="status"><?= $guests?'Menyiapkan QR…':'Belum ada undangan pada acara ini.' ?></p>
<p class="screen-only">Cetak A4 pada skala 100% dan matikan header/footer browser. Pilih “Save as PDF” untuk menyimpan. Maksimal 20 kartu per batch; cetak batch berikutnya untuk melanjutkan.</p>
<nav class="batch-nav" aria-label="Batch cetak"><?php if($batch>1): ?><a id="previous-batch" href="<?= esc(print_batch_url($event,$batch-1)) ?>">← Batch sebelumnya</a><?php endif ?><?php if($batch<$batchCount): ?><a id="next-batch" href="<?= esc(print_batch_url($event,$batch+1)) ?>">Batch berikutnya →</a><?php endif ?></nav>
<p id="print-warning">QR belum siap. Tunggu hingga semua kartu selesai dibuat sebelum mencetak.</p>
<div id="print-cards" class="print-grid"><?php foreach($guests as $guest): $url=APP_BASE_URL.'/index.php?page=scan#'.http_build_query(['v'=>'1','event'=>$event,'code'=>$guest['kode'],'token'=>$guest['token']],'','&',PHP_QUERY_RFC3986); ?>
<article class="invitation-card"><div class="card-brand"><img src="/assets/logo-rsas.png" alt="Logo RSAS" width="40" height="40"><span>RSAU PROF. DR.<br>ABDULRACHMAN SALEH</span></div><h2 class="card-event"><?= esc($eventInfo['nama']) ?></h2><?php if($eventInfo['tanggal']): ?><p class="card-date"><?= esc(date('d/m/Y',strtotime($eventInfo['tanggal']))) ?></p><?php endif ?><?php if($eventInfo['lokasi']): ?><p class="card-location"><?= esc($eventInfo['lokasi']) ?></p><?php endif ?><div class="card-qr" data-qr="<?= esc($url) ?>" aria-label="QR check-in <?= esc($guest['nama']) ?>"></div><h3 class="card-name"><?= esc($guest['nama']) ?></h3><p class="card-company"><?= esc($guest['perusahaan']) ?></p><p class="card-position"><?= esc($guest['jabatan']) ?></p><p class="card-code">Kode: <?= esc($guest['kode']) ?></p></article>
<?php endforeach ?></div>
<?php endif ?></main></body></html>
