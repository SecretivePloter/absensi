-- ============================================================
-- 009_drop_role_check.sql — Hapus CHECK constraint statis pada users.role
--
-- KENAPA: mulai migration 008, role bersifat DINAMIS (dikelola di tabel `roles`).
-- Constraint lama `users_role_check` (dibuat di 006) hanya mengizinkan daftar role
-- lama, sehingga menyimpan user dengan role baru (mis. 'hrd') GAGAL:
--   "new row for relation \"users\" violates check constraint \"users_role_check\""
--
-- AMAN: hanya MENGHAPUS batasan. Tidak mengubah/menghapus data user mana pun.
-- Validasi role kini di level aplikasi (dropdown hanya menampilkan role dari tabel
-- `roles`). users.role tetap kolom teks bebas (tanpa FK) sesuai desain.
--
-- Jalankan manual di Supabase SQL Editor akun pfvlxlfykdabrwijqqxa.
-- ============================================================

alter table public.users drop constraint if exists users_role_check;
