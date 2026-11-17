# Registrasi Undangan RSAS — dua tampilan

PHP Native, MySQL, HTML/CSS dan JavaScript Vanilla. Tidak ada framework atau proses build.

1. **Scan Tablet** (`/` atau `/index.php?page=scan`): pilih T01–T06, tekan Mulai Kamera, pindai QR, lihat nama/perusahaan/jabatan, lalu tekan **Konfirmasi Hadir**. Pencarian manual tersedia jika kamera gagal.
2. **Admin** (`/index.php?page=admin`): impor CSV satu kali, lihat nama yang sudah datang beserta tablet pencatat, jumlah undangan/hadir/belum hadir, dan unduh CSV. Daftar diperbarui setiap 3 detik saat halaman aktif. Admin juga dapat membuat QR dari pencarian undangan.

Semua tablet menggunakan daftar dan kehadiran di **database server yang sama**. Tidak perlu menyalin JSON antarperangkat. Semua halaman terbuka tanpa login sesuai permintaan awal. Koneksi internet diperlukan; jika penyimpanan gagal, aplikasi menampilkan pesan dan tidak mengklaim tamu sudah dicatat. Konfirmasi bisa dicoba lagi setelah koneksi pulih.

## Pasang di cPanel

1. Buat/pilih database MySQL 8.0.16+ atau MariaDB 10.11+ dan user melalui cPanel. Hubungkan user ke database. Aktifkan PHP 8.2+ dengan PDO MySQL (`pdo_mysql`).
2. Pilih database tersebut di phpMyAdmin, impor **[sql/05_scan_sederhana.sql](sql/05_scan_sederhana.sql)**. Hanya ada dua tabel aktif: `scan_tamu` dan `scan_catatan`. Tidak perlu mengimpor schema/seed/paket SQL pendamping versi lama.
3. Unggah **isi `public/`** termasuk `.htaccess` ke document root subdomain `undanganregistrasirsas.puskesau.com`.
4. Salin `config.local.php.example` menjadi `config.local.php` **satu tingkat di atas document root**. Isi nama database/user dengan prefix cPanel, password, host database hosting yang sebenarnya, dan kode acara. Contoh jika document root `/home/akun/undangan/`, lokasi konfigurasi `/home/akun/config.local.php`. Jangan letakkan konfigurasi dalam folder web. Alternatif: variabel server `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS`, `EVENT_CODE`.
5. Pastikan DNS subdomain mengarah ke server hosting yang diberikan penyedia dan sertifikat TLS valid. `.htaccess` mengalihkan HTTP ke domain HTTPS tetap. Lihat [cPanel](docs/CPANEL.md).
6. Buka Admin → impor `public/template.csv`. Buka Scan di keenam tablet → pilih ID masing-masing → uji QR dan konfirmasi. Admin harus melihat nama dan tablet pencatat.

Tidak ada kredensial server dalam JavaScript. `APP_BASE_URL` dipatok ke `https://undanganregistrasirsas.puskesau.com`; tidak memakai header Host untuk QR/navigasi. Saat menguji lokal gunakan rute langsung karena tautan navigasi tetap menuju domain produksi. Endpoint API memakai origin aplikasi yang sedang berjalan.

## CSV sederhana

```csv
kode,nama,perusahaan,jabatan
UM001,Bima Contoh,,Tamu umum
PT001,Dian Contoh,PT Mitra Sintetis,Direktur
PT002,Sari Contoh,PT Mitra Sintetis,Manajer
```

QR dapat berisi kode saja (misalnya `PT001`) atau tautan QR undangan domain RSAS. QR dari aplikasi lama tetap cocok jika CSV lama dengan token yang sama diimpor dan EVENT_CODE sesuai. Daftar IndexedDB lama tidak dipindahkan otomatis ke MySQL; impor master CSV untuk menyiapkan daftar server.

UTF-8, pemisah koma, header persis seperti contoh. Satu kode = satu slot. Dua perwakilan perusahaan memakai dua kode berbeda dan dihitung dua orang. Kode: 1–64 huruf ASCII/angka/`_`/`-`; setiap teks maksimal 200 karakter. Kutip nilai yang mengandung koma. Batas 5 MB / 10.000 baris.

Impor ulang daftar sama tidak menggandakan tamu. Kode sama dengan nama/perusahaan/jabatan berbeda ditolak dan impor dibatalkan seluruhnya. Tidak ada tombol hapus massal atau penggantian daftar otomatis. Acara baru memakai `EVENT_CODE` baru; data acara lama tetap tersimpan dan dipisahkan dari laporan aktif.

Format CSV lama `event,code,name,company,position,category,token` juga diterima bila event sesuai konfigurasi. Ini mempertahankan token untuk QR lama. QR lama dari CSV bertoken kosong hanya dapat dipertahankan jika token aslinya tersedia; tidak bisa direkonstruksi dari nama saja. Data IndexedDB/backup JSON lama tidak otomatis masuk database baru. Tidak ada RSVP pada tampilan sederhana ini.

## QR dan konfirmasi

Admin → Cari undangan dan buat QR → pilih nama → simpan PNG. QR berisi tautan domain tetap dengan event/kode/token di fragment. Kamera memproses frame di tablet dengan jsQR lokal; audio dimatikan dan kamera belakang diprioritaskan. QR berisi **kode undangan saja** (misalnya `PT001`) juga didukung untuk daftar CSV sederhana. URL asing dan QR bertoken tidak cocok ditolak. Tamu tidak pernah dicatat hanya karena QR terlihat; petugas harus menekan Konfirmasi Hadir.

Setiap pasangan `(acara, kode, tablet)` disimpan satu kali. Konfirmasi ulang pada tablet sama tidak mengubah waktu pertama. Tamu yang dicatat T02 dan T03 memiliki dua catatan tablet, tetapi Admin menghitung **satu kehadiran per kode**. Angka setiap tablet dapat dijumlahkan melebihi total hadir unik. Waktu disimpan UTC; tabel browser menampilkannya dalam zona waktu perangkat, ekspor mencantumkan UTC.

Aplikasi lama menggunakan service worker/IndexedDB untuk rekap offline. Versi ini menonaktifkan worker dan cache shell lama agar data Admin tidak kedaluwarsa. IndexedDB lama tidak dihapus; simpan backup lama sebelum beralih. Mode offline tidak dapat mencatat kehadiran bersama pada versi ini.

## Uji

- Lint PHP: `find public -name '*.php' -exec php -l {} \;`.
- `npm test`: pengujian utilitas lama dan konverter SQL; tidak memerlukan dependensi npm.
- Integrasi browser: pasang Playwright di luar folder unggahan, jalankan PHP+PDO MySQL dengan database uji kosong yang telah diisi schema 05. `PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs TEST_ORIGIN=http://127.0.0.1:8091 node tests/browser.mjs`. Uji mengimpor data sintetis dan mencatat kehadiran, jadi jangan arahkan ke produksi.
- [Hasil uji](docs/PENGUJIAN.md) dan [panduan enam tablet](docs/ENAM-TABLET.md).

`sql/01`–`04`, konverter `tools/`, dan dokumen SQL lama tetap disimpan sebagai paket arsip pendamping versi sebelumnya; bukan komponen runtime dua tampilan ini. Generator qrcode-generator 2.0.4 (MIT) dan jsQR 1.4.0 (Apache-2.0) dibundel lokal dalam `public/assets/vendor/`.
