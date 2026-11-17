# Hasil pengujian versi dua tampilan

Diuji 17 November 2026 dengan PHP 8.2 + PDO MySQL, MariaDB 10.11.19 / MySQL 8.0.46, dan Chromium headless. Tidak ada deployment produksi dalam pengujian ini.

| Pemeriksaan | Hasil |
| --- | --- |
| `php -l` seluruh 3 berkas PHP aktif | Lulus |
| Schema dua tabel InnoDB/utf8mb4 | Lulus MySQL dan MariaDB |
| Enam sesi browser independen T01–T06 | Masing-masing memindai QR sintetis lalu mengonfirmasi nama |
| Scan sebelum Konfirmasi Hadir | Belum ada kehadiran yang disimpan |
| Satu kode di keenam tablet | Satu tamu unik, sumber T01–T06 tersimpan |
| Dua slot PT berbeda | Dua tamu dihitung |
| Admin otomatis | Nama, asal tablet dan total diperbarui tanpa refresh manual |
| Impor CSV dan konflik identitas | Impor valid berhasil; konflik ditolak tanpa penambahan sebagian |
| Koneksi putus saat konfirmasi | Gagal dengan pesan, retry aman setelah jaringan pulih |
| Ekspor CSV, validasi QR, CSRF, rute, tata letak tablet | Lulus |
| `npm test` | 9 pengujian lulus, termasuk utilitas SQL lama yang dipertahankan |
| Kamera fisik Chrome Android / Safari iPad | Belum diuji; perlu perangkat sebenarnya melalui HTTPS |
| DNS / TLS / redirect cPanel produksi | Belum diuji; menunggu pemasangan pada hosting |

`tests/browser.mjs` membutuhkan server PHP dengan database uji KOSONG dan schema `sql/05_scan_sederhana.sql`. Tes mengimpor data sintetis dan menulis absensi; jangan jalankan pada database produksi. Contoh: `PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs TEST_ORIGIN=http://127.0.0.1:8091 node tests/browser.mjs`. Browser memakai kamera canvas simulasi untuk menguji pengolahan frame QR, bukan kamera/izin/fokus perangkat fisik.

Sebelum acara: buka situs HTTPS dari enam tablet, impor contoh CSV di Admin, tetapkan T01–T06, periksa identitas dan konfirmasi. Pastikan Admin menampilkan nama/sumber tablet serta total unik. Uji izin kamera ditolak, pencarian manual, koneksi terputus, retry, dan unduhan CSV. Versi ini memerlukan internet; tidak menyediakan pencatatan offline. Shell offline lama dibersihkan, tetapi IndexedDB lama tidak dihapus otomatis.


Pembaruan multi-acara: uji integrasi browser juga lulus pada MySQL 8.0.46 dan MariaDB 10.11.19 untuk pembuatan/pemilihan acara, tanggal tidak valid, kode acara duplikat, kode tamu sama pada dua acara dengan identitas berbeda, isolasi scan/rekap/CSV, QR beda acara ditolak, pilihan tetap setelah reload, dan respons jaringan acara lama tidak menimpa tampilan acara baru. Tata letak diperiksa di lebar 390, 1024, dan 1280 piksel. Animasi scan/konfirmasi menghormati prefers-reduced-motion. Migrasi 06 dijalankan ulang pada data yang sudah ada tanpa mengubah jumlah kehadiran.

Filter kehadiran Admin: `tests/attendance-filters.mjs` lulus pada MySQL 8.0.46 dan MariaDB 10.11.19. Diuji semua/sudah/belum datang, pencarian nama/perusahaan/jabatan/kode/tablet, CSV sesuai filter/pencarian, kode duplikat lintas tablet satu baris, waktu kosong untuk belum datang, ringkasan seluruh acara, isolasi acara, perpindahan tamu dari belum ke sudah setelah check-in, penolakan parameter tidak valid, respons filter tertunda dan lebar ponsel 390 piksel.

Edit identitas: `tests/edit-guest.mjs` lulus pada MySQL 8.0.46 dan MariaDB 10.11.19 menggunakan database dummy terpisah. Pemeriksaan meliputi editor tabel dan pencarian (tamu sudah/belum hadir), identitas baru pada scanner/CSV, QR lama tetap valid, jumlah hadir serta catatan tablet tidak berubah, slot kode sama pada acara lain tetap utuh, validasi/CSRF/metode HTTP, konflik dua operator, penyimpanan ulang, koneksi gagal/retry, respons lookup lama, dan dialog pada lebar ponsel. Jalankan pada database baru dari SQL 07; tes mengoreksi beberapa identitas demo.

Pratinjau CSV: `tests/csv-preview.mjs` lulus pada MySQL 8.0.46 dan MariaDB 10.11.19. Pemeriksaan mencakup ringkasan baru/identik/bermasalah tanpa penulisan, nomor baris, konfirmasi dan impor ulang, penolakan konflik tanpa simpan sebagian, perubahan data setelah pratinjau, pergantian berkas/acara, CSV UTF-8 BOM/CRLF/Unicode/sel multiline/kutip ganda, header/kutip rusak, batas 10.000 undangan, batas 20 contoh/50 kesalahan, format CSV lama, CSRF, teks HTML sebagai teks, dan tampilan ponsel. Alur enam tablet diperbarui agar melewati pratinjau dan konfirmasi sebelum impor.

Status acara: `tests/event-status.mjs` lulus di MySQL 8.0.46 dan MariaDB 10.11.19 untuk Persiapan/Dibuka/Selesai, kendali tablet otomatis, penolakan check-in/impor/edit melalui API pada acara selesai, QR/laporan/riwayat tetap utuh, konflik perubahan status, pembukaan kembali, default acara baru, serta tampilan ponsel. Uji transaksi penutupan menahan lock pada baris acara sementara check-in dimulai; setelah penutupan commit, check-in ditolak dan jumlah hadir tetap. `tests/status-migration.py` memverifikasi upgrade schema lama, default acara baru, migrasi ulang, dan pelestarian status Selesai serta catatan scan pada kedua mesin database.

Cetak QR massal: `tests/bulk-print.mjs` lulus pada MySQL 8.0.46 dan MariaDB 10.11.19 untuk batch 20/20/1 dari 41 undangan, urutan kode tanpa duplikat, tautan domain tetap, decoding seluruh QR menjadi tautan/token awal, isolasi acara, tanpa perubahan undangan/riwayat, PDF A4 berisi identitas tanpa tombol navigasi, tombol window.print, tampilan ponsel, parameter invalid, acara kosong dan acara selesai. PDF batch 20 kartu dihasilkan dengan Chromium; satu QR pada hasil render PDF juga didekode ulang ke tautan asal. Fokus/kualitas pindai dari kertas, dialog Save as PDF Safari iPad dan printer fisik belum diuji.

Daftar yang diberikan pengguna: `tests/event-roster.py` lulus pada MySQL 8.0.46 dan MariaDB 10.11.19: 80 slot dalam 10 kelompok, kode unik, tanggal 19 November 2026, status Persiapan, tidak ada absensi awal, token acak unik, dan impor ulang mempertahankan token/koreksi/status. `tests/roster-print.mjs` memeriksa pratinjau CSV menghasilkan 80 data identik, empat batch masing-masing 20 kartu, seluruh QR dapat didekode dengan kode acara yang benar, waktu/lokasi tercantum pada PDF, serta tidak ada absensi yang dibuat saat mencetak. Data ini berasal dari teks pengguna, bukan hasil verifikasi dokumen TOR asli.
