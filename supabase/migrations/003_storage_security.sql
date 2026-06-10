-- ============================================================
-- Migration 003: Storage foto user + pengetatan keamanan RLS
-- Jalankan di Supabase Dashboard → SQL Editor
-- ============================================================

-- ------------------------------------------------------------
-- A. STORAGE: bucket publik untuk foto user
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;

-- Foto bisa dilihat publik (dipakai di halaman scan tanpa login)
drop policy if exists "photos_public_read" on storage.objects;
create policy "photos_public_read" on storage.objects
  for select using (bucket_id = 'photos');

-- Upload/ubah/hapus foto hanya admin yang login
drop policy if exists "photos_auth_insert" on storage.objects;
create policy "photos_auth_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'photos');

drop policy if exists "photos_auth_update" on storage.objects;
create policy "photos_auth_update" on storage.objects
  for update to authenticated using (bucket_id = 'photos');

drop policy if exists "photos_auth_delete" on storage.objects;
create policy "photos_auth_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'photos');

-- ------------------------------------------------------------
-- B. PENGETATAN RLS
-- Sebelumnya: semua operasi diizinkan untuk anon (berbahaya —
-- anon key terlihat publik di bundle JS, siapa pun bisa hapus data).
-- Sekarang:
--   - Baca (select): publik — dibutuhkan halaman scan (lookup QR,
--     cek duplikat) yang berjalan tanpa login.
--   - Insert attendance: publik — kiosk scan mencatat absen tanpa login.
--   - Semua tulis/ubah/hapus lainnya: HANYA admin login (authenticated).
-- ------------------------------------------------------------

-- USERS
drop policy if exists "Allow all for anon" on users;
create policy "users_select_public" on users
  for select using (true);
create policy "users_insert_auth" on users
  for insert to authenticated with check (true);
create policy "users_update_auth" on users
  for update to authenticated using (true);
create policy "users_delete_auth" on users
  for delete to authenticated using (true);

-- CLASSES
drop policy if exists "Allow all for anon" on classes;
create policy "classes_select_public" on classes
  for select using (true);
create policy "classes_insert_auth" on classes
  for insert to authenticated with check (true);
create policy "classes_update_auth" on classes
  for update to authenticated using (true);
create policy "classes_delete_auth" on classes
  for delete to authenticated using (true);

-- ATTENDANCE
drop policy if exists "Allow all for anon" on attendance;
create policy "attendance_select_public" on attendance
  for select using (true);
-- Kiosk scan (tanpa login) hanya boleh insert method 'qr';
-- input manual butuh login admin.
create policy "attendance_insert_qr_public" on attendance
  for insert to anon with check (method = 'qr');
create policy "attendance_insert_auth" on attendance
  for insert to authenticated with check (true);
create policy "attendance_update_auth" on attendance
  for update to authenticated using (true);
create policy "attendance_delete_auth" on attendance
  for delete to authenticated using (true);

-- APP_SETTINGS
drop policy if exists "Allow all for anon" on app_settings;
create policy "app_settings_select_public" on app_settings
  for select using (true);
create policy "app_settings_write_auth" on app_settings
  for all to authenticated using (true) with check (true);
