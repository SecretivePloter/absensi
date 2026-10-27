import { test } from 'node:test'
import assert from 'node:assert/strict'
import XLSX from 'xlsx-js-style'
import { parseCertificateWorkbook, matchPhotos, certificateNumber, predicateFor, parseCertificateNumber } from '../src/features/sertifikat/batch-data.js'

function fixture() {
  const sheet = XLSX.utils.aoa_to_sheet([
    ['TABEL UNTUK BULK GENERATOR'], [],
    ['kelas', 'NAMA', 'Tempat', 'Nilai sertifikat'],
    [null, null, null, 'Bunpou ', 'Kaiwa', 'Dokkai', 'Absensi', 'Nilai'],
    ['GST26', 'Peserta A', 'Kuningan, 11 Mei 1994', 23.875, 22, 21, 25, 96.5625],
    ['GST26', 'Peserta B', 'Jakarta, 12 November 1993', 24, 23, 25, 25, 97],
  ])
  sheet.I3 = {t:'s',v:'Nomor Sertifikat'}; sheet.I5 = {t:'s',v:'NO.S.1056.CLT.20.X.2026'}; sheet.I6 = {t:'s',v:'NO.S.1057.CLT.20.X.2026'}; sheet['!ref']='A1:I6'
  sheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 1, c: 8 } }]
  for (const row of [5, 6]) for (const col of ['D', 'E', 'F', 'G', 'H']) sheet[col + row].z = col === 'H' ? '0.0' : '0'
  return { SheetNames: ['Nomor Sertifikat', 'AUTOMATE', 'Progres nilai'], Sheets: { 'Nomor Sertifikat': {}, AUTOMATE: sheet, 'Progres nilai': {} } }
}
test('AUTOMATE imports uppercase names, individual TTL and class; maps Dokkai/Kaiwa by header', () => {
  const { rows } = parseCertificateWorkbook(XLSX, fixture())
  assert.equal(rows.length, 2)
  assert.equal(rows[0].name, 'PESERTA A')
  assert.equal(rows[0].ttl, 'Kuningan, 11 Mei 1994')
  assert.equal(rows[1].ttl, 'Jakarta, 12 November 1993')
  assert.equal(rows[0].studentClass, 'GST26')
  assert.deepEqual(rows[0].scores.map(s => s.display), ['24', '21', '22', '25', '96.6'])
  assert.equal(rows[0].scores[1].cell, 'F5')
  assert.equal(rows[1].scores[4].display, '97.0')
})
test('ignores other sheets and requires AUTOMATE, no fallback to old workbook', () => {
  const book = fixture(); book.Sheets['Progres nilai'] = book.Sheets.AUTOMATE
  assert.equal(parseCertificateWorkbook(XLSX, book).rows.length, 2)
  book.SheetNames = ['Progres nilai']
  assert.throws(() => parseCertificateWorkbook(XLSX, book), /AUTOMATE/)
})
test('rejects incomplete identity, invalid scores, and uncached formulas', () => {
  for (const col of ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']) for (const bad of [undefined, { t: 'e', v: 7 }, { f: 'A1' }]) {
    const book = fixture(); book.Sheets.AUTOMATE[col + '5'] = bad
    assert.throws(() => parseCertificateWorkbook(XLSX, book), /kosong\/error/)
  }
  for (const [cell, value] of [['D5', 26], ['H5', 101], ['G5', -1]]) {
    const book = fixture(); book.Sheets.AUTOMATE[cell].v = value
    assert.throws(() => parseCertificateWorkbook(XLSX, book), /di luar/)
  }
})
test('rejects duplicate names and missing/duplicate score headings', () => {
  const book = fixture(); book.Sheets.AUTOMATE.B6.v = ' PESERTA   a '
  assert.throws(() => parseCertificateWorkbook(XLSX, book), /Nama ganda/)
  const other = fixture(); other.Sheets.AUTOMATE.E4.v = 'Dokkai'
  assert.throws(() => parseCertificateWorkbook(XLSX, other), /tepat satu/)
})
test('normalizes photo case, Unicode and repeated spaces; refuses typos and duplicates', () => {
  const rows = parseCertificateWorkbook(XLSX, fixture()).rows
  assert.equal(matchPhotos(rows, [{ name: ' peserta  a.JPG', size: 30 }])[0].photoError, '')
  assert.equal(matchPhotos(rows, [{ name: 'ＰＥＳＥＲＴＡ A.png', size: 30 }])[0].photoError, '')
  assert.equal(matchPhotos(rows, [{ name: 'Peserta aa.jpg', size: 30 }])[0].photoError, 'Foto belum ditemukan')
  assert.equal(matchPhotos(rows, [{ name: 'Peserta A.jpg', size: 30 }, { name: 'peserta a.png', size: 30 }])[0].photoError, 'Foto ganda')
})
test('numbering and predicates remain unchanged', () => {
  assert.equal(certificateNumber(1058, 'CLT', '2026-10-20'), 'NO.S.1058.CLT.20.X.2026')
  assert.equal(certificateNumber(1059, 'Bimbel', '2027-01-01'), 'NO.S.1059.Bimbel.1.I.2027')
  assert.equal(predicateFor('96.6'), 'Amat Sangat Baik')
  assert.equal(predicateFor('90'), 'Amat Baik')
})

test('uses exact Excel number and derives class/date; rejects invalid and duplicate sequences', () => {
  const rows = parseCertificateWorkbook(XLSX, fixture()).rows
  assert.equal(rows[0].number, 'NO.S.1056.CLT.20.X.2026')
  assert.equal(rows[0].issueDate, '2026-10-20')
  assert.equal(parseCertificateNumber('NO.S.77.Bimbel.29.II.2024').classType, 'Bimbel')
  for (const n of ['', 'NO.S.5.CLT.31.II.2026', 'NO.S.5.CLT.29.II.2025', 'NO.S.5.CLT.1.XIII.2026']) assert.throws(() => parseCertificateNumber(n))
  const b = fixture(); b.Sheets.AUTOMATE.I6.v = 'NO.S.1056.TG.21.X.2026'
  assert.throws(() => parseCertificateWorkbook(XLSX,b), /ganda/)
})
