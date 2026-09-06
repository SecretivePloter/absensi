# Pool Audio Absen

Taruh file `.mp3` di folder yang sesuai, lalu jalankan `npm run build` (atau restart `npm run dev`).
Kode otomatis mengambil SEMUA file `.mp3` di folder ini secara acak — tidak perlu edit kode.

- `masuk/`  — dipilih acak saat absen **masuk** (kalau tidak sedang telat & user tidak punya audio pribadi).
- `pulang/` — dipilih acak saat absen **pulang**.
- `telat/`  — dipilih acak saat absen masuk **setelah jam threshold telat** (atur di Pengaturan → Audio). Kalau folder ini kosong, absen telat tetap pakai audio masuk biasa.

Urutan prioritas audio masuk: **hari spesial** (Pengaturan → Audio) → **telat** → **audio pribadi user** (halaman Pengguna) → **acak dari folder ini** → fallback `public/audio/datang.mp3`.

Urutan prioritas audio pulang: **hari spesial** → **acak dari folder ini** → fallback `public/audio/pulang.mp3`.
