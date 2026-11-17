# Pemasangan cPanel

1. Periksa panel hosting yang benar: akun/domain `puskesau.com`, menu Domains/Subdomains, IP server pada Server Information atau informasi penyedia, serta nameserver otoritatif domain. Nilai IP/nameserver tidak tersedia dalam repositori ini; konfirmasi pada penyedia. Jangan memakai IP contoh sebagai DNS produksi.
2. Tambahkan subdomain `undanganregistrasirsas.puskesau.com`, dengan document root khusus, misalnya folder di akun hosting yang dipilih cPanel. Jangan berbagi document root dengan aplikasi lain. Unggah **isi `public/`** langsung ke root tersebut, termasuk `.htaccess`; `index.php` dan `sw.js` harus berada di root subdomain. Pilih PHP 8.2+ melalui MultiPHP Manager. Pastikan file statis dapat dibaca dan direktori dapat ditelusuri; jangan gunakan izin 777.
3. Pada pengelola DNS otoritatif (belum tentu Zone Editor cPanel), buat A ke IPv4 hosting yang diberikan penyedia. Tambah AAAA hanya jika IPv6 hosting benar-benar aktif. Alternatif CNAME hanya ke hostname yang secara eksplisit diberikan penyedia; jangan membuat A dan CNAME pada nama sama. Periksa propagasi dengan `dig A undanganregistrasirsas.puskesau.com` dan AAAA. Hapus AAAA usang melalui pengelola DNS bila menyebabkan salah tujuan.
4. Jalankan AutoSSL/Let's Encrypt untuk subdomain. Pastikan DNS mengarah benar dan CAA mengizinkan CA yang digunakan. Verifikasi sertifikat mencakup hostname, rantai dipercaya, dan tidak kedaluwarsa. Jangan melewati peringatan TLS di tablet.
5. `.htaccess` mengalihkan HTTP ke HTTPS pada domain tetap. Pastikan mod_rewrite dan AllowOverride diizinkan. Bila hosting menolak `Options -Indexes`, minta dukungan hosting atau sesuaikan directive tersebut sesuai aturan penyedia. Jika memakai reverse proxy/CDN dan terjadi loop redirect, atur TLS sampai origin / Full Strict atau minta penyedia menangani redirect pada edge; jangan percaya X-Forwarded-Host. Aplikasi tidak mengasumsikan topologi proxy.
6. Periksa empat rute lewat HTTPS, rute tidak dikenal menghasilkan 404, CSP/Permissions-Policy di respons PHP, dan `/sw.js` mengembalikan JavaScript pada root. Jangan biarkan PHP tersaji sebagai teks. Gunakan cache bypass untuk PHP dan `sw.js` bila CDN aktif.
7. Pada perangkat panitia, impor master, simpan acara/ID tablet, tekan persiapan offline. Setujui kamera hanya pada Petugas. Jalankan checklist perangkat fisik sebelum hari acara. Semua tablet harus memakai origin HTTPS yang sama, browser yang sama selama acara, dan bukan browser dalam aplikasi WhatsApp.

## Pemeriksaan pascapasang

- `curl -I http://undanganregistrasirsas.puskesau.com/`: 301 ke domain HTTPS tetap.
- `curl -I https://undanganregistrasirsas.puskesau.com/`: TLS dipercaya dan HTTP 200.
- `curl -I 'https://undanganregistrasirsas.puskesau.com/index.php?page=petugas'`: `camera=(self)`; Tamu dan Koordinator `camera=()`.
- Lakukan check-in sintetis, ekspor PNG/JSON/CSV, gabungkan pada T05, lalu uji mode pesawat.

Jangan unggah data demo/backup tamu ke hosting. Deploy dan DNS produksi belum dilakukan oleh repositori ini.
