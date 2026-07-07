-- ============================================================
-- Migration 010: Admin roles (admin vs operator)
-- ============================================================
-- Tabel untuk membedakan level akses pengguna yang login (Supabase Auth).
-- • admin   → akses penuh (CRUD semua halaman)
-- • operator → hanya bisa melihat dashboard (read-only) + scan QR
--
-- CATATAN: user yang TIDAK ada di tabel ini otomatis dianggap admin
-- (backward compatible — semua user lama tetap admin tanpa perlu insert).
-- ============================================================

create table if not exists admin_roles (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'admin' check (role in ('admin', 'operator')),
  created_at timestamptz default now()
);

alter table admin_roles enable row level security;

-- Policy: semua authenticated user bisa baca; hanya admin yang bisa write
-- (untuk sementara allow all agar konsisten dengan policy MVP lainnya)
create policy "Allow all for admin_roles" on admin_roles
  for all using (true) with check (true);

-- Index untuk lookup cepat
create index if not exists admin_roles_role_idx on admin_roles(role);
