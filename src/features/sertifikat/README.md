# Integrasi generator sertifikat

Route admin `/sertifikat` menampilkan generator standalone melalui
`SertifikatGeneratorEmbed.jsx`. Runtime generator berada di
`public/sertifikat/` dan sengaja disimpan sebagai aset statis agar template SVG,
font, foto, kalibrator, dan pembuatan PDF memakai implementasi yang sama.

## Kontrak

- Halaman utama generator: `/sertifikat/index.html`
- Kalibrator: `/sertifikat/adjust.html`
- Nilai kategori 1 sampai 4: `0..25`
- Nilai total: dihitung otomatis, `0..100`
- Kalibrasi per browser: localStorage key `ich_adj`
- Kalibrasi bawaan deployment: `public/sertifikat/config.js`

Generator tunggal tetap berfungsi tanpa Supabase. Tab Sinkronisasi Massal,
Validasi, serta Arsip memakai client `src/lib/supabaseCert.js` yang sudah ada.

Jangan mengaktifkan archive pada `public/sertifikat/config.js` dengan secret
atau `service_role` key. Jika arsip standalone dibutuhkan, gunakan publishable
key dan policy Supabase yang sesuai.
