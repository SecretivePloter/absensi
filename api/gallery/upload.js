// ============================================================
// POST /api/gallery/upload
// Menerima 1 foto (sudah dikompres di browser, base64), meng-upload
// ke Google Drive, lalu mengembalikan id file + url thumbnail.
// Metadata disimpan ke Supabase oleh frontend (bukan di sini).
// ============================================================
import { Readable } from 'stream'
import { getDrive, verifyUser, readJsonBody } from './_lib.js'

// Catatan: foto dikompres di browser (maks ~1600px JPEG) sebelum dikirim,
// sehingga payload base64 aman di bawah limit body 4.5 MB Vercel Function.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method tidak diizinkan' })
  }

  const user = await verifyUser(req)
  if (!user) {
    return res.status(401).json({ error: 'Tidak terautentikasi. Silakan login ulang.' })
  }

  try {
    const body = await readJsonBody(req)
    const { fileName, mimeType, dataBase64 } = body
    if (!dataBase64) {
      return res.status(400).json({ error: 'Data file kosong.' })
    }

    const buffer = Buffer.from(dataBase64, 'base64')
    const drive = getDrive()

    // Upload ke folder tujuan.
    // supportsAllDrives: true WAJIB agar bisa upload ke folder di dalam
    // Shared Drive (Drive Bersama). Ini solusi untuk error
    // "Service Accounts do not have storage quota": file di Shared Drive
    // dimiliki organisasi, bukan service account, sehingga tidak kena kuota 0.
    const created = await drive.files.create({
      requestBody: {
        name: fileName || `galeri-${Date.now()}.jpg`,
        parents: [process.env.GDRIVE_FOLDER_ID],
      },
      media: {
        mimeType: mimeType || 'image/jpeg',
        body: Readable.from(buffer),
      },
      fields: 'id',
      supportsAllDrives: true,
    })

    const fileId = created.data.id

    // Jadikan dapat dibaca publik (anyone with link) agar thumbnail tampil cepat.
    await drive.permissions.create({
      fileId,
      requestBody: { role: 'reader', type: 'anyone' },
      supportsAllDrives: true,
    })

    return res.status(200).json({
      driveFileId: fileId,
      thumbUrl: `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`,
    })
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Gagal upload ke Google Drive.' })
  }
}
