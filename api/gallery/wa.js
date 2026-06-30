// ============================================================
// POST /api/gallery/wa  —  Upload foto dari Bot WhatsApp ke Google Drive.
// ============================================================
// Dipanggil HANYA oleh bot WA (ichikara-wa-bot), di-gate dengan secret
// bersama (header x-wa-secret). Endpoint ini SENGAJA hanya meng-upload ke
// Drive — pengecekan admin & penyimpanan metadata dilakukan oleh bot
// (yang punya koneksi Supabase galeri sendiri). Dengan begitu endpoint
// publik ini tidak memegang service-role database.
//
// Body: { fileName?, mimeType?, dataBase64 }
// Return: { driveFileId, thumbUrl }
// ============================================================
import { Readable } from 'stream'
import { getDrive, readJsonBody } from './_lib.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method tidak diizinkan' })
  }

  // Verifikasi secret bersama
  const secret = req.headers['x-wa-secret']
  const expected = process.env.GALLERY_WA_SECRET
  if (!expected || secret !== expected) {
    return res.status(401).json({ error: 'Secret tidak valid' })
  }

  try {
    const body = await readJsonBody(req)
    const { fileName, mimeType, dataBase64 } = body
    if (!dataBase64) {
      return res.status(400).json({ error: 'Data file kosong.' })
    }

    const buffer = Buffer.from(dataBase64, 'base64')
    const drive = getDrive()

    const created = await drive.files.create({
      requestBody: {
        name: fileName || `wa-${Date.now()}.jpg`,
        parents: [process.env.GDRIVE_FOLDER_ID],
      },
      media: {
        mimeType: mimeType || 'image/jpeg',
        body: Readable.from(buffer),
      },
      fields: 'id',
    })

    const fileId = created.data.id
    await drive.permissions.create({
      fileId,
      requestBody: { role: 'reader', type: 'anyone' },
    })

    return res.status(200).json({
      driveFileId: fileId,
      thumbUrl: `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`,
    })
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Gagal upload ke Google Drive.' })
  }
}
