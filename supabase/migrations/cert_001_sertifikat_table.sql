-- ============================================================
-- MIGRATION: Tabel Sertifikat
-- Database  : Supabase CERT (vhsgpfivjfulzglloecz) — BERBEDA dari DB absensi
-- Jalankan  : SQL Editor di dashboard Supabase akun vhsgpfivjfulzglloecz
-- ============================================================

-- 1. Tabel utama sertifikat
CREATE TABLE IF NOT EXISTS sertifikat (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nomor       text UNIQUE NOT NULL,          -- nomor sertifikat unik, misal ICH-2026-001
    nama_peserta text NOT NULL,
    ttl         text,                           -- tempat & tanggal lahir
    level       text,                           -- level bahasa Jepang (N5, N4, dst)
    lama        text,                           -- lama belajar, misal "3 Bulan"
    predikat    text,                           -- Baik / Amat Baik / dst
    lulus       text,                           -- 'LULUS' | 'TIDAK LULUS'
    tgl_selesai text,                           -- tanggal selesai kursus (YYYY-MM-DD atau teks)
    tgl_terbit  text,                           -- tanggal terbit sertifikat
    n1          text,                           -- nilai per kategori
    n2          text,
    n3          text,
    n4          text,
    n5          text,
    created_at  timestamptz NOT NULL DEFAULT now()
);

-- Index untuk pencarian cepat
CREATE INDEX IF NOT EXISTS sertifikat_nama_idx ON sertifikat (nama_peserta);
CREATE INDEX IF NOT EXISTS sertifikat_created_idx ON sertifikat (created_at DESC);

-- 2. Row Level Security (RLS)
ALTER TABLE sertifikat ENABLE ROW LEVEL SECURITY;

-- Baca publik (untuk validasi nomor sertifikat tanpa login)
CREATE POLICY "sertifikat_read_public"
    ON sertifikat FOR SELECT
    USING (true);

-- Tulis hanya oleh service role / anon (admin app memakai anon key)
CREATE POLICY "sertifikat_write_anon"
    ON sertifikat FOR ALL
    USING (true)
    WITH CHECK (true);

-- 3. Storage bucket untuk foto peserta (opsional, digunakan generator massal)
INSERT INTO storage.buckets (id, name, public)
VALUES ('sertifikat_photos', 'sertifikat_photos', false)
ON CONFLICT (id) DO NOTHING;

-- Policy storage: upload via anon key
CREATE POLICY "sertifikat_photos_upload"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'sertifikat_photos');

CREATE POLICY "sertifikat_photos_read"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'sertifikat_photos');

CREATE POLICY "sertifikat_photos_delete"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'sertifikat_photos');
