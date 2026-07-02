// ============================================================
// Helper bersama untuk Vercel Serverless Functions modul galeri.
// Menyimpan kredensial Google Drive (Service Account) secara AMAN
// di server — TIDAK PERNAH terekspos ke browser.
// ============================================================
import { google } from 'googleapis'

/**
 * Membuat klien Google Drive.
 *
 * Mendukung 2 mode auth (dipilih otomatis):
 *
 * 1) OAuth "atas nama user" (DIUTAMAKAN) — cocok untuk menyimpan ke Google Drive
 *    akun personal/Gmail (mis. mugenworklabs@gmail.com). File dimiliki akun user
 *    dan memakai KUOTA Drive-nya, sehingga tidak kena error
 *    "Service Accounts do not have storage quota".
 *    Env var:
 *      - GOOGLE_OAUTH_CLIENT_ID
 *      - GOOGLE_OAUTH_CLIENT_SECRET
 *      - GOOGLE_OAUTH_REFRESH_TOKEN  (dibuat sekali via scripts/get-drive-token.mjs)
 *      - GDRIVE_FOLDER_ID            (folder tujuan, dibuat oleh script itu)
 *
 * 2) Service Account (fallback) — hanya cocok bila folder tujuan berada di
 *    Shared Drive (Workspace), karena service account tak punya kuota di My Drive.
 *    Env var:
 *      - GDRIVE_CLIENT_EMAIL
 *      - GDRIVE_PRIVATE_KEY
 *      - GDRIVE_FOLDER_ID
 */
export function getDrive() {
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN
  if (refreshToken) {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET
    if (!clientId || !clientSecret) {
      throw new Error('OAuth Google belum lengkap (GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET).')
    }
    const oauth2 = new google.auth.OAuth2(clientId, clientSecret)
    oauth2.setCredentials({ refresh_token: refreshToken })
    return google.drive({ version: 'v3', auth: oauth2 })
  }

  // Fallback: Service Account (hanya untuk Shared Drive).
  const email = process.env.GDRIVE_CLIENT_EMAIL
  const key = (process.env.GDRIVE_PRIVATE_KEY || '').replace(/\\n/g, '\n')
  if (!email || !key) {
    throw new Error('Kredensial Google Drive belum diset (OAuth atau Service Account).')
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
