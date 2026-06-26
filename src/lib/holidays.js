// Daftar hari libur nasional Indonesia (tanggal merah).
// HANYA untuk ditampilkan di kalender — TIDAK memengaruhi logika absensi sama sekali.
//
// Sumber: SKB 3 Menteri tentang Hari Libur Nasional & Cuti Bersama.
// ⚠️ PERBARUI SETIAP TAHUN. Tanggal hari besar Islam/Imlek/Saka bisa bergeser
//    sesuai keputusan resmi pemerintah — verifikasi sebelum dipakai.
//
// Format: 'YYYY-MM-DD': 'Nama hari libur'

const HOLIDAYS = {
  // ---- 2026 ----
  '2026-01-01': 'Tahun Baru Masehi',
  '2026-01-16': 'Isra Mikraj Nabi Muhammad SAW',
  '2026-02-17': 'Tahun Baru Imlek 2577',
  '2026-03-19': 'Hari Suci Nyepi (Saka 1948)',
  '2026-03-21': 'Idul Fitri 1447 H',
  '2026-03-22': 'Idul Fitri 1447 H',
  '2026-04-03': 'Wafat Isa Almasih',
  '2026-05-01': 'Hari Buruh Internasional',
  '2026-05-14': 'Kenaikan Isa Almasih',
  '2026-05-31': 'Hari Raya Waisak 2570',
  '2026-06-01': 'Hari Lahir Pancasila',
  '2026-06-16': 'Idul Adha 1447 H',
  '2026-07-06': 'Tahun Baru Islam 1448 H',
  '2026-08-17': 'Hari Kemerdekaan RI',
  '2026-09-14': 'Maulid Nabi Muhammad SAW',
  '2026-12-25': 'Hari Raya Natal',

  // ---- 2027 (tambahkan saat SKB resmi terbit) ----
  '2027-01-01': 'Tahun Baru Masehi',
}

/**
 * Mengembalikan nama hari libur nasional untuk tanggal tertentu, atau null.
 * @param {string} dateStr - format 'YYYY-MM-DD'
 * @returns {string|null}
 */
export function getHolidayName(dateStr) {
  return HOLIDAYS[dateStr] ?? null
}

export default HOLIDAYS
