-- ============================================================
-- Seed data untuk testing
-- Jalankan SETELAH migration 001_init.sql
-- ============================================================

-- Bersihkan data lama (opsional)
-- truncate attendance, users, classes cascade;

-- Kelas
insert into classes (id, name, description, schedule) values
  ('11111111-0000-0000-0000-000000000001', 'N5 Pemula', 'Kelas dasar untuk pemula mutlak', 'Senin & Rabu, 09:00 - 11:00'),
  ('11111111-0000-0000-0000-000000000002', 'N4 Dasar', 'Pengenalan tata bahasa dasar', 'Selasa & Kamis, 13:00 - 15:00'),
  ('11111111-0000-0000-0000-000000000003', 'N3 Menengah', 'Kelas menengah untuk yang sudah N4', 'Sabtu, 09:00 - 12:00')
on conflict (id) do nothing;

-- Users (5 murid + 2 karyawan)
insert into users (id, name, role, class_id, qr_code, phone, is_active) values
  (
    '22222222-0000-0000-0000-000000000001',
    'Siti Rahayu',
    'student',
    '11111111-0000-0000-0000-000000000001',
    'QR-SITI-RAHAYU-001',
    '081234567890',
    true
  ),
  (
    '22222222-0000-0000-0000-000000000002',
    'Budi Santoso',
    'student',
    '11111111-0000-0000-0000-000000000001',
    'QR-BUDI-SANTOSO-002',
    '081234567891',
    true
  ),
  (
    '22222222-0000-0000-0000-000000000003',
    'Dewi Kusuma',
    'student',
    '11111111-0000-0000-0000-000000000002',
    'QR-DEWI-KUSUMA-003',
    '081234567892',
    true
  ),
  (
    '22222222-0000-0000-0000-000000000004',
    'Ahmad Fauzi',
    'student',
    '11111111-0000-0000-0000-000000000002',
    'QR-AHMAD-FAUZI-004',
    '081234567893',
    true
  ),
  (
    '22222222-0000-0000-0000-000000000005',
    'Putri Wijaya',
    'student',
    '11111111-0000-0000-0000-000000000003',
    'QR-PUTRI-WIJAYA-005',
    '081234567894',
    true
  ),
  (
    '22222222-0000-0000-0000-000000000006',
    'Sensei Tanaka',
    'employee',
    null,
    'QR-SENSEI-TANAKA-006',
    '081234567895',
    true
  ),
  (
    '22222222-0000-0000-0000-000000000007',
    'Admin Kantor',
    'employee',
    null,
    'QR-ADMIN-KANTOR-007',
    '081234567896',
    true
  )
on conflict (id) do nothing;

-- Contoh absensi (3 hari terakhir)
insert into attendance (user_id, date, check_in_at, method) values
  ('22222222-0000-0000-0000-000000000001', current_date, now() - interval '2 hours', 'qr'),
  ('22222222-0000-0000-0000-000000000002', current_date, now() - interval '1 hour 50 minutes', 'qr'),
  ('22222222-0000-0000-0000-000000000006', current_date, now() - interval '3 hours', 'qr'),
  ('22222222-0000-0000-0000-000000000001', current_date - 1, (current_date - 1)::timestamp + interval '8 hours 30 minutes', 'qr'),
  ('22222222-0000-0000-0000-000000000003', current_date - 1, (current_date - 1)::timestamp + interval '8 hours 45 minutes', 'manual'),
  ('22222222-0000-0000-0000-000000000006', current_date - 1, (current_date - 1)::timestamp + interval '8 hours', 'qr'),
  ('22222222-0000-0000-0000-000000000007', current_date - 1, (current_date - 1)::timestamp + interval '8 hours 15 minutes', 'qr'),
  ('22222222-0000-0000-0000-000000000002', current_date - 2, (current_date - 2)::timestamp + interval '9 hours', 'qr'),
  ('22222222-0000-0000-0000-000000000004', current_date - 2, (current_date - 2)::timestamp + interval '9 hours 10 minutes', 'qr'),
  ('22222222-0000-0000-0000-000000000005', current_date - 2, (current_date - 2)::timestamp + interval '9 hours 5 minutes', 'manual')
on conflict do nothing;
