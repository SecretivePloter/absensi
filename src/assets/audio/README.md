# Pool Audio Absen

Taruh file `.mp3` di folder yang sesuai, lalu jalankan `npm run build` (atau restart `npm run dev`).
Kode otomatis mengambil SEMUA file `.mp3` di folder ini secara acak — tidak perlu edit kode.
Ini pool fallback statis; digabung dengan audio kategori **Default** dari Pustaka Audio (Pengaturan → Audio).

- `masuk/`  — dipilih acak saat absen **masuk** (kalau user tidak punya audio pribadi kategori Custom).
- `pulang/` — dipilih acak saat absen **pulang**.

Urutan prioritas audio masuk: **hari spesial** (Pengaturan → Audio) → **audio pribadi user kategori Custom** (halaman Pengguna) → **acak** (folder ini + Pustaka kategori Default/Masuk) → fallback `public/audio/datang.mp3`.

Urutan prioritas audio pulang: **hari spesial** → **audio pribadi user kategori Custom** → **acak** (folder ini + Pustaka kategori Default/Pulang) → fallback `public/audio/pulang.mp3`.
