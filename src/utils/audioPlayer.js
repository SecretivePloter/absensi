// Pool audio-acak statis: taruh file .mp3 di src/assets/audio/{masuk,pulang,telat}/,
// otomatis ikut dipakai tanpa perlu ubah kode (lihat src/assets/audio/README.md).
// Pool ini digabung dengan Pustaka Audio (tabel audio_library, diatur di Pengaturan → Audio).
const masukStatic = Object.values(
  import.meta.glob('../assets/audio/masuk/*.mp3', { eager: true, import: 'default' })
)
const pulangStatic = Object.values(
  import.meta.glob('../assets/audio/pulang/*.mp3', { eager: true, import: 'default' })
)
const telatStatic = Object.values(
  import.meta.glob('../assets/audio/telat/*.mp3', { eager: true, import: 'default' })
)

const pickRandom = (pool) => (pool.length ? pool[Math.floor(Math.random() * pool.length)] : null)

export const playAudio = (src) => {
  if (!src) return
  try {
    const audio = new Audio(src)
    audio.volume = 1.0
    audio.play().catch(() => { })
  } catch {
    // Audio() bisa gagal dikonstruksi di browser lama — abaikan, tidak fatal.
  }
}

/**
 * Cek apakah waktu absen masuk melewati jam threshold "telat".
 * @param {Date} checkInDate - waktu absen masuk (lokal)
 * @param {string} thresholdStr - format "HH:mm", mis. "08:00"
 */
export const isLateCheckIn = (checkInDate, thresholdStr) => {
  if (!thresholdStr || !checkInDate) return false
  const [h, m] = thresholdStr.split(':').map(Number)
  if (Number.isNaN(h)) return false
  const threshold = new Date(checkInDate)
  threshold.setHours(h, Number.isNaN(m) ? 0 : m, 0, 0)
  return checkInDate.getTime() > threshold.getTime()
}

// Prioritas masuk: hari spesial (semua user) > telat > audio pribadi user > acak (statis + pustaka) > default statis.
export const resolveCheckInAudio = ({ specialAudioUrl, isLate, customAudioUrl, libraryMasuk = [], libraryTelat = [] } = {}) => {
  if (specialAudioUrl) return specialAudioUrl
  if (isLate) {
    const telat = pickRandom([...telatStatic, ...libraryTelat])
    if (telat) return telat
  }
  if (customAudioUrl) return customAudioUrl
  return pickRandom([...masukStatic, ...libraryMasuk]) || '/audio/datang.mp3'
}

// Prioritas pulang: hari spesial (semua user) > audio pribadi user > acak (statis + pustaka) > default statis.
export const resolveCheckOutAudio = ({ specialAudioUrl, customAudioUrl, libraryPulang = [] } = {}) => {
  if (specialAudioUrl) return specialAudioUrl
  if (customAudioUrl) return customAudioUrl
  return pickRandom([...pulangStatic, ...libraryPulang]) || '/audio/pulang.mp3'
}
