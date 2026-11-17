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
