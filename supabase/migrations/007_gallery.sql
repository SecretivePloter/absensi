-- ============================================================
-- Migration 007: Modul GALERI ICHIKARA (TERISOLASI PENUH)
-- ============================================================
-- Modul ini HANYA menambah tabel baru berprefix gallery_.
-- TIDAK ADA perintah ALTER / DROP / DELETE / UPDATE ke tabel
-- existing (users, classes, attendance, locations, app_settings).
-- File foto disimpan di Google Drive — Supabase hanya menyimpan
-- metadata kecil (teks). Aman dijalankan di SQL Editor.
--
-- Cara pakai: copy-paste seluruh isi file ini ke
-- Supabase Dashboard -> SQL Editor -> Run.
-- ============================================================

-- ---------- 1. Kategori galeri ----------
create table if not exists gallery_categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text not null unique,
  created_at timestamptz default now()
);

-- ---------- 2. Media galeri (metadata, file fisik di Drive) ----------
create table if not exists gallery_media (
  id              uuid primary key default gen_random_uuid(),
  drive_file_id   text not null,                       -- id file di Google Drive
  drive_thumb_url text,                                -- url thumbnail publik Drive
  file_name       text,
  mime_type       text,
  category_id     uuid references gallery_categories(id) on delete set null,
  caption         text,
  taken_at        date,                                -- tanggal foto diambil
  week_label      text,                                -- contoh: "2026-W27"
  uploaded_by     uuid,                                -- id user dari auth.users (tanpa FK, demi isolasi)
  source          text not null default 'web' check (source in ('web','wa')),
  created_at      timestamptz default now()
);

create index if not exists idx_gallery_media_category on gallery_media(category_id);
create index if not exists idx_gallery_media_taken_at on gallery_media(taken_at);
create index if not exists idx_gallery_media_week      on gallery_media(week_label);

-- ---------- 3. Admin WhatsApp (untuk fase bot WA nanti) ----------
create table if not exists gallery_wa_admins (
  id             uuid primary key default gen_random_uuid(),
  phone          text not null unique,                 -- format 62xxx
  name           text,
  is_super_admin boolean default false,
  created_at     timestamptz default now()
);

-- ---------- 4. Row Level Security (hanya untuk tabel gallery_*) ----------
alter table gallery_categories enable row level security;
alter table gallery_media      enable row level security;
alter table gallery_wa_admins  enable row level security;

-- Baca: publik (metadata saja, ditampilkan di portal yang sudah login)
create policy "gallery_categories_select" on gallery_categories for select using (true);
create policy "gallery_media_select"      on gallery_media      for select using (true);
create policy "gallery_wa_admins_select"  on gallery_wa_admins  for select using (true);

-- Tulis (insert/update/delete): hanya user terautentikasi (admin yang login)
create policy "gallery_categories_write" on gallery_categories for all to authenticated using (true) with check (true);
create policy "gallery_media_write"      on gallery_media      for all to authenticated using (true) with check (true);
create policy "gallery_wa_admins_write"  on gallery_wa_admins  for all to authenticated using (true) with check (true);

-- ---------- 5. Seed nomor admin WA ----------
insert into gallery_wa_admins (phone, name, is_super_admin) values
  ('6281226725064', 'Admin Utama', true),
  ('6281318216260', 'Admin 2',     false)
on conflict (phone) do nothing;

-- ============================================================
-- SELESAI. Tidak ada tabel existing yang tersentuh.
-- ============================================================
