-- INSTALASI DAFTAR ACARA RSAS 19 NOVEMBER 2026. Pilih database cPanel yang sudah dibuat.
-- 80 slot sesuai rincian pengguna; status Persiapan, tanpa RSVP atau absensi awal.
-- SQL tidak memuat nilai token QR; token acak baru dibuat MySQL/MariaDB saat impor.
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
  status ENUM('persiapan','dibuka','selesai') NOT NULL DEFAULT 'persiapan',
  lokasi VARCHAR(200) NOT NULL DEFAULT '',
  dibuat_utc DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT ck_acara_nama_sederhana CHECK (CHAR_LENGTH(TRIM(nama))>0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


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

START TRANSACTION;
INSERT INTO scan_acara(kode,nama,tanggal,lokasi,status,dibuat_utc) VALUES
('RSAS-20261119','Forum Komunikasi Publik, Bakti Sosial, dan Penandatanganan Kerja Sama Pelayanan Kesehatan RSAU Prof. dr. Abdulrachman Saleh','2026-11-19','RSAU Prof. dr. Abdulrachman Saleh, Pancoran, Jakarta Selatan — Mulai 09.00 WIB','persiapan',UTC_TIMESTAMP(3))
ON DUPLICATE KEY UPDATE kode=VALUES(kode);
INSERT INTO scan_tamu(acara,kode,nama,perusahaan,jabatan,token) VALUES
('RSAS-20261119','RSAS001','Paban V/Watpers Spersau','Spersau','Paban V/Watpers Spersau',LOWER(HEX(RANDOM_BYTES(24)))),
('RSAS-20261119','RSAS002','Kapuskesau','Puskesau','Kapuskesau',LOWER(HEX(RANDOM_BYTES(24)))),
('RSAS-20261119','RSAS003','Dirbinum','Puskesau','Dirbinum',LOWER(HEX(RANDOM_BYTES(24)))),
('RSAS-20261119','RSAS004','Ka SPI','Puskesau','Ka SPI',LOWER(HEX(RANDOM_BYTES(24)))),
('RSAS-20261119','RSAS005','Dirbinyankes','Puskesau','Dirbinyankes',LOWER(HEX(RANDOM_BYTES(24)))),
('RSAS-20261119','RSAS006','Dirbinmatfaskes','Puskesau','Dirbinmatfaskes',LOWER(HEX(RANDOM_BYTES(24)))),
('RSAS-20261119','RSAS007','Dirbinprofkes','Puskesau','Dirbinprofkes',LOWER(HEX(RANDOM_BYTES(24)))),
('RSAS-20261119','RSAS008','Kasubdispenum','Dispenau','Kasubdispenum',LOWER(HEX(RANDOM_BYTES(24)))),
('RSAS-20261119','RSAS009','Kasubdispenpas','Dispenau','Kasubdispenpas',LOWER(HEX(RANDOM_BYTES(24)))),
('RSAS-20261119','RSAS010','Kasubdisbankum','Diskumau','Kasubdisbankum',LOWER(HEX(RANDOM_BYTES(24)))),
('RSAS-20261119','RSAS011','Kalakespra dr. Saryanto','LAKESPRA dr. Saryanto','Kalakespra dr. Saryanto',LOWER(HEX(RANDOM_BYTES(24)))),
('RSAS-20261119','RSAS012','Kadep Aeroklinik','LAKESPRA dr. Saryanto','Kadep Aeroklinik',LOWER(HEX(RANDOM_BYTES(24)))),
('RSAS-20261119','RSAS013','Kalakesgilut drg. R. Poerwanto','Lakesgilut drg. R. Poerwanto','Kalakesgilut drg. R. Poerwanto',LOWER(HEX(RANDOM_BYTES(24)))),
('RSAS-20261119','RSAS014','Ka RSGM','RSGM','Ka RSGM',LOWER(HEX(RANDOM_BYTES(24)))),
('RSAS-20261119','RSAS015','Ka RSAU dr. Esnawan Antariksa','RSAU dr. Esnawan Antariksa','Ka RSAU dr. Esnawan Antariksa',LOWER(HEX(RANDOM_BYTES(24)))),
('RSAS-20261119','RSAS016','Ka RSAU dr. Hasan Toto','RSAU dr. Hasan Toto','Ka RSAU dr. Hasan Toto',LOWER(HEX(RANDOM_BYTES(24)))),
('RSAS-20261119','RSAS017','Dirkes Ditjenkuathan Kemhan','Ditjenkuathan Kemhan','Dirkes Ditjenkuathan Kemhan',LOWER(HEX(RANDOM_BYTES(24)))),
('RSAS-20261119','RSAS018','Kasubditmatfaskes Ditkes Ditjenkuathan Kemhan','Ditjenkuathan Kemhan','Kasubditmatfaskes Ditkes Ditjenkuathan Kemhan',LOWER(HEX(RANDOM_BYTES(24)))),
('RSAS-20261119','RSAS019','Kasubditnakes Ditkes Ditjenkuathan Kemhan','Ditjenkuathan Kemhan','Kasubditnakes Ditkes Ditjenkuathan Kemhan',LOWER(HEX(RANDOM_BYTES(24)))),
('RSAS-20261119','RSAS020','Kapuskes TNI','Puskes TNI','Kapuskes TNI',LOWER(HEX(RANDOM_BYTES(24)))),
('RSAS-20261119','RSAS021','Kabidyankesin Puskes TNI','Puskes TNI','Kabidyankesin Puskes TNI',LOWER(HEX(RANDOM_BYTES(24)))),
('RSAS-20261119','RSAS022','Ka RS TNI Patria Puskes TNI','RS TNI Patria Puskes TNI','Ka RS TNI Patria Puskes TNI',LOWER(HEX(RANDOM_BYTES(24)))),
('RSAS-20261119','RSAS023','Kapusintelmed','Bais (BIN)','Kapusintelmed',LOWER(HEX(RANDOM_BYTES(24)))),
('RSAS-20261119','RSAS024','Kapuskesad','Puskesad','Kapuskesad',LOWER(HEX(RANDOM_BYTES(24)))),
('RSAS-20261119','RSAS025','Ka RSPAD','RSPAD','Ka RSPAD',LOWER(HEX(RANDOM_BYTES(24)))),
('RSAS-20261119','RSAS026','Karumkit Pusdikkes Puskesad','Pusdikkes Puskesad','Karumkit Pusdikkes Puskesad',LOWER(HEX(RANDOM_BYTES(24)))),
('RSAS-20261119','RSAS027','Karumkit dr. Ridwan Maureksa Puskesad','Rumkit dr. Ridwan Maureksa Puskesad','Karumkit dr. Ridwan Maureksa Puskesad',LOWER(HEX(RANDOM_BYTES(24)))),
('RSAS-20261119','RSAS028','Kapuskesal','Puskesal','Kapuskesal',LOWER(HEX(RANDOM_BYTES(24)))),
('RSAS-20261119','RSAS029','Karumkit Mar Cilandak','Rumkit Mar Cilandak','Karumkit Mar Cilandak',LOWER(HEX(RANDOM_BYTES(24)))),
('RSAS-20261119','RSAS030','Ka RSAL dr. Mintohardjo Puskesal','RSAL dr. Mintohardjo Puskesal','Ka RSAL dr. Mintohardjo Puskesal',LOWER(HEX(RANDOM_BYTES(24)))),
('RSAS-20261119','RSAS031','Ka RS POLRI dr. Sukanto','RS POLRI dr. Sukanto','Ka RS POLRI dr. Sukanto',LOWER(HEX(RANDOM_BYTES(24)))),
('RSAS-20261119','RSAS032','Dirut RSPI Sulianti Suroso','RSPI Sulianti Suroso','Dirut RSPI Sulianti Suroso',LOWER(HEX(RANDOM_BYTES(24)))),
('RSAS-20261119','RSAS033','Asisten Kesejahteraan Rakyat Provinsi DKI Jakarta','Pemerintah Provinsi DKI Jakarta','Asisten Kesejahteraan Rakyat Provinsi DKI Jakarta',LOWER(HEX(RANDOM_BYTES(24)))),
('RSAS-20261119','RSAS034','Kadinkes Provinsi DKI Jakarta','Pemerintah Provinsi DKI Jakarta','Kadinkes Provinsi DKI Jakarta',LOWER(HEX(RANDOM_BYTES(24)))),
('RSAS-20261119','RSAS035','Wakil Ketua DPRD DKI Jakarta','Pemerintah Provinsi DKI Jakarta','Wakil Ketua DPRD DKI Jakarta',LOWER(HEX(RANDOM_BYTES(24)))),
('RSAS-20261119','RSAS036','Ketua Komisi E Bidang Kesejahteraan Rakyat','Pemerintah Provinsi DKI Jakarta','Ketua Komisi E Bidang Kesejahteraan Rakyat',LOWER(HEX(RANDOM_BYTES(24)))),
('RSAS-20261119','RSAS037','Sekretaris Kota Jakarta Selatan','Pemerintah Kota Jakarta Selatan','Sekretaris Kota Jakarta Selatan',LOWER(HEX(RANDOM_BYTES(24)))),
('RSAS-20261119','RSAS038','Asisten Administrasi dan Kesejahteraan Rakyat Kota Jakarta Selatan','Pemerintah Kota Jakarta Selatan','Asisten Administrasi dan Kesejahteraan Rakyat Kota Jakarta Selatan',LOWER(HEX(RANDOM_BYTES(24)))),
('RSAS-20261119','RSAS039','Kasubdinkes Kota Jakarta Selatan','Pemerintah Kota Jakarta Selatan','Kasubdinkes Kota Jakarta Selatan',LOWER(HEX(RANDOM_BYTES(24)))),
('RSAS-20261119','RSAS040','Camat Kecamatan Pancoran','Pemerintah Kota Jakarta Selatan','Camat Kecamatan Pancoran',LOWER(HEX(RANDOM_BYTES(24)))),
('RSAS-20261119','RSAS041','Lurah Kelurahan Pancoran','Pemerintah Kota Jakarta Selatan','Lurah Kelurahan Pancoran',LOWER(HEX(RANDOM_BYTES(24)))),
('RSAS-20261119','RSAS042','Ka RSUD Tebet','RSUD Tebet','Ka RSUD Tebet',LOWER(HEX(RANDOM_BYTES(24)))),
('RSAS-20261119','RSAS043','Ka RSUD Mampang Prapatan','RSUD Mampang Prapatan','Ka RSUD Mampang Prapatan',LOWER(HEX(RANDOM_BYTES(24)))),
('RSAS-20261119','RSAS044','Dirut RS Triadipa','RS Triadipa','Dirut RS Triadipa',LOWER(HEX(RANDOM_BYTES(24)))),
('RSAS-20261119','RSAS045','Dirut RS Medistra','RS Medistra','Dirut RS Medistra',LOWER(HEX(RANDOM_BYTES(24)))),
('RSAS-20261119','RSAS046','Ka PKM Kelurahan Pancoran 2','PKM Kelurahan Pancoran 2','Ka PKM Kelurahan Pancoran 2',LOWER(HEX(RANDOM_BYTES(24)))),
('RSAS-20261119','RSAS047','Ka PKM Kelurahan Kalibata 2','PKM Kelurahan Kalibata 2','Ka PKM Kelurahan Kalibata 2',LOWER(HEX(RANDOM_BYTES(24)))),
('RSAS-20261119','RSAS048','Kacab BPJS Kesehatan Jakarta Selatan','BPJS Kesehatan Jakarta Selatan','Kacab BPJS Kesehatan Jakarta Selatan',LOWER(HEX(RANDOM_BYTES(24)))),
('RSAS-20261119','RSAS049','Kacab BPJS Ketenagakerjaan Jakarta Selatan','BPJS Ketenagakerjaan Jakarta Selatan','Kacab BPJS Ketenagakerjaan Jakarta Selatan',LOWER(HEX(RANDOM_BYTES(24)))),
('RSAS-20261119','RSAS050','Kacab BNI Kemendes','BNI Kemendes','Kacab BNI Kemendes',LOWER(HEX(RANDOM_BYTES(24)))),
('RSAS-20261119','RSAS051','Kacab BRI Cilangkap','BRI Cilangkap','Kacab BRI Cilangkap',LOWER(HEX(RANDOM_BYTES(24)))),
('RSAS-20261119','RSAS052','Pimcab BJB Hasyim Ashari','BJB Hasyim Ashari','Pimcab BJB Hasyim Ashari',LOWER(HEX(RANDOM_BYTES(24)))),
('RSAS-20261119','RSAS053','CEO Regional 2 BJB','BJB Regional 2','CEO Regional 2 BJB',LOWER(HEX(RANDOM_BYTES(24)))),
('RSAS-20261119','RSAS054','Perwakilan PT Administrasi Medika (Ad Medika)','PT Administrasi Medika (Ad Medika)','Perwakilan perusahaan/organisasi',LOWER(HEX(RANDOM_BYTES(24)))),
('RSAS-20261119','RSAS055','Perwakilan PT Zurich Asuransi Indonesia','PT Zurich Asuransi Indonesia','Perwakilan perusahaan/organisasi',LOWER(HEX(RANDOM_BYTES(24)))),
('RSAS-20261119','RSAS056','Perwakilan PT MSIG Life Insurance Indonesia Tbk','PT MSIG Life Insurance Indonesia Tbk','Perwakilan perusahaan/organisasi',LOWER(HEX(RANDOM_BYTES(24)))),
('RSAS-20261119','RSAS057','Perwakilan PT Teknologi Pamadya Analitika (Meditap)','PT Teknologi Pamadya Analitika (Meditap)','Perwakilan perusahaan/organisasi',LOWER(HEX(RANDOM_BYTES(24)))),
('RSAS-20261119','RSAS058','Perwakilan PT International Services Pasific Cross','PT International Services Pasific Cross','Perwakilan perusahaan/organisasi',LOWER(HEX(RANDOM_BYTES(24)))),
('RSAS-20261119','RSAS059','Perwakilan PT Medilink Digital Medika (Medilink)','PT Medilink Digital Medika (Medilink)','Perwakilan perusahaan/organisasi',LOWER(HEX(RANDOM_BYTES(24)))),
('RSAS-20261119','RSAS060','Perwakilan PT Asabri','PT Asabri','Perwakilan perusahaan/organisasi',LOWER(HEX(RANDOM_BYTES(24)))),
('RSAS-20261119','RSAS061','Perwakilan PT Asuransi Umum Mega','PT Asuransi Umum Mega','Perwakilan perusahaan/organisasi',LOWER(HEX(RANDOM_BYTES(24)))),
('RSAS-20261119','RSAS062','Perwakilan PT Prudential','PT Prudential','Perwakilan perusahaan/organisasi',LOWER(HEX(RANDOM_BYTES(24)))),
('RSAS-20261119','RSAS063','Perwakilan PT Jasindo','PT Jasindo','Perwakilan perusahaan/organisasi',LOWER(HEX(RANDOM_BYTES(24)))),
('RSAS-20261119','RSAS064','Perwakilan Yayasan Kesejahteraan Pegawai PT Bank Pembangunan Daerah Jawa Barat dan Banten (YKP Bank BJB)','Yayasan Kesejahteraan Pegawai PT Bank Pembangunan Daerah Jawa Barat dan Banten (YKP Bank BJB)','Perwakilan perusahaan/organisasi',LOWER(HEX(RANDOM_BYTES(24)))),
('RSAS-20261119','RSAS065','Perwakilan BRI Life Healthcare Operation','BRI Life Healthcare Operation','Perwakilan perusahaan/organisasi',LOWER(HEX(RANDOM_BYTES(24)))),
('RSAS-20261119','RSAS066','Perwakilan BNI Life Healthcare','BNI Life Healthcare','Perwakilan perusahaan/organisasi',LOWER(HEX(RANDOM_BYTES(24)))),
('RSAS-20261119','RSAS067','Perwakilan PT Korea Indonesia (Korindo) Abadi','PT Korea Indonesia (Korindo) Abadi','Perwakilan perusahaan/organisasi',LOWER(HEX(RANDOM_BYTES(24)))),
('RSAS-20261119','RSAS068','Perwakilan PT Persada Sport Facility','PT Persada Sport Facility','Perwakilan perusahaan/organisasi',LOWER(HEX(RANDOM_BYTES(24)))),
('RSAS-20261119','RSAS069','Perwakilan GM Golf Halim 1','GM Golf Halim 1','Perwakilan perusahaan/organisasi',LOWER(HEX(RANDOM_BYTES(24)))),
('RSAS-20261119','RSAS070','Perwakilan Ketua Umum Inkopau','Ketua Umum Inkopau','Perwakilan perusahaan/organisasi',LOWER(HEX(RANDOM_BYTES(24)))),
('RSAS-20261119','RSAS071','Perwakilan PT Kreasi Hasta Mitra Perkasa','PT Kreasi Hasta Mitra Perkasa','Perwakilan perusahaan/organisasi',LOWER(HEX(RANDOM_BYTES(24)))),
('RSAS-20261119','RSAS072','Perwakilan Persatuan Purnawirawan TNI AU (PPAU)','Persatuan Purnawirawan TNI AU (PPAU)','Perwakilan Persatuan Purnawirawan TNI AU (PPAU)',LOWER(HEX(RANDOM_BYTES(24)))),
('RSAS-20261119','RSAS073','Ketua PD IBI Jakarta','PD IBI Jakarta','Ketua PD IBI Jakarta',LOWER(HEX(RANDOM_BYTES(24)))),
('RSAS-20261119','RSAS074','Ketua IBI Korwil Jakarta Selatan','IBI Korwil Jakarta Selatan','Ketua IBI Korwil Jakarta Selatan',LOWER(HEX(RANDOM_BYTES(24)))),
('RSAS-20261119','RSAS075','Komandan Komplek Triloka','Komplek Triloka','Komandan Komplek Triloka',LOWER(HEX(RANDOM_BYTES(24)))),
('RSAS-20261119','RSAS076','Bapak Ir. Triawan Saleh','Keluarga Prof. dr. Abdulrachman Saleh','Perwakilan keluarga',LOWER(HEX(RANDOM_BYTES(24)))),
('RSAS-20261119','RSAS077','Anggota keluarga tambahan 1 (nama belum tersedia)','Keluarga Prof. dr. Abdulrachman Saleh','Anggota keluarga tambahan',LOWER(HEX(RANDOM_BYTES(24)))),
('RSAS-20261119','RSAS078','Anggota keluarga tambahan 2 (nama belum tersedia)','Keluarga Prof. dr. Abdulrachman Saleh','Anggota keluarga tambahan',LOWER(HEX(RANDOM_BYTES(24)))),
('RSAS-20261119','RSAS079','Anggota keluarga tambahan 3 (nama belum tersedia)','Keluarga Prof. dr. Abdulrachman Saleh','Anggota keluarga tambahan',LOWER(HEX(RANDOM_BYTES(24)))),
('RSAS-20261119','RSAS080','Anggota keluarga tambahan 4 (nama belum tersedia)','Keluarga Prof. dr. Abdulrachman Saleh','Anggota keluarga tambahan',LOWER(HEX(RANDOM_BYTES(24))))
ON DUPLICATE KEY UPDATE kode=VALUES(kode);
COMMIT;
-- Impor ulang tidak mengganti identitas, status acara, token, ataupun log yang sudah ada.
SELECT kode,nama,tanggal,lokasi,status FROM scan_acara WHERE kode='RSAS-20261119';
SELECT COUNT(*) AS undangan FROM scan_tamu WHERE acara='RSAS-20261119';
SELECT COUNT(DISTINCT kode) AS hadir FROM scan_catatan WHERE acara='RSAS-20261119';
