SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
-- Stored routines retain the sql_mode at creation, including on permissive hosting.
SET SESSION sql_mode = CONCAT_WS(',', @@SESSION.sql_mode, 'STRICT_ALL_TABLES', 'NO_ZERO_DATE', 'NO_ZERO_IN_DATE');
-- Routine is also the reusable import entry point. Never CALL inside another transaction.
-- Failures roll back archive, scans, RSVP and effective attendance together.
DROP PROCEDURE IF EXISTS rsas_impor_t05;
DELIMITER $$
CREATE PROCEDURE rsas_impor_t05(IN p_acara VARCHAR(64), IN p_nama VARCHAR(255), IN p_json LONGTEXT)
SQL SECURITY INVOKER
BEGIN
  DECLARE v_arsip BIGINT UNSIGNED;
  DECLARE v_lock VARCHAR(64);
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    DROP TEMPORARY TABLE IF EXISTS rsas_tmp_scan;
    DROP TEMPORARY TABLE IF EXISTS rsas_tmp_rsvp;
    RESIGNAL;
  END;
  IF p_json IS NULL OR OCTET_LENGTH(p_json)>20971520 OR NOT JSON_VALID(p_json) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='JSON invalid or larger than 20 MB';
  END IF;
  IF COALESCE(JSON_TYPE(JSON_EXTRACT(p_json,'$.version')),'') <> 'INTEGER'
    OR JSON_UNQUOTE(JSON_EXTRACT(p_json,'$.version')) <> '1'
    OR COALESCE(JSON_TYPE(JSON_EXTRACT(p_json,'$.logs')),'') <> 'ARRAY'
    OR COALESCE(JSON_TYPE(JSON_EXTRACT(p_json,'$.rsvps')),'') <> 'ARRAY' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Expected version 1, logs[] and rsvps[]';
  END IF;
  IF JSON_LENGTH(p_json,'$.logs')>100000 OR JSON_LENGTH(p_json,'$.rsvps')>10000 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Too many scan or RSVP records';
  END IF;
  DROP TEMPORARY TABLE IF EXISTS rsas_tmp_scan;
  DROP TEMPORARY TABLE IF EXISTS rsas_tmp_rsvp;
  CREATE TEMPORARY TABLE rsas_tmp_scan (
    scan_id VARCHAR(512), acara VARCHAR(512), kode VARCHAR(512), stasiun VARCHAR(512), waktu VARCHAR(512)
  ) ENGINE=InnoDB;
  CREATE TEMPORARY TABLE rsas_tmp_rsvp (
    acara VARCHAR(512), kode VARCHAR(512), jawaban VARCHAR(512), waktu VARCHAR(512)
  ) ENGINE=InnoDB;
  INSERT INTO rsas_tmp_scan
  SELECT j.id,j.event,j.code,j.tablet,j.at FROM JSON_TABLE(p_json,'$.logs[*]' COLUMNS(
    id VARCHAR(512) PATH '$.id' ERROR ON ERROR,
    event VARCHAR(512) PATH '$.event' ERROR ON ERROR,
    code VARCHAR(512) PATH '$.code' ERROR ON ERROR,
    tablet VARCHAR(512) PATH '$.tablet' ERROR ON ERROR,
    at VARCHAR(512) PATH '$.at' ERROR ON ERROR
  )) j;
  INSERT INTO rsas_tmp_rsvp
  SELECT j.event,j.code,j.answer,j.at FROM JSON_TABLE(p_json,'$.rsvps[*]' COLUMNS(
    event VARCHAR(512) PATH '$.event' ERROR ON ERROR,
    code VARCHAR(512) PATH '$.code' ERROR ON ERROR,
    answer VARCHAR(512) PATH '$.answer' ERROR ON ERROR,
    at VARCHAR(512) PATH '$.at' ERROR ON ERROR
  )) j;
  IF EXISTS(SELECT 1 FROM rsas_tmp_scan WHERE scan_id IS NULL OR kode IS NULL OR acara IS NULL OR stasiun IS NULL OR waktu IS NULL
      OR BINARY acara <> BINARY p_acara OR scan_id NOT REGEXP '^[A-Za-z0-9_-]{1,64}$'
      OR kode NOT REGEXP '^[A-Za-z0-9_-]{1,64}$' OR stasiun NOT IN ('T01','T02','T03','T04','T05','T06')
      OR waktu NOT REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}[.][0-9]{3}Z$')
    OR EXISTS(SELECT 1 FROM rsas_tmp_rsvp WHERE kode IS NULL OR acara IS NULL OR jawaban IS NULL OR waktu IS NULL
      OR BINARY acara <> BINARY p_acara OR kode NOT REGEXP '^[A-Za-z0-9_-]{1,64}$' OR BINARY jawaban NOT IN ('hadir','tidak','belum')
      OR waktu NOT REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}[.][0-9]{3}Z$') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Invalid ID, event, station, answer or UTC timestamp';
  END IF;
  IF EXISTS(SELECT 1 FROM rsas_tmp_scan GROUP BY BINARY scan_id HAVING COUNT(*)>1)
    OR EXISTS(SELECT 1 FROM rsas_tmp_rsvp GROUP BY BINARY kode HAVING COUNT(*)>1) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Duplicate IDs inside input';
  END IF;
  -- Validate full UTC timestamp shape and actual calendar day before DATETIME conversion.
  IF EXISTS(SELECT 1 FROM (
      SELECT waktu FROM rsas_tmp_scan UNION ALL SELECT waktu FROM rsas_tmp_rsvp
    ) t WHERE waktu NOT REGEXP '^[1-9][0-9]{3}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9][.][0-9]{3}Z$'
      OR CAST(SUBSTRING(waktu,9,2) AS UNSIGNED) > DAY(LAST_DAY(CONCAT(SUBSTRING(waktu,1,7),'-01')))) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Invalid UTC timestamp or calendar date';
  END IF;
  START TRANSACTION;
  -- Serializes imports for this event. FK also prevents importing an unknown event.
  SET v_lock=NULL;
  SELECT kode INTO v_lock FROM rsas_acara WHERE kode=p_acara FOR UPDATE;
  IF v_lock IS NULL THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Unknown event'; END IF;
  IF EXISTS(SELECT 1 FROM rsas_tmp_scan t JOIN rsas_catatan_scan s ON s.acara=p_acara AND s.scan_id=BINARY t.scan_id
    WHERE s.kode<>BINARY t.kode OR s.stasiun<>BINARY t.stasiun
    OR s.dipindai_utc<>STR_TO_DATE(t.waktu,'%Y-%m-%dT%H:%i:%s.%fZ')) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Existing scan ID has conflicting contents';
  END IF;
  INSERT INTO rsas_arsip_impor_t05(acara,sha256,nama_berkas,payload,diterima_utc)
    VALUES(p_acara,SHA2(p_json,256),p_nama,p_json,UTC_TIMESTAMP(3))
    ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id);
  SET v_arsip=LAST_INSERT_ID();
  INSERT INTO rsas_catatan_scan(acara,scan_id,kode,stasiun,dipindai_utc,arsip_id)
    SELECT p_acara,scan_id,kode,stasiun,STR_TO_DATE(waktu,'%Y-%m-%dT%H:%i:%s.%fZ'),v_arsip FROM rsas_tmp_scan
    ON DUPLICATE KEY UPDATE scan_id=VALUES(scan_id);
  -- Tie-break matches browser: latest time, then lexicographically greatest answer.
  INSERT INTO rsas_rsvp(acara,kode,jawaban,dijawab_utc,arsip_id)
    SELECT p_acara,kode,jawaban,STR_TO_DATE(waktu,'%Y-%m-%dT%H:%i:%s.%fZ'),v_arsip FROM rsas_tmp_rsvp
    ON DUPLICATE KEY UPDATE
      arsip_id=IF(VALUES(dijawab_utc)>rsas_rsvp.dijawab_utc OR (VALUES(dijawab_utc)=rsas_rsvp.dijawab_utc AND VALUES(jawaban)>rsas_rsvp.jawaban),VALUES(arsip_id),rsas_rsvp.arsip_id),
      jawaban=IF(VALUES(dijawab_utc)>rsas_rsvp.dijawab_utc OR (VALUES(dijawab_utc)=rsas_rsvp.dijawab_utc AND VALUES(jawaban)>rsas_rsvp.jawaban),VALUES(jawaban),rsas_rsvp.jawaban),
      dijawab_utc=GREATEST(rsas_rsvp.dijawab_utc,VALUES(dijawab_utc));
  DELETE FROM rsas_kehadiran_efektif WHERE acara=p_acara;
  INSERT INTO rsas_kehadiran_efektif(acara,kode,pertama_utc,terakhir_utc,jumlah_scan,jumlah_tablet)
    SELECT acara,kode,MIN(dipindai_utc),MAX(dipindai_utc),COUNT(*),COUNT(DISTINCT stasiun)
    FROM rsas_catatan_scan WHERE acara=p_acara GROUP BY acara,kode;
  COMMIT;
  DROP TEMPORARY TABLE rsas_tmp_scan;
  DROP TEMPORARY TABLE rsas_tmp_rsvp;
END$$
DELIMITER ;

-- Synthetic merged snapshot: every station contributes evidence, PT001 is scanned twice.
SET @t05_json = '{"version":1,"logs":[
 {"id":"demo-vip","event":"DEMO-SQL-RSAS","code":"VIP001","tablet":"T01","at":"2026-11-17T01:00:00.000Z"},
 {"id":"demo-pt-t02","event":"DEMO-SQL-RSAS","code":"PT001","tablet":"T02","at":"2026-11-17T01:01:00.000Z"},
 {"id":"demo-pt-t03","event":"DEMO-SQL-RSAS","code":"PT001","tablet":"T03","at":"2026-11-17T01:02:00.000Z"},
 {"id":"demo-pt2","event":"DEMO-SQL-RSAS","code":"PT002","tablet":"T04","at":"2026-11-17T01:03:00.000Z"},
 {"id":"demo-um","event":"DEMO-SQL-RSAS","code":"UM001","tablet":"T05","at":"2026-11-17T01:04:00.000Z"},
 {"id":"demo-extra","event":"DEMO-SQL-RSAS","code":"EX001","tablet":"T06","at":"2026-11-17T01:05:00.000Z"}
],"rsvps":[
 {"event":"DEMO-SQL-RSAS","code":"UM001","answer":"tidak","at":"2026-11-16T01:00:00.000Z"},
 {"event":"DEMO-SQL-RSAS","code":"UM002","answer":"hadir","at":"2026-11-16T01:00:00.000Z"},
 {"event":"DEMO-SQL-RSAS","code":"PT001","answer":"hadir","at":"2026-11-16T01:00:00.000Z"}
]}';
CALL rsas_impor_t05('DEMO-SQL-RSAS','demo-rekap-enam-tablet.json',@t05_json);
