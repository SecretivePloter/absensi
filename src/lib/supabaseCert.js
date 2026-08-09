import { createClient } from '@supabase/supabase-js'

// Supabase khusus untuk sistem sertifikat — BERBEDA dari database absensi
const certUrl = import.meta.env.VITE_CERT_SUPABASE_URL || 'https://vhsgpfivjfulzglloecz.supabase.co'
const certKey = import.meta.env.VITE_CERT_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZoc2dwZml2amZ1bHpnbGxvZWN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NTAzMjIsImV4cCI6MjA5NjEyNjMyMn0.7QuSci1Ifs5SZl56jfIKjKpQ1ZBipvDkDoNWV7n5rfA'

export const supabaseCert = createClient(certUrl, certKey)
