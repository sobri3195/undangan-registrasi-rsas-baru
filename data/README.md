# Daftar acara RSAU — 19 November 2026

Sumber: rincian teks yang diberikan pengguna dari bagian Peserta dan Undangan TOR 12 November 2026. Seluruh 80 slot dipilih dan dikonfirmasi pengguna. Berkas ini menyalin rencana undangan, bukan bukti RSVP atau kehadiran, dan bukan hasil pemeriksaan dokumen TOR asli.

- Kode acara: `RSAS-20261119`.
- Kegiatan: Forum Komunikasi Publik, Bakti Sosial, dan Penandatanganan Kerja Sama Pelayanan Kesehatan RSAU Prof. dr. Abdulrachman Saleh.
- Kamis, 19 November 2026, pukul 09.00 WIB (Asia/Jakarta).
- Tempat: RSAU Prof. dr. Abdulrachman Saleh, Pancoran, Jakarta Selatan.
- Status awal: **Persiapan**; tidak ada absensi atau RSVP yang dibuat.
- Kode slot `RSAS001`–`RSAS080` mengikuti urutan rincian sumber.

| Kelompok | Slot |
| --- | --- |
| TNI AU | 16 |
| Kemhan | 3 |
| Mabes TNI | 3 |
| Bais (BIN), penamaan mengikuti sumber | 1 |
| TNI AD | 4 |
| TNI AL | 3 |
| POLRI | 1 |
| Pemerintah, fasyankes, BPJS, perbankan | 22 |
| Provider asuransi dan korporasi | 18 |
| Tokoh masyarakat dan keluarga | 9 |
| **Total** | **80** |

Nama jabatan dipakai sebagai nama undangan ketika sumber belum menyebut orangnya. Provider/perusahaan menggunakan “Perwakilan …”, tanpa mengarang nama pribadi. Empat anggota keluarga tambahan memakai label sementara dan kode terpisah. Setelah nama perwakilan diketahui, perbaiki melalui Edit sehingga kode/QR tidak berubah. Kolom perusahaan/instansi merupakan pengelompokan kerja untuk pencarian; pastikan kembali nomenklatur instansi sebelum kartu dibagikan.

Catatan angka TOR awal **73** tetap dicatat sebagai perbedaan sumber. Persetujuan memasukkan 80 slot tidak mengubah target TOR 73/85% pada paket laporan SQL lama. Progres di aplikasi sederhana menghitung seluruh slot acara, sehingga penyebut acara ini adalah 80; jangan menyebutnya persentase TOR resmi.

`undangan-rsas-20261119.csv` dapat diimpor ke acara dengan kode tersebut melalui pratinjau Admin. JSON menyimpan pemetaan nomor/kelompok untuk pemeriksaan dan tidak diunggah ke folder web. Keduanya tidak berisi token QR. Untuk instalasi satu berkas SQL, gunakan `sql/09_acara_rsas_20261119.sql`: schema dan daftar 80 slot sudah lengkap; token dibuat acak di database. Impor ulang mempertahankan data dan token yang sudah ada. Untuk database yang telah berisi slot tambahan pada event ini, total dapat lebih dari 80 karena skrip tidak menghapus data pengguna.
