// Workbook import is intentionally limited to the certificate table and its name column.
export const normalizeName = value => String(value || '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('id-ID')
export const romanMonths = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']
export function predicateFor(summary) {
  const score = Number(String(summary).replace(',', '.'))
  return score === 100 ? 'Sempurna' : score >= 91 ? 'Amat Sangat Baik' : score >= 86 ? 'Amat Baik' : score >= 71 ? 'Baik' : score >= 60 ? 'Cukup' : 'Belum Memenuhi'
}
export function certificateNumber(sequence, classType, date) {
  const [year, month, day] = date.split('-').map(Number)
  return `NO.S.${sequence}.${classType}.${day}.${romanMonths[month - 1]}.${year}`
}
export function parseCertificateWorkbook(XLSX, workbook) {
  const sheetName = workbook.SheetNames.find(name => /^progres{1,2} nilai$/.test(normalizeName(name)))
  if (!sheetName) throw new Error('Sheet Progres nilai / Progress nilai tidak ditemukan.')
  const sheet = workbook.Sheets[sheetName]
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1')
  if (range.e.r > 10000 || range.e.c > 1000) throw new Error('Sheet terlalu besar. Gunakan format master yang disepakati.')
  const cell = (r, c) => sheet[XLSX.utils.encode_cell({ r, c })]
  const headings = []
  for (let r = range.s.r; r <= range.e.r; r++) for (let c = range.s.c; c <= range.e.c; c++) {
    if (normalizeName(cell(r, c)?.v) === 'nilai sertifikat') headings.push({ r, c })
  }
  if (headings.length !== 1) throw new Error('Harus ada tepat satu tabel berjudul Nilai Sertifikat.')
  const { r, c } = headings[0]
  const expected = ['bunpou', 'dokkai', 'kaiwa', 'absensi', 'summary']
  expected.forEach((heading, i) => {
    if (normalizeName(cell(r + 1, c + i)?.v) !== heading) throw new Error(`Kolom ${heading} tidak ditemukan di tabel Nilai Sertifikat.`)
  })
  let nameColumn = -1
  for (let col = range.s.c; col < c; col++) if (normalizeName(cell(r, col)?.v) === 'nama') nameColumn = col
  if (nameColumn < 0) throw new Error('Kolom Nama pada baris judul tabel tidak ditemukan.')
  const rows = [], names = new Set()
  for (let row = r + 2; row <= range.e.r; row++) {
    const name = String(cell(row, nameColumn)?.v || '').trim()
    if (normalizeName(name) === 'nama') break
    if (!name) {
      if (expected.some((_, i) => cell(row, c + i)?.v !== undefined && cell(row, c + i)?.v !== '')) throw new Error(`Baris ${row + 1} memiliki nilai sertifikat tetapi nama kosong.`)
      continue
    }
    const key = normalizeName(name)
    if (names.has(key)) throw new Error(`Nama ganda pada baris ${row + 1}: ${name}. Perbaiki workbook dahulu.`)
    names.add(key)
    const scores = expected.map((heading, i) => {
      const source = cell(row, c + i), max = i === 4 ? 100 : 25
      if (!source || source.t === 'e' || typeof source.v !== 'number' || !Number.isFinite(source.v) || source.v < 0 || source.v > max) {
        throw new Error(`${name}: ${heading} kosong/error/di luar 0–${max}. Hitung ulang dan simpan Excel sebelum impor.`)
      }
      const display = XLSX.utils.format_cell(source)
      if (!/^\d+(?:[.,]\d+)?$/.test(display)) throw new Error(`${name}: format angka ${heading} tidak didukung (${display}).`)
      return { value: source.v, display, cell: XLSX.utils.encode_cell({ r: row, c: c + i }) }
    })
    rows.push({ name, key, row: row + 1, scores, ttl: '', selected: true, photo: null, photoError: '' })
  }
  if (!rows.length) throw new Error('Tidak ada peserta pada tabel Nilai Sertifikat.')
  if (rows.length > 200) throw new Error('Maksimal 200 peserta per batch.')
  return { sheetName, rows }
}
export function matchPhotos(rows, files) {
  const photos = new Map()
  for (const file of files) {
    if (!/\.(jpe?g|png|webp)$/i.test(file.name)) continue
    const key = normalizeName(file.name.replace(/\.[^.]+$/, ''))
    photos.set(key, [...(photos.get(key) || []), file])
  }
  return rows.map(row => {
    const matches = photos.get(row.key) || []
    const photo = matches.length === 1 ? matches[0] : null
    const photoError = matches.length > 1 ? 'Foto ganda' : !photo ? 'Foto belum ditemukan' : photo.size > 10 * 1024 * 1024 || !photo.size ? 'Foto harus 1 byte–10 MB' : ''
    return { ...row, photo, photoError }
  })
}
export async function sha256(data) {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2, '0')).join('')
}
