-- Select the EXISTING cPanel database first. No CREATE DATABASE / USE / GRANT.
-- MySQL >= 8.0.16 (enforced CHECK) or MariaDB >= 10.11.
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rsas_acara (
  kode VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  nama VARCHAR(200) NOT NULL,
  base_url VARCHAR(255) NOT NULL DEFAULT 'https://undanganregistrasirsas.puskesau.com',
  CONSTRAINT ck_acara_kode CHECK (kode REGEXP '^[A-Za-z0-9_-]{1,64}$'),
  CONSTRAINT ck_acara_url CHECK (base_url = 'https://undanganregistrasirsas.puskesau.com')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rsas_stasiun (
  kode CHAR(3) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  peran VARCHAR(100) NOT NULL,
  CONSTRAINT ck_stasiun CHECK (kode IN ('T01','T02','T03','T04','T05','T06'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rsas_undangan (
  acara VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  kode VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  nama VARCHAR(200) NOT NULL,
  perusahaan VARCHAR(200) NOT NULL DEFAULT '',
  jabatan VARCHAR(200) NOT NULL DEFAULT '',
  kategori VARCHAR(20) NOT NULL,
  resmi TINYINT NOT NULL DEFAULT 1 COMMENT '0 = tamu tambahan, tidak masuk pembilang/penyebut resmi',
  PRIMARY KEY (acara, kode),
  CONSTRAINT fk_undangan_acara FOREIGN KEY (acara) REFERENCES rsas_acara(kode),
  CONSTRAINT ck_undangan_kode CHECK (kode REGEXP '^[A-Za-z0-9_-]{1,64}$'),
  CONSTRAINT ck_nama CHECK (CHAR_LENGTH(TRIM(nama)) > 0),
  CONSTRAINT ck_kategori CHECK (kategori IN ('VIP','reguler','mitra PT')),
  CONSTRAINT ck_resmi CHECK (resmi IN (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rsas_arsip_impor_t05 (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  acara VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  sha256 CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  nama_berkas VARCHAR(255) NOT NULL,
  payload LONGTEXT NOT NULL COMMENT 'JSON turunan T05 tanpa token QR; bukan backup browser mentah',
  diterima_utc DATETIME(3) NOT NULL,
  UNIQUE KEY uq_arsip_hash (acara, sha256),
  UNIQUE KEY uq_arsip_event (acara, id),
  CONSTRAINT fk_arsip_acara FOREIGN KEY (acara) REFERENCES rsas_acara(kode),
  CONSTRAINT ck_arsip_json CHECK (JSON_VALID(payload)),
  CONSTRAINT ck_arsip_sha CHECK (sha256 REGEXP '^[a-f0-9]{64}$')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rsas_rsvp (
  acara VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  kode VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  jawaban VARCHAR(8) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  dijawab_utc DATETIME(3) NOT NULL,
  arsip_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (acara, kode),
  CONSTRAINT fk_rsvp_slot FOREIGN KEY (acara,kode) REFERENCES rsas_undangan(acara,kode),
  CONSTRAINT fk_rsvp_arsip FOREIGN KEY (acara,arsip_id) REFERENCES rsas_arsip_impor_t05(acara,id),
  CONSTRAINT ck_rsvp CHECK (jawaban IN ('hadir','tidak','belum'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rsas_catatan_scan (
  acara VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  scan_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  kode VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  stasiun CHAR(3) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  dipindai_utc DATETIME(3) NOT NULL,
  arsip_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (acara,scan_id),
  KEY ix_scan_slot_time (acara,kode,dipindai_utc),
  CONSTRAINT fk_scan_slot FOREIGN KEY (acara,kode) REFERENCES rsas_undangan(acara,kode),
  CONSTRAINT fk_scan_stasiun FOREIGN KEY (stasiun) REFERENCES rsas_stasiun(kode),
  CONSTRAINT fk_scan_arsip FOREIGN KEY (acara,arsip_id) REFERENCES rsas_arsip_impor_t05(acara,id),
  CONSTRAINT ck_scan_id CHECK (scan_id REGEXP '^[A-Za-z0-9_-]{1,64}$')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rsas_kehadiran_efektif (
  acara VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  kode VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  pertama_utc DATETIME(3) NOT NULL,
  terakhir_utc DATETIME(3) NOT NULL,
  jumlah_scan INT UNSIGNED NOT NULL,
  jumlah_tablet TINYINT UNSIGNED NOT NULL,
  PRIMARY KEY (acara,kode),
  CONSTRAINT fk_hadir_slot FOREIGN KEY (acara,kode) REFERENCES rsas_undangan(acara,kode),
  CONSTRAINT ck_hadir_waktu CHECK (terakhir_utc >= pertama_utc),
  CONSTRAINT ck_hadir_jumlah CHECK (jumlah_scan >= jumlah_tablet AND jumlah_tablet BETWEEN 1 AND 6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Operational stations are required even if demo data is not imported.
INSERT INTO rsas_stasiun(kode,peran) VALUES
('T01','VIP'),('T02','Reguler'),('T03','Reguler dan mitra PT'),
('T04','Bantuan'),('T05','Rekap'),('T06','Cadangan')
ON DUPLICATE KEY UPDATE kode=VALUES(kode);
