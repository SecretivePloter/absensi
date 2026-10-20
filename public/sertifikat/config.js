// Konfigurasi runtime package Ichikara Certificate Generator.
// Generator dan kalibrator tetap berjalan saat arsip Supabase dimatikan.
window.ICHIKARA_CERTIFICATE_CONFIG = {
  integration: {
    // Tambahkan origin website parent untuk integrasi lintas domain.
    // Contoh: 'https://app.perusahaan.com'. Jangan gunakan '*'.
    allowedParentOrigins: [window.location.origin],
  },
  archive: {
    enabled: false,
    url: '',
    anonKey: '',
    schema: 'ichikara',
  },
  defaultAdjustments: {
    front: {
      't:Lembaga Pendidikan Bahasa Jepang': {
        label: 'Teks: Lembaga Pendidikan Bahasa Jepang', dx: 420, dy: 0, scale: 1,
      },
      't:SERTIFIKAT': {
        label: 'Teks: SERTIFIKAT', dx: -310, dy: 0, scale: 1,
      },
    },
    back: {
      't:SURAT KETERANGAN NILAI': {
        label: 'Teks: SURAT KETERANGAN NILAI', dx: 420, dy: 0, scale: 1,
      },
      't:{{ nilai2 }}': { label: 'Teks: 20', dx: 130, dy: 0, scale: 1 },
      't:{{ nilai1 }}': { label: 'Teks: 22', dx: 130, dy: 0, scale: 1 },
      't:{{ nilai3 }}': { label: 'Teks: 23', dx: 130, dy: 0, scale: 1 },
      't:{{ nilai4 }}': { label: 'Teks: 24', dx: 130, dy: 0, scale: 1 },
      't:{{ nilai5 }}': { label: 'Teks: 89', dx: 130, dy: 0, scale: 1 },
    },
  },
}

// Kompatibilitas dengan implementasi arsip lama.
window.ICHIKARA_SUPABASE_CONFIG = {
  url: window.ICHIKARA_CERTIFICATE_CONFIG.archive.url,
  anonKey: window.ICHIKARA_CERTIFICATE_CONFIG.archive.anonKey,
}
