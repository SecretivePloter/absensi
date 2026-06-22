-- Migration 006: absence_reason untuk absensi tanpa hadir fisik
ALTER TABLE attendance
ADD COLUMN IF NOT EXISTS absence_reason TEXT
CHECK (absence_reason IN ('izin', 'sakit'));
