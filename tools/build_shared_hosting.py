"""Build one upload folder + one phpMyAdmin SQL; no third-party dependencies.
Usage: python3 tools/build_shared_hosting.py /workspace/rsas-paket-hosting
The output path must not already exist; no existing files are overwritten.
Pass --event-rsas for the supplied 80-slot event instead of synthetic demo data.
"""
from pathlib import Path
import shutil
import sys
import zipfile

repo = Path(__file__).resolve().parents[1]
if len(sys.argv) not in (2,3) or (len(sys.argv)==3 and sys.argv[2]!='--event-rsas'):
    raise SystemExit('Usage: python3 tools/build_shared_hosting.py OUTPUT [--event-rsas]')
out = Path(sys.argv[1]).resolve()
if out.exists():
    raise SystemExit('Output sudah ada. Pilih folder output baru agar file pengguna tidak tertimpa.')
if out == repo or repo in out.parents:
    raise SystemExit('Gunakan folder output di luar checkout repositori.')
out.mkdir(parents=True)
web = out / 'hosting-subdomain'
shutil.copytree(repo / 'public', web)
private = web / 'private'
private.mkdir()
(private / '.htaccess').write_text('Require all denied\n')
(private / 'database.php').write_text('''<?php
// Isi di hosting. File ini dilarang diakses langsung oleh konfigurasi Apache.
return [
    'DB_HOST' => 'localhost',
    'DB_PORT' => '3306',
    'DB_NAME' => '', // contoh: akun_database
    'DB_USER' => '', // contoh: akun_user
    'DB_PASS' => '', // password user database cPanel
    'APP_TIMEZONE' => 'Asia/Jakarta', // waktu hadir ditampilkan dalam WIB
];
''')
event_bundle = len(sys.argv)>2 and sys.argv[2]=='--event-rsas'
if event_bundle:
    shutil.copyfile(repo / 'data/undangan-rsas-20261119.csv', private / 'daftar-undangan.csv')
else:
    shutil.copyfile(repo / 'demo/shared-hosting.csv', web / 'demo-undangan.csv')
shutil.copyfile(repo / 'docs/PASANG_PAKET_HOSTING.txt', web / 'PANDUAN.txt')
sql_name = 'rsas_acara_19_november_2026.sql' if event_bundle else 'rsas_dummy.sql'
shutil.copyfile(repo / ('sql/09_acara_rsas_20261119.sql' if event_bundle else 'sql/07_shared_hosting_dummy.sql'), out / sql_name)
if event_bundle:
    shutil.copyfile(repo / 'docs/PASANG_ACARA_RSAS.txt', web / 'PANDUAN.txt')
# Normalize copied workspace modes for Apache/shared hosting (never use 777).
web.chmod(0o755)
for item in web.rglob('*'):
    item.chmod(0o755 if item.is_dir() else 0o644)
(out / sql_name).chmod(0o644)
archive = out.with_suffix('.zip')
if archive.exists():
    raise SystemExit('Arsip sudah ada; folder output baru telah dibuat tetapi arsip tidak ditimpa.')
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as z:
    for p in sorted(out.rglob('*')):
        if p.is_file():
            z.write(p, p.relative_to(out))
print(f'Folder unggahan: {web}\nSQL phpMyAdmin: {out / sql_name}\nZIP: {archive}')
