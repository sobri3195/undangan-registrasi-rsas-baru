-- Jalankan sesudah 05_scan_sederhana.sql, pada database cPanel yang sama.
-- Aman diulang. Daftar undangan dan kehadiran lama tetap dipertahankan.
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
SET time_zone='+00:00';
CREATE TABLE IF NOT EXISTS scan_acara (
  kode VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  nama VARCHAR(200) NOT NULL,
  tanggal DATE NULL,
  status ENUM('persiapan','dibuka','selesai') NOT NULL DEFAULT 'persiapan',
  lokasi VARCHAR(200) NOT NULL DEFAULT '',
  dibuat_utc DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT ck_acara_nama_sederhana CHECK (CHAR_LENGTH(TRIM(nama))>0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- Pulihkan seluruh kode acara dari daftar versi sebelumnya tanpa menimpa metadata.
INSERT INTO scan_acara(kode,nama)
SELECT DISTINCT t.acara,t.acara FROM scan_tamu t
WHERE NOT EXISTS(SELECT 1 FROM scan_acara a WHERE a.kode=t.acara);
-- Instalasi baru mendapat satu acara awal. Acara berikutnya dibuat dari Admin.
INSERT INTO scan_acara(kode,nama)
SELECT 'RSAS-2026','Registrasi Undangan RSAS'
WHERE NOT EXISTS(SELECT 1 FROM scan_acara);
