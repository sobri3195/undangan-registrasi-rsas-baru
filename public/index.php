<?php
declare(strict_types=1);
const APP_BASE_URL = 'https://undanganregistrasirsas.puskesau.com';
$page = $_GET['page'] ?? 'beranda';
if (!is_string($page) || !in_array($page, ['beranda', 'tamu', 'petugas', 'koordinator'], true)) {
    http_response_code(404);
    $page = '404';
}
header("Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self'; media-src 'self' blob:; worker-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'");
header('Permissions-Policy: camera=' . ($page === 'petugas' ? '(self)' : '()') . ', microphone=(), geolocation=()');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: no-referrer');
header('Cache-Control: no-cache');
function e(string $s): string { return htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }
function linkTo(string $p): string { return APP_BASE_URL . ($p === 'beranda' ? '/' : '/index.php?page=' . $p); }
$titles = ['beranda'=>'Selamat datang', 'tamu'=>'Undangan Anda', 'petugas'=>'Penerimaan tamu', 'koordinator'=>'Pusat koordinasi', '404'=>'Halaman tidak ditemukan'];
?><!doctype html>
<html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#103e43"><title><?= e($titles[$page]) ?> · Registrasi RSAU</title><link rel="stylesheet" href="/assets/style.css"><script defer src="/assets/vendor/qrcode.js"></script><script defer src="/assets/vendor/qrcode_UTF8.js"></script><script defer src="/assets/vendor/jsQR.js"></script><script type="module" src="/assets/app.js"></script></head>
<body data-page="<?= e($page) ?>" data-base="<?= e(APP_BASE_URL) ?>"><header><a class="brand" href="<?= e(linkTo('beranda')) ?>">RSAU <span>PROF. DR. ABDULRACHMAN SALEH</span></a><span class="badge" id="connection">Perangkat lokal</span></header>
<nav aria-label="Utama"><?php foreach (['beranda'=>'Beranda','tamu'=>'Tamu','petugas'=>'Petugas','koordinator'=>'Koordinator'] as $route=>$label): ?><a <?= $page === $route ? 'aria-current="page"' : '' ?> href="<?= e(linkTo($route)) ?>"><?= e($label) ?></a><?php endforeach ?></nav>
<main><div class="eyebrow">REGISTRASI UNDANGAN</div><h1><?= e($titles[$page]) ?></h1><p class="intro">RSAU Prof. dr. Abdulrachman Saleh</p><div id="notice" role="status" aria-live="polite"></div>
<?php if ($page === 'beranda'): ?>
<section class="hero"><div><h2>Sambut tamu.<br>Catat dengan mudah.</h2><p>Konfirmasi undangan dan penerimaan tamu dalam satu alur sederhana, melalui ponsel atau tablet.</p><a class="button" href="<?= e(linkTo('tamu')) ?>">Buka undangan</a></div><div class="seal" aria-hidden="true">RSAU<br><small>REGISTRASI<br>UNDANGAN</small></div></section>
<div class="grid"><section><h2>Untuk tamu</h2><p>Buka tautan QR dari panitia untuk menjawab RSVP dan menyimpan QR check-in.</p></section><section><h2>Untuk petugas</h2><p>Siapkan daftar lokal sebelum bertugas. Setiap perangkat menyimpan absensinya sendiri.</p><a href="<?= e(linkTo('petugas')) ?>">Buka penerimaan →</a></section><section><h2>Untuk koordinator</h2><p>Impor slot undangan, bagikan QR, lalu gabungkan backup keenam tablet.</p><a href="<?= e(linkTo('koordinator')) ?>">Buka koordinasi →</a></section></div>
<?php elseif ($page === 'tamu'): ?>
<section id="guest"><h2>Undangan belum dibuka</h2><p>Gunakan tautan QR undangan yang dibagikan panitia. Identitas pribadi tidak disertakan dalam QR.</p></section>
<section id="rsvp-panel" hidden><h2>Konfirmasi rencana kehadiran</h2><p>Jawaban dikirim melalui pesan kepada panitia. RSVP tidak mencatat kehadiran fisik.</p><div class="actions"><button data-rsvp="hadir">Akan Hadir</button><button class="secondary" data-rsvp="tidak">Tidak Dapat Hadir</button></div><textarea id="reply" readonly aria-label="Pesan RSVP"></textarea><div class="actions"><button id="copy-reply">Salin Jawaban</button><a id="whatsapp" class="button" hidden rel="noreferrer" target="_blank">Buka WhatsApp</a></div><h2>QR check-in</h2><p>Tunjukkan QR ini di meja penerimaan. Simpan PNG sebelum berangkat.</p><div id="guest-qr"></div><button id="save-guest">Simpan QR PNG</button></section>
<?php elseif ($page === 'petugas' || $page === 'koordinator'): ?>
<section><h2>Perangkat & acara</h2><div class="grid"><label>Tablet<select id="tablet"><?php foreach (['T01'=>'VIP','T02'=>'Reguler','T03'=>'Reguler & mitra PT','T04'=>'Bantuan','T05'=>'Rekap','T06'=>'Cadangan'] as $id=>$role): ?><option value="<?= e($id) ?>"><?= e($id . ' · ' . $role) ?></option><?php endforeach ?></select></label><label>Kode acara<input id="event" maxlength="64" placeholder="RSAS-2026" pattern="[A-Za-z0-9_-]+"></label></div><button id="settings">Simpan pengaturan</button><p id="summary"></p><p class="muted">Data hanya tersimpan pada browser dan perangkat ini. Ekspor backup setiap pergantian sesi; jangan gunakan mode privat.</p></section>
<?php if ($page === 'petugas'): ?>
<section><h2>Pindai undangan</h2><video id="video" muted playsinline hidden></video><canvas id="frame" hidden></canvas><div class="actions"><button id="camera">Mulai Kamera</button><button id="stop-camera" class="secondary">Hentikan Kamera</button></div><p id="camera-status">Kamera aktif hanya setelah tombol ditekan. Jika gagal, gunakan pencarian manual.</p><label>Nama, perusahaan, jabatan, atau kode<input id="search" type="search" placeholder="Cari undangan lokal…" autocomplete="off"></label><div id="results"></div></section><section id="selection" hidden><h2>Konfirmasi tamu</h2><div id="identity"></div><button id="attend">Catat Hadir</button></section>
<?php else: ?>
<section><h2>1. Impor daftar undangan</h2><p>Satu baris adalah satu slot. Dua perwakilan perusahaan harus memakai dua kode berbeda. Kolom token boleh kosong untuk membuat token acak.</p><a href="<?= e(APP_BASE_URL) ?>/template.csv" download>Unduh template CSV</a><label>Daftar CSV (maks. 5 MB)<input id="csv" type="file" accept=".csv,text/csv"></label><label>Nomor WhatsApp panitia (format internasional, misalnya 628…)<input id="phone" inputmode="numeric" maxlength="15"></label><button id="save-phone">Simpan nomor</button><p>Nomor panitia disertakan pada tautan undangan yang dibuat setelah nomor disimpan.</p></section>
<section><h2>2. Undangan & RSVP</h2><label>Cari slot<input id="invite-search" type="search"></label><div id="invites"></div><div id="invitation"></div><p>Catat RSVP berdasarkan pesan yang diterima. Perubahan RSVP tidak mengubah absensi.</p></section>
<section><h2>3. Gabungkan backup tablet</h2><p>Impor seluruh JSON T01–T06 pada T05. Catatan dari slot sama dihitung sekali; semua bukti pindai tetap dipertahankan. Daftar dan token yang bertentangan ditolak.</p><label>Berkas JSON (maks. 20 MB per berkas)<input id="merge" type="file" accept=".json,application/json" multiple></label><button id="report">Ekspor laporan CSV</button></section>
<?php endif ?>
<section><h2>Backup & persiapan offline</h2><label>Impor backup JSON untuk menyiapkan / memulihkan tablet<input id="restore" type="file" accept=".json,application/json"></label><button id="backup">Ekspor backup JSON</button><button id="offline" class="secondary">Siapkan halaman offline</button><p id="offline-status">Persiapan memuat semua halaman dan pustaka QR. Uji ulang dalam mode pesawat sebelum acara.</p></section>
<?php else: ?><p>Gunakan navigasi untuk kembali ke halaman yang tersedia.</p><?php endif ?>
</main><footer>Registrasi lokal · Tanpa login · Backup dikelola panitia<br>RSVP adalah rencana; absensi adalah kehadiran di lokasi.</footer></body></html>
