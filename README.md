# Registrasi Undangan RSAS — dua tampilan

PHP Native, MySQL, HTML/CSS dan JavaScript Vanilla. Tidak ada framework atau proses build.

1. **Scan Tablet** (`/` atau `/index.php?page=scan`): pilih T01–T06, tekan Mulai Kamera, pindai QR, lihat nama/perusahaan/jabatan, lalu tekan **Konfirmasi Hadir**. Pencarian manual tersedia jika kamera gagal.
2. **Admin** (`/index.php?page=admin`): impor CSV satu kali, lihat nama yang sudah datang beserta tablet pencatat, jumlah undangan/hadir/belum hadir, dan unduh CSV. Daftar diperbarui setiap 3 detik saat halaman aktif. Admin juga dapat membuat QR dari pencarian undangan.

Semua tablet menggunakan daftar dan kehadiran di **database server yang sama**. Tidak perlu menyalin JSON antarperangkat. Semua halaman terbuka tanpa login sesuai permintaan awal. Koneksi internet diperlukan; jika penyimpanan gagal, aplikasi menampilkan pesan dan tidak mengklaim tamu sudah dicatat. Konfirmasi bisa dicoba lagi setelah koneksi pulih.

## Paket siap unggah — daftar 80 tamu

Gunakan langsung folder **[paket-hosting/hosting-subdomain](paket-hosting/hosting-subdomain)** dan satu berkas **[rsas_acara_19_november_2026.sql](paket-hosting/rsas_acara_19_november_2026.sql)**. Tidak perlu menjalankan Python, Composer, npm atau menggabungkan SQL di hosting.

1. Buat/pilih database dan user di cPanel, hubungkan user ke database, lalu impor satu SQL tersebut lewat phpMyAdmin.
2. Unggah **isi** `hosting-subdomain/` ke document root subdomain; jangan membuat tingkat URL tambahan.
3. Edit **satu file** `private/database.php`: isi host, port, nama database, user dan password yang diberikan hosting. Zona waktu sudah WIB. Jangan menaruh SQL di document root.
4. Buka Admin, periksa acara RSAS-20261119: 80 undangan, 0 hadir, status Persiapan. Periksa identitas penerima lalu buka status penerimaan saat siap.

Panduan singkat ada dalam `PANDUAN.txt` di folder unggahan. Folder siap unggah berisi salinan kode rilis, bukan data produksi. Untuk pemeliharaan kode gunakan `public/`; perbarui paket lewat builder dan cocokkan berkas sebelum rilis. Pertahankan file konfigurasi yang sudah Anda isi ketika melakukan upgrade.

## Instalasi dari kode sumber (opsional)

Untuk pemasangan praktis, gunakan paket siap unggah di atas. Langkah berikut untuk pengembang yang memasang langsung dari `public/`.

1. Buat/pilih database MySQL 8.0.16+ atau MariaDB 10.11+ dan user melalui cPanel. Hubungkan user ke database. Aktifkan PHP 8.2+ dengan PDO MySQL (`pdo_mysql`).
2. Pilih database tersebut di phpMyAdmin, impor **[sql/05_scan_sederhana.sql](sql/05_scan_sederhana.sql)** lalu **[sql/06_multi_acara.sql](sql/06_multi_acara.sql)**. Tiga tabel aktif: `scan_acara`, `scan_tamu` dan `scan_catatan`. Tidak perlu mengimpor schema/seed/paket SQL pendamping versi lama.
3. Unggah **isi `public/`** termasuk `.htaccess` ke document root subdomain `undanganregistrasirsas.puskesau.com`.
4. Salin `config.local.php.example` menjadi `config.local.php` **satu tingkat di atas document root**. Isi nama database/user dengan prefix cPanel, password, host database hosting yang sebenarnya. Acara dipilih melalui antarmuka. Contoh jika document root `/home/akun/undangan/`, lokasi konfigurasi `/home/akun/config.local.php`. Jangan letakkan konfigurasi dalam folder web. Alternatif: variabel server `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS`.
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

QR dapat berisi kode saja (misalnya `PT001`) atau tautan QR undangan domain RSAS. QR dari aplikasi lama tetap cocok jika CSV lama dengan token yang sama diimpor dan kode acara sesuai. Daftar IndexedDB lama tidak dipindahkan otomatis ke MySQL; impor master CSV untuk menyiapkan daftar server.

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

## Beberapa acara

Impor `sql/06_multi_acara.sql` sesudah `05_scan_sederhana.sql` pada database yang sama. Untuk pemasangan yang sudah menggunakan versi dua tampilan, cukup jalankan `06_multi_acara.sql` lalu unggah ulang isi `public/`. Migrasi mempertahankan undangan dan scan lama, membuat entri acara untuk setiap kode acara lama, dan aman dijalankan ulang. Pada database baru tersedia acara awal `RSAS-2026`. Parameter `EVENT_CODE` konfigurasi lama tidak lagi digunakan.

Di **Admin → Acara baru**, isi nama, kode unik, tanggal dan lokasi (dua terakhir opsional). Setelah dibuat, acara langsung dipilih. Impor CSV untuk acara tersebut. Pada setiap tablet pilih acara yang sama sebelum scanning. Muat ulang halaman tablet untuk mengambil daftar acara yang baru dibuat Admin. Pilihan acara tersimpan pada browser masing-masing; mengganti pilihan Admin tidak mengubah pilihan tablet lain.

Setiap operasi pencarian, impor CSV, QR, konfirmasi dan ekspor memakai acara terpilih. Kode `PT001` dapat dipakai lagi di acara lain dengan nama tamu berbeda. Kehadiran dua acara tidak digabung. Saat mengganti acara, konfirmasi/pencarian lama dibersihkan. QR tautan yang berisi event berbeda ditolak dengan petunjuk memilih acara yang sesuai; QR kode polos memakai acara terpilih. Untuk mengurangi salah acara, bagikan QR tautan yang dibuat Admin.

Ringkasan Admin dan progres kehadiran selalu untuk acara terpilih, dengan total undangan acara sebagai penyebut. Tanggal acara adalah tanggal kalender; waktu kedatangan disimpan dalam UTC dan ditampilkan dalam WIB (zona waktu pada file konfigurasi, default `Asia/Jakarta`), termasuk jika zona waktu perangkat berbeda. Berkas CSV diberi nama sesuai kode acara. Tidak ada penghapusan atau pengubahan identitas acara pada pembaruan ini.

## Paket satu folder + satu SQL

Jalankan `python3 tools/build_shared_hosting.py /workspace/rsas-paket-hosting` (pilih output baru jika sudah ada). ZIP berisi tepat satu folder `hosting-subdomain/` dan satu berkas `rsas_dummy.sql`. Unggah **isi folder hosting-subdomain** ke document root, lalu isi `private/database.php`. File konfigurasi ini diprioritaskan jika tersedia; instalasi lama tetap dapat memakai `config.local.php` di luar document root. Variabel server masih memiliki prioritas tertinggi.

Impor `rsas_dummy.sql` ke database cPanel yang dipilih melalui phpMyAdmin; tidak perlu SQL 05/06 terpisah. Dummy menyediakan dua acara, 11 slot, dan contoh scan semua tablet: DEMO-RSAS-2026 memiliki 8 undangan / 5 hadir unik dari 6 catatan; DEMO-MITRA-2027 memiliki 3 undangan / 1 hadir. Token demo bukan untuk undangan nyata. Buat acara baru untuk penggunaan sebenarnya. `PANDUAN.txt` di folder unggahan menjelaskan langkah pemasangan dan cara memeriksa hasil. SQL tetap di luar folder web.

## Filter daftar undangan di Admin

Pilih **Semua Undangan**, **Sudah Datang** (pilihan awal), atau **Belum Datang** di atas tabel. Pencarian nama, perusahaan, jabatan, kode, dan tablet diterapkan pada filter terpilih. Tombol Unduh CSV memakai acara, filter, dan pencarian yang sama; berkas menyertakan kolom status. Tamu belum datang mempunyai waktu kedatangan kosong, bukan waktu buatan. Total undangan/hadir/belum hadir di bagian atas tetap merupakan ringkasan seluruh acara.

Daftar mengikuti perubahan kehadiran setiap 3 detik. Kode yang tercatat beberapa tablet tetap satu baris. Pergantian acara membersihkan pencarian, mempertahankan filter, dan tidak menampilkan hasil respons acara/filter sebelumnya. Pembaruan ini tidak memerlukan perubahan database: cukup unggah berkas aplikasi terbaru. Uji khusus: `PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs TEST_ORIGIN=http://127.0.0.1:8098 node tests/attendance-filters.mjs` pada database uji baru yang diisi SQL dummy 07; uji mencatat satu kehadiran demo.

## Edit identitas tamu

Klik **Edit** pada tabel Admin (termasuk filter Semua/Belum Datang), atau cari kode pada bagian pencarian undangan lalu klik **Edit**. Formulir memperbaiki nama, perusahaan/instansi, dan jabatan pada slot acara terpilih. Kode undangan, token QR, waktu hadir dan tablet pencatat tetap dipertahankan. Identitas baru tampil di daftar, ekspor CSV dan hasil pemindaian/pencarian berikutnya. Ini untuk koreksi identitas, bukan memindahkan undangan kepada orang lain.

Nama wajib diisi; setiap kolom maksimal 200 karakter. Jika operator lain sudah memperbarui identitas setelah formulir dibuka, penyimpanan ditolak dengan pesan konflik: tutup lalu buka ulang Edit untuk membaca data terbaru. Saat koneksi gagal, formulir tetap terbuka dan dapat dicoba lagi. Menyimpan ulang perubahan yang sama aman. Akses mengikuti Admin yang tersedia saat ini, tanpa login. Tidak diperlukan perubahan schema database.

Setelah mengoreksi identitas, sesuaikan CSV master panitia juga. CSV lama dengan identitas berbeda tetap ditolak saat impor agar tidak mengembalikan koreksi secara diam-diam.

Saat memperbarui hosting yang sudah terpasang, pertahankan `private/database.php` yang berisi konfigurasi Anda. Unggah berkas aplikasi yang berubah; tidak perlu mengimpor ulang SQL dummy.

## Pratinjau CSV sebelum impor

Di Admin, pilih acara dan berkas CSV, lalu tekan **Periksa & Pratinjau CSV**. Pratinjau menampilkan jumlah baris, undangan baru, data yang sudah ada dan identik, serta baris bermasalah. Maksimal 20 contoh baris dan 50 rincian kesalahan ditampilkan agar halaman tetap ringan; total kesalahan tetap dihitung seluruhnya. Nomor kesalahan mengikuti baris fisik berkas, termasuk jika sel berkutip mengandung baris baru.

Pemeriksaan tidak mengubah database atau membuat token QR. Setelah semua kesalahan diperbaiki, tekan **Konfirmasi Impor**. Server memvalidasi ulang berkas dan membandingkan dengan data terbaru dalam transaksi; bila ada satu konflik, seluruh impor dibatalkan. Data yang sudah identik dilewati dan token lamanya dipertahankan. Bila identitas berbeda, perbaiki melalui Edit atau perbaiki CSV, bukan menimpa data dengan impor.

Mengganti berkas, mengganti acara, atau menekan Batalkan membatalkan pratinjau. Jika koneksi gagal saat konfirmasi, periksa ulang CSV; impor ulang data identik tidak menggandakan undangan. Format tetap UTF-8 (BOM boleh), pemisah koma, maksimal 5 MB/10.000 undangan. Kutip ganda dalam sel berkutip ditulis dua kali. Header salah, kutip rusak, dan berkas tanpa undangan ditolak. Pembaruan ini tidak memerlukan perubahan database.

Uji khusus pada database demo terpisah: `PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs TEST_ORIGIN=http://127.0.0.1:8104 node tests/csv-preview.mjs`. Uji tersebut mengubah data sintetis; jangan jalankan pada produksi.

## Status acara: Persiapan, Dibuka, Selesai

Di Admin, pilih status di samping nama acara, tekan **Terapkan**, lalu konfirmasi. Status berlaku untuk acara terpilih saja.

| Status | Perilaku |
| --- | --- |
| Persiapan | Siapkan CSV, edit identitas, dan buat QR. Kamera/check-in belum dibuka. |
| Dibuka | T01–T06 boleh mencatat hadir. Impor dan perbaikan identitas tetap tersedia. |
| Selesai | Lihat/cari daftar, QR, dan ekspor laporan; check-in, pratinjau/impor CSV, dan edit identitas dihentikan. |

Acara baru selalu dimulai dalam Persiapan. Tablet memeriksa status setiap 3 detik menggunakan endpoint ringan; ketika ditutup, kamera dihentikan dan konfirmasi lama dibersihkan. PHP tetap memeriksa status dalam transaksi dengan penguncian baris acara, sehingga permintaan dari tampilan lama tidak dapat melewati penutupan. Pembukaan kembali diperbolehkan melalui perubahan status yang dikonfirmasi Admin; daftar, token QR dan riwayat hadir tidak dihapus. Perubahan status dari formulir yang tertinggal ditolak jika sudah ada perubahan berbeda dari perangkat lain.

**Upgrade instalasi lama:** backup database, pilih database yang sama di phpMyAdmin, impor `sql/08_status_acara.sql`, lalu unggah kode terbaru sambil mempertahankan `private/database.php`. Migrasi aman diulang: acara yang sudah ada dipertahankan Dibuka saat kolom pertama kali ditambahkan, supaya penerimaan berjalan tidak berhenti mendadak. Tandai acara lama yang sudah berakhir sebagai Selesai melalui Admin. Status yang sudah dipilih tidak diubah ketika migrasi diulang.

**Instalasi baru:** `rsas_dummy.sql` dalam paket hosting sudah mencakup schema dan migrasi status. Acara demo disetel Dibuka agar bisa langsung diuji; acara nyata baru tetap Persiapan. Jangan mengimpor SQL dummy sebagai pengganti migrasi pada database produksi.

Uji status: `PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs TEST_ORIGIN=http://127.0.0.1:8107 PHP_CONTAINER=rsas-status-mysql node tests/event-status.mjs` pada database demo terpisah. Uji migrasi: `python3 tests/status-migration.py rsas-sql-mysql mysql` (membuat database uji `rsas_status_upgrade`; jangan arahkan ke produksi).

## Cetak QR undangan massal

Pilih acara di Admin → **Cetak QR Massal**. Tampilan cetak memuat seluruh daftar undangan acara, bukan hanya hasil filter kehadiran/pencarian tabel. Kartu memuat logo RSAS, nama acara, tanggal bila tersedia, nama tamu, perusahaan, jabatan, kode dan QR. Dua perwakilan PT tetap memperoleh dua kartu dengan kode berbeda.

Maksimal 20 kartu dimuat per batch, diurutkan berdasarkan kode. Tekan **Cetak / Simpan PDF**, pilih kertas A4, skala 100%, dan matikan header/footer browser. Gunakan **Batch berikutnya** untuk mencetak sisanya. Browser menentukan jumlah lembar berdasarkan panjang identitas; kartu tidak dipotong menjadi dua halaman. Pengujian PDF Chromium mencetak batch normal 20 kartu dalam 4 lembar. Cetak satu contoh dan uji QR terlebih dahulu sebelum mencetak seluruh daftar.

QR menggunakan token yang sudah ada di database. Mencetak tidak membuat token, undangan atau absensi baru. Halaman ini juga tersedia saat Persiapan dan Selesai karena hanya membaca data. Selesaikan koreksi daftar sebelum mencetak semua batch; jika daftar berubah di tengah pencetakan, periksa ulang urutan/batch agar tidak ada kartu terlewat atau tercetak ulang. Simpan PDF di media panitia dan bagikan kartu kepada tamu yang sesuai.

Tidak perlu Composer atau pustaka PDF server; QR dibentuk dengan pustaka lokal yang sudah dibundel dan PDF dibuat oleh browser. Tombol cetak aktif setelah QR selesai dibuat. Tidak perlu migrasi database tambahan jika versi status acara sudah terpasang. Uji: `PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs TEST_ORIGIN=http://127.0.0.1:8110 node tests/bulk-print.mjs` pada database uji kosong dengan schema 05/06/08; memerlukan Chromium dan `pdftotext` untuk memeriksa PDF.

## Paket daftar acara 19 November 2026

Daftar dari pengguna tersedia pada `data/undangan-rsas-20261119.csv`, dengan kode `RSAS001`–`RSAS080`. Lihat [pemetaan dan catatan sumber](data/README.md) untuk rincian 10 kelompok, label perwakilan instansi/PT, serta empat anggota keluarga yang namanya belum tersedia. Rincian 80 slot disiapkan lengkap; perbedaan angka TOR awal 73 tetap dicatat, bukan dianggap sudah diverifikasi.

Bangun paket khusus: `python3 tools/build_shared_hosting.py /workspace/rsas-acara-19-november-2026 --event-rsas`. ZIP tetap berisi satu folder `hosting-subdomain/` dan satu SQL `rsas_acara_19_november_2026.sql`. SQL gabungan sudah mencakup schema/status dan daftar acara sebenarnya, **tanpa data demo, RSVP, atau absensi awal**. Token dibuat acak di database, bukan disertakan nilainya dalam SQL. Status awal **Persiapan**; acara berlangsung Kamis, 19 November 2026, mulai 09.00 WIB. Jam dicantumkan pada informasi lokasi acara dan kartu cetak.

CSV di paket ini berada dalam `private/daftar-undangan.csv`, bukan folder publik. Masukkan konfigurasi database di `private/database.php` setelah mengunggah folder. Setelah SQL berhasil, Admin akan menampilkan acara `RSAS-20261119` dengan 80 undangan dan 0 hadir. Periksa identitas sebelum mencetak empat batch (20/20/20/20). Angka progres aplikasi memakai seluruh slot acara; angka itu berbeda dari persentase TOR resmi dengan penyebut tetap 73 pada paket SQL lama. Impor ulang SQL tidak menimpa koreksi/status/token yang sudah tersimpan dan tidak menghapus slot tambahan yang mungkin dibuat panitia.
