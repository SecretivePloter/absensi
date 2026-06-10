# Sistem Absensi QR — Lembaga Kursus Bahasa Jepang

Aplikasi web absensi berbasis QR code untuk lembaga kursus bahasa Jepang.

## Tech Stack

- **Frontend**: React 18 + Vite + Tailwind CSS
- **State**: Zustand
- **Backend/DB**: Supabase
- **QR Scanner**: html5-qrcode
- **QR Generator**: qrcode (npm)
- **Export Excel**: xlsx (SheetJS)
- **Chart**: Recharts
- **Routing**: React Router v6

## Setup Cepat

### 1. Install dependencies

```bash
npm install
```

### 2. Konfigurasi Supabase

Buat file `.env.local` di root project:

```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```

Dapatkan nilai ini dari Supabase Dashboard → Project Settings → API.

### 3. Setup Database

1. Buka **Supabase Dashboard** → **SQL Editor**
2. Copy-paste isi `supabase/migrations/001_init.sql` → **Run**
3. (Opsional) Copy-paste isi `supabase/seed.sql` untuk data contoh

### 4. Buat Admin User

Di Supabase Dashboard → **Authentication** → **Users** → **Add User**:
- Email: `admin@kursus.com`
- Password: (pilih sendiri)

### 5. Jalankan

```bash
npm run dev
```

Buka http://localhost:5173

---

## Halaman & Fitur

| Path | Deskripsi | Login? |
|------|-----------|--------|
| `/scan` | Scan QR kiosk — fullscreen, cocok di tablet | ❌ Publik |
| `/login` | Login admin | ❌ Publik |
| `/dashboard` | Rekap harian + grafik 7 hari + export Excel | ✅ |
| `/users` | CRUD murid & karyawan + generate QR | ✅ |
| `/users/:id` | Profil + kalender kehadiran + riwayat | ✅ |
| `/classes` | CRUD kelas | ✅ |
| `/attendance/manual` | Input absensi manual oleh admin | ✅ |

## Deploy ke Vercel / Netlify

1. Push ke GitHub
2. Connect repo di Vercel/Netlify
3. Set environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy otomatis pada setiap push

## Catatan Keamanan

RLS policy saat ini membolehkan semua operasi dari anon key (cocok untuk MVP).
Sebelum production, perketat policy di `supabase/migrations/001_init.sql`.

## Struktur Folder

```
src/
├── components/
│   ├── ui/              # Button, Card, Input, Dialog, Toast, dll
│   ├── QRScanner.jsx    # html5-qrcode wrapper
│   ├── QRCode.jsx       # Display + download + print QR
│   ├── AttendanceTable.jsx
│   ├── ExportButton.jsx
│   └── Layout.jsx       # Sidebar + mobile nav
├── pages/
│   ├── Login.jsx
│   ├── Scan.jsx         # Halaman kiosk fullscreen
│   ├── Dashboard.jsx
│   ├── Users.jsx
│   ├── UserDetail.jsx
│   ├── Classes.jsx
│   └── ManualAttendance.jsx
├── store/
│   ├── useAuthStore.js  # Supabase Auth via Zustand
│   └── useThemeStore.js # Dark/light mode
├── lib/
│   └── supabase.js      # Supabase client
└── utils/
    └── exportExcel.js   # SheetJS export helper
```
