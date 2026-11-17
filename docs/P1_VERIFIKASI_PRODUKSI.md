# Verifikasi P1 sebelum acara

Perbaikan akses diuji secara otomatis pada database lokal terpisah. Pemeriksaan perangkat, jaringan lokasi, dan TLS produksi tetap memerlukan lingkungan sebenarnya. Jangan mengisi daftar ini sebagai lulus hanya karena tes browser simulasi lulus.

## Pasang dan periksa akses

1. Backup database dan konfigurasi. Pada instalasi lama, impor 10_akses_panitia.sql. SQL gabungan paket baru sudah menyertakannya.
2. Isi database serta ADMIN_PIN dan STAFF_PIN yang acak dan berbeda (8–12 digit) pada private/database.php. Jangan gunakan PIN contoh atau tanggal acara. Jangan bagikan PIN Admin kepada petugas scan.
3. Browser privat tanpa sesi: Scan/Admin menampilkan form PIN; API events/status/search/invitation/export dan cetak QR tidak mengungkap data tamu.
4. Masuk Petugas: pencarian, pindai, identitas dan Konfirmasi Hadir berjalan; pengelolaan/status/QR/laporan ditolak.
5. Masuk Admin: impor/edit/status/QR massal/CSV berjalan. Keluar lalu ulangi akses; data kembali terlindungi. Mengganti PIN peran harus mencabut sesi lama peran itu.
6. Sesudah pengujian sintetis, periksa acara nyata tetap Persiapan dan tidak mengandung absensi latihan.

## Hosting dan HTTPS — belum diverifikasi otomatis di produksi

- HTTP mengalihkan ke HTTPS dengan domain tetap; sertifikat valid tanpa peringatan.
- private/database.php dan private/daftar-undangan.csv ditolak (403).
- Cache CDN tidak menyimpan PHP, API, akses PIN atau hasil cetak.
- Cookie sesi memiliki Secure pada HTTPS, HttpOnly, dan SameSite=Strict.
- PHP menjalankan kode, tidak mengunduh file sumber; PIN dan password tidak terlihat di HTML/respons API.

## Perangkat — belum diuji pada kamera fisik

- Chrome Android dan Safari iPad: izin kamera diterima/ditolak, kamera belakang, fokus, pindai satu QR cetak dan satu QR dari layar.
- Nama benar muncul sebelum tombol Konfirmasi Hadir. Pindai ulang di T02 dan T03 menghasilkan satu tamu hadir dengan dua sumber tablet.
- Dua slot PT yang berbeda menghasilkan dua kehadiran.
- Keenam tablet masuk dengan PIN Petugas, memilih acara yang sama dan ID T01–T06 berbeda; Admin memperbarui rekap.
- Kunci layar/pindah aplikasi lalu kembali; kamera dapat dimulai kembali. Sesi yang habis meminta PIN kembali.

## Jaringan dan pemulihan — perlu diuji pada lokasi acara

- Putuskan internet sesaat ketika konfirmasi: aplikasi tidak mengklaim sukses; retry setelah pulih tidak menggandakan hadir.
- Versi ini tidak menyimpan check-in dalam mode pesawat. Siapkan internet cadangan dan daftar manual; jangan mengandalkan service worker lama.
- Ekspor CSV dan backup database melalui cPanel; pulihkan backup ke database uji terpisah, cocokkan jumlah serta QR/token dan hadir.
- Catat model perangkat, versi OS/browser, waktu uji, operator dan hasil; tutup pemeriksaan gagal sebelum acara dibuka.

Tidak ada hasil kamera/TLS produksi yang dinyatakan lulus dalam perubahan kode ini. Kegagalan proxy pengembangan menjangkau domain produksi bukan hasil pengukuran TLS hosting.
