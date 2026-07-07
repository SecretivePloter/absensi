# CLAUDE.md — Panduan Pengembangan Sistem Absensi QR

Panduan internal untuk pengembangan lebih lanjut aplikasi absensi QR Ichikara.
Baca ini sebelum mengubah kode. Untuk setup dasar lihat [README.md](README.md).

---

## 1. Ringkasan Proyek

Aplikasi web absensi berbasis QR code untuk **Ichikara** (lembaga kursus bahasa Jepang).
Mengelola kehadiran **murid** dan **staff/karyawan/sensei**.

- **Status**: LIVE PRODUCTION ✅
- **Live URL**: https://portal.ichikara.co.id (custom domain)
- **Vercel**: https://absensi-qr-blond.vercel.app (project `absensi-qr`, team `secretiveploters-projects`)
- **GitHub**: https://github.com/SecretivePloter/absensi (branch `main`, akun git `SecretivePloter`)
- **Deploy**: otomatis tiap `git push origin main` → Vercel build & deploy (~1-2 menit)

### ⚠️ Keamanan & Kredensial
- Proyek ini memakai **akun Supabase TERPISAH** dari proyek Ichikara lain.
- Project ref Supabase: **`pfvlxlfykdabrwijqqxa`**
- **JANGAN hardcode credentials.** Semua di `.env.local` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
- Auth key pakai format publishable baru `sb_publishable_...`.

---

## 2. Tech Stack

| Komponen | Teknologi | Catatan |
|----------|-----------|---------|
| Frontend | React 18 + Vite **5** | ⚠️ JANGAN upgrade Vite selama Node masih < v20.19 |
| Styling | Tailwind v3 + CSS variables | gaya shadcn (design tokens) |
| State | Zustand | `useAuthStore`, `useThemeStore` |
| Backend/DB | Supabase JS v2 | |
| QR Scan | html5-qrcode | |
| QR Gen | qrcode (npm) | |
| Excel | **xlsx-js-style** | BUKAN `xlsx` biasa (perlu styling) |
| Chart | Recharts | |
| Routing | React Router v6 | |

**Constraint penting**: Node.js lokal v20.12.2 → tidak kompatibel Vite 9. Tetap di Vite 5.

---

## 3. Skema Database

Tabel utama: `users`, `classes`, `attendance`, `locations`.

### Tabel `attendance` (paling sering disentuh)
Kolom penting:
- `id`, `user_id`, `date` (DATE, lokal)
- `check_in_at` (timestamptz, UTC) — bisa **null** untuk record izin/sakit
- `check_out_at` (timestamptz, UTC) — null jika belum pulang
- `location_id`, `method` ('qr' | 'manual')
- `notes` (catatan admin)
- `early_checkout_reason` (alasan pulang cepat)
- `absence_reason` (TEXT, CHECK IN ('izin','sakit'), nullable) — dari migration 006

### Migrasi (jalankan manual di Supabase SQL Editor akun `pfvlxlfykdabrwijqqxa`)
| File | Isi |
|------|-----|
| `001_init.sql` | 4 tabel awal |
| `002_unique_attendance.sql` | hapus duplikat + unique index (user_id, date) |
| `003_storage_security.sql` | bucket `photos` + RLS ketat |
| `004_locations_checkout.sql` | tabel locations + check_out_at + location_id |
| `005_early_checkout_roles.sql` | role + alasan pulang cepat |
| `006_absence_reason.sql` | kolom `absence_reason` (izin/sakit) ✅ sudah dijalankan |
| `006_asisten_sensei_role.sql` | role asisten_sensei |
| `007_gallery.sql` | tabel galeri |
| `008_roles.sql` | tabel roles dinamis |
| `009_drop_role_check.sql` | hapus check constraint role lama |
| `010_admin_roles.sql` | tabel admin_roles (admin vs operator) ⚠️ jalankan manual |

> ⚠️ **MCP Supabase yang terhubung mengarah ke akun LAMA** (`vhsgpfivjfulzglloecz`), BUKAN akun ini. Jadi semua migrasi **harus user jalankan manual** di dashboard Supabase akun baru.

### Role (user murid/staff)
`STAFF_ROLES = ['staff', 'sensei', 'asisten_sensei', 'employee']` — sisanya dianggap murid.

### Role Admin (user login — tabel `admin_roles`, migration 010)
- `admin` = akses penuh, semua CRUD (default jika tidak ada entry di tabel)
- `operator` = hanya bisa lihat Dashboard (read-only) + Scan QR
- **Backward compatible**: user lama tanpa entry di `admin_roles` → otomatis admin.
- Store: `useAuthStore.adminRole` ('admin' | 'operator'), di-fetch saat login.
- Guard: `AdminGuard` di `App.jsx` mencegah operator akses halaman admin-only.
- Layout: `Layout.jsx` menyaring `navItems` berdasarkan `adminRole`.
- Dashboard: tombol CRUD (hapus, edit jam, edit catatan, tandai izin/sakit) disembunyikan jika operator.

---

## 4. Halaman & Routing

| Path | Deskripsi | Login? |
|------|-----------|--------|
| `/scan` | Kiosk fullscreen scan QR (tablet) | ❌ Publik |
| `/login` | Login admin | ❌ Publik |
| `/dashboard` | Rekap harian + grafik 7 hari + export Excel | ✅ |
| `/users` | CRUD murid & karyawan + generate QR | ✅ |
| `/users/:id` | Profil + kalender + riwayat absensi | ✅ |
| `/classes` | CRUD kelas | ✅ |
| `/locations` | CRUD lokasi kiosk | ✅ |
| `/attendance/manual` | Input absensi manual | ✅ |

---

## 5. Cara Kerja Sistem Absensi (Scan Kiosk)

- Scan **1** = masuk (`check_in_at`).
- Scan **2** (jeda ≥ `CHECKOUT_MIN_GAP_MS` = 5 menit, di `Scan.jsx`) = pulang (`check_out_at`).
- Scan **3** = "sudah lengkap".
- Lokasi kiosk per perangkat disimpan di `localStorage` key `scan_location_id`.
- Halaman scan menampilkan greeting (Selamat Pagi/Siang/Sore/Malam) + nama depan, reset 2 detik.
- **Tombol flip kamera** (🔄 `SwitchCamera`) di header → toggle `facingMode` antara `'environment'` (belakang) dan `'user'` (depan).
- `QRScanner` component menerima prop `facingMode` — scanner restart otomatis saat mode berubah.
- **Keputusan produk user**: TIDAK pakai deteksi terlambat. Pakai absen pulang + kelola lokasi.

---

## 6. Fitur Edit Absensi oleh Admin (ditambahkan sesi terbaru)

### a. Edit jam masuk/pulang — pola 2 langkah konfirmasi
Tersedia di **dua tempat**:
- **Dashboard** ([src/pages/Dashboard.jsx](src/pages/Dashboard.jsx)) — via `AttendanceTable` prop `onUpdateTime`.
- **Profil user** ([src/pages/UserDetail.jsx](src/pages/UserDetail.jsx)) — tabel riwayat punya tombol jam (🕐) per baris.

Alur: klik 🕐 → **Dialog step 'edit'** (form `<input type="time">` Jam Masuk + Jam Pulang) → **Lanjut →** → **Dialog step 'confirm'** (ringkasan) → **Ya, Simpan** → update Supabase.

### b. Tandai Izin/Sakit
Dari modal Alpha di Dashboard, admin bisa set `absence_reason`.

### c. Edit catatan inline
`AttendanceTable` prop `onUpdateNote`.

### Helper konversi waktu (WAJIB konsisten — ada di AttendanceTable.jsx & UserDetail.jsx)
```js
// UTC ISO → "HH:mm" lokal untuk ditampilkan di <input type="time">
const toLocalTimeStr = (isoString) =>
  isoString ? format(new Date(isoString), 'HH:mm') : ''

// date "YYYY-MM-DD" + time "HH:mm" lokal → UTC ISO untuk disimpan
const buildISO = (dateStr, timeStr) => {
  if (!timeStr) return null
  const [h, m] = timeStr.split(':').map(Number)
  const [y, mo, d] = dateStr.split('-').map(Number)
  return new Date(y, mo - 1, d, h, m, 0).toISOString()
}
```
> Waktu disimpan di DB sebagai **UTC**, ditampilkan dalam zona lokal. Selalu lewat helper ini — jangan format manual.

### `AttendanceTable` — komponen bersama
Props opsional: `{ records, loading, selectable, onDeleteSelected, onUpdateNote, onUpdateTime }`.
Tombol/aksi hanya muncul jika prop handler-nya dikirim. Dipakai bersama Dashboard & UserDetail.

---

## 7. Gotcha Penting (WAJIB tahu sebelum ngoding)

1. **`select('*')` vs nama kolom eksplisit di Supabase**
   - `select('*')` **TIDAK error** kalau ada kolom yang belum dibuat — diam-diam mengembalikan kolom yang ada.
   - `select('user_id, absence_reason')` (nama eksplisit) **ERROR** kalau salah satu kolom belum ada.
   - **Pola defensif** (sudah dipakai di `fetchStats` & `openDetail` Dashboard): coba select dengan kolom baru, kalau `error` → retry tanpa kolom itu lalu map nilai null.
   ```js
   const { data, error } = await supabase.from('attendance')
     .select('user_id, check_in_at, absence_reason').eq('date', today).in('user_id', ids)
   if (error) { /* fallback: select tanpa absence_reason, map absence_reason: null */ }
   ```

2. **Null-check `check_in_at`** — record izin/sakit punya `check_in_at = null`. `new Date(null)` → invalid date / crash. Selalu cek dulu sebelum `format()`.

3. **Vercel env var Vite** — `VITE_*` di-inline saat **BUILD-time**. Flag `-e` pada `vercel deploy` hanya set runtime → bundle kosong → white screen. WAJIB `vercel env add VITE_... production` lalu redeploy. Verifikasi URL ter-inline di bundle JS.

4. **Stale closure di html5-qrcode** — callback dipanggil ~10x/detik. Guard via state React = stale closure → duplikat. FIX: pakai `useRef` (`lockRef`), start scanner SEKALI via `onScanRef`.

5. **Excel export** — pakai `xlsx-js-style`, bukan `xlsx`. `vite.config` manualChunks menyesuaikan.

---

## 8. Workflow Deploy

```bash
git add -A
git commit -m "..."
git push origin main          # ← Vercel auto-deploy ~1-2 menit
```
Setelah deploy, **hard refresh** browser (`Ctrl+Shift+R`) agar cache lama tidak menutupi versi baru.

> Catatan: agen Claude Code **tidak bisa push ke `main`** (diblokir classifier keamanan). Push harus dijalankan user secara manual di terminal.

---

## 9. Catatan Kekeliruan / Pelajaran (riwayat nyata)

Direkam agar tidak terulang:

1. **Mengira data hilang padahal hanya statistik salah hitung.**
   User panik "data tadi pagi tidak tersimpan" karena Dashboard menampilkan **0 Hadir** padahal data ada di tabel. Faktanya data aman — bug-nya: `fetchStats` select kolom `absence_reason` yang belum ada (migration 006 belum jalan) → query error → count 0. Tabel tetap benar karena pakai `select('*')`. **Pelajaran:** cek apakah statistik vs tabel pakai query berbeda sebelum menyimpulkan data rusak.

2. **Lupa menjalankan migration sebelum pakai fitur.**
   Fitur `absence_reason` di-deploy tapi migration 006 belum dijalankan di SQL Editor → crash diam-diam. **Pelajaran:** setiap fitur yang butuh kolom baru, jalankan migrasinya **dulu** di Supabase akun `pfvlxlfykdabrwijqqxa` sebelum mengandalkan fiturnya.

3. **Mengira fitur belum dibuat padahal hanya belum di-deploy.**
   User tanya "tombol jam ada di mana?" sambil melihat situs live — padahal kode fiturnya sudah selesai & di-commit, hanya **belum di-push**. Branch lokal 2 commit di depan `origin/main`. **Pelajaran:** kalau fitur "hilang" di situs live, cek dulu `git status` / `git log origin/main..HEAD` — kemungkinan besar belum push. Lalu hard refresh setelah deploy.

4. **Lupa push setelah commit.** Beberapa kali commit menumpuk lokal tanpa di-push, sehingga perubahan tidak muncul di production. **Pelajaran:** biasakan `git push origin main` segera setelah commit yang ingin di-deploy.
