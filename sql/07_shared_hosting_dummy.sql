-- SATU BERKAS UNTUK phpMyAdmin. Pilih database yang sudah dibuat di cPanel.
-- Untuk instalasi/latihan dengan dummy data. Tidak ada CREATE DATABASE / USE / DROP.
-- Pilih database yang SUDAH dibuat di cPanel. Hanya schema ini diperlukan aplikasi dua tampilan.
SET NAMES utf8mb4;
CREATE TABLE IF NOT EXISTS scan_tamu (
  acara VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  kode VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  nama VARCHAR(200) NOT NULL,
  perusahaan VARCHAR(200) NOT NULL DEFAULT '',
  jabatan VARCHAR(200) NOT NULL DEFAULT '',
  token VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  PRIMARY KEY(acara,kode)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS scan_catatan (
  acara VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  kode VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  tablet CHAR(3) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  dicatat_utc DATETIME(3) NOT NULL,
  PRIMARY KEY(acara,kode,tablet),
  CONSTRAINT fk_scan_sederhana FOREIGN KEY(acara,kode) REFERENCES scan_tamu(acara,kode),
  CONSTRAINT ck_tablet_sederhana CHECK(tablet IN ('T01','T02','T03','T04','T05','T06'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Jalankan sesudah 05_scan_sederhana.sql, pada database cPanel yang sama.
-- Aman diulang. Daftar undangan dan kehadiran lama tetap dipertahankan.
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
SET time_zone='+00:00';
CREATE TABLE IF NOT EXISTS scan_acara (
  kode VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  nama VARCHAR(200) NOT NULL,
  tanggal DATE NULL,
  lokasi VARCHAR(200) NOT NULL DEFAULT '',
  dibuat_utc DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT ck_acara_nama_sederhana CHECK (CHAR_LENGTH(TRIM(nama))>0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seluruh identitas/token berikut SINTETIS, hanya untuk latihan.
-- Demo memakai kode acara khusus, tidak menimpa identitas yang sudah ada.
START TRANSACTION;
INSERT INTO scan_acara(kode,nama,tanggal,lokasi,dibuat_utc) VALUES
('DEMO-RSAS-2026','DEMO - Registrasi Undangan RSAU','2026-12-10','Aula RSAU (contoh)','2026-11-17 00:00:00.000'),
('DEMO-MITRA-2027','DEMO - Temu Mitra RSAU','2027-02-20','Ruang Pertemuan (contoh)','2026-11-17 00:00:00.000')
ON DUPLICATE KEY UPDATE kode=VALUES(kode);
INSERT INTO scan_tamu(acara,kode,nama,perusahaan,jabatan,token) VALUES
('DEMO-RSAS-2026','VIP001','Dr. Arga Sintetis','Instansi Demo','Pimpinan','ea41da7f3b1bd57d8b4402a5f70ff5f45d05866cb09de33b8c224dbf61d28e66'),
('DEMO-RSAS-2026','VIP002','Dr. Naya Sintetis','Instansi Demo','Dokter','e4fc57f7e4495fb355656708b8c36b59cbf526ed22dd9e018f91e7dc252744b7'),
('DEMO-RSAS-2026','UM001','Bima Contoh','','Tamu umum','33c0ac73779a9874a584ac9bdb0d4005302e9b014d6b009c2c0269f3db0cb439'),
('DEMO-RSAS-2026','UM002','Laras Contoh','','Tamu umum','a2aad2252ac44060b39ceb8c6582898bd389a7ab6bf6e97a696d4399bcabd873'),
('DEMO-RSAS-2026','UM003','Reno Contoh','','Tamu umum','8d88a167c412a706b0760a6966db2ddc08f93b3cfa1b0427ea0429b653cd7adc'),
('DEMO-RSAS-2026','UM004','Mira Contoh','','Tamu umum','3e2bd6ab237806a144e0217ef7f20867363f8b7f5068894576c436a8ba0aeae1'),
('DEMO-RSAS-2026','PT001','Dian Sintetis','PT Mitra Sintetis','Direktur','43ad6cbd4ea55fe1e941c16019b7ca37fc70d069ca67b0d31cccb42e3faecdba'),
('DEMO-RSAS-2026','PT002','Sari Sintetis','PT Mitra Sintetis','Manajer','a3921258d6f64497c32385ebc6b9ed3635f529fbb18ac2c12ed68e1a3fa3bebd'),
('DEMO-MITRA-2027','UM001','Tara Contoh','Instansi Kedua','Staf','9aa14c3917e0b3ed15e2d67f7aba5ae3c3bd12a411ed8cd57a1193cabd99d273'),
('DEMO-MITRA-2027','PT001','Galih Contoh','PT Kedua Sintetis','Direktur','db1a27a2b570669f8ce3b652930cf7581c0ba78b9987836026c75ba91c091bb8'),
('DEMO-MITRA-2027','PT002','Alya Contoh','PT Kedua Sintetis','Manajer','e9e99d90304761233f41aa2c85d4a7565665b134ed5f06304590d2bf89ff1329')
ON DUPLICATE KEY UPDATE kode=VALUES(kode);
INSERT INTO scan_catatan(acara,kode,tablet,dicatat_utc) VALUES
('DEMO-RSAS-2026','VIP001','T01','2026-12-10 00:00:00.000'),
('DEMO-RSAS-2026','PT001','T02','2026-12-10 00:01:00.000'),
('DEMO-RSAS-2026','PT001','T03','2026-12-10 00:02:00.000'),
('DEMO-RSAS-2026','PT002','T04','2026-12-10 00:03:00.000'),
('DEMO-RSAS-2026','UM001','T05','2026-12-10 00:04:00.000'),
('DEMO-RSAS-2026','UM002','T06','2026-12-10 00:05:00.000'),
('DEMO-MITRA-2027','PT001','T01','2027-02-20 00:00:00.000')
ON DUPLICATE KEY UPDATE tablet=VALUES(tablet);
COMMIT;

-- Hasil awal: acara pertama 8 undangan / 5 hadir / 6 catatan;
-- acara kedua 3 undangan / 1 hadir / 1 catatan. Kode sama pada acara berbeda terpisah.
SELECT a.kode,a.nama,
 (SELECT COUNT(*) FROM scan_tamu t WHERE t.acara=a.kode) AS undangan,
 (SELECT COUNT(DISTINCT c.kode) FROM scan_catatan c WHERE c.acara=a.kode) AS hadir_unik,
 (SELECT COUNT(*) FROM scan_catatan c WHERE c.acara=a.kode) AS catatan_tablet
FROM scan_acara a WHERE a.kode IN ('DEMO-RSAS-2026','DEMO-MITRA-2027') ORDER BY a.kode;
