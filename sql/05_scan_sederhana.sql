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
