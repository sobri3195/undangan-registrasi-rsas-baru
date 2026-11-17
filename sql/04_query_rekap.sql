SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
-- Change only this event code for your event. All queries filter on it.
SET @acara = 'DEMO-SQL-RSAS';

-- 1. Physical attendance, independent of RSVP (one row per occupied slot).
SELECT u.kode,u.nama,u.perusahaan,u.jabatan,u.kategori,u.resmi,
       h.pertama_utc,h.terakhir_utc,h.jumlah_scan,h.jumlah_tablet,
       COALESCE(r.jawaban,'belum') AS rsvp
FROM rsas_kehadiran_efektif h
JOIN rsas_undangan u ON u.acara=h.acara AND u.kode=h.kode
LEFT JOIN rsas_rsvp r ON r.acara=u.acara AND r.kode=u.kode
WHERE u.acara=@acara ORDER BY h.pertama_utc,u.kode;

-- 2. RSVP list: includes non-attendees and slots that have not replied.
SELECT u.kode,u.nama,u.perusahaan,u.resmi,COALESCE(r.jawaban,'belum') AS rsvp,
       r.dijawab_utc,CASE WHEN h.kode IS NULL THEN 'tidak' ELSE 'ya' END AS hadir_fisik
FROM rsas_undangan u
LEFT JOIN rsas_rsvp r ON r.acara=u.acara AND r.kode=u.kode
LEFT JOIN rsas_kehadiran_efektif h ON h.acara=u.acara AND h.kode=u.kode
WHERE u.acara=@acara ORDER BY u.kode;

SELECT COALESCE(r.jawaban,'belum') AS rsvp,COUNT(*) AS jumlah_slot,
       SUM(CASE WHEN h.kode IS NOT NULL THEN 1 ELSE 0 END) AS hadir_fisik
FROM rsas_undangan u
LEFT JOIN rsas_rsvp r ON r.acara=u.acara AND r.kode=u.kode
LEFT JOIN rsas_kehadiran_efektif h ON h.acara=u.acara AND h.kode=u.kode
WHERE u.acara=@acara GROUP BY COALESCE(r.jawaban,'belum');

-- 3. Company rollup. A company with two official slots can contribute two attendees.
-- Empty company denotes guests with no affiliation, not a PT/company identity.
SELECT u.perusahaan,COUNT(*) AS semua_slot,
 SUM(CASE WHEN u.resmi=1 THEN 1 ELSE 0 END) AS slot_resmi,
 SUM(CASE WHEN u.resmi=1 AND h.kode IS NOT NULL THEN 1 ELSE 0 END) AS hadir_resmi,
 SUM(CASE WHEN u.resmi=0 AND h.kode IS NOT NULL THEN 1 ELSE 0 END) AS hadir_tambahan,
 SUM(CASE WHEN h.kode IS NOT NULL THEN 1 ELSE 0 END) AS total_hadir
FROM rsas_undangan u
LEFT JOIN rsas_kehadiran_efektif h ON h.acara=u.acara AND h.kode=u.kode
WHERE u.acara=@acara GROUP BY u.perusahaan ORDER BY u.perusahaan;

-- 4. Cross-tablet duplicates; preserve every scan ID as evidence.
SELECT s.kode,u.nama,u.perusahaan,COUNT(*) AS jumlah_scan,
 COUNT(DISTINCT s.stasiun) AS jumlah_tablet,
 GROUP_CONCAT(DISTINCT s.stasiun ORDER BY s.stasiun SEPARATOR ', ') AS tablet,
 MIN(s.dipindai_utc) AS pertama_utc,MAX(s.dipindai_utc) AS terakhir_utc
FROM rsas_catatan_scan s JOIN rsas_undangan u ON u.acara=s.acara AND u.kode=s.kode
WHERE s.acara=@acara GROUP BY s.kode,u.nama,u.perusahaan
HAVING COUNT(DISTINCT s.stasiun)>1;

-- 5. Official percentage = physical official occupied slots / all official invitation slots.
-- RSVP is never the denominator. Zero official slots -> NULL, not a misleading 0%.
SELECT COUNT(*) AS semua_slot,
 SUM(CASE WHEN u.resmi=1 THEN 1 ELSE 0 END) AS slot_resmi,
 SUM(CASE WHEN u.resmi=1 AND h.kode IS NOT NULL THEN 1 ELSE 0 END) AS hadir_resmi,
 SUM(CASE WHEN u.resmi=0 AND h.kode IS NOT NULL THEN 1 ELSE 0 END) AS hadir_tambahan,
 SUM(CASE WHEN h.kode IS NOT NULL THEN 1 ELSE 0 END) AS hadir_fisik_total,
 ROUND(100.0*SUM(CASE WHEN u.resmi=1 AND h.kode IS NOT NULL THEN 1 ELSE 0 END)
 /NULLIF(SUM(CASE WHEN u.resmi=1 THEN 1 ELSE 0 END),0),2) AS persen_kehadiran_resmi
FROM rsas_undangan u
LEFT JOIN rsas_kehadiran_efektif h ON h.acara=u.acara AND h.kode=u.kode
WHERE u.acara=@acara;

-- 6. Reconciliation: expected ZERO rows. Detect direct edits bypassing the importer.
SELECT u.kode,h.kode AS kode_efektif,h.jumlah_scan,h.jumlah_tablet,h.pertama_utc,h.terakhir_utc,
 COUNT(s.scan_id) AS scan_asli,COUNT(DISTINCT s.stasiun) AS tablet_asli
FROM rsas_undangan u
LEFT JOIN rsas_kehadiran_efektif h ON h.acara=u.acara AND h.kode=u.kode
LEFT JOIN rsas_catatan_scan s ON s.acara=u.acara AND s.kode=u.kode
WHERE u.acara=@acara
GROUP BY u.kode,h.kode,h.jumlah_scan,h.jumlah_tablet,h.pertama_utc,h.terakhir_utc
HAVING (kode_efektif IS NULL AND COUNT(s.scan_id)>0)
 OR (kode_efektif IS NOT NULL AND (h.jumlah_scan<>COUNT(s.scan_id)
 OR h.jumlah_tablet<>COUNT(DISTINCT s.stasiun)
 OR NOT(h.pertama_utc<=>MIN(s.dipindai_utc)) OR NOT(h.terakhir_utc<=>MAX(s.dipindai_utc))));
