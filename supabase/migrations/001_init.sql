-- ============================================================
-- Sistem Absensi QR — Lembaga Kursus Bahasa Jepang
-- Migration 001: Initial schema
-- ============================================================

-- Tabel classes (harus dibuat duluan karena users mereferensikannya)
create table if not exists classes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  schedule text,
  created_at timestamptz default now()
);

-- Tabel users
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text not null check (role in ('student', 'employee')),
  class_id uuid references classes(id) on delete set null,
  qr_code text unique not null default gen_random_uuid()::text,
  photo_url text,
  phone text,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Tabel attendance
create table if not exists attendance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  check_in_at timestamptz default now(),
  date date default current_date,
  method text default 'qr' check (method in ('qr', 'manual')),
  notes text,
  created_at timestamptz default now()
);

-- Tabel app_settings (opsional, untuk konfigurasi aplikasi)
create table if not exists app_settings (
  key text primary key,
  value text
);

-- Indexes
create index if not exists attendance_user_id_idx on attendance(user_id);
create index if not exists attendance_date_idx on attendance(date);
create index if not exists users_qr_code_idx on users(qr_code);

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================

alter table classes enable row level security;
alter table users enable row level security;
alter table attendance enable row level security;
alter table app_settings enable row level security;

-- Policy MVP: izinkan semua operasi dari anon key
-- CATATAN: Perketat policy ini sebelum production!
-- Contoh: batasi write ke authenticated users saja

create policy "Allow all for anon" on classes for all using (true) with check (true);
create policy "Allow all for anon" on users for all using (true) with check (true);
create policy "Allow all for anon" on attendance for all using (true) with check (true);
create policy "Allow all for anon" on app_settings for all using (true) with check (true);
