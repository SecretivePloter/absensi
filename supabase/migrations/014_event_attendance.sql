-- ============================================================
-- 014_event_attendance.sql — Schema untuk Absensi Event Belajar Malam
--
-- FITUR BARU: Tabel terpisah total agar tidak mengganggu absensi regular
-- ============================================================

create table if not exists public.events (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,                 -- misal: "Belajar Malam Q3", "Tryout 5" 
  start_date  date,                          -- tanggal mulai (opsional)
  end_date    date,                          -- tanggal akhir (opsional) 
  is_active   boolean not null default true, -- admin bisa matikan event yang sudah selesai
  created_at  timestamptz default now()
);

-- Menyimpan pendaftaran user di sebuah event (opsi A: relasi ke profil users)
create table if not exists public.event_participants (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.events(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete cascade,
  created_at  timestamptz default now(),
  unique(event_id, user_id) -- cegah user daftar 2x di event yang sama
);

-- Menyimpan detik check-in khusus untuk peserta event
create table if not exists public.event_attendance (
  id                    uuid primary key default gen_random_uuid(),
  event_participant_id  uuid not null references public.event_participants(id) on delete cascade,
  date                  date not null default current_date,
  check_in_at           timestamptz default now(),
  notes                 text,
  created_at            timestamptz default now(),
  unique(event_participant_id, date) -- batas 1x hadir per hari (bisa diubah nanti)
);

-- Enable RLS
alter table public.events enable row level security;
alter table public.event_participants enable row level security;
alter table public.event_attendance enable row level security;

-- Policy (MVP: all anon - sama seperti schema inti. Sesuaikan di production)
create policy "Allow all for anon on events" 
  on public.events for all using (true) with check (true);

create policy "Allow all for anon on event_participants" 
  on public.event_participants for all using (true) with check (true);

create policy "Allow all for anon on event_attendance" 
  on public.event_attendance for all using (true) with check (true);
