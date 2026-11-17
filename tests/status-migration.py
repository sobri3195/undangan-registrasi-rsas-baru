"""Run only against disposable local Docker DBs. Uses dedicated rsas_status_upgrade database."""
from pathlib import Path
import subprocess
import sys
container,client=sys.argv[1:]
repo=Path(__file__).resolve().parents[1]
def run(sql,db=True):
    cmd=['docker','exec','-i',container,client,'-uroot','--batch','--skip-column-names']+(['rsas_status_upgrade'] if db else [])
    p=subprocess.run(cmd,input=sql,text=True,capture_output=True)
    assert p.returncode==0,p.stderr
    return p.stdout.strip()
run('CREATE DATABASE rsas_status_upgrade CHARACTER SET utf8mb4;',False)
run((repo/'sql/05_scan_sederhana.sql').read_text())
# Reproduce the previous schema without the status column.
run("CREATE TABLE scan_acara(kode VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,nama VARCHAR(200) NOT NULL,tanggal DATE NULL,lokasi VARCHAR(200) NOT NULL DEFAULT '',dibuat_utc DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;")
run("INSERT INTO scan_acara(kode,nama) VALUES ('OLD','Old event'); INSERT INTO scan_tamu VALUES ('OLD','G001','Synthetic','','','"+'a'*48+"'); INSERT INTO scan_catatan VALUES ('OLD','G001','T01','2026-11-17 00:00:00.000');")
script=(repo/'sql/08_status_acara.sql').read_text();run(script)
assert run("SELECT status FROM scan_acara WHERE kode='OLD';")=='dibuka'
run("UPDATE scan_acara SET status='selesai' WHERE kode='OLD';")
run(script);run("INSERT INTO scan_acara(kode,nama) VALUES ('NEW','New event');")
assert run('SELECT kode,status FROM scan_acara ORDER BY kode;')=='NEW\tpersiapan\nOLD\tselesai'
assert run('SELECT COUNT(*) FROM scan_catatan;')=='1'
print('PASS migration',container,': existing events open, new events preparation, replay preserves closed event and scans')
