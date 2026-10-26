# Generator massal dan validator sertifikat

## Penggunaan admin

1. Login ke portal lalu buka `/sertifikat-admin`, tab Generator Massal.
2. Siapkan satu folder berisi satu file `.xlsx` dan foto JPG/PNG/WebP (maksimal 10 MB/foto).
   Nama foto harus sama dengan nama murid, misalnya `Hendro Ariyanto.jpg`.
   Huruf besar/kecil dan spasi berulang diabaikan. Nama mirip tidak ditebak.
3. Pilih folder. Sistem hanya mengambil nama dan tabel **Nilai Sertifikat** dari
   sheet **Progres nilai** atau **Progress nilai**. Pada contoh GST#26, sumbernya
   D6:D22 dan AB6:AF22 (17 peserta); bagian nilai level lain tidak diikutkan.
4. Periksa foto dan lengkapi tempat/tanggal lahir setiap peserta. Data ini tidak
   diambil dari sheet lain. Foto hilang/ganda dapat dipilih manual pada barisnya.
5. Periksa kelas, tanggal terbit, tanggal selesai, level, durasi, predikat dan hasil.
   Default tanggal 20 Oktober 2026 mengikuti contoh, bukan tanggal komputer.
   Predikat default mengikuti Summary menurut kategori pada template; admin dapat
   menggantinya untuk seluruh batch. Hasil LULUS/TIDAK LULUS harus dikonfirmasi admin.
6. **Unduh ZIP pratinjau** membuat PDF bertanda PRATINJAU, tanpa nomor resmi.
7. **Generate & terbitkan ZIP** memesan nomor, membuat dua halaman PDF per murid,
   lalu mencatat penerbitan setelah seluruh PDF dan ZIP selesai dibuat.
8. Simpan ZIP dengan aman. ZIP berisi PDF dan `manifest.json` yang memuat nomor,
   nama, nilai sumber, SHA-256 PDF, dan tautan validator. Foto/PDF tidak disimpan
   di server. Tombol **Unduh ZIP lagi** tersedia selama halaman belum ditutup.

## Nilai dan penomoran

- Nilai 4 kategori harus 0–25 dan Summary 0–100.
- Hasil memakai format tampilan sel Excel: `23.875` dengan format `0` dicetak `24`;
  Summary `96.5625` dengan format `0.0` dicetak `96.6`. Summary tidak dihitung ulang.
- Formula memakai hasil yang tersimpan di workbook. Hitung ulang dan simpan workbook
  di Excel sebelum impor; formula tanpa hasil cache ditolak.
- Nomor awal registri 1058: `NO.S.1058.CLT.20.X.2026`.
- Satu pencatat nomor untuk CLT, Bimbel, TG, semua batch dan tahun. Nomor tidak direset.
- Reservasi dilindungi transaksi database, bukan localStorage. Nomor yang sudah
  dipesan tidak didaur ulang meskipun render gagal; batch identik dapat dilanjutkan.
- Ulangi dengan data, foto, pilihan peserta, pengaturan, dan kalibrasi yang sama
  untuk memakai reservasi semula. Nama/kelas/tanggal yang sama tidak bisa diterbitkan
  dua kali melalui batch berbeda; hubungi pengelola database untuk koreksi terkontrol.
- Kalibrasi dibekukan saat batch dimulai sehingga perubahan pada tab lain tidak
  mengubah posisi sertifikat di tengah proses.

## Validator publik

Buka `/validasi-sertifikat`, tanpa login. Masukkan nomor lengkap.
Hasil valid menampilkan nomor, nama, kelas dan tanggal terbit. Nilai, TTL, foto,
dan seluruh daftar peserta tidak tersedia melalui pencarian publik.
Batch pending tidak dianggap terbit. Nomor tidak ditemukan berbeda dari gangguan koneksi.
Dokumen lama dan PDF dari Generator Tunggal lokal tidak otomatis masuk registri.
Untuk satu peserta yang perlu validasi, gunakan Generator Massal dan pilih satu orang.
Validasi nomor bukan pemeriksaan keaslian byte PDF; cocokkan identitas dokumennya.

## Arsitektur dan akses

- `CertificateBatch.jsx`: impor folder, pemeriksaan, ZIP, dan transaksi penerbitan.
- `batch-data.js`: parser tabel, pencocokan foto, format nomor dan predikat.
- `certificate-service.js`: RPC dan komunikasi iframe terikat origin/request ID.
- Runtime `public/sertifikat/index.html` dan `certificate-core.js` adalah engine
  bersama dengan generator tunggal; template SVG dan kalibrasi tetap digunakan.
- Worker menerima `scoreSource: 'excel'` untuk mempertahankan Summary.
- `/sertifikat/mass.html` mengarah ke portal admin; implementasi massal standalone
  lama tidak lagi dipakai di repo ini.
- Supabase project absensi: `pfvlxlfykdabrwijqqxa`. Schema `certificate_private`
  menyimpan admins, counter, batches dan records. RLS aktif tanpa izin tabel langsung.
- RPC `certificate_batch` hanya authenticated + anggota allowlist khusus.
  RPC `certificate_verify` tersedia anon/authenticated untuk nomor tepat saja.
- Dua penerbit dikonfirmasi pemilik: `it@ichikara.co.id`, `kresna@ichikara.co.id`.
  Pemberian izin dilakukan melalui query admin server terarah, tidak lewat frontend.
  Akun baru atau role admin lama tidak otomatis mendapat izin sertifikat.
- Migrasi sertifikat tidak mengubah tabel, data, atau policy absensi.
- Peringatan advisor RLS tanpa policy pada schema private disengaja: akses tabel
  ditolak dan hanya fungsi dengan izin eksplisit boleh mengaksesnya.

## Pemeriksaan

Jalankan `node --test tests/certificate-import.test.mjs`, lint file terkait dan
`npm run build`. Uji browser mencakup impor folder, foto, PDF dua halaman/ZIP,
nilai desimal, retry, serta lebar 390/1024 px. Uji registri memakai transaksi
ROLLBACK agar nomor resmi tidak terpakai. Jangan memasukkan workbook murid,
foto sample, token, atau hasil PDF uji ke Git.

Untuk deployment baru di database kosong, jalankan migrasi registri kemudian
beri izin hanya pada akun yang telah dikonfirmasi pemilik. Jangan menjalankan
`cert_001_sertifikat_table.sql` lama, yang mengacu ke database sertifikat berbeda.
