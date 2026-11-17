-- Upgrade P1: pilih database aplikasi di phpMyAdmin. Tidak mengubah data undangan/scan.
-- Jalankan sebelum mengunggah kode akses PIN; aman diulang.
SET NAMES utf8mb4;
CREATE TABLE IF NOT EXISTS scan_access_limits (
  bucket CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  failures SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  reset_at BIGINT UNSIGNED NOT NULL,
  KEY ix_access_reset (reset_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
