-- ============================================================
-- Migration 011: Fix early_checkout_reason column & constraint
-- ============================================================
-- Migration 005 menggunakan sintaks ADD COLUMN IF NOT EXISTS ... CHECK (...)
-- yang bisa bermasalah (constraint tidak terbuat jika kolom sudah ada).
-- Migration ini memastikan kolom DAN constraint-nya benar.
-- AMAN dijalankan berulang kali (idempotent).
-- ============================================================

-- 1. Pastikan kolom early_checkout_reason ada
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'attendance' AND column_name = 'early_checkout_reason'
  ) THEN
    ALTER TABLE attendance ADD COLUMN early_checkout_reason TEXT;
  END IF;
END $$;

-- 2. Hapus constraint lama (jika ada) lalu buat ulang
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_early_checkout_reason_check;
ALTER TABLE attendance ADD CONSTRAINT attendance_early_checkout_reason_check
  CHECK (early_checkout_reason IN ('izin', 'sakit', 'dinas_keluar', 'others'));
