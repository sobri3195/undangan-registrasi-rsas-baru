"""Integration tests against disposable Docker database containers; stdlib only.
Usage: python3 sql/tests/test_sql.py rsas-sql-mysql mysql
Never point this at production: creates/drops the dedicated rsas_integration database.
"""
import json
import pathlib
import subprocess
import sys

container, client = sys.argv[1:]
root = pathlib.Path(__file__).resolve().parents[1]

def query(sql, fail=False, db=True):
    command = ['docker','exec','-i',container,client,'-uroot','--batch','--skip-column-names']
    if db:
        command.append('rsas_integration')
    p = subprocess.run(command, input=sql, text=True, capture_output=True)
    if fail:
        assert p.returncode != 0, f'Expected rejection: {sql}'
    else:
        assert p.returncode == 0, p.stderr
    return p.stdout.strip()

def call(payload, fail=False):
    # Hex literal avoids SQL string quoting and faithfully preserves JSON bytes.
    raw=json.dumps(payload, ensure_ascii=False).encode().hex()
    return query(f"CALL rsas_impor_t05('DEMO-SQL-RSAS','test.json',CONVERT(0x{raw} USING utf8mb4));",fail)

def totals():
    return query('SELECT (SELECT COUNT(*) FROM rsas_arsip_impor_t05), (SELECT COUNT(*) FROM rsas_catatan_scan), (SELECT COUNT(*) FROM rsas_kehadiran_efektif), (SELECT COUNT(*) FROM rsas_rsvp);')

query('DROP DATABASE IF EXISTS rsas_integration; CREATE DATABASE rsas_integration CHARACTER SET utf8mb4;',db=False)
for filename in ['01_schema.sql','02_seed_demo.sql','03_contoh_impor_t05.sql','04_query_rekap.sql']:
    query((root/filename).read_text())
assert totals() == '1\t6\t5\t3', totals()
# Replay schema + seeds + complete import: idempotent, no evidence overwritten.
for filename in ['01_schema.sql','02_seed_demo.sql','03_contoh_impor_t05.sql']:
    query((root/filename).read_text())
assert totals() == '1\t6\t5\t3'
assert query("SELECT jumlah_scan,jumlah_tablet FROM rsas_kehadiran_efektif WHERE kode='PT001';")=='2\t2'
assert query("SELECT COUNT(*) FROM rsas_kehadiran_efektif h JOIN rsas_undangan u USING(acara,kode) WHERE u.perusahaan='PT Mitra Sintetis' AND u.resmi=1;")=='2'
assert query("SELECT ROUND(100.0*SUM(u.resmi=1 AND h.kode IS NOT NULL)/NULLIF(SUM(u.resmi=1),0),2) FROM rsas_undangan u LEFT JOIN rsas_kehadiran_efektif h USING(acara,kode);")=='66.67'
assert query("SELECT r.jawaban,h.kode IS NOT NULL FROM rsas_rsvp r LEFT JOIN rsas_kehadiran_efektif h USING(acara,kode) WHERE r.kode='UM001';")=='tidak\t1'
assert query("SELECT r.jawaban,h.kode IS NOT NULL FROM rsas_rsvp r LEFT JOIN rsas_kehadiran_efektif h USING(acara,kode) WHERE r.kode='UM002';")=='hadir\t0'

log=dict(id='new-log',event='DEMO-SQL-RSAS',code='PT001',tablet='T06',at='2026-11-17T01:09:00.000Z')
for patch in [dict(code='UNKNOWN'),dict(tablet='T07'),dict(event='other'),dict(at='2026-02-31T01:09:00.000Z'),dict(at='2026-11-17T25:00:00.000Z'),dict(at=None),dict(code=None),dict(id='demo-pt-t02',tablet='T06'),dict(code='pt001')]:
    before=totals()
    call(dict(version=1,logs=[{**log,**patch}],rsvps=[]),fail=True)
    assert totals()==before, 'Failed import was not atomic'
for payload in [dict(version=2,logs=[],rsvps=[]),dict(version=1,logs={},rsvps=[]),dict(version=1,logs=[log,log],rsvps=[]),dict(version=1,logs=[],rsvps=[dict(event='DEMO-SQL-RSAS',code='UM001',answer='yes',at=log['at'])])]:
    before=totals();call(payload,fail=True);assert totals()==before
# RSVP-only import never creates physical attendance.
reply=dict(event='DEMO-SQL-RSAS',code='UM003',answer='hadir',at=log['at'])
call(dict(version=1,logs=[],rsvps=[reply]))
assert query("SELECT COUNT(*) FROM rsas_kehadiran_efektif WHERE kode='UM003';")=='0'
# Older answer cannot replace latest; stable tie break independent of import order.
call(dict(version=1,logs=[],rsvps=[{**reply,'answer':'tidak','at':'2026-11-16T01:00:00.000Z'}]))
assert query("SELECT jawaban FROM rsas_rsvp WHERE kode='UM003';")=='hadir'
call(dict(version=1,logs=[],rsvps=[{**reply,'answer':'tidak'}]))
call(dict(version=1,logs=[],rsvps=[reply]))
assert query("SELECT jawaban FROM rsas_rsvp WHERE kode='UM003';")=='tidak'
# Replaying an existing scan under differently formatted JSON adds no second scan.
call(dict(version=1,logs=[dict(id='demo-pt-t02',event='DEMO-SQL-RSAS',code='PT001',tablet='T02',at='2026-11-17T01:01:00.000Z')],rsvps=[]))
assert query('SELECT COUNT(*) FROM rsas_catatan_scan;')=='6'
# DB constraints work independently of the import routine.
for sql in ["UPDATE rsas_undangan SET resmi=2 WHERE kode='PT001';", "INSERT INTO rsas_stasiun VALUES ('T07','invalid');", "UPDATE rsas_catatan_scan SET kode='UNKNOWN' WHERE scan_id='demo-vip';", "INSERT INTO rsas_undangan SELECT * FROM rsas_undangan WHERE kode='PT001';"]:
    query(sql,fail=True)
query("INSERT INTO rsas_acara(kode,nama) VALUES ('EMPTY','No slots');")
assert query("SELECT ROUND(100.0*0/NULLIF(COUNT(*),0),2) FROM rsas_undangan WHERE acara='EMPTY';")=='NULL'
print('PASS',container,query('SELECT VERSION();'),': import/replay, PT slots, duplicates, 66.67%, RSVP separation, rollback, invalid dates/FK/unique/CHECK, zero denominator')
