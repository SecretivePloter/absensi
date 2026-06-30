// ============================================================
// POST /api/gallery/delete
// Menghapus 1 file dari Google Drive berdasarkan driveFileId.
// Penghapusan baris metadata di Supabase dilakukan oleh frontend.
// ============================================================
import { getDrive, verifyUser, readJsonBody } from './_lib.js'

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
    const { driveFileId } = body
    if (!driveFileId) {
      return res.status(400).json({ error: 'driveFileId kosong.' })
    }

    try {
      await getDrive().files.delete({ fileId: driveFileId })
    } catch (err) {
      // Bila file sudah tidak ada di Drive (404), anggap sukses agar baris DB tetap bisa dihapus.
      const status = err?.code || err?.response?.status
      if (status !== 404) throw err
    }

    return res.status(200).json({ ok: true })
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Gagal menghapus file di Google Drive.' })
  }
}
