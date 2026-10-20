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

Runtime standalone ini adalah satu-satunya implementasi generator yang dipakai
oleh route admin. Implementasi React lama, client Supabase khusus sertifikat,
serta folder prototipe lama telah dihapus agar tidak ikut bundle atau deployment.

Generator tetap berfungsi tanpa Supabase. Fitur massal yang disertakan di dalam
paket standalone bersifat opsional dan harus dikonfigurasi melalui
`public/sertifikat/config.js` sebelum dipakai.

Jangan mengaktifkan archive pada `public/sertifikat/config.js` dengan secret
atau `service_role` key. Jika arsip standalone dibutuhkan, gunakan publishable
key dan policy Supabase yang sesuai.
