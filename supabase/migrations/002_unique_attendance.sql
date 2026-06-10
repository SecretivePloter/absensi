-- ============================================================
-- Migration 002: Cegah double-absen di level database
-- Jalankan di Supabase Dashboard → SQL Editor
--
-- 1. Hapus baris duplikat (user sama, tanggal sama) — sisakan yang paling awal
-- 2. Tambah unique index supaya tidak bisa terjadi lagi, bahkan kalau ada
--    bug di aplikasi atau scan dari 2 perangkat sekaligus.
-- ============================================================

-- 1. Bersihkan duplikat, simpan check-in paling awal per (user_id, date)
delete from attendance a
using attendance b
where a.user_id = b.user_id
  and a.date = b.date
  and a.check_in_at > b.check_in_at;

-- (jika check_in_at sama persis, simpan id terkecil)
delete from attendance a
using attendance b
where a.user_id = b.user_id
  and a.date = b.date
  and a.check_in_at = b.check_in_at
  and a.id > b.id;

-- 2. Unique constraint: satu user hanya boleh 1 absen per tanggal
create unique index if not exists attendance_user_date_unique
  on attendance(user_id, date);
