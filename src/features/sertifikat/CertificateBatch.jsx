import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { zipSync, strToU8 } from 'fflate'
import { parseCertificateWorkbook, matchPhotos, sha256, predicateFor } from './batch-data'
import { certificateRPC, createGenerator, saveBlob } from './certificate-service'

const inputClass = 'w-full min-w-0 rounded-md border bg-background px-3 py-2 text-sm'
const buttonClass = 'rounded-md border px-4 py-2 text-sm font-medium disabled:opacity-50 hover:bg-muted'
const initialSettings = { classType: 'CLT', issueDate: '2026-10-20', endDate: '2026-10-19', level: 'N5 (Dasar)', duration: '180', predicate: 'auto', result: 'LULUS' }

export default function CertificateBatch() {
  const [rows, setRows] = useState([])
  const [settings, setSettings] = useState(initialSettings)
  const [source, setSource] = useState('')
  const [busy, setBusy] = useState(false)
  const [ready, setReady] = useState(false)
  const [status, setStatus] = useState('Pilih folder berisi satu Excel dan foto yang dinamai sesuai nama murid.')
  const [error, setError] = useState('')
  const [nextNumber, setNextNumber] = useState(null)
  const [download, setDownload] = useState(null)
  const [progress, setProgress] = useState(0)
  const frame = useRef(null)
  const working = useRef(false)
  const selected = rows.filter(row => row.selected)
  const invalid = selected.filter(row => row.photoError || !row.ttl.trim())

  useEffect(() => {
    certificateRPC('certificate_batch', { p_action: 'next' }).then(data => setNextNumber(data.next_number)).catch(e => setError(e.message))
    const warn = event => { if (working.current) { event.preventDefault(); event.returnValue = '' } }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [])

  async function importFolder(event) {
    const files = [...event.target.files]
    event.target.value = ''
    if (!files.length) return
    setBusy(true); setError(''); setRows([]); setDownload(null); setSource('')
    try {
      const books = files.filter(file => /\.xlsx$/i.test(file.name) && !file.name.startsWith('~$'))
      if (books.length !== 1) throw new Error('Folder harus berisi tepat satu file .xlsx (file sementara Excel diabaikan).')
      if (books[0].size > 50 * 1024 * 1024) throw new Error('Ukuran workbook maksimal 50 MB.')
      setStatus('Membaca tabel master AUTOMATE…')
      const XLSX = await import('xlsx-js-style')
      const book = XLSX.read(await books[0].arrayBuffer(), { type: 'array', cellNF: true, cellText: true })
      const imported = parseCertificateWorkbook(XLSX, book)
      setRows(matchPhotos(imported.rows, files)); setSource(`${books[0].name} · ${imported.sheetName}`)
      setStatus(`${imported.rows.length} peserta ditemukan. Nama, tempat/tanggal lahir, dan nilai diambil dari AUTOMATE. Periksa data dan foto sebelum generate.`)
    } catch (e) { setError(e.message); setStatus('Impor belum berhasil.') }
    finally { setBusy(false) }
  }

  function editRow(index, update) {
    setRows(previous => previous.map((row, i) => i === index ? { ...row, ...update } : row))
    setDownload(null)
  }

  async function generate(issue) {
    if (working.current) return
    setError(''); setDownload(null); setProgress(0)
    if (!selected.length || invalid.length) { setError('Pilih peserta dan lengkapi foto serta tempat/tanggal lahir.'); return }
    if (!settings.issueDate || !settings.endDate || settings.endDate > settings.issueDate || !settings.level.trim() || !settings.predicate.trim() || !/^\d+(\.\d+)?$/.test(settings.duration) || Number(settings.duration) <= 0) {
      setError('Lengkapi pengaturan. Tanggal selesai tidak boleh sesudah tanggal terbit, dan durasi harus lebih dari nol.'); return
    }
    if (!ready || !frame.current?.contentWindow?.CertificateCore) { setError('Engine generator belum siap. Tunggu lalu coba lagi.'); return }
    setBusy(true); working.current = true
    const generator = createGenerator(frame.current)
    try {
      const core = frame.current.contentWindow.CertificateCore
      const calibration = core.readAdjustments()
      const prepared = []
      for (const [index, row] of selected.entries()) {
        setStatus(`Memeriksa foto ${index + 1}/${selected.length}: ${row.name}`)
        const photoDataUrl = await core.cropPhoto(row.photo)
        prepared.push({ ...row, photoDataUrl, photoHash: await sha256(await row.photo.arrayBuffer()) })
      }
      const payload = {
        settings, calibration,
        rows: prepared.map(row => ({ name: row.name, ttl: row.ttl.trim(), photoHash: row.photoHash, scores: row.scores.map(score => ({ ...score, display: score.display.replace(',', '.') })) })),
      }
      const key = await sha256(JSON.stringify(payload))
      let reservation = null
      if (issue) {
        setStatus('Memesan nomor sertifikat dari server…')
        reservation = await certificateRPC('certificate_batch', { p_action: 'reserve', p_key: key, p_payload: payload })
      }
      const files = {}, hashes = [], manifest = []
      for (const [index, row] of prepared.entries()) {
        setStatus(`Membuat PDF ${index + 1}/${prepared.length}: ${row.name}`)
        const number = reservation?.records[index].number || 'PRATINJAU - BELUM DITERBITKAN'
        const result = await generator.generate({
          nama: row.name, nomor: number, ttl: row.ttl.trim(), level: settings.level,
          lama: settings.duration, predikat: settings.predicate === 'auto' ? predicateFor(row.scores[4].display) : settings.predicate, lulus: settings.result,
          tgl_selesai: settings.endDate, tgl_terbit: settings.issueDate, scoreSource: 'excel', calibration,
          ...Object.fromEntries(row.scores.map((score, i) => [`n${i + 1}`, score.display.replace(',', '.')])) ,
        }, row.photoDataUrl)
        const bytes = new Uint8Array(await (await fetch(result.pdfDataUrl)).arrayBuffer())
        hashes.push(await sha256(bytes))
        const filename = `${String(index + 1).padStart(3, '0')}_${result.fileName}`
        files[filename] = bytes
        manifest.push({ number, name: row.name, filename, sha256: hashes[index], scores: row.scores, validator: issue ? `${location.origin}/validasi-sertifikat?nomor=${encodeURIComponent(number)}` : null })
        setProgress(index + 1)
        await new Promise(resolve => setTimeout(resolve, 0))
      }
      files['manifest.json'] = strToU8(JSON.stringify({ batch: key, issued: issue, source, certificates: manifest }, null, 2))
      const zip = new Blob([zipSync(files, { level: 0 })], { type: 'application/zip' })
      if (issue) {
        setStatus('PDF selesai. Mencatat penerbitan untuk validator publik…')
        await certificateRPC('certificate_batch', { p_action: 'complete', p_key: key, p_hashes: hashes })
      }
      const filename = `${issue ? 'Sertifikat' : 'Pratinjau'}_${settings.classType}_${settings.issueDate}_${key.slice(0, 8)}.zip`
      setDownload({ blob: zip, filename }); saveBlob(zip, filename)
      setStatus(issue ? `${selected.length} sertifikat diterbitkan dan ZIP siap. Nomor dapat diperiksa di validator publik.` : `${selected.length} PDF pratinjau siap. Belum diterbitkan dan tidak memakai nomor resmi.`)
      if (issue) certificateRPC('certificate_batch', { p_action: 'next' }).then(data => setNextNumber(data.next_number)).catch(() => {})
    } catch (e) {
      setError(`${e.message} Jika nomor sudah dipesan, ulangi dengan data dan foto yang sama untuk memakai reservasi yang sama.`)
      setStatus('Proses belum selesai. Batch belum dinyatakan selesai oleh aplikasi.')
    } finally { generator.destroy(); working.current = false; setBusy(false) }
  }

  return <section className="space-y-5 min-w-0" aria-labelledby="batch-title">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 id="batch-title" className="text-lg font-semibold">Sertifikat massal dari folder</h2><p className="text-sm text-muted-foreground">Excel + foto murid → periksa data → generate PDF dan unduh ZIP.</p></div>
      <Link className={buttonClass} to="/validasi-sertifikat" target="_blank" rel="noopener noreferrer">Validator publik ↗</Link>
    </div>
    <fieldset disabled={busy} className="space-y-4 rounded-xl border bg-card p-4 min-w-0">
      <label className="block space-y-2"><span className="font-medium text-sm">1. Pilih folder lokal</span><input aria-label="Folder sertifikat" type="file" webkitdirectory="" directory="" multiple onChange={importFolder} className="block w-full min-w-0 text-sm" /></label>
      <p className="text-xs text-muted-foreground break-words">{source || 'Satu master .xlsx dengan sheet AUTOMATE dan foto JPG/PNG/WebP. Sheet lain diabaikan. Nama foto tidak membedakan kapital atau spasi berulang. Subfolder boleh digunakan.'}</p>
      {!!rows.length && <p className="text-sm text-green-700">Folder berhasil dibaca: {rows.length} peserta.</p>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm">Jenis kelas<select aria-label="Jenis kelas" className={inputClass} value={settings.classType} onChange={e => setSettings({ ...settings, classType: e.target.value })}>{['CLT', 'Bimbel', 'TG'].map(v => <option key={v}>{v}</option>)}</select></label>
        <label className="text-sm">Tanggal terbit<input aria-label="Tanggal terbit" className={inputClass} type="date" value={settings.issueDate} onChange={e => setSettings({ ...settings, issueDate: e.target.value })} /></label>
        <label className="text-sm">Tanggal selesai kursus<input aria-label="Tanggal selesai kursus" className={inputClass} type="date" value={settings.endDate} onChange={e => setSettings({ ...settings, endDate: e.target.value })} /></label>
        <label className="text-sm">Level<input aria-label="Level" className={inputClass} value={settings.level} onChange={e => setSettings({ ...settings, level: e.target.value })} /></label>
        <label className="text-sm">Lama belajar (jam)<input aria-label="Lama belajar" className={inputClass} type="number" min="1" value={settings.duration} onChange={e => setSettings({ ...settings, duration: e.target.value })} /></label>
        <label className="text-sm">Predikat<select aria-label="Predikat" className={inputClass} value={settings.predicate} onChange={e => setSettings({ ...settings, predicate: e.target.value })}><option value="auto">Sesuai Summary Excel</option>{['Cukup', 'Baik', 'Amat Baik', 'Amat Sangat Baik', 'Sempurna'].map(v => <option key={v}>{v}</option>)}</select></label>
        <label className="text-sm">Hasil<select aria-label="Hasil" className={inputClass} value={settings.result} onChange={e => setSettings({ ...settings, result: e.target.value })}><option>LULUS</option><option>TIDAK LULUS</option></select></label>
        <div className="text-sm">Nomor urut berikutnya<p className="pt-2 text-lg font-semibold">{nextNumber ?? 'Belum tersedia'}</p></div>
      </div>
      <p className="text-xs text-muted-foreground">Pengaturan awal mengikuti contoh. Periksa tanggal, level, durasi, predikat, dan hasil sebelum menerbitkan. Nomor final ditetapkan server saat generate.</p>
    </fieldset>
    {!!rows.length && <fieldset disabled={busy} className="space-y-3 min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-medium">2. Periksa {rows.length} peserta</h3><button className={buttonClass} onClick={() => setRows(rows.map(row => ({ ...row, selected: !rows.every(r => r.selected) })))}>{rows.every(row => row.selected) ? 'Batalkan semua pilihan' : 'Pilih semua'}</button></div>
      <p className="text-sm text-muted-foreground">Nama dicetak KAPITAL. Tempat/tanggal lahir otomatis dari kolom Tempat di AUTOMATE dan dapat dikoreksi di sini. Nilai akhir (Summary) mengikuti Excel, tidak dihitung ulang. Kelas peserta dari Excel tidak mengubah jenis nomor CLT/Bimbel/TG.</p>
      <p className="text-xs text-muted-foreground">Geser tabel ke kanan untuk melihat seluruh nilai, termasuk Summary.</p>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm text-left"><thead className="bg-muted"><tr>{['Pilih', 'Nama / baris Excel', 'Foto', 'Tempat, tanggal lahir', 'Bunpou', 'Dokkai', 'Kaiwa', 'Absensi', 'Summary'].map(h => <th className="px-3 py-3 whitespace-nowrap" key={h}>{h}</th>)}</tr></thead>
          <tbody>{rows.map((row, index) => <tr key={row.key} className="border-t">
            <td className="px-3 py-3"><input aria-label={`Pilih ${row.name}`} type="checkbox" checked={row.selected} onChange={e => editRow(index, { selected: e.target.checked })} /></td>
            <td className="px-3 py-3 min-w-40">{row.name}<small className="block text-muted-foreground">{row.studentClass} · Baris {row.row}</small></td>
            <td className="px-3 py-3 min-w-48"><span className={row.photoError ? 'text-red-600' : 'text-green-700'}>{row.photoError || row.photo.name}</span><input aria-label={`Foto ${row.name}`} type="file" accept="image/jpeg,image/png,image/webp" className="mt-1 block w-48 text-xs" onChange={e => { const photo = e.target.files[0]; if (photo) editRow(index, { photo, photoError: photo.size && photo.size <= 10 * 1024 * 1024 ? '' : 'Foto harus 1 byte–10 MB' }) }} /></td>
            <td className="px-3 py-3 min-w-64"><input aria-label={`Tempat tanggal lahir ${row.name}`} className={inputClass} placeholder="Contoh: Kuningan, 11 Mei 1994" value={row.ttl} maxLength={200} onChange={e => editRow(index, { ttl: e.target.value })} /></td>
            {row.scores.map((score, i) => <td className="px-3 py-3 tabular-nums" key={i} title={`Nilai asli: ${score.value}; sel ${score.cell}`}>{score.display}</td>)}
          </tr>)}</tbody>
        </table>
      </div>
    </fieldset>}
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <p role="status" aria-live="polite" className="text-sm">{status}</p>
      {!!error && <p role="alert" className="text-sm text-red-600 break-words">{error}</p>}
      {busy && <progress className="w-full" max={Math.max(selected.length, 1)} value={progress} />}
      <p className="text-xs text-muted-foreground">{selected.length} dipilih · {invalid.length} perlu dilengkapi. Pratinjau tidak memakai nomor. Generate &amp; terbitkan akan mencatat penerbitan resmi.</p>
      <div className="flex flex-wrap gap-2">
        <button className={buttonClass} disabled={busy || !ready || !selected.length || !!invalid.length} onClick={() => generate(false)}>Unduh ZIP pratinjau</button>
        <button className={`${buttonClass} bg-primary text-primary-foreground hover:bg-primary/90`} disabled={busy || !ready || nextNumber === null || !selected.length || !!invalid.length} onClick={() => generate(true)}>Generate &amp; terbitkan ZIP</button>
        {download && <button className={buttonClass} onClick={() => saveBlob(download.blob, download.filename)}>Unduh ZIP lagi</button>}
      </div>
    </div>
    <iframe ref={frame} src="/sertifikat/index.html" title="Engine sertifikat massal" onLoad={() => setReady(true)} style={{ position: 'fixed', left: '-20000px', width: 1200, height: 900, visibility: 'hidden' }} aria-hidden="true" tabIndex={-1} />
  </section>
}
