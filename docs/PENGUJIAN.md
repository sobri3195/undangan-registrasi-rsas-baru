# Hasil pengujian

Dijalankan 17 November 2026 pada PHP CLI 8.2.32, Node 24.22.1, dan Chromium headless lokal. Tidak ada deployment produksi dalam pengujian ini.

| Pemeriksaan | Hasil |
| --- | --- |
| `php -l public/index.php` | Lulus, tidak ada kesalahan sintaks |
| `npm test` | 8 pengujian lulus, 0 gagal / dilewati |
| Empat rute PHP, rute array / tidak dikenal | HTTP 200 pada rute valid; 404 pada rute tidak valid |
| Host palsu | Tautan undangan tetap memakai APP_BASE_URL |
| CSP dan Permissions-Policy | Header tersedia; kamera diizinkan hanya pada Petugas |
| QR → decoder lokal → konfirmasi → IndexedDB | Lulus dengan stream video dari canvas QR sintetis |
| Mulai Kamera hanya setelah tombol, tanpa audio | Lulus dengan mock getUserMedia, 1 pemanggilan sesudah tombol |
| PNG QR undangan dan check-in | Unduhan berhasil di Chromium |
| CSV, JSON, RSVP, transaksi IndexedDB | Lulus, termasuk penolakan data bertentangan |
| Dua tablet T01/T02 mencatat slot sama | Dua log dipertahankan, satu hadir unik; impor ulang idempoten |
| Offline Chromium | Setelah persiapan cache, jaringan dimatikan melalui Playwright; navigasi, reload, pencarian, simulasi pindai, JSON/CSV/PNG dan merge lulus |
| Kamera fisik Chrome Android | Belum diuji; perlu perangkat nyata melalui HTTPS |
| Kamera fisik Safari iPad | Belum diuji; perlu perangkat nyata melalui HTTPS |
| DNS, sertifikat, redirect Apache/cPanel produksi | Belum diuji; perlu akses hosting dan pemasangan |
| Mode pesawat fisik enam tablet | Belum diuji; wajib checklist sebelum acara |

Uji browser: `tests/browser.mjs`. Uji model: `tests/core.test.js`. Pengujian browser menggunakan server PHP lokal HTTP pada loopback yang dipercaya browser untuk service worker. Itu bukan bukti TLS produksi atau kompatibilitas Safari/Android. Kamera canvas menguji alur pemrosesan frame dan konfirmasi, bukan fokus, izin, atau kamera belakang perangkat fisik.

## Kriteria penerimaan perangkat fisik

Pada Chrome Android dan Safari iPad: buka HTTPS dengan sertifikat valid, impor master demo, simpan ID/acara, persiapkan offline. Tekan Mulai Kamera, izinkan kamera belakang, pindai QR PT001, pastikan belum hadir sebelum Catat Hadir. Catat dari dua tablet, ekspor JSON keduanya, gabungkan T05: satu hadir. Ulangi pada PT002: total dua hadir. Coba izin ditolak dan pencarian manual. Aktifkan mode pesawat, reload, pindai dan ekspor PNG/JSON/CSV; buka berkas untuk memverifikasi isinya. Simpan hasil perangkat/browser/versi di catatan operasional panitia.
