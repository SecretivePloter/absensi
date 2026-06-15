-- Migration 006: Tambah role asisten_sensei
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
CHECK (role IN ('student', 'employee', 'staff', 'sensei', 'asisten_sensei'));
