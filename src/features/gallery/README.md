# Modul Galeri Ichikara

Modul dokumentasi foto kegiatan untuk portal absensi (React + Supabase).
File foto disimpan di **Google Drive**; Supabase hanya menyimpan **metadata kecil**.

> **Isolasi:** seluruh kode modul ada di `src/features/gallery/` (frontend) dan
> `api/gallery/` (backend). Tidak mengubah data/fitur absensi existing.
> Hanya 2 file existing disentuh secara aditif: `src/App.jsx` (route) &
> `src/components/Layout.jsx` (menu "Galeri").

## Arsitektur

```
Browser (React)          Vercel Function           Google Drive / Supabase
─────────────            ───────────────           ──────────────────────
Upload foto ──compress──► /api/gallery/upload ──► upload ke Google Drive
                          (pegang kredensial)      ↓ drive_file_id
Tampil grid ◄── thumbnail publik Drive ───────────┘
Simpan info ───────────► Supabase tabel gallery_media (metadata)
Hapus foto  ───────────► /api/gallery/delete ──► hapus file di Drive
                         + hapus baris Supabase
```

## Struktur file

```
src/features/gallery/
├── GallerySection.jsx        # halaman utama + tab
├── tabs/
│   ├── GalleryGrid.jsx       # grid + filter + preview
│   ├── GalleryUpload.jsx     # upload multi-file
│   ├── GalleryManage.jsx     # edit/hapus media
│   ├── GalleryCategories.jsx # CRUD kategori
│   └── GalleryWaAdmins.jsx   # kelola nomor WA admin
└── lib/
    ├── galleryApi.js         # query Supabase + panggil API Drive
    └── galleryUtils.js       # slug, label minggu, kompres gambar

api/gallery/
├── _lib.js      # helper Drive + verifikasi login
├── upload.js    # POST upload ke Drive
├── delete.js    # POST hapus dari Drive
├── wa.js        # STUB endpoint bot WA (fase berikutnya)
└── ENV.example.txt
```

## Setup (1x saja)

### 1. Database
Buka **Supabase Dashboard → SQL Editor**, jalankan isi file:
`supabase/migrations/007_gallery.sql`
(hanya membuat tabel `gallery_*`, tidak menyentuh tabel lain).

### 2. Google Service Account
1. Buka https://console.cloud.google.com → buat / pilih project.
2. **APIs & Services → Library** → aktifkan **Google Drive API**.
3. **APIs & Services → Credentials → Create Credentials → Service Account**.
4. Setelah dibuat, masuk ke service account → tab **Keys → Add Key → JSON**.
   Unduh file JSON-nya (simpan aman, JANGAN commit).
5. Catat `client_email` di JSON tersebut.

### 3. Folder Drive
1. Buat 1 folder di Google Drive (mis. "Galeri Ichikara").
2. **Share** folder itu ke `client_email` service account (akses **Editor**).
3. Salin **ID folder** dari URL: `drive.google.com/drive/folders/<ID>`.

### 4. Env vars di Vercel
Set 5 variabel sesuai `api/gallery/ENV.example.txt`:
`GDRIVE_CLIENT_EMAIL`, `GDRIVE_PRIVATE_KEY`, `GDRIVE_FOLDER_ID`,
`SUPABASE_URL`, `SUPABASE_ANON_KEY`. Lalu redeploy / `git push`.

### 5. Selesai
Buka portal → menu **Galeri** → tab **Upload** untuk mencoba.

## Fase berikutnya (Bot WhatsApp)
`api/gallery/wa.js` masih stub. Tabel `gallery_wa_admins` + UI pengelolaannya
sudah siap. Implementasi bot (terima foto via WA → masuk galeri) menyusul
di fase terpisah, kemungkinan terhubung dengan bot interpreter existing.
