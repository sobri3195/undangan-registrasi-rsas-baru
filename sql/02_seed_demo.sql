SET NAMES utf8mb4;
START TRANSACTION;
-- Idempotent, does not overwrite existing rows. All identities below are synthetic.
INSERT INTO rsas_acara(kode,nama) VALUES ('DEMO-SQL-RSAS','Acara Demonstrasi Sintetis RSAU')
ON DUPLICATE KEY UPDATE kode=VALUES(kode);
INSERT INTO rsas_stasiun(kode,peran) VALUES
('T01','VIP'),('T02','Reguler'),('T03','Reguler dan mitra PT'),
('T04','Bantuan'),('T05','Rekap'),('T06','Cadangan')
ON DUPLICATE KEY UPDATE kode=VALUES(kode);
INSERT INTO rsas_undangan(acara,kode,nama,perusahaan,jabatan,kategori,resmi) VALUES
('DEMO-SQL-RSAS','VIP001','Dr. Raka Sintetis','Instansi Demo','Pimpinan','VIP',1),
('DEMO-SQL-RSAS','UM001','Bima Contoh','','Tamu umum','reguler',1),
('DEMO-SQL-RSAS','UM002','Nadia Contoh','','Tamu umum','reguler',1),
('DEMO-SQL-RSAS','UM003','Eka Contoh','','Tamu umum','reguler',1),
('DEMO-SQL-RSAS','PT001','Dian Sintetis','PT Mitra Sintetis','Direktur','mitra PT',1),
('DEMO-SQL-RSAS','PT002','Sari Sintetis','PT Mitra Sintetis','Manajer','mitra PT',1),
('DEMO-SQL-RSAS','EX001','Tamu Tambahan Contoh','PT Mitra Sintetis','Pendamping tambahan','mitra PT',0)
ON DUPLICATE KEY UPDATE kode=VALUES(kode);
COMMIT;
