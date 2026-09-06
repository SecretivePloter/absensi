// Pool audio-acak statis: taruh file .mp3 di src/assets/audio/{masuk,pulang}/,
// otomatis ikut dipakai tanpa perlu ubah kode (lihat src/assets/audio/README.md).
// Pool ini digabung dengan Pustaka Audio kategori "default" (diatur di Pengaturan → Audio).
const masukStatic = Object.values(
  import.meta.glob('../assets/audio/masuk/*.mp3', { eager: true, import: 'default' })
)
const pulangStatic = Object.values(
  import.meta.glob('../assets/audio/pulang/*.mp3', { eager: true, import: 'default' })
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

// Prioritas masuk: hari spesial (semua user) > audio pribadi user (kategori custom) > acak (statis + pustaka default) > default statis.
export const resolveCheckInAudio = ({ specialAudioUrl, customAudioUrl, libraryMasuk = [] } = {}) => {
  if (specialAudioUrl) return specialAudioUrl
  if (customAudioUrl) return customAudioUrl
  return pickRandom([...masukStatic, ...libraryMasuk]) || '/audio/datang.mp3'
}

// Prioritas pulang: hari spesial (semua user) > audio pribadi user (kategori custom) > acak (statis + pustaka default) > default statis.
export const resolveCheckOutAudio = ({ specialAudioUrl, customAudioUrl, libraryPulang = [] } = {}) => {
  if (specialAudioUrl) return specialAudioUrl
  if (customAudioUrl) return customAudioUrl
  return pickRandom([...pulangStatic, ...libraryPulang]) || '/audio/pulang.mp3'
}
