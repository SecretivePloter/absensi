ALTER TABLE public.event_attendance 
ADD COLUMN IF NOT EXISTS status text DEFAULT 'hadir',
ADD COLUMN IF NOT EXISTS notes text DEFAULT NULL;

-- Untuk izin manual, check_in_at bisa bernilai NULL.
-- Constraint unique yang ada (event_participant_id, date) tetap berlaku.
