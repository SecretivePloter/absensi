-- ============================================================
-- Migration 017: Sederhanakan kategori Pustaka Audio + hapus fitur telat
-- Jalankan di Supabase Dashboard → SQL Editor (akun pfvlxlfykdabrwijqqxa)
-- ============================================================
-- Sebelumnya (migration 016) kategori audio_library: masuk, pulang, telat, event.
-- Sekarang disederhanakan jadi 3: default, event, custom.
--   - 'default'  → dipakai untuk variasi acak di kiosk scan. Punya kolom
--                  tambahan `direction` ('masuk'/'pulang') supaya random-nya
--                  tetap kontekstual per arah.
--   - 'event'    → dipakai di Audio Hari Spesial (tidak berubah).
--   - 'custom'   → dipakai untuk audio pribadi per user (profil user).
-- Kategori & label boleh diubah kapan saja lewat tombol Edit di pustaka
-- (tidak terkunci sejak upload).
--
-- Fitur "Audio Telat" DIHAPUS sesuai keputusan produk — absen telat sekarang
-- ikut audio default/acak biasa. Data track lama kategori 'telat' TIDAK
-- dihapus, hanya dipindah ke kategori 'custom' supaya file tidak hilang.
--
-- Tidak ada data attendance yang diubah/dihapus oleh migration ini.
-- ============================================================

-- ------------------------------------------------------------
-- A. Lepas constraint lama dulu supaya data lama bisa dipindah kategorinya.
-- ------------------------------------------------------------
alter table audio_library drop constraint if exists audio_library_category_check;

-- ------------------------------------------------------------
-- B. Kolom arah (hanya relevan untuk category = 'default').
-- ------------------------------------------------------------
alter table audio_library add column if not exists direction text check (direction in ('masuk', 'pulang'));

-- ------------------------------------------------------------
-- C. Migrasi data lama ke skema baru.
-- ------------------------------------------------------------
update audio_library set direction = 'masuk' where category = 'masuk';
update audio_library set direction = 'pulang' where category = 'pulang';
update audio_library set category = 'default' where category in ('masuk', 'pulang');
update audio_library set category = 'custom' where category = 'telat';
-- category = 'event' dibiarkan apa adanya.

-- ------------------------------------------------------------
-- D. Pasang constraint baru.
-- ------------------------------------------------------------
alter table audio_library add constraint audio_library_category_check
  check (category in ('default', 'event', 'custom'));

alter table audio_library drop constraint if exists audio_library_direction_for_default;
alter table audio_library add constraint audio_library_direction_for_default
  check (category <> 'default' or direction in ('masuk', 'pulang'));

-- ------------------------------------------------------------
-- E. Bersihkan pengaturan jam telat yang sudah tidak dipakai.
-- ------------------------------------------------------------
delete from app_settings where key = 'late_threshold_time';
