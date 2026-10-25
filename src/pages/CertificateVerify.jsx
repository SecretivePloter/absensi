import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { certificateRPC } from '../features/sertifikat/certificate-service'

export default function CertificateVerify() {
  const [params] = useSearchParams()
  const [number, setNumber] = useState(params.get('nomor') || '')
  const [result, setResult] = useState(undefined)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function verify(event) {
    event.preventDefault(); setError(''); setResult(undefined)
    const normalized = number.trim().toUpperCase()
    if (!/^NO\.S\.\d+\.(CLT|BIMBEL|TG)\.\d{1,2}\.(I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII)\.\d{4}$/.test(normalized)) {
      setError('Format nomor belum sesuai. Contoh: NO.S.1058.CLT.20.X.2026'); return
    }
    setBusy(true)
    try { setResult(await certificateRPC('certificate_verify', { p_number: normalized })) }
    catch { setError('Layanan validasi belum dapat dihubungi. Coba lagi. Gangguan koneksi tidak berarti sertifikat tidak valid.') }
    finally { setBusy(false) }
  }
  return <main className="min-h-screen bg-background px-4 py-12 text-foreground">
    <div className="mx-auto max-w-xl space-y-6">
      <div><p className="text-sm font-medium text-muted-foreground">LPJ ICHIKARA</p><h1 className="mt-2 text-3xl font-bold">Validasi sertifikat</h1><p className="mt-3 text-muted-foreground">Periksa nomor sertifikat dan cocokkan identitas yang tampil dengan dokumen yang diterima. Tidak perlu login.</p></div>
      <form onSubmit={verify} className="rounded-xl border bg-card p-5 space-y-4">
        <label className="block font-medium" htmlFor="certificate-number">Nomor sertifikat</label>
        <input id="certificate-number" className="w-full min-w-0 rounded-md border bg-background p-3 text-sm" value={number} onChange={e => { setNumber(e.target.value); setResult(undefined); setError('') }} maxLength={80} placeholder="NO.S.1058.CLT.20.X.2026" required disabled={busy} autoComplete="off" spellCheck={false} />
        <button className="w-full rounded-md bg-primary p-3 font-medium text-primary-foreground disabled:opacity-50" disabled={busy}>{busy ? 'Memeriksa…' : 'Periksa sertifikat'}</button>
      </form>
      {error && <p role="alert" className="rounded-lg border border-red-300 p-4 text-red-600">{error}</p>}
      {result !== undefined && <section role="status" className="rounded-xl border bg-card p-5 space-y-3">
        <h2 className="text-lg font-semibold">{result ? 'Sertifikat terdaftar dan valid' : 'Nomor belum terdaftar'}</h2>
        {result ? <dl className="space-y-3">{[['Nomor', result.number], ['Nama peserta', result.name], ['Jenis kelas', result.class_type], ['Tanggal terbit', new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(result.issued_date))]].map(([label, value]) => <div key={label}><dt className="text-sm text-muted-foreground">{label}</dt><dd className="font-medium break-words">{value}</dd></div>)}</dl> : <p className="text-sm text-muted-foreground">Periksa kembali penulisan nomor. Sertifikat lama yang belum dimasukkan ke registri atau batch yang belum selesai diterbitkan tidak akan muncul. Hubungi admin Ichikara untuk konfirmasi.</p>}
      </section>}
      <p className="text-xs text-muted-foreground">Validasi ini mencocokkan registri penerbitan. Pastikan nama, kelas, dan tanggal pada dokumen sama dengan hasil pemeriksaan.</p>
    </div>
  </main>
}
