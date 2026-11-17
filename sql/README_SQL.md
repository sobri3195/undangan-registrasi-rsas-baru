# Paket SQL pendamping Registrasi Undangan RSAS

Untuk aplikasi `https://undanganregistrasirsas.puskesau.com/`. Paket ini adalah arsip dan pelaporan manual melalui phpMyAdmin, bukan perubahan alur check-in aplikasi. PHP/browser tetap berjalan tanpa database server, login, endpoint unggah, atau kredensial MySQL dalam JavaScript. Data baru masuk database ketika panitia mengimpor berkas SQL secara sengaja. Simpan SQL/JSON dan hasil laporan hanya pada media panitia; **jangan unggah folder sql/ atau backup ke document root**.

## Persyaratan

Gunakan database **yang sudah dibuat di cPanel** dan pilih database tersebut di phpMyAdmin. Berkas distribusi tidak menjalankan `CREATE DATABASE`, `USE`, `GRANT`, mengubah user, atau mengasumsikan nama/prefix database cPanel. Mesin: MySQL 8.0.16+ (versi 8.0 awal belum menegakkan CHECK) atau MariaDB 10.11+. Semua tabel InnoDB dengan default utf8mb4_unicode_ci, ID ASCII case-sensitive. Seluruh waktu memakai DATETIME(3) UTC, bukan waktu lokal server. MySQL 8.0.46 dan MariaDB 10.11.19 sudah diuji.

User database memerlukan SELECT, INSERT, UPDATE, DELETE, CREATE, CREATE TEMPORARY TABLES, CREATE ROUTINE, ALTER ROUTINE, EXECUTE dan REFERENCES sesuai pengaturan hosting. phpMyAdmin harus mendukung DELIMITER (umumnya didukung). Jika hosting menolak routine, minta penyedia mengizinkan hak yang diperlukan atau menjalankan pemasangan routine untuk database ini. Jangan menghilangkan transaksi, FK, atau CHECK untuk melewati penolakan. Berkas tidak membutuhkan SUPER/FILE atau akses filesystem server. SQL SECURITY INVOKER menggunakan hak pemanggil, tanpa DEFINER akun tertentu.

Backup database sebelum memasang. Prefiks `rsas_` mencegah benturan umum, tetapi pastikan belum dipakai skema lain. `CREATE TABLE IF NOT EXISTS` tidak memigrasikan tabel lama yang strukturnya berbeda. DDL memiliki implicit commit; pemasangan schema/routine bukan satu transaksi atomik. Impor data melalui routine bersifat atomik.

## Urutan di phpMyAdmin

1. cPanel → phpMyAdmin → pilih database yang benar → Import → SQL, UTF-8 → `01_schema.sql`. Periksa tujuh tabel dan enam stasiun. Jangan mematikan foreign key checks. Stasiun sudah diisi oleh schema sehingga produksi tidak bergantung pada seed demo.
2. Untuk latihan pada database uji, impor `02_seed_demo.sql`: 7 slot, terdiri dari 6 resmi dan 1 tambahan. Dua perwakilan resmi PT memiliki kode berbeda. Jangan menjalankan seed demo pada acara nyata.
3. Impor `03_contoh_impor_t05.sql`. Bagian pertama memasang routine `rsas_impor_t05`, bagian akhir menjalankan payload demonstrasi. **Untuk produksi, jalankan hanya bagian pemasangan sampai `DELIMITER ;`; jangan jalankan bagian `-- Synthetic merged snapshot` dan setelahnya.** Tambahkan acara dan master slot resmi/tambahan yang benar sebelum impor rekap nyata.
4. Pada database demo jalankan `04_query_rekap.sql` di tab SQL. Untuk produksi ganti `SET @acara` sesuai event. Periksa hasil dan query rekonsiliasi terakhir yang harus menghasilkan 0 baris.
5. Untuk rekap baru, impor hasil konversi T05 yang hanya memanggil routine. Jangan mengimpor ulang berkas 03 sebagai cara mengimpor data nyata. Jika ada error, hentikan, baca pesan dan perbaiki sumber; routine melakukan ROLLBACK serta meneruskan error. Jangan memakai `--force` atau INSERT IGNORE.

Schema dan demo aman dijalankan ulang terhadap data demo yang sama: tidak menimpa identitas lama. Namun seed bukan mekanisme memperbarui master. Simpan daftar master sebelum penerimaan; setelah ada scan, jangan mengubah status resmi/kode/perusahaan untuk mengejar angka laporan. Tidak ada perintah penghapusan data dalam empat berkas distribusi.

## Model data

| Tabel | Isi / kunci |
| --- | --- |
| rsas_acara | kode event unik dan URL aplikasi tetap |
| rsas_stasiun | T01 VIP; T02 reguler; T03 reguler/PT; T04 bantuan; T05 rekap; T06 cadangan |
| rsas_undangan | satu slot per `(acara,kode)`; identitas, kategori, `resmi` 1/0 |
| rsas_rsvp | jawaban terkini per slot, waktu UTC dan referensi arsip; terpisah dari scan |
| rsas_arsip_impor_t05 | payload JSON turunan, SHA-256 isi, nama berkas, waktu impor; unik per event/hash |
| rsas_catatan_scan | bukti scan unik `(acara,scan_id)`; FK slot, stasiun, arsip |
| rsas_kehadiran_efektif | satu baris per `(acara,kode)` yang memiliki scan; min/max waktu, jumlah scan/tablet |

Perusahaan dua slot resmi menghasilkan dua kehadiran jika keduanya datang. Bukan `COUNT(DISTINCT perusahaan)`. Satu slot dengan dua scan T02/T03 tetap dua bukti dan satu kehadiran efektif. Scan ID yang sama diimpor ulang diabaikan hanya bila isinya identik; isi berbeda ditolak dan seluruh impor dibatalkan. Snapshot sama memiliki satu arsip. JSON dengan urutan/format berbeda dapat menghasilkan arsip baru, tetapi tidak menggandakan scan yang ID-nya sama. ID scan berbeda untuk slot sama dipertahankan, termasuk scan ulang pada tablet sama.

RSVP-only tidak membuat kehadiran. Jawaban terbaru menang berdasarkan waktu UTC; jika waktunya sama, jawaban dengan urutan leksikografis ASCII terbesar menang, sesuai aplikasi. Jam tablet perlu disinkronkan. Tombol reset `belum` juga merupakan jawaban. Duplikasi kode RSVP atau scan ID di dalam satu payload ditolak.

Kehadiran efektif dibangun ulang dalam transaksi impor yang sama, dengan penguncian acara untuk menserialkan impor bersamaan. Jangan INSERT/UPDATE/DELETE scan atau kehadiran efektif secara manual. FK tidak otomatis membangun materialisasi ini. Bila query rekonsiliasi menunjukkan selisih akibat edit langsung, pulihkan dari backup atau panggil routine dengan payload event yang valid untuk menghitung ulang, lalu periksa lagi. Jangan memanggil routine di dalam transaksi milik Anda: routine mengelola START TRANSACTION/COMMIT sendiri. Batas input 20 MB, 100.000 scan dan 10.000 RSVP per payload; batas max_allowed_packet/upload phpMyAdmin mungkin lebih rendah. Impor beberapa batch valid, bukan potongan JSON sembarang.

## Format ekspor T05

Di aplikasi saat ini, **Ekspor backup JSON** mempertahankan scan ID, event, kode, token dan seluruh riwayat scan lokal/gabungan. **Laporan CSV bukan sumber impor SQL**, karena sudah merangkum dan tidak menyimpan tiap scan ID. Gabungkan JSON T01–T06 pada T05 terlebih dahulu. Konverter lokal berikut memvalidasi backup versi 1, memilih event, dan menghapus token QR serta identitas sebelum membuat SQL. Tidak ada koneksi jaringan/database pada konverter.

```sh
node tools/t05-to-sql.mjs /lokasi-aman/backup-T05.json /lokasi-aman/impor-rekap.sql KODE-ACARA
```

Node 22+ hanya diperlukan pada komputer panitia untuk konversi, bukan pada hosting PHP. Output baru dibuat dengan izin pemilik dan tidak menimpa berkas yang ada. Impor `impor-rekap.sql` melalui phpMyAdmin setelah routine dipasang. Literal UTF-8 heksadesimal menghindari penyambungan string SQL dari teks tamu. Backup JSON asli tetap disimpan aman di perangkat panitia untuk pemulihan tablet, bukan di hosting. Nama berkas jangan berisi identitas tamu.

Payload turunan yang disimpan dalam arsip:

```json
{
  "version": 1,
  "logs": [{"id":"id-scan-asli","event":"KODE-ACARA","code":"PT001","tablet":"T02","at":"2026-11-17T01:01:00.000Z"}],
  "rsvps": [{"event":"KODE-ACARA","code":"PT001","answer":"hadir","at":"2026-11-16T01:00:00.000Z"}]
}
```

`logs` dan `rsvps` wajib berupa array (boleh kosong). Semua baris harus milik event pemanggilan; event/slot harus ada di master. ID event/kode/scan 1–64 karakter `[A-Za-z0-9_-]`, stasiun T01–T06, jawaban `hadir`, `tidak`, `belum`. Timestamp wajib UTC ISO dengan tepat tiga digit milidetik; tanggal kalender tidak valid ditolak. Metadata token tidak diperlukan untuk pelaporan SQL; verifikasi QR telah dilakukan pada tablet, dan import ini bukan verifikasi kriptografis kehadiran. SHA-256 berfungsi sebagai identitas isi arsip, bukan tanda tangan/autentikasi tablet.

Aplikasi browser belum mempunyai flag resmi/tambahan. Karena itu **jangan menganggap kategori `mitra PT` sebagai status resmi**. Koordinator harus menyiapkan master SQL yang dipetakan ke kode event/slot aplikasi dan menetapkan `resmi=0` untuk tambahan sebelum impor rekap. Contoh insert (ganti nilai sintetis sesuai master yang disetujui):

```sql
INSERT INTO rsas_acara(kode,nama) VALUES ('ACARA-ANDA','Nama acara');
INSERT INTO rsas_undangan(acara,kode,nama,perusahaan,jabatan,kategori,resmi) VALUES
('ACARA-ANDA','PT001','Nama perwakilan 1','PT Contoh','Direktur','mitra PT',1),
('ACARA-ANDA','PT002','Nama perwakilan 2','PT Contoh','Manajer','mitra PT',1),
('ACARA-ANDA','EX001','Nama pendamping','PT Contoh','Pendamping','mitra PT',0);
```

## Hasil yang harus terlihat pada demo

| Ukuran | Hasil |
| --- | --- |
| Slot total / resmi / tambahan | 7 / 6 / 1 |
| Scan T01–T06 | 6 |
| Hadir fisik unik | 5 |
| Hadir resmi / tambahan | 4 / 1 |
| Perwakilan PT resmi hadir | 2 dari 2 slot; tambahan perusahaan yang sama dilaporkan terpisah |
| Duplikat lintas tablet | PT001, T02 dan T03, dua scan satu hadir |
| RSVP | 2 hadir, 1 tidak, 4 belum; bukan ukuran hadir fisik |
| Persentase kehadiran resmi | 4 / 6 × 100 = 66,67% |
| Rekonsiliasi efektif vs scan | 0 baris selisih |

UM001 menjawab tidak tetapi datang; UM002 menjawab hadir tetapi belum datang. Tamu tambahan EX001 tercatat fisik dan di laporan perusahaan, tetapi tidak masuk pembilang ataupun penyebut persentase resmi. Bila tidak ada slot resmi, persentase NULL (belum dapat dihitung).

## Validasi pengembang

Tes integrasi memakai container sementara milik pengembang, bukan database cPanel. Skrip tes membuat/menghapus **database rsas_integration di container**; jangan arahkan ke produksi. Tidak ada port database yang dipublikasikan. Contoh:

```sh
docker run --name rsas-sql-mysql -e MYSQL_ALLOW_EMPTY_PASSWORD=yes -d mysql:8.0
docker run --name rsas-sql-maria -e MARIADB_ALLOW_EMPTY_ROOT_PASSWORD=1 -d mariadb:10.11
# Tunggu startup selesai dan SELECT 1 berhasil, lalu:
python3 sql/tests/test_sql.py rsas-sql-mysql mysql
python3 sql/tests/test_sql.py rsas-sql-maria mariadb
```

Lulus pada MySQL 8.0.46 dan MariaDB 10.11.19: urutan empat berkas, impor ulang, dua slot PT, deduplikasi lintas tablet, angka 66,67%, RSVP terpisah, konflik ID, tanggal invalid, unknown slot/stasiun/event, rollback atomik, constraint FK/unik/CHECK, dan penyebut nol. Pengujian berlangsung pada mesin pengembangan; impor melalui phpMyAdmin/cPanel sebenarnya belum dijalankan.
