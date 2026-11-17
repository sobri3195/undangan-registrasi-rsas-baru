"""Disposable Docker DB only. Creates its own rsas_access_upgrade database."""
from pathlib import Path
import subprocess,sys
container,client=sys.argv[1:]
root=Path(__file__).resolve().parents[1]
def sql(source,db=True):
    p=subprocess.run(['docker','exec','-i',container,client,'-uroot','--batch','--skip-column-names']+(['rsas_access_upgrade'] if db else []),input=source,text=True,capture_output=True)
    assert p.returncode==0,p.stderr
    return p.stdout.strip()
sql('CREATE DATABASE rsas_access_upgrade CHARACTER SET utf8mb4;',False)
sql((root/'sql/07_shared_hosting_dummy.sql').read_text())
sql('DROP TABLE scan_access_limits;')
query="SELECT kode,nama,tanggal,status FROM scan_acara ORDER BY kode; SELECT acara,kode,nama,perusahaan,jabatan,token FROM scan_tamu ORDER BY acara,kode; SELECT acara,kode,tablet,dicatat_utc FROM scan_catatan ORDER BY acara,kode,tablet;"
before=sql(query)
for _ in range(2):sql((root/'sql/10_akses_panitia.sql').read_text())
assert sql(query)==before
assert sql('SELECT COUNT(*) FROM scan_access_limits;')=='0'
print('PASS access migration',container,': repeat import preserves events, identities, tokens, status and attendance')
