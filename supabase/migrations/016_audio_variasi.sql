-- ============================================================
-- Migration 016: Variasi audio absen + Pustaka Audio
-- Jalankan di Supabase Dashboard → SQL Editor (akun pfvlxlfykdabrwijqqxa)
-- ============================================================
-- Menambahkan:
--   1. Storage bucket 'audio' — file mp3 diupload lewat Pengaturan → Audio.
--   2. Tabel audio_library — "pustaka" audio: upload sekali + label,
--      dipakai berulang lewat selector (per user, hari spesial, dll).
--   3. Kolom users.custom_audio_masuk_url & custom_audio_pulang_url —
--      pilihan audio pribadi per user (dari pustaka), untuk absen
--      masuk & pulang secara terpisah.
--   4. Tabel special_audio_days — audio khusus untuk tanggal tertentu,
--      berlaku untuk SEMUA user yang absen pada tanggal itu.
--   5. Default nilai app_settings.late_threshold_time (jam batas "telat",
--      hanya dipakai untuk menentukan bunyi audio, BUKAN penalti/laporan).
--
-- Tidak ada data attendance yang diubah/dihapus oleh migration ini.
-- ============================================================

-- ------------------------------------------------------------
-- A. STORAGE: bucket publik untuk file audio
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('audio', 'audio', true)
on conflict (id) do nothing;

drop policy if exists "audio_public_read" on storage.objects;
create policy "audio_public_read" on storage.objects
  for select using (bucket_id = 'audio');

drop policy if exists "audio_auth_insert" on storage.objects;
create policy "audio_auth_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'audio');

drop policy if exists "audio_auth_update" on storage.objects;
create policy "audio_auth_update" on storage.objects
  for update to authenticated using (bucket_id = 'audio');

drop policy if exists "audio_auth_delete" on storage.objects;
create policy "audio_auth_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'audio');

-- ------------------------------------------------------------
-- B. Pustaka Audio — upload sekali di Pengaturan, dipilih berulang
--    lewat selector (kategori menentukan di mana ia muncul sebagai pilihan).
-- ------------------------------------------------------------
create table if not exists audio_library (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  audio_url text not null,
  category text not null check (category in ('masuk', 'pulang', 'telat', 'event')),
  created_at timestamptz default now()
);

alter table audio_library enable row level security;

-- Dibaca publik: dipakai halaman /scan tanpa login untuk pilih audio acak.
drop policy if exists "audio_library_select_public" on audio_library;
create policy "audio_library_select_public" on audio_library
  for select using (true);

drop policy if exists "audio_library_write_auth" on audio_library;
create policy "audio_library_write_auth" on audio_library
  for all to authenticated using (true) with check (true);

-- ------------------------------------------------------------
-- C. Audio pribadi per user (dipilih dari pustaka, masuk & pulang terpisah)
-- ------------------------------------------------------------
alter table users add column if not exists custom_audio_masuk_url text;
alter table users add column if not exists custom_audio_pulang_url text;

-- ------------------------------------------------------------
-- D. Audio hari spesial (event tertentu, dipilih dari pustaka)
-- ------------------------------------------------------------
create table if not exists special_audio_days (
  id uuid primary key default gen_random_uuid(),
  event_date date not null unique,
  audio_url text not null,
  label text,
  created_at timestamptz default now()
);

alter table special_audio_days enable row level security;

-- Dibaca publik: dipakai halaman /scan tanpa login untuk cek audio hari ini.
drop policy if exists "special_audio_days_select_public" on special_audio_days;
create policy "special_audio_days_select_public" on special_audio_days
  for select using (true);

-- Tulis hanya admin yang login.
drop policy if exists "special_audio_days_write_auth" on special_audio_days;
create policy "special_audio_days_write_auth" on special_audio_days
  for all to authenticated using (true) with check (true);

-- ------------------------------------------------------------
-- E. Threshold "telat" (hanya untuk pilih audio, bukan absensi/laporan)
-- ------------------------------------------------------------
insert into app_settings (key, value)
values ('late_threshold_time', '08:00')
on conflict (key) do nothing;
