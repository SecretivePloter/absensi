# CHANGELOG — Absensi QR Ichikara

Format: `[Tanggal] Versi / Sesi — Deskripsi`

---

## [2026-07-13] Sesi 4 — Redesain ID Card

### 🎨 Desain Baru ID Card (PT ICHIKARA)

#### Folder Prototype
- **Folder baru:** `prototype/`
  - `prototype/IDCardPrototype.html` — Preview standalone desain baru (buka langsung di browser)
  - `prototype/README.md` — Dokumentasi folder prototype

#### Implementasi ke Project Utama
- **File diubah:** `src/pages/IDCard.jsx`
  - Desain lama (2 sisi berdampingan landscape) diganti dengan desain baru portrait
  - **Desain baru:** Mengikuti template resmi PT ICHIKARA:
    - Background geometris SVG (rose `#f0b8c4` · biru muda `#a8d5e2` · abu-abu `#8a8fa8`) di pojok kanan atas dan kiri bawah
    - Header terpusat: logo PT ICHIKARA (atas) + teks **PT ICHIKARA** tebal (bawah)
    - Area foto kotak dengan rounded corner dan shadow
    - Garis pemisah navy `#1a1a6e`
    - Nama KAPITAL tebal → Jabatan KAPITAL biru → NIK (jika ada)
  - Ukuran kertas diperbarui: `85,6 × 135mm` portrait
  - Import `QRCodeLib` dihapus (tidak lagi digunakan)
  - Teks info tip diperbarui ke ukuran kertas baru

#### Implementasi Data NIK (Nomor Induk Karyawan)
- **Migration baru:** `supabase/migrations/012_add_user_nik.sql` — Menambahkan kolom `nik` (TEXT) ke tabel `users`.
- **File diubah:** `src/pages/Users.jsx`
  - Field input **NIK** ditambahkan ke halaman manajemen pengguna (opsional).
  - Kolom `nik` disertakan dalam fetch, state form, load form edit, dan save ke Supabase.
- **File diubah:** `src/pages/IDCard.jsx`
  - Kolom `nik` ditambahkan ke dalam fetch data Supabase.
  - Kartu otomatis menampilkan baris `NIK: xxxx-xxxx` di bawah Jabatan jika user memiliki NIK.

#### Perbaikan Filter Kategori "Murid" di Dashboard
- **Migration baru:** `supabase/migrations/013_fix_murid_roles.sql` — Mengubah kolom `is_staff` menjadi `false` untuk semua role kustom yang mengandung nama "murid", "student", atau "siswa" (misalnya "Murid TG").
- **File diubah:** `src/store/useRolesStore.js`
  - Logika pembuatan role baru (`addRole`) kini otomatis mengatur tipe `is_staff: false` jika nama role memuat unsur murid/student/siswa.
- **File diubah:** `src/pages/Dashboard.jsx`
  - Data custom role (seperti "Murid TG") kini dikeluarkan dari perhitungan & summary grup "Staff & Sensei".
  - Tab independen baru (contoh: "Murid TG") akan otomatis muncul di rentetan tab filter Dashboard, memisahkan data absensinya secara spesifik.

---



### 🐛 Bug Fix

#### Early Checkout Reason Gagal Tersimpan
- **Masalah:** Saat karyawan scan pulang sebelum jam 17:00 lalu memilih alasan (Izin/Sakit/Dinas Keluar/Lainnya), record gagal tersimpan ke database.
- **Penyebab:** Migration `005_early_checkout_roles.sql` menggunakan sintaks `ADD COLUMN IF NOT EXISTS ... CHECK(...)` yang tidak membuat constraint jika kolom sudah ada.
- **File baru:** `supabase/migrations/011_fix_early_checkout.sql`
  - Migration idempotent (aman dijalankan berulang kali)
  - Pastikan kolom `early_checkout_reason` ada di tabel `attendance`
  - Drop & re-create constraint dengan nama eksplisit `attendance_early_checkout_reason_check`
  - Nilai yang diizinkan: `izin`, `sakit`, `dinas_keluar`, `others`
- **File diubah:** `src/pages/Scan.jsx`
  - Error message di `handleReasonSelect` sekarang menampilkan pesan asli dari Supabase (bukan string generic), memudahkan debugging

> ⚠️ **WAJIB:** Jalankan `011_fix_early_checkout.sql` secara manual di Supabase SQL Editor sebelum atau setelah deploy.

---

#### Scanner QR Tidak Berfungsi di Laptop
- **Masalah:** Scanner berfungsi di HP Android tapi "bengong" di laptop.
- **Penyebab:** `QRScanner.jsx` mengirimkan constraint `{ facingMode: 'environment' }` langsung ke browser. Laptop tidak memiliki kamera belakang → browser melempar `OverconstrainedError` → scanner berhenti tanpa fallback.
- **File diubah:** `src/components/QRScanner.jsx` (ditulis ulang penuh)
  - **Multi-step camera fallback:**
    1. Enumerate semua kamera yang tersedia
    2. Pilih kamera terbaik berdasarkan label (back/environment untuk Android, front/user untuk laptop)
    3. Coba start dengan `facingMode` constraint (optimal di Android)
    4. Jika gagal → fallback ke camera ID spesifik (bekerja di laptop)
    5. Jika masih gagal → coba semua kamera satu per satu
  - Pesan error lebih deskriptif + tombol **"Coba Lagi"** untuk retry tanpa reload

---

### ✨ Fitur Baru

#### Halaman Rekap Absensi
- **File baru:** `src/pages/AttendanceRecap.jsx`
  - Filter tanggal (from–to) dengan shortcut: Hari Ini, Kemarin, 7 Hari, Bulan Ini
  - Filter tipe: Semua / Murid / Staff & Karyawan
  - Pencarian nama
  - Stat cards: Hadir, Izin, Sakit, Alpha, Pulang Awal
  - Tabel lengkap responsive (kolom tersembunyi di layar kecil)
  - Export ke Excel (gunakan fungsi `exportAttendanceToExcel` yang sudah ada)
- **File diubah:** `src/App.jsx`
  - Route baru: `/attendance/recap` (di dalam `AdminGuard`)
- **File diubah:** `src/components/Layout.jsx`
  - Nav item baru: **"Rekap Absen"** dengan icon `FileBarChart`
  - Diletakkan di antara "Absensi Manual" dan "ID Card"

---

#### Auto-Fill Jam Template di Dialog Edit Jam
- **File diubah:** `src/components/AttendanceTable.jsx`
- **File diubah:** `src/pages/UserDetail.jsx`
  - Tombol **"Isi Jam Template (08:00 - 17:00)"** ditambahkan di atas grid input jam masuk/pulang pada dialog edit jam
  - Klik tombol → jam masuk otomatis terisi `08:00`, jam pulang `17:00`
  - Berguna saat karyawan lupa absen pulang, admin bisa isi cepat

---

#### Cetak ID Card Satu Lembar (Side-by-Side)
- **File diubah:** `src/pages/IDCard.jsx`
  - `@page size` diubah dari `55mm × 87mm` (portrait, 1 kartu per halaman) → `118mm × 91mm` (landscape, 2 kartu)
  - Ditambah wrapper `.page { display: flex; flex-direction: row; gap: 4mm }`
  - `page-break-after: always` dihapus dari elemen `.card`
  - Sisi depan (foto + nama) dan belakang (QR code) kini tampil **berdampingan** dalam satu halaman

---

### 🎨 UI / Teks

#### Hapus Semua Tanda Emdash (—) dari UI
Karakter `—` (emdash) diganti dengan `-` atau `:` di seluruh antarmuka.

| File | Contoh perubahan |
|------|-----------------|
| `src/pages/Dashboard.jsx` | `Sudah Hadir — Semua` → `Sudah Hadir: Semua` |
| `src/pages/Dashboard.jsx` | `Murid — N5` → `Murid - N5` |
| `src/pages/UserDetail.jsx` | `Kalender Kehadiran — Juli` → `Kalender Kehadiran: Juli` |
| `src/pages/UserDetail.jsx` | `QR Code — Nama` → `QR Code: Nama` |
| `src/components/AttendanceTable.jsx` | placeholder `—` → `-` di sel kosong |
| `src/pages/Scan.jsx` | `nama — Akun nonaktif` → `nama - Akun nonaktif` |
| `src/pages/Users.jsx` | `QR Code — Nama` → `QR Code: Nama` |
| `src/pages/ManualAttendance.jsx` | deskripsi halaman, toast sukses, label kelas |
| `src/pages/IDCard.jsx` | `<title>ID Card — Nama</title>` → `-` |
| `src/utils/exportExcel.js` | judul sheet Excel |
| `src/pages/Settings.jsx` | preview kode role |
| `src/features/gallery/GallerySection.jsx` | subtitle halaman Galeri |

---

## [2026-07-06 s.d. 07-07] Sesi 2 — Scanner & Role System

### ✨ Fitur

#### Flip Kamera (Android)
- `src/pages/Scan.jsx` — state `facingMode` + fungsi `toggleCamera()`
- `src/components/QRScanner.jsx` — menerima prop `facingMode`, restart scanner saat prop berubah
- Tombol `SwitchCamera` ditambahkan di UI scanner

#### Role-Based Access Control (Admin vs Operator)
- **Migration baru:** `supabase/migrations/010_admin_roles.sql`
  - Tabel `admin_roles(auth_user_id, role, created_at)`
  - Role: `admin` (CRUD penuh) | `operator` (read-only dashboard + scan)
  - User yang tidak ada di tabel → otomatis dianggap `admin` (backward compatible)
- **File baru/diubah:** `src/store/useAuthStore.js` — fetch `adminRole` saat login
- **File diubah:** `src/App.jsx` — guard `AdminGuard` memblokir operator dari halaman admin
- **File diubah:** `src/components/Layout.jsx` — filter nav item berdasarkan `adminRole`, badge Operator/Admin di sidebar

---

## [2026-07-06] Sesi 1 — Analisis Codebase

- Analisis menyeluruh seluruh codebase: `src/`, `supabase/migrations/`, `CLAUDE.md`
- Dokumentasi awal: stack teknologi, skema database, alur scan, RLS policy

---

## Catatan Teknis Penting

### Database (Supabase)
- Project ref: `pfvlxlfykdabrwijqqxa`
- RLS: semua tabel memakai policy `Allow all for anon` (MVP) — perketat sebelum production skala besar
- Migration harus dijalankan manual di SQL Editor (tidak ada CI migration runner)

### Urutan Migration
| File | Isi |
|------|-----|
| `001_init.sql` | Schema awal: `users`, `attendance`, `classes`, `app_settings`, RLS |
| `002_*.sql` | Lokasi / locations |
| `003_*.sql` | Photo URL pada users |
| `004_*.sql` | Check-out (kolom `check_out_at`) |
| `005_early_checkout_roles.sql` | Kolom `early_checkout_reason` (ada bug constraint — lihat 011) |
| `006_*.sql` - `009_*.sql` | Absence reason, hari libur, custom roles, dll |
| `010_admin_roles.sql` | Tabel `admin_roles` (Admin vs Operator) |
| `011_fix_early_checkout.sql` | **Fix constraint `early_checkout_reason`** — WAJIB dijalankan |

### Struktur Kunci
```
src/
├── pages/
│   ├── Scan.jsx            # Kiosk scan QR (publik, no auth)
│   ├── Dashboard.jsx       # Dashboard utama admin
│   ├── Users.jsx           # Manajemen pengguna
│   ├── UserDetail.jsx      # Detail + riwayat absensi per user
│   ├── ManualAttendance.jsx
│   ├── IDCard.jsx          # Generate + cetak ID Card (side-by-side)
│   ├── AttendanceRecap.jsx # [BARU] Rekap absensi dengan filter
│   ├── Settings.jsx
│   └── IDCard.jsx
├── components/
│   ├── QRScanner.jsx       # [DIPERBARUI] Multi-device camera fallback
│   ├── AttendanceTable.jsx # Tabel absensi bersama (reusable)
│   └── Layout.jsx
├── store/
│   ├── useAuthStore.js     # Auth + adminRole
│   └── useRolesStore.js    # Custom role labels
└── utils/
    └── exportExcel.js      # Export absensi & users ke XLSX
```

### Environment Variables (`.env.local`)
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

### Deploy
```bash
# Vercel auto-deploy via:
git push origin main
```
