// ==================================================================
// Ambil GOOGLE_OAUTH_REFRESH_TOKEN untuk modul Galeri (sekali jalan).
// Sekaligus membuat folder "Galeri Ichikara" di Drive akun yang login,
// lalu mencetak GDRIVE_FOLDER_ID-nya.
//
// PRASYARAT:
//   1. Buat OAuth Client ID tipe "Desktop app" di Google Cloud Console
//      (project yang sama dengan service account, akun mugenworklabs@gmail.com).
//   2. Set OAuth consent screen ke "In production" + scope .../auth/drive.file.
//
// CARA JALAN (PowerShell, dari folder absensi-qr):
//   $env:OAUTH_CLIENT_ID="xxxx.apps.googleusercontent.com"
//   $env:OAUTH_CLIENT_SECRET="yyyy"
//   node scripts/get-drive-token.mjs
//
// Lalu buka URL yang tercetak di browser, LOGIN sebagai akun pemilik Drive
// (mis. mugenworklabs@gmail.com), izinkan akses. Token & folder id akan tercetak.
// ==================================================================
import http from 'http'
import { google } from 'googleapis'

const CLIENT_ID = process.env.OAUTH_CLIENT_ID
const CLIENT_SECRET = process.env.OAUTH_CLIENT_SECRET
if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('\n[GAGAL] Set dulu OAUTH_CLIENT_ID dan OAUTH_CLIENT_SECRET di environment.\n')
  process.exit(1)
}

const PORT = 53682
const REDIRECT = `http://localhost:${PORT}`
// drive.file = hanya file/folder yang dibuat aplikasi ini (scope non-sensitif,
// tak perlu verifikasi Google). Cukup untuk galeri.
const SCOPES = ['https://www.googleapis.com/auth/drive.file']

const oauth2 = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT)
const authUrl = oauth2.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: SCOPES,
})

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, REDIRECT)
    const code = url.searchParams.get('code')
    if (!code) { res.end('Menunggu otorisasi...'); return }

    res.end('Berhasil! Silakan kembali ke terminal. Tab ini boleh ditutup.')
    server.close()

    const { tokens } = await oauth2.getToken(code)
    oauth2.setCredentials(tokens)

    // Buat folder galeri di Drive akun yang login.
    const drive = google.drive({ version: 'v3', auth: oauth2 })
    const folder = await drive.files.create({
      requestBody: {
        name: 'Galeri Ichikara',
        mimeType: 'application/vnd.google-apps.folder',
      },
      fields: 'id',
    })

    console.log('\n================ SALIN KE VERCEL ENV ================')
    console.log('GOOGLE_OAUTH_REFRESH_TOKEN =', tokens.refresh_token || '(KOSONG!)')
    console.log('GDRIVE_FOLDER_ID           =', folder.data.id)
    console.log('====================================================\n')

    if (!tokens.refresh_token) {
      console.log('[PERINGATAN] refresh_token kosong. Cabut akses lama di')
      console.log('https://myaccount.google.com/permissions lalu jalankan ulang script ini.\n')
    }
    process.exit(0)
  } catch (e) {
    console.error('\n[GAGAL]', e.message, '\n')
    process.exit(1)
  }
})

server.listen(PORT, () => {
  console.log('\n1) Buka URL ini di browser, LOGIN sebagai akun pemilik Drive (mis. mugenworklabs@gmail.com):\n')
  console.log(authUrl)
  console.log('\n2) Kalau muncul peringatan "Google hasn\'t verified this app" -> Advanced -> Go to (unsafe).')
  console.log('3) Izinkan akses. Token akan tercetak otomatis di terminal ini.\n')
})
