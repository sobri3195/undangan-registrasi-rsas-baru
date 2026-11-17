# Aplikasi registrasi undangan RSAU dengan absensi lokal enam tablet

Menyediakan empat halaman PHP publik untuk tamu, petugas, dan koordinator. QR per slot menggunakan domain tetap dan token acak; RSVP melalui pesan dipisahkan dari absensi yang baru dicatat setelah konfirmasi petugas.

Daftar, RSVP panitia, dan log disimpan di IndexedDB. Backup JSON dapat digabung tanpa menghitung ganda slot yang dipindai beberapa tablet. Ekspor PNG, JSON, dan CSV Excel, cache offline service worker, validasi impor, CSP, pembatasan kamera, dan proteksi formula CSV disertakan.

Hanya isi `public/` diunggah ke document root. README, template CSV, data sintetis, panduan cPanel/DNS/TLS, dan panduan T01–T06 disertakan.

Validasi: PHP lint lulus; 8 pengujian model lulus; alur Chromium termasuk offline, video QR simulasi, IndexedDB, unduhan, dan merge dua tablet lulus. Kamera fisik Android/iPad, mode pesawat perangkat fisik, dan HTTPS/cPanel produksi belum diuji; checklist tersedia di docs/PENGUJIAN.md.
