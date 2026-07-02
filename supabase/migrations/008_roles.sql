-- ============================================================
-- 008_roles.sql — Tabel role dinamis (agar admin bisa menambah posisi/role baru)
--
-- AMAN untuk data existing:
--   - TIDAK menyentuh tabel `users` sama sekali (kolom users.role tetap teks bebas,
--     tanpa foreign key). Menambah/menghapus baris di sini tidak mengubah user mana pun.
--   - Hanya CREATE TABLE baru + seed role bawaan. NOL ALTER/DROP ke tabel lain.
--
-- Jalankan manual di Supabase SQL Editor akun pfvlxlfykdabrwijqqxa.
-- ============================================================

create table if not exists public.roles (
  id          uuid primary key default gen_random_uuid(),
  value       text unique not null,          -- disimpan di users.role (mis. 'manager')
  label       text not null,                 -- tampilan (mis. 'Manager')
  is_staff    boolean not null default true, -- true = dihitung sebagai staff/karyawan
  sort_order  int not null default 100,
  created_at  timestamptz default now()
);

alter table public.roles enable row level security;

-- Baca publik: kiosk scan berjalan anonim namun perlu menampilkan label role.
drop policy if exists "roles_select_public" on public.roles;
create policy "roles_select_public" on public.roles
  for select using (true);

-- Tulis (tambah/ubah/hapus) hanya untuk admin yang sudah login.
drop policy if exists "roles_write_authenticated" on public.roles;
create policy "roles_write_authenticated" on public.roles
  for all to authenticated using (true) with check (true);

-- Seed role bawaan yang sudah dipakai aplikasi (idempotent).
insert into public.roles (value, label, is_staff, sort_order) values
  ('student',        'Murid',            false, 1),
  ('staff',          'Staff',            true,  2),
  ('sensei',         'Sensei',           true,  3),
  ('asisten_sensei', 'Asisten Sensei',   true,  4),
  ('employee',       'Karyawan (lama)',  true,  5)
on conflict (value) do nothing;
