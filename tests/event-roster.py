"""Validate the user-provided 80-slot roster on disposable local Docker databases."""
from pathlib import Path
import subprocess,csv,json,re,sys
from collections import Counter
container,client=sys.argv[1:]
root=Path(__file__).resolve().parents[1]
rows=list(csv.DictReader((root/'data/undangan-rsas-20261119.csv').open()))
manifest=json.loads((root/'data/undangan-rsas-20261119.json').read_text())
assert len(rows)==80 and [r['kode'] for r in rows]==[f'RSAS{i:03}' for i in range(1,81)]
assert len(set(r['kode'] for r in rows))==80
assert list(Counter(r['kelompok'] for r in manifest['slots']).values())==[16,3,3,1,4,3,1,22,18,9]
for slot,row in zip(manifest['slots'],rows):
    assert {k:slot[k] for k in row}==row
assert all(r['nama'].startswith('Perwakilan ') for r in rows[53:71])
assert all('nama belum' in r['nama'] for r in rows[76:80])
def run(sql,db=True):
    args=['docker','exec','-i',container,client,'-uroot','--default-character-set=utf8mb4','--batch','--skip-column-names']+(['rsas_real_roster'] if db else [])
    p=subprocess.run(args,input=sql,text=True,capture_output=True);assert p.returncode==0,p.stderr;return p.stdout.strip()
run('CREATE DATABASE rsas_real_roster CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;',False)
sql=(root/'sql/09_acara_rsas_20261119.sql').read_text()
assert not re.search(r"'[0-9a-f]{48,64}'",sql),'SQL must not include actual QR token values'
run(sql)
assert run("SELECT (SELECT COUNT(*) FROM scan_acara),(SELECT COUNT(*) FROM scan_tamu),(SELECT COUNT(*) FROM scan_catatan);")=='1\t80\t0'
assert run("SELECT status,tanggal FROM scan_acara WHERE kode='RSAS-20261119';")=='persiapan\t2026-11-19'
assert run('SELECT COUNT(DISTINCT token),MIN(CHAR_LENGTH(token)),MAX(CHAR_LENGTH(token)) FROM scan_tamu;')=='80\t48\t48'
before=run('SELECT kode,token FROM scan_tamu ORDER BY kode;')
run("UPDATE scan_acara SET status='dibuka' WHERE kode='RSAS-20261119'; UPDATE scan_tamu SET nama='Koreksi panitia' WHERE kode='RSAS001';")
run(sql)
assert run('SELECT kode,token FROM scan_tamu ORDER BY kode;')==before
assert run("SELECT nama FROM scan_tamu WHERE kode='RSAS001';")=='Koreksi panitia'
assert run("SELECT status FROM scan_acara;")=='dibuka'
# Restore only our test modifications so browser checks see the original roster in preparation.
run("UPDATE scan_acara SET status='persiapan' WHERE kode='RSAS-20261119'; UPDATE scan_tamu SET nama='"+rows[0]['nama'].replace("'","''")+"' WHERE kode='RSAS001';")
received=[json.loads(line) for line in run("SELECT JSON_OBJECT('kode',kode,'nama',nama,'perusahaan',perusahaan,'jabatan',jabatan) FROM scan_tamu ORDER BY kode;").splitlines()]
assert received==rows
print('PASS user roster',container,': 80 slots, 10 groups, correct date/preparation, no attendance, independent family slots, random unique tokens, safe repeat import')
