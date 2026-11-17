"""Build one upload folder + one phpMyAdmin SQL; no third-party dependencies.
Usage: python3 tools/build_shared_hosting.py /workspace/rsas-paket-hosting
The output path must not already exist; no existing files are overwritten.
"""
from pathlib import Path
import shutil
import sys
import zipfile

repo = Path(__file__).resolve().parents[1]
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
];
''')
shutil.copyfile(repo / 'demo/shared-hosting.csv', web / 'demo-undangan.csv')
shutil.copyfile(repo / 'docs/PASANG_PAKET_HOSTING.txt', web / 'PANDUAN.txt')
shutil.copyfile(repo / 'sql/07_shared_hosting_dummy.sql', out / 'rsas_dummy.sql')
# Normalize copied workspace modes for Apache/shared hosting (never use 777).
web.chmod(0o755)
for item in web.rglob('*'):
    item.chmod(0o755 if item.is_dir() else 0o644)
(out / 'rsas_dummy.sql').chmod(0o644)
archive = out.with_suffix('.zip')
if archive.exists():
    raise SystemExit('Arsip sudah ada; folder output baru telah dibuat tetapi arsip tidak ditimpa.')
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as z:
    for p in sorted(out.rglob('*')):
        if p.is_file():
            z.write(p, p.relative_to(out))
print(f'Folder unggahan: {web}\nSQL phpMyAdmin: {out / "rsas_dummy.sql"}\nZIP: {archive}')
