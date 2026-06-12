import * as XLSX from 'xlsx-js-style'

const BRAND_COLOR = '1E40AF' // biru tua
const HEADER_FILL = { patternType: 'solid', fgColor: { rgb: BRAND_COLOR } }
const THIN = { style: 'thin', color: { rgb: 'D1D5DB' } }
const BORDER = { top: THIN, bottom: THIN, left: THIN, right: THIN }

const titleStyle = {
  font: { bold: true, sz: 16, color: { rgb: '111827' } },
  alignment: { horizontal: 'left', vertical: 'center' },
}
const subtitleStyle = {
  font: { sz: 10, color: { rgb: '6B7280' } },
  alignment: { horizontal: 'left' },
}
const headerStyle = {
  font: { bold: true, sz: 11, color: { rgb: 'FFFFFF' } },
  fill: HEADER_FILL,
  alignment: { horizontal: 'center', vertical: 'center' },
  border: BORDER,
}
const cellStyle = {
  font: { sz: 10.5 },
  alignment: { vertical: 'center' },
  border: BORDER,
}
const cellCenterStyle = { ...cellStyle, alignment: { horizontal: 'center', vertical: 'center' } }
const zebraFill = { patternType: 'solid', fgColor: { rgb: 'F3F4F6' } }

/**
 * Bangun worksheet berstyle: judul, subjudul, header berwarna,
 * border tiap sel, zebra-striping, lebar kolom otomatis.
 */
function buildStyledSheet({ title, subtitle, headers, rows, centerCols = [] }) {
  const aoa = [
    [title],
    [subtitle],
    [],
    headers,
    ...rows,
  ]
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  const headerRowIdx = 3 // baris ke-4 (0-based)

  // Merge judul & subjudul selebar tabel
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: headers.length - 1 } },
  ]

  // Style judul & subjudul
  const tCell = XLSX.utils.encode_cell({ r: 0, c: 0 })
  const sCell = XLSX.utils.encode_cell({ r: 1, c: 0 })
  if (ws[tCell]) ws[tCell].s = titleStyle
  if (ws[sCell]) ws[sCell].s = subtitleStyle

  // Style header
  headers.forEach((_, c) => {
    const ref = XLSX.utils.encode_cell({ r: headerRowIdx, c })
    if (ws[ref]) ws[ref].s = headerStyle
  })

  // Style data + zebra
  rows.forEach((row, i) => {
    const r = headerRowIdx + 1 + i
    row.forEach((_, c) => {
      const ref = XLSX.utils.encode_cell({ r, c })
      if (!ws[ref]) ws[ref] = { t: 's', v: '' }
      const base = centerCols.includes(c) ? cellCenterStyle : cellStyle
      ws[ref].s = i % 2 === 1 ? { ...base, fill: zebraFill } : base
    })
  })

  // Lebar kolom otomatis berdasarkan isi terpanjang
  ws['!cols'] = headers.map((h, c) => {
    const maxLen = Math.max(
      String(h).length,
      ...rows.map(row => String(row[c] ?? '').length)
    )
    return { wch: Math.min(Math.max(maxLen + 3, 10), 40) }
  })

  // Tinggi baris judul & header
  ws['!rows'] = [{ hpt: 24 }, { hpt: 14 }, { hpt: 6 }, { hpt: 20 }]

  // Autofilter di baris header
  ws['!autofilter'] = {
    ref: XLSX.utils.encode_range(
      { r: headerRowIdx, c: 0 },
      { r: headerRowIdx + rows.length, c: headers.length - 1 }
    ),
  }

  return ws
}

const exportStamp = () =>
  `Diekspor ${new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} pukul ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`

const earlyReasonMap = { izin: 'Izin', sakit: 'Sakit', dinas_keluar: 'Dinas Keluar', others: 'Lainnya' }
const roleLabelExport = (role) => {
  if (role === 'student') return 'Murid'
  if (role === 'sensei') return 'Sensei'
  return 'Staff'
}

export function exportAttendanceToExcel(records, filename = 'absensi') {
  const headers = ['No', 'Nama', 'Role', 'Kelas', 'Tanggal', 'Jam Masuk', 'Jam Pulang', 'Alasan Pulang Awal', 'Lokasi', 'Metode', 'Catatan']
  const fmtTime = (t) =>
    t ? new Date(t).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '-'
  const rows = records.map((r, i) => [
    i + 1,
    r.users?.name ?? '-',
    roleLabelExport(r.users?.role),
    r.users?.classes?.name ?? '-',
    new Date(r.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }),
    fmtTime(r.check_in_at),
    fmtTime(r.check_out_at),
    earlyReasonMap[r.early_checkout_reason] ?? '-',
    r.locations?.name ?? '-',
    r.method === 'qr' ? 'QR Scan' : 'Manual',
    r.notes ?? '',
  ])

  const ws = buildStyledSheet({
    title: 'Rekap Absensi — Ichikara',
    subtitle: `${exportStamp()} · ${records.length} record`,
    headers,
    rows,
    centerCols: [0, 4, 5, 6, 9],
  })

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Absensi')
  XLSX.writeFile(wb, `${filename}_${new Date().toISOString().slice(0, 10)}.xlsx`)
}

export function exportUsersToExcel(users, filename = 'users') {
  const headers = ['No', 'Nama', 'Role', 'Kelas', 'No HP', 'Status', 'Terdaftar']
  const rows = users.map((u, i) => [
    i + 1,
    u.name,
    u.role === 'student' ? 'Murid' : 'Karyawan',
    u.classes?.name ?? '-',
    u.phone ?? '-',
    u.is_active ? 'Aktif' : 'Nonaktif',
    new Date(u.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }),
  ])

  const ws = buildStyledSheet({
    title: 'Daftar Pengguna — Ichikara',
    subtitle: `${exportStamp()} · ${users.length} pengguna`,
    headers,
    rows,
    centerCols: [0, 5, 6],
  })

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Pengguna')
  XLSX.writeFile(wb, `${filename}_${new Date().toISOString().slice(0, 10)}.xlsx`)
}
