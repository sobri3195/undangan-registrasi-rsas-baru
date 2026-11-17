# Registrasi Undangan RSAU

Aplikasi PHP Native, HTML, CSS, dan JavaScript Vanilla untuk RSAU Prof. dr. Abdulrachman Saleh. Empat halaman publik, tanpa login dan tanpa database server. Data pribadi, roster, RSVP panitia, dan absensi hanya disimpan di IndexedDB browser panitia. Tidak ada endpoint unggah data.

## Menjalankan

- PHP 8.2+; produksi: Apache cPanel dengan mod_rewrite, mod_headers, TLS, dan PHP aktif.
- Unggah **hanya isi `public/`**, termasuk `.htaccess`, ke document root subdomain. Tidak memerlukan Composer, npm, atau build di hosting.
- Pengembangan: `php -S 127.0.0.1:8080 -t public`. Kamera dan service worker di produksi memerlukan HTTPS. Localhost hanya untuk pengujian internal.
- `APP_BASE_URL` di PHP dan `BASE` di JS dipatok ke `https://undanganregistrasirsas.puskesau.com`. Tidak ada pembacaan Host / X-Forwarded-Host untuk tautan atau QR. Navigasi lokal menggunakan domain produksi sesuai persyaratan; pada dev gunakan rute langsung.

| Halaman | Fungsi |
| --- | --- |
| `/` | Beranda |
| `/index.php?page=tamu` | Jawaban RSVP, pesan WhatsApp opsional, QR PNG |
| `/index.php?page=petugas` | Kamera belakang, pencarian manual, konfirmasi Catat Hadir |
| `/index.php?page=koordinator` | Impor CSV, QR individu, pencatatan RSVP, merge JSON, laporan CSV |

## Alur panitia

1. Gunakan template `public/template.csv` atau CSV sintetis `demo/undangan.csv`. UTF-8, koma, header persis `event,code,name,company,position,category,token`. Kategori: `VIP`, `reguler`, `mitra PT`. Kode/event: huruf ASCII, angka, `_`, `-`, maksimum 64 karakter. Maksimum 10.000 slot dan 5 MB. Teks maksimum 200 karakter. Kutip kolom yang mengandung koma atau baris baru.
2. Satu baris = satu orang/slot. Dua perwakilan PT menggunakan dua kode. Impor **sekali pada koordinator** dengan token kosong untuk token acak 192-bit. Lalu ekspor JSON master dan impor JSON yang sama pada semua tablet. Jangan mengimpor CSV bertoken kosong secara terpisah di setiap tablet: token baru akan bertentangan. Simpan master sebagai backup aman.
3. Simpan kode acara, ID tablet, dan nomor WhatsApp opsional (8–15 digit internasional tanpa `+`). Pilih slot → Buat QR/tautan → simpan PNG atau salin tautan. Nomor panitia dibawa dalam fragment QR; buat ulang tautan bila nomor berubah. QR memuat event/kode/token, bukan nama/perusahaan. Tamu normal tidak memiliki roster lokal dan melihat kode undangan; identitas lengkap baru tampil setelah pencocokan oleh petugas.
4. Tamu memilih Akan Hadir / Tidak Dapat Hadir lalu menyalin pesan atau membuka WhatsApp. Pesan perlu dikirim tamu. Panitia mencatat jawaban di Koordinator. Tidak ada RSVP otomatis lintas perangkat. Jawaban tidak mengubah absensi. QR check-in bisa disimpan sebagai PNG.
5. Petugas menyimpan data hanya setelah menekan **Catat Hadir**. Pindai saja tidak mencatat. Pencarian minimal 2 karakter berdasarkan nama, perusahaan, jabatan, kode; difilter acara aktif dan dibatasi 50 hasil.
6. Setiap tablet mengekspor JSON setelah sesi. T05 mengimpor seluruh JSON, kemudian mengekspor laporan CSV UTF-8 BOM untuk Excel. Jika Excel memakai pemisah titik koma, gunakan Data → From Text/CSV dan pilih koma / UTF-8.

## Format & penggabungan

JSON versi 1 memuat `slots`, `logs`, `rsvps` (contoh dalam `demo/`). Log memiliki ID unik, event/kode/token, ID tablet dan waktu ISO UTC. Kunci kehadiran adalah `(event, code)`. Dua tablet yang offline bisa mencatat slot sama; kedua bukti disimpan, laporan menghitung satu hadir, menampilkan semua tablet dan waktu paling awal. Tidak ada pencegahan duplikat lintas tablet secara langsung. Pada data lokal yang sudah hadir, pencatatan ulang ditolak. Transaksi read/write IndexedDB mencegah tab browser menimpa data satu sama lain.

Impor ulang JSON idempoten. Slot dengan kode sama tetapi identitas atau token berbeda, log dengan ID sama tetapi isi berbeda, token tidak cocok, versi tak dikenal, atau ukuran berlebih ditolak tanpa mengubah data. Maksimum 20 MB per JSON, 12 berkas per operasi, 100.000 log pada data hasil gabungan. RSVP terbaru menurut waktu perangkat dipakai; untuk waktu sama dipilih nilai jawaban secara leksikografis agar hasil deterministik. Samakan jam tablet sebelum acara dan periksa konflik RSVP secara manual. Roster dianggap tetap setelah master dibagikan. Perubahan identitas bertentangan harus diselesaikan dari master oleh panitia; aplikasi tidak menimpa roster diam-diam.

## Privasi dan batas keamanan

Semua halaman terbuka sesuai desain. Token acak dicocokkan terhadap master lokal, **bukan tanda tangan digital**. QR atau JSON yang dibagikan harus melalui jalur panitia yang dipercaya. Orang dengan akses perangkat atau berkas backup dapat membaca/mengubah data; tidak ada otorisasi server, enkripsi backup, atau validasi kehadiran jarak jauh. Jangan mempublikasikan JSON master. Kunci perangkat, batasi pemakaian, simpan backup di media panitia yang terlindungi, tetapkan retensi/penghapusan setelah acara. Menghapus data situs, mode privat, pergantian browser/origin, atau eviksi penyimpanan dapat menghilangkan data. IndexedDB tidak otomatis berpindah perangkat.

Render DOM memakai `textContent`, PHP memakai escape HTML dan allowlist rute. CSP tanpa inline script/eval, camera Permissions-Policy hanya Petugas, audio/geolokasi dimatikan, referrer disembunyikan, dan formula Excel diawali apostrof. Kamera berhenti saat halaman disembunyikan. Tidak ada analytics/CDN runtime: generator QR dan decoder dibundel lokal. Fragment QR tidak dikirim sebagai query ke server; token tetap rahasia bagi pemegang tautan. Tidak ada data tamu dalam cache service worker; cache berisi shell publik.

Service worker `/sw.js`, scope `/`, menyimpan halaman dan aset setelah tombol persiapan ditekan; fallback cache digunakan jika jaringan gagal. Perbarui versi CACHE ketika merilis perubahan shell. Proses PHP tidak berjalan offline: halaman hasil render yang tersimpan dipakai. Data tetap di IndexedDB. Gunakan tombol persiapan setelah rilis, lalu uji mode pesawat. Backup tetap wajib meskipun persistent storage diizinkan browser.

## Validasi

`php -l public/index.php` dan `npm test` (Node 22+, tanpa dependensi). Uji browser opsional: pasang Playwright di luar folder unggahan; jalankan PHP server, lalu `PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node tests/browser.mjs` dengan Chromium lokal. Lihat [hasil pengujian](docs/PENGUJIAN.md), [cPanel](docs/CPANEL.md), dan [operasi enam tablet](docs/ENAM-TABLET.md).

Dependensi vendored: qrcode-generator 2.0.4 (MIT; lisensi di header + berkas LICENSE), jsQR 1.4.0 (Apache-2.0). Sumber npm resmi; tidak membutuhkan koneksi registry saat aplikasi berjalan. Jangan unggah folder `demo`, `docs`, atau `tests` ke document root.
