// ============================================================
// POST /api/gallery/wa  —  STUB untuk fase Bot WhatsApp (BELUM aktif)
// ============================================================
// Endpoint ini disiapkan sebagai kerangka untuk integrasi bot WA
// (kirim foto via WhatsApp -> masuk galeri). Implementasi penuh
// menyusul di fase terpisah.
//
// Rencana kontrak (akan difinalisasi di fase WA):
//   Header : x-wa-secret: <token rahasia bot>   (verifikasi pemanggil)
//   Body   : { action: 'upload' | 'add_admin' | 'list', ... }
//
//   action 'upload':
//     { action:'upload', from:'62xxx', dataBase64, fileName, caption, category }
//     -> cek 'from' ada di gallery_wa_admins -> upload ke Drive -> insert gallery_media (source='wa')
//
//   action 'add_admin' (hanya super admin):
//     { action:'add_admin', from:'62xxx', phone:'62yyy', name }
//     -> cek 'from' is_super_admin -> insert gallery_wa_admins
//
// Saat ini sengaja menolak semua request agar tidak dipakai sebelum siap.
// ============================================================

export default async function handler(req, res) {
  return res.status(501).json({
    error: 'Endpoint bot WhatsApp belum diimplementasikan (fase terpisah).',
  })
}
