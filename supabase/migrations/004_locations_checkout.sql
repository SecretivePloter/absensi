-- ============================================================
-- Migration 004: Lokasi scan + absen pulang (check-out)
-- Jalankan di Supabase Dashboard → SQL Editor
-- ============================================================

-- ------------------------------------------------------------
-- A. Tabel locations (kantor/cabang)
-- ------------------------------------------------------------
create table if not exists locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  created_at timestamptz default now()
);

alter table locations enable row level security;

create policy "locations_select_public" on locations
  for select using (true);
create policy "locations_insert_auth" on locations
  for insert to authenticated with check (true);
create policy "locations_update_auth" on locations
  for update to authenticated using (true);
create policy "locations_delete_auth" on locations
  for delete to authenticated using (true);

-- ------------------------------------------------------------
-- B. Kolom baru di attendance
-- ------------------------------------------------------------
alter table attendance add column if not exists check_out_at timestamptz;
alter table attendance add column if not exists location_id uuid references locations(id) on delete set null;

create index if not exists attendance_location_idx on attendance(location_id);

-- ------------------------------------------------------------
-- C. Keamanan check-out dari kiosk (tanpa login)
-- Kiosk perlu meng-UPDATE record untuk mengisi jam pulang.
-- Dibatasi level KOLOM: anon hanya boleh menulis check_out_at,
-- dan hanya pada record hari ini yang belum pulang.
-- ------------------------------------------------------------
revoke update on attendance from anon;
grant update (check_out_at) on attendance to anon;

drop policy if exists "attendance_checkout_anon" on attendance;
create policy "attendance_checkout_anon" on attendance
  for update to anon
  using (date = current_date and check_out_at is null)
  with check (true);

-- ------------------------------------------------------------
-- D. Contoh isi lokasi (ganti/atau tambah lewat halaman Lokasi di aplikasi)
-- ------------------------------------------------------------
-- insert into locations (name, address) values
--   ('Kantor Pusat', 'Jl. Contoh No. 1'),
--   ('Cabang 2', 'Jl. Contoh No. 2');
