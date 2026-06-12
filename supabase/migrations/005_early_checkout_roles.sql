-- Migration 005: early_checkout_reason + role tambahan (staff, sensei)

-- 1. Tambah kolom early_checkout_reason ke tabel attendance
ALTER TABLE attendance
ADD COLUMN IF NOT EXISTS early_checkout_reason TEXT
CHECK (early_checkout_reason IN ('izin', 'sakit', 'dinas_keluar', 'others'));

-- 2. Perluas constraint role di tabel users (tambah staff & sensei, pertahankan student & employee)
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
CHECK (role IN ('student', 'employee', 'staff', 'sensei'));
