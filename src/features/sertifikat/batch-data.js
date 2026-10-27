// Only the supplied AUTOMATE master is accepted. Scores are mapped by heading,
// then returned in the renderer's Bunpou, Dokkai, Kaiwa, Absensi, total order.
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
  const sheets = workbook.SheetNames.filter(name => normalizeName(name) === 'automate')
  if (sheets.length !== 1) throw new Error('Harus ada tepat satu sheet AUTOMATE pada file master.')
  const sheetName = sheets[0]
  const sheet = workbook.Sheets[sheetName]
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1')
  if (range.e.r > 10000 || range.e.c > 1000) throw new Error('Sheet terlalu besar. Gunakan format master yang disepakati.')
  const cell = (r, c) => sheet[XLSX.utils.encode_cell({ r, c })]
  const headings = []
  for (let r = range.s.r; r <= range.e.r; r++) for (let c = range.s.c; c <= range.e.c; c++) {
    if (normalizeName(cell(r, c)?.v) === 'tabel untuk bulk generator') headings.push({ r, c })
  }
  if (headings.length !== 1) throw new Error('Harus ada tepat satu TABEL UNTUK BULK GENERATOR di AUTOMATE.')
  const title = headings[0]
  const titleMerge = (sheet['!merges'] || []).find(m => m.s.r === title.r && m.s.c === title.c)
  const r = (titleMerge?.e.r ?? title.r) + 1
  const start = title.c, end = titleMerge?.e.c ?? range.e.c
  const findColumn = (row, heading) => {
    const matches = []
    for (let col = start; col <= end; col++) if (normalizeName(cell(row, col)?.v) === heading) matches.push(col)
    if (matches.length !== 1) throw new Error(`Kolom ${heading} harus ada tepat satu di tabel AUTOMATE.`)
    return matches[0]
  }
  const classColumn = findColumn(r, 'kelas'), nameColumn = findColumn(r, 'nama'), ttlColumn = findColumn(r, 'tempat')
  const scoreStart = findColumn(r, 'nilai sertifikat')
  const expected = ['bunpou', 'dokkai', 'kaiwa', 'absensi', 'nilai']
  const columns = expected.map(heading => findColumn(r + 1, heading))
  if (columns.some(col => col < scoreStart)) throw new Error('Kolom nilai harus berada di bagian Nilai sertifikat.')
  const rows = [], names = new Set()
  for (let row = r + 2; row <= range.e.r; row++) {
    const usedColumns = [classColumn, nameColumn, ttlColumn, ...columns]
    if (usedColumns.every(col => cell(row, col)?.v === undefined || cell(row, col)?.v === '')) continue
    const readText = (col, label) => {
      const source = cell(row, col)
      if (!source || source.t === 'e' || typeof source.v !== 'string' || !source.v.trim()) throw new Error(`Baris ${row + 1}: ${label} kosong/error. Lengkapi master AUTOMATE.`)
      return source.v.normalize('NFKC').trim().replace(/\s+/g, ' ')
    }
    const name = readText(nameColumn, 'Nama').toLocaleUpperCase('id-ID')
    const ttl = readText(ttlColumn, 'Tempat, tanggal lahir')
    const studentClass = readText(classColumn, 'Kelas')
    if (ttl.length > 200) throw new Error(`${name}: tempat/tanggal lahir maksimal 200 karakter.`)
    const key = normalizeName(name)
    if (names.has(key)) throw new Error(`Nama ganda pada baris ${row + 1}: ${name}. Perbaiki workbook dahulu.`)
    names.add(key)
    const scores = expected.map((heading, i) => {
      const source = cell(row, columns[i]), max = i === 4 ? 100 : 25
      if (!source || source.t === 'e' || typeof source.v !== 'number' || !Number.isFinite(source.v) || source.v < 0 || source.v > max) {
        throw new Error(`${name}: ${heading} kosong/error/di luar 0–${max}. Hitung ulang dan simpan Excel sebelum impor.`)
      }
      const display = XLSX.utils.format_cell(source)
      if (!/^\d+(?:[.,]\d+)?$/.test(display)) throw new Error(`${name}: format angka ${heading} tidak didukung (${display}).`)
      return { value: source.v, display, cell: XLSX.utils.encode_cell({ r: row, c: columns[i] }) }
    })
    rows.push({ name, key, row: row + 1, scores, ttl, studentClass, selected: true, photo: null, photoError: '' })
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
