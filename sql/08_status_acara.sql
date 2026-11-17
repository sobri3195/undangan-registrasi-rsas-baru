-- Upgrade instalasi yang sudah memiliki scan_acara. Pilih database cPanel yang sama.
-- Acara lama tetap dibuka, acara baru default persiapan. Aman dijalankan ulang.
SET @rsas_status_sql = IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='scan_acara' AND COLUMN_NAME='status'),
  'DO 0',
  'ALTER TABLE scan_acara ADD COLUMN status ENUM(''persiapan'',''dibuka'',''selesai'') NOT NULL DEFAULT ''dibuka'''
);
PREPARE rsas_status_stmt FROM @rsas_status_sql;
EXECUTE rsas_status_stmt;
DEALLOCATE PREPARE rsas_status_stmt;
ALTER TABLE scan_acara ALTER COLUMN status SET DEFAULT 'persiapan';
