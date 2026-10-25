import { test } from 'node:test'
import assert from 'node:assert/strict'
import XLSX from 'xlsx-js-style'
import { parseCertificateWorkbook, matchPhotos, certificateNumber, predicateFor } from '../src/features/sertifikat/batch-data.js'

function fixture() {
  const sheet = { '!ref': 'D3:AF7', D3: { t: 's', v: 'Nama' }, AB3: { t: 's', v: 'Nilai Sertifikat' }, D6: { t: 's', v: 'Peserta A' }, D7: { t: 's', v: 'Peserta B' } }
  ;['Bunpou', 'Dokkai', 'Kaiwa', 'Absensi', 'Summary'].forEach((v, i) => {
    const col = ['AB', 'AC', 'AD', 'AE', 'AF'][i]
    sheet[col + '4'] = { t: 's', v }
    sheet[col + '6'] = { t: 'n', v: [23.875, 23.5, 24.125, 25, 96.5625][i], z: i === 4 ? '0.0' : '0' }
    sheet[col + '7'] = { t: 'n', v: [24, 23, 25, 25, 97][i], z: i === 4 ? '0.0' : '0' }
  })
  return { SheetNames: ['Ignored', 'Progres nilai'], Sheets: { Ignored: {}, 'Progres nilai': sheet } }
}
test('reads only certificate table; preserves raw values and formatted Summary', () => {
  const result = parseCertificateWorkbook(XLSX, fixture())
  assert.equal(result.rows.length, 2)
  assert.equal(result.rows[0].scores[0].value, 23.875)
  assert.equal(result.rows[0].scores[0].display, '24')
  assert.equal(result.rows[0].scores[4].display, '96.6')
  assert.equal(result.rows[1].scores[4].display, '97.0')
})
test('rejects missing/error scores without silently treating them as zero', () => {
  for (const bad of [undefined, { t: 'e', v: 7 }, { t: 'n', v: 101 }]) {
    const book = fixture(); book.Sheets['Progres nilai'].AF6 = bad
    assert.throws(() => parseCertificateWorkbook(XLSX, book), /kosong\/error/)
  }
})
test('rejects duplicate names, wrong heading, and missing sheet', () => {
  const book = fixture(); book.Sheets['Progres nilai'].D7.v = ' PESERTA   A '
  assert.throws(() => parseCertificateWorkbook(XLSX, book), /Nama ganda/)
  const other = fixture(); other.Sheets['Progres nilai'].AB4.v = 'Other'
  assert.throws(() => parseCertificateWorkbook(XLSX, other), /bunpou/)
  assert.throws(() => parseCertificateWorkbook(XLSX, { SheetNames: [] }), /Sheet/)
})
test('photo matching ignores case/spaces, rejects ambiguity and missing photos', () => {
  const rows = parseCertificateWorkbook(XLSX, fixture()).rows
  assert.equal(matchPhotos(rows, [{ name: ' PESERTA  A.JPG', size: 30 }])[0].photoError, '')
  assert.equal(matchPhotos(rows, [])[0].photoError, 'Foto belum ditemukan')
  assert.equal(matchPhotos(rows, [{ name: 'Peserta A.jpg', size: 30 }, { name: 'peserta a.png', size: 30 }])[0].photoError, 'Foto ganda')
})
test('numbering uses shared sequence and Roman month across classes/year', () => {
  assert.equal(certificateNumber(1058, 'CLT', '2026-10-20'), 'NO.S.1058.CLT.20.X.2026')
  assert.equal(certificateNumber(1059, 'Bimbel', '2027-01-01'), 'NO.S.1059.Bimbel.1.I.2027')
  assert.equal(certificateNumber(1060, 'TG', '2027-12-31'), 'NO.S.1060.TG.31.XII.2027')
})
test('predicate follows displayed Summary categories', () => {
  assert.equal(predicateFor('97.0'), 'Amat Sangat Baik')
  assert.equal(predicateFor('96.6'), 'Amat Sangat Baik')
  assert.equal(predicateFor('90'), 'Amat Baik')
  assert.equal(predicateFor('100'), 'Sempurna')
})
