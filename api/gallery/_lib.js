// ============================================================
// Helper bersama untuk Vercel Serverless Functions modul galeri.
// Menyimpan kredensial Google Drive (Service Account) secara AMAN
// di server — TIDAK PERNAH terekspos ke browser.
// ============================================================
import { google } from 'googleapis'

/**
 * Membuat klien Google Drive memakai Service Account dari env var.
 * Env var yang dibutuhkan (set di Vercel -> Project -> Settings -> Environment Variables):
 *   - GDRIVE_CLIENT_EMAIL : email service account
 *   - GDRIVE_PRIVATE_KEY  : private key (boleh ber-\n literal, akan dinormalisasi)
 *   - GDRIVE_FOLDER_ID    : id folder Drive tujuan upload
 */
export function getDrive() {
  const email = process.env.GDRIVE_CLIENT_EMAIL
  const key = (process.env.GDRIVE_PRIVATE_KEY || '').replace(/\\n/g, '\n')
  if (!email || !key) {
    throw new Error('Kredensial Google Drive belum diset (GDRIVE_CLIENT_EMAIL / GDRIVE_PRIVATE_KEY).')
  }
  const auth = new google.auth.JWT({
    email,
    key,
    scopes: ['https://www.googleapis.com/auth/drive'],
  })
  return google.drive({ version: 'v3', auth })
}

/**
 * Verifikasi bahwa pemanggil adalah user portal yang sudah login (Supabase Auth).
 * Frontend mengirim access_token di header Authorization: Bearer <token>.
 * Mengembalikan objek user bila valid, atau null bila tidak.
 *
 * Env var: SUPABASE_URL, SUPABASE_ANON_KEY (anon key bersifat publik, aman di server).
 */
export async function verifyUser(req) {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization || ''
    const token = authHeader.replace(/^Bearer\s+/i, '').trim()
    if (!token) return null

    const url = process.env.SUPABASE_URL
    const anon = process.env.SUPABASE_ANON_KEY
    if (!url || !anon) {
      // Bila env auth belum diset, tolak demi keamanan.
      return null
    }

    const resp = await fetch(`${url}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: anon },
    })
    if (!resp.ok) return null
    return await resp.json()
  } catch {
    return null
  }
}

/** Membaca body JSON dari request (Vercel sudah parse otomatis, ini fallback). */
export async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body
  return await new Promise((resolve) => {
    let data = ''
    req.on('data', (c) => { data += c })
    req.on('end', () => {
      try { resolve(JSON.parse(data || '{}')) } catch { resolve({}) }
    })
  })
}
