// ============================================================
// Export "Laporan Rekap Absensi" gaya template payroll Ichikara.
//
// Menghasilkan 1 worksheet berbentuk laporan (bukan tabel datar), meniru
// layout template payroll: bar hijau, blok identitas + tabel ringkas kanan-atas,
// blok Pendapatan & Potongan (label saja, nilai KOSONG), tabel absensi harian
// (kanji hari, jam masuk/keluar, hari kerja, fee, keterangan), lalu footer TTD.
//
// PENTING:
// - Hanya membaca data → menulis file .xlsx di browser. TIDAK menyentuh DB.
// - Nilai uang SENGAJA dikosongkan (hanya struktur/label). Yang terisi:
//   Nama, Periode Kerja, Total/Aktual hari kerja, dan isi tabel absensi.
// - Library: xlsx-js-style (mendukung style), BUKAN xlsx biasa.
// ============================================================
import * as XLSX from 'xlsx-js-style'
import { unzipSync, zipSync } from 'fflate'
import { format, eachDayOfInterval } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import { getHolidayName } from '../lib/holidays'

// Kanji hari, diindeks oleh Date.getDay() (0=Minggu ... 6=Sabtu).
const HARI_KANJI = ['日', '月', '火', '水', '木', '金', '土']

// ---- Palet warna (sesuai permintaan: hijau, kuning, hitam, putih + abu-abu weekend) ----
const GREEN = '556B2F'   // bar header hijau tua (olive)
const YELLOW = 'FFFF00'  // highlight baris berketerangan & Total Terima
const GRAY = 'D9D9D9'    // penanda Sabtu/Minggu/tanggal merah
const BLACK = '000000'

const THIN = { style: 'thin', color: { rgb: BLACK } }
const BORDER_ALL = { top: THIN, bottom: THIN, left: THIN, right: THIN }

// Factory style ringkas.
function S({ sz = 11, bold = false, h = 'left', v = 'center', fill, border = false, wrap = false, color = BLACK } = {}) {
  const s = {
    font: { name: 'Calibri', sz, bold, color: { rgb: color } },
    alignment: { horizontal: h, vertical: v, wrapText: wrap },
  }
  if (fill) s.fill = { patternType: 'solid', fgColor: { rgb: fill } }
  if (border) s.border = BORDER_ALL
  return s
}

const fmtTime = (iso) => (iso ? format(new Date(iso), 'HH:mm') : '')

// Ambil teks keterangan dari catatan / alasan izin-sakit / alasan pulang awal.
function keteranganText(rec) {
  if (!rec) return ''
  if (rec.notes && rec.notes.trim()) return rec.notes.trim()
  const abs = { izin: 'Izin', sakit: 'Sakit' }[rec.absence_reason]
  if (abs) return abs
  const early = { izin: 'Izin', sakit: 'Sakit', dinas_keluar: 'Dinas Keluar', others: 'Lainnya' }[rec.early_checkout_reason]
  return early || ''
}

// xlsx-js-style TIDAK menulis <pageSetup> (orientasi/fit-to-page), hanya <pageMargins>.
// Maka setelah file dibuat, kita suntik <pageSetup> + <pageSetUpPr fitToPage> ke XML
// worksheet agar hasilnya benar-benar A4 Landscape & muat 1 halaman lebar saat dicetak.
function injectPrintSetup(sheetXml) {
  let xml = sheetXml
  // 1. fitToPage pada <sheetPr> (harus jadi child pertama <worksheet>)
  if (/<sheetPr[\s>]/.test(xml)) {
    if (!/pageSetUpPr/.test(xml)) {
      xml = xml.replace(/<sheetPr(\s[^>]*)?\/>/, (m) => m.replace('/>', '><pageSetUpPr fitToPage="1"/></sheetPr>'))
      xml = xml.replace(/<sheetPr(\s[^>]*)?>(?!<pageSetUpPr)/, (m) => m + '<pageSetUpPr fitToPage="1"/>')
    }
  } else {
    xml = xml.replace(/(<worksheet[^>]*>)/, '$1<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>')
  }
  // 2. <pageSetup> tepat setelah <pageMargins> (urutan skema OOXML)
  const ps = '<pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/>'
  if (/<pageMargins[^>]*\/>/.test(xml)) {
    xml = xml.replace(/(<pageMargins[^>]*\/>)/, `$1${ps}`)
  } else {
    xml = xml.replace(/(<\/worksheet>)/, `${ps}$1`)
  }
  return xml
}

/**
 * Bangun workbook laporan payroll dan kembalikan byte .xlsx (sudah dipatch print setup).
 * @param {object}   opts
 * @param {object}   opts.user         - { name, ... }
 * @param {Array}    opts.records      - attendance dalam periode (punya date, check_in_at, check_out_at, notes, absence_reason, early_checkout_reason)
 * @param {Date}     opts.periodStart  - tanggal awal periode (mis. 21 bulan lalu)
 * @param {Date}     opts.periodEnd    - tanggal akhir periode (mis. 20 bulan ini)
 * @returns {{ bytes: Uint8Array, filename: string }}
 */
export function buildPayrollWorkbook({ user, records, periodStart, periodEnd }) {
  const ws = {}
  const merges = []
  const rows = [] // tinggi baris per index

  // --- helper penulisan sel ---
  const put = (r, c, v, style, type) => {
    const t = type || (typeof v === 'number' ? 'n' : 's')
    ws[XLSX.utils.encode_cell({ r, c })] = { t, v: v ?? '', s: style }
  }
  // Kotak (merge) — style diterapkan ke SEMUA sel agar border tampil penuh.
  const box = (r1, c1, r2, c2, v, style, type) => {
    for (let r = r1; r <= r2; r++) {
      for (let c = c1; c <= c2; c++) {
        const isHead = r === r1 && c === c1
        put(r, c, isHead ? v : '', style, isHead ? type : 's')
      }
    }
    if (r1 !== r2 || c1 !== c2) merges.push({ s: { r: r1, c: c1 }, e: { r: r2, c: c2 } })
  }
  const setH = (r, hpt) => { rows[r] = { hpt } }

  // ---- data turunan ----
  const days = eachDayOfInterval({ start: periodStart, end: periodEnd })
  const byDate = new Map(records.map((r) => [r.date, r]))
  const totalHariKerja = records.filter((r) => r.check_in_at).length
  const periodeLabel = `${format(periodStart, 'd MMMM yyyy', { locale: idLocale })} - ${format(periodEnd, 'd MMMM yyyy', { locale: idLocale })}`

  const MAXC = 12 // kolom A..M

  // ===================== BARIS 0: BAR HIJAU =====================
  box(0, 0, 0, MAXC, '', S({ fill: GREEN }))
  setH(0, 30)
  setH(1, 6) // spacer

  // ===================== IDENTITAS (kiri) + TABEL RINGKAS (kanan) =====================
  const labelS = S({ bold: true })
  const colonS = S({ h: 'center' })
  const valueS = S()

  // Nama
  put(2, 0, 'Nama', labelS); put(2, 1, ':', colonS)
  box(2, 2, 2, 4, user?.name || '-', valueS)
  // Periode Kerja
  put(3, 0, 'Periode Kerja', labelS); put(3, 1, ':', colonS)
  box(3, 2, 3, 4, periodeLabel, valueS)
  // Total hari kerja
  put(4, 0, 'Total hari kerja', labelS); put(4, 1, ':', colonS)
  box(4, 2, 4, 4, totalHariKerja, valueS, 'n')

  // Tabel ringkas kanan-atas (Total hari kerja | S/I | Cuti Bersama | Aktual hari kerja)
  const miniHead = S({ bold: true, h: 'center', v: 'center', border: true, wrap: true, sz: 10 })
  const miniVal = S({ h: 'center', v: 'center', border: true })
  put(2, 7, 'Total hari kerja', miniHead)
  put(2, 8, 'S/I', miniHead)
  put(2, 9, 'Cuti Bersama', miniHead)
  box(2, 10, 2, 12, 'Aktual hari kerja', miniHead)
  put(3, 7, totalHariKerja, miniVal, 'n')
  put(3, 8, 0, miniVal, 'n')
  put(3, 9, 0, miniVal, 'n')
  box(3, 10, 3, 12, totalHariKerja, miniVal, 'n')
  setH(2, 26)

  // ===================== PENDAPATAN (kiri) & POTONGAN (kanan) =====================
  const sectionS = S({ bold: true, h: 'center', sz: 12 })
  box(6, 0, 6, 4, 'Pendapatan', sectionS)
  box(6, 7, 6, 12, 'Potongan', sectionS)

  // Baris label pendapatan (nilai KOSONG). Format: label(A:B) : (C) nilai(D:E)
  const penLabel = S({ wrap: true })
  const penValue = S({ h: 'right' })
  const penRow = (r, label, opts = {}) => {
    box(r, 0, r, 1, label, opts.bold ? S({ bold: true }) : penLabel)
    put(r, 2, ':', colonS)
    box(r, 3, r, 4, '', opts.valStyle || penValue)
  }
  penRow(7, 'GP')
  penRow(8, 'Lembur')
  penRow(9, 'Meal Fee')
  penRow(10, 'Transport Fee')
  penRow(11, 'Subsidi BPJS Ketenagakerjaan')
  penRow(12, 'Sensei Fee')
  penRow(13, 'Insentif')
  penRow(14, 'Total Pendapatan', { bold: true })
  penRow(15, 'Total Terima', { bold: true, valStyle: S({ h: 'right', fill: YELLOW }) })
  penRow(16, 'Asrama', { bold: true })
  setH(11, 26) // beri ruang label BPJS yang panjang

  // Baris label potongan (nilai KOSONG). Format: label(H:J) nilai(K:M)
  const potLabel = S()
  const potValue = S({ h: 'right' })
  const potRow = (r, label, opts = {}) => {
    box(r, 7, r, 9, label, opts.bold ? S({ bold: true }) : potLabel)
    box(r, 10, r, 12, '', potValue)
  }
  potRow(7, 'Asrama')
  potRow(8, 'Kurang hari kerja')
  potRow(9, 'Makan')
  potRow(10, 'Pph 21')
  potRow(11, 'Total potongan', { bold: true })

  // ===================== TABEL ABSENSI HARIAN =====================
  const HEAD_ROW = 18
  const th = S({ bold: true, h: 'center', v: 'center', border: true, wrap: true })
  put(HEAD_ROW, 0, 'Tanggal', th)
  put(HEAD_ROW, 1, 'Hari', th)
  put(HEAD_ROW, 2, 'Jam Masuk', th)
  put(HEAD_ROW, 3, 'Jam Keluar', th)
  put(HEAD_ROW, 4, 'Hari Kerja', th)
  put(HEAD_ROW, 5, 'Fee', th)
  box(HEAD_ROW, 7, HEAD_ROW, 12, 'Keterangan', th)
  setH(HEAD_ROW, 24)

  days.forEach((day, i) => {
    const r = HEAD_ROW + 1 + i
    const dateStr = format(day, 'yyyy-MM-dd')
    const rec = byDate.get(dateStr)
    const present = !!rec?.check_in_at
    const ket = keteranganText(rec)
    const dow = day.getDay()
    const isRed = dow === 0 || dow === 6 || !!getHolidayName(dateStr)

    // Prioritas warna: baris berketerangan = kuning; selain itu weekend/libur = abu-abu.
    const fill = ket ? YELLOW : (isRed ? GRAY : undefined)
    const cell = (extra = {}) => S({ h: 'center', v: 'center', border: true, fill, ...extra })

    put(r, 0, format(day, 'dd/MMM/yyyy'), cell())
    put(r, 1, HARI_KANJI[dow], cell())
    put(r, 2, fmtTime(rec?.check_in_at), cell())
    put(r, 3, fmtTime(rec?.check_out_at), cell())
    put(r, 4, present ? 1 : '', cell(), present ? 'n' : 's')
    put(r, 5, '', cell()) // Fee kosong
    // Keterangan (rata kiri)
    box(r, 7, r, 12, ket, S({ h: 'left', v: 'center', border: true, wrap: true, fill: ket ? YELLOW : undefined }))
    setH(r, 18)
  })

  // Baris total Fee (kosong — fee tidak dihitung)
  const feeTotalRow = HEAD_ROW + 1 + days.length
  put(feeTotalRow, 5, '', S({ h: 'center', v: 'center', border: true }))

  // ===================== FOOTER TANDA TANGAN =====================
  const ftHead = feeTotalRow + 2
  const ttdHead = S({ bold: true, h: 'center', v: 'center', border: true })
  const ttdBox = S({ border: true })
  box(ftHead, 1, ftHead, 2, 'Dibuat', ttdHead)
  box(ftHead, 3, ftHead, 4, 'Disetujui', ttdHead)
  box(ftHead + 1, 1, ftHead + 4, 2, '', ttdBox)
  box(ftHead + 1, 3, ftHead + 4, 4, '', ttdBox)

  const maxR = ftHead + 4

  // ===================== PROPERTI SHEET =====================
  ws['!ref'] = XLSX.utils.encode_range({ r: 0, c: 0 }, { r: maxR, c: MAXC })
  ws['!merges'] = merges
  ws['!rows'] = rows
  // Lebar kolom (generous — "jangan kekecilan")
  ws['!cols'] = [
    { wch: 14 }, // A Tanggal
    { wch: 7 },  // B Hari
    { wch: 12 }, // C Jam Masuk
    { wch: 12 }, // D Jam Keluar
    { wch: 11 }, // E Hari Kerja
    { wch: 13 }, // F Fee
    { wch: 3 },  // G spacer
    { wch: 16 }, // H
    { wch: 12 }, // I
    { wch: 14 }, // J
    { wch: 12 }, // K
    { wch: 12 }, // L
    { wch: 12 }, // M
  ]
  // Margin cetak rapi (pageSetup disuntik manual di bawah — lihat injectPrintSetup).
  ws['!margins'] = { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 }
  ws['!printArea'] = ws['!ref']

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Laporan')

  // Tulis ke buffer, lalu suntik <pageSetup> ke sheet1.xml (A4 landscape, fit 1 halaman).
  const raw = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
  const files = unzipSync(new Uint8Array(raw))
  const key = 'xl/worksheets/sheet1.xml'
  if (files[key]) {
    const patched = injectPrintSetup(new TextDecoder().decode(files[key]))
    files[key] = new TextEncoder().encode(patched)
  }
  const bytes = zipSync(files)

  const safeName = (user?.name || 'karyawan').replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, '_')
  const stamp = format(periodStart, 'yyyy-MM-dd')
  return { bytes, filename: `laporan_${safeName}_${stamp}.xlsx` }
}

/**
 * Bangun laporan lalu picu unduhan di browser.
 * @see buildPayrollWorkbook untuk parameter.
 */
export function exportPayrollReport(opts) {
  const { bytes, filename } = buildPayrollWorkbook(opts)
  const blob = new Blob([bytes], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
