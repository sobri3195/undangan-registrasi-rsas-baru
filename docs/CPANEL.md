# cPanel — versi dua tampilan

1. Tambahkan subdomain `undanganregistrasirsas.puskesau.com` pada akun hosting yang benar. Pilih document root khusus aplikasi. Unggah isi `public/`, termasuk `.htaccess`, sehingga `index.php` dan `api.php` langsung ada di root subdomain.
2. Ambil IP hosting dan nameserver otoritatif dari penyedia hosting yang sebenarnya. Pada DNS otoritatif, buat A subdomain ke IPv4 hosting tersebut. AAAA hanya jika IPv6 benar-benar aktif; alternatif CNAME hanya sesuai petunjuk penyedia. Tidak ada IP/nameserver produksi dalam repositori ini.
3. Pasang sertifikat AutoSSL/Let's Encrypt untuk subdomain, periksa cakupan hostname, rantai sertifikat, masa berlaku dan CAA. Jangan melewati peringatan sertifikat pada tablet.
4. Pilih PHP 8.2+ dan aktifkan PDO MySQL. Buat database/user di cPanel, hubungkan hak akses user ke database. Pilih database itu di phpMyAdmin lalu impor `sql/05_scan_sederhana.sql` lalu `sql/06_multi_acara.sql`. Untuk instalasi dua tampilan sebelumnya, jalankan hanya 06 sebagai migrasi.
5. Salin `config.local.php.example` menjadi `config.local.php` satu level di atas document root. Isi nama database/user dengan prefix cPanel dan password di hosting; jangan unggah konfigurasi ke folder web atau Git. Pilih acara melalui antarmuka; acara untuk CSV dan QR lama harus sesuai dengan kode acara yang diimpor.
6. `.htaccess` memerlukan Apache mod_rewrite/AllowOverride. Redirect menggunakan domain HTTPS tetap. Jika reverse proxy menyebabkan loop, sesuaikan TLS origin pada penyedia atau minta redirect ditangani edge; jangan mengambil domain dari X-Forwarded-Host. Pastikan PHP dijalankan, bukan diunduh sebagai teks.
7. Buka `/index.php?page=admin`, impor CSV, lalu uji `/index.php?page=scan` pada keenam tablet. API/PHP mengirim `Cache-Control: no-store`; bypass cache CDN untuk PHP dan API. Data harus tampil di Admin tanpa pemindahan file.

Pemasangan DNS/TLS dan database produksi belum dijalankan dari lingkungan pengembangan ini. Data dan fungsi panitia kini memerlukan PIN.

Pembaruan status acara pada instalasi lama memerlukan `sql/08_status_acara.sql` sebelum kode baru digunakan. Impor di database aplikasi yang sama, dengan backup lebih dahulu. Untuk instalasi baru dari ZIP, SQL gabungan sudah mencakup status. Setelah membuat acara nyata, buka penerimaan melalui Admin → Status acara → Dibuka → Terapkan; tutup dengan Selesai setelah penerimaan berakhir.


AKSES PANITIA (PERBAIKAN P1):
- Isi ADMIN_PIN dan STAFF_PIN pada file setting database yang sama. Pada paket
  satu folder, tetap hanya private/database.php yang perlu diatur.
- Gunakan dua PIN acak berbeda, masing-masing 8-12 digit; tidak ada PIN bawaan.
- Masuk di Scan dengan PIN Petugas; masuk di Admin dengan PIN Admin.
- Petugas tidak dapat mengubah daftar/status acara, membuat QR atau mengunduh laporan.
- Data undangan, endpoint API dan halaman cetak tidak tersedia tanpa akses.
- Sesi berlaku 12 jam; tekan Keluar setelah selesai. Mengganti PIN mencabut
  sesi peran tersebut. Aplikasi tidak menyimpan PIN di cookie/localStorage atau memasukkannya ke SQL.
- Instalasi baru: satu SQL paket sudah mencakup tabel pembatas percobaan.
- Upgrade: backup, impor sql/10_akses_panitia.sql dari repositori, pertahankan
  konfigurasi database yang sudah terisi, tambahkan kedua PIN, unggah kode baru.
  Jangan menimpa konfigurasi berisi kredensial dengan template kosong.
- Lima kegagalan per alamat/peran dalam 5 menit membatasi login sementara;
  batas global tambahan 50 kegagalan/peran per menit. Cookie baru tidak meresetnya.
- Gunakan HTTPS. Uji Android/iPad dan jaringan lokasi sebelum penerimaan.
