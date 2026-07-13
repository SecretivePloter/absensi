-- Perbaiki tipe role custom yang mengandung kata murid atau student
-- Agar tidak lagi dianggap sebagai staff, sehingga Dashboard memfilternya dengan benar.
UPDATE roles 
SET is_staff = false 
WHERE value ILIKE '%murid%' 
   OR value ILIKE '%student%' 
   OR value ILIKE '%siswa%';
