# Validasi mass generator dan validator, 25 Oktober 2026

## Hasil

- Parser workbook GST#26: 17 peserta dari Progres nilai, nama D6:D22, nilai AB6:AF22.
- Nilai sumber dan display dipertahankan; contoh Summary 97.0 dan 96.6.
- Enam tes regresi Node lulus, mencakup format nilai, nilai kosong/error, nama ganda,
  sheet/header salah, pencocokan foto, nomor lintas kelas/tahun dan predikat.
- Browser mengimpor folder lokal berisi workbook asli dan 17 salinan foto sample.
- Generate pratinjau menghasilkan 17 PDF/34 halaman, 25.276.106 byte PDF dalam ZIP.
- Seluruh 17 SHA-256 cocok dengan manifest; ZIP tidak memiliki entry rusak.
- Dua PDF juga diperiksa secara visual; nama, foto, nilai, dan tanda tangan terbaca.
- Tidak ada page error pada batch penuh. Halaman tidak overflow pada 390/1024 px.
- Simulasi kegagalan pencatatan akhir menahan unduhan. Retry memakai batch key dan
  nomor yang sama, kemudian berhasil menghasilkan ZIP.
- Public validator lokal memanggil RPC production tanpa login; nomor yang belum
  terbit menghasilkan status tidak terdaftar. Tampilan hasil positif diuji dengan
  respons simulasi dan identitas data uji.

## Database

Pengujian transaksi production diakhiri ROLLBACK, tanpa mengubah nomor permanen:

- Nomor awal 1058, berikutnya 1059; kelas lain meneruskan 1060.
- Permintaan reserve identik menghasilkan reservasi yang sama.
- Pending tidak muncul pada validator; batch lengkap muncul sebagai valid.
- Jumlah hash PDF yang kurang ditolak.
- Anon dapat memvalidasi nomor, tidak dapat memesan nomor atau membaca tabel privat.
- Akun authenticated di luar allowlist ditolak; pemberian izin ke diri sendiri ditolak.
- Setelah uji: 0 records, next_number=1058, 2 penerbit yang dikonfirmasi pemilik.
- Advisor: empat INFO RLS tanpa policy pada tabel private disengaja (deny-all).
  Peringatan fungsi web lama dan leaked-password protection berada di luar perubahan ini.

## Batas pembuktian

UI admin lokal diuji memakai state login simulasi dan respons RPC penerbitan simulasi;
izin dan perilaku RPC asli diuji secara terpisah pada database melalui transaksi rollback.
Tidak ada password pengguna yang diminta atau login pengguna yang diambil alih.
Foto sample bukan foto asli 17 murid, dan TTL pengujian ditandai DATA UJI.
Sertifikat peserta sebenarnya belum diterbitkan; admin perlu memasukkan folder foto
asli, melengkapi TTL, meninjau pengaturan, lalu menerbitkan dari akun yang diizinkan.

Panduan operasional: `src/features/sertifikat/README.md`.

## Revisi master AUTOMATE, 27 Oktober 2026

- Master pengguna dibaca hanya dari AUTOMATE, tabel B7:L26, 16 peserta.
- Nama C11:C26 dinormalisasi uppercase; TTL D11:D26 otomatis; sheet lain diabaikan.
- Nilai H:L dipetakan menurut header, sehingga Dokkai dari J dan Kaiwa dari I.
- Enam tes regresi parser lulus; lint modul tanpa error dan build 3508 modul lulus.
- Browser mengimpor master asli dengan 16 foto sample bernama campuran kapital/spasi.
- Seluruh TTL otomatis terisi. ZIP menghasilkan 16 PDF/32 halaman, 16 hash cocok,
  ZIP tidak rusak, nol pageerror dan nol foto tidak cocok; layout 390/1024 tanpa overflow.
- PDF peserta pertama dirender dan diperiksa: uppercase, TTL, foto, serta nilai
  24/21/23/25/93 sesuai pemetaan kategori. Ini pratinjau, tidak memesan nomor resmi.
- Login admin/RPC next disimulasikan untuk pengujian lokal; tidak memakai akun asli.
- TTL dipertahankan sesuai teks master, termasuk ejaan; admin dapat mengoreksinya.
