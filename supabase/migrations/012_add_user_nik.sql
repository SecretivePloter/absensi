-- Add NIK (Nomor Induk Karyawan) column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS nik TEXT;
