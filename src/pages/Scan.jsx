import { useState, useEffect, useRef, useCallback } from 'react'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { QRScanner } from '../components/QRScanner'
import { Spinner } from '../components/ui/spinner'

function getGreeting(date) {
  const h = date.getHours()
  if (h < 11) return 'Selamat Pagi'
  if (h < 15) return 'Selamat Siang'
  if (h < 18) return 'Selamat Sore'
  return 'Selamat Malam'
}

const firstName = (name) => (name || '').trim().split(/\s+/)[0]

export default function Scan() {
  const [now, setNow] = useState(new Date())
  const [scanState, setScanState] = useState('idle') // idle | processing | success | duplicate | error
  const [result, setResult] = useState(null)
  // Lock pakai ref supaya kebal stale closure — cegah scan berulang per frame
  const lockRef = useRef(false)

  // Jam real-time
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const handleScan = useCallback(async (qrValue) => {
    if (lockRef.current) return
    lockRef.current = true
    setScanState('processing')

    // Kembali ke idle & buka lock setelah delay
    const finish = (delay) => setTimeout(() => {
      setScanState('idle')
      setResult(null)
      lockRef.current = false
    }, delay)

    try {
      const { data: user, error: userErr } = await supabase
        .from('users')
        .select('id, name, role, photo_url, is_active, classes(name)')
        .eq('qr_code', qrValue)
        .single()

      if (userErr || !user) {
        setResult({ type: 'error', message: 'QR code tidak dikenali' })
        setScanState('error')
        finish(2500)
        return
      }

      if (!user.is_active) {
        setResult({ type: 'error', message: `${user.name} — Akun nonaktif` })
        setScanState('error')
        finish(2500)
        return
      }

      const today = format(new Date(), 'yyyy-MM-dd')

      const { data: existing } = await supabase
        .from('attendance')
        .select('id, check_in_at')
        .eq('user_id', user.id)
        .eq('date', today)
        .maybeSingle()

      if (existing) {
        setResult({ type: 'duplicate', user, checkInAt: existing.check_in_at })
        setScanState('duplicate')
        finish(2500)
        return
      }

      const { error: insertErr } = await supabase
        .from('attendance')
        .insert({ user_id: user.id, method: 'qr', date: today })

      if (insertErr) {
        // 23505 = unique violation: scan beradu cepat, sudah tercatat
        if (insertErr.code === '23505') {
          setResult({ type: 'duplicate', user, checkInAt: new Date().toISOString() })
          setScanState('duplicate')
          finish(2500)
          return
        }
        throw insertErr
      }

      setResult({ type: 'success', user, greeting: getGreeting(new Date()) })
      setScanState('success')
      finish(2000)
    } catch (err) {
      console.error(err)
      setResult({ type: 'error', message: 'Terjadi kesalahan sistem' })
      setScanState('error')
      finish(2500)
    }
  }, [])

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {/* Header bar */}
      <div className="flex items-center justify-between px-6 py-4 bg-gray-800/80 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Ichikara" className="h-9 w-auto bg-white rounded-md px-2 py-1" />
          <h1 className="font-bold text-sm leading-none">Absensi QR</h1>
        </div>

        <div className="text-right">
          <div className="text-2xl font-mono font-bold tabular-nums">
            {format(now, 'HH:mm:ss')}
          </div>
          <div className="text-xs text-gray-400">
            {format(now, 'EEEE, d MMMM yyyy', { locale: id })}
          </div>
        </div>
      </div>

      {/* Main content — scanner selalu ter-mount, hasil tampil sebagai overlay */}
      <div className="flex-1 relative flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm">
          <p className="text-center text-gray-300 mb-6">Arahkan QR code ke kamera</p>
          <div className="rounded-2xl overflow-hidden shadow-2xl border border-gray-700">
            <QRScanner onScan={handleScan} />
          </div>
          <p className="text-center text-xs text-gray-500 mt-4">
            Scan otomatis — tidak perlu menekan tombol
          </p>
        </div>

        {/* Overlay hasil scan */}
        {scanState !== 'idle' && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-900/95 backdrop-blur-sm px-4">
            {scanState === 'processing' && (
              <div className="flex flex-col items-center gap-4 animate-fade-in">
                <Spinner size="lg" className="text-blue-400" />
                <p className="text-gray-300">Memproses...</p>
              </div>
            )}

            {scanState === 'success' && result?.user && (
              <div className="flex flex-col items-center gap-5 animate-fade-in text-center">
                <div className="relative">
                  {result.user.photo_url ? (
                    <img
                      src={result.user.photo_url}
                      alt={result.user.name}
                      className="h-28 w-28 rounded-full object-cover border-4 border-green-500"
                    />
                  ) : (
                    <div className="h-28 w-28 rounded-full bg-green-500/20 border-4 border-green-500 flex items-center justify-center text-4xl font-bold text-green-400">
                      {result.user.name?.charAt(0)?.toUpperCase()}
                    </div>
                  )}
                  <div className="absolute -bottom-2 -right-2 bg-green-500 rounded-full p-1 animate-check-bounce">
                    <CheckCircle2 className="h-7 w-7 text-white" />
                  </div>
                </div>
                <div>
                  <p className="text-xl text-green-300/90">{result.greeting},</p>
                  <h2 className="text-4xl font-bold mt-1">{firstName(result.user.name)}</h2>
                  <p className="text-gray-400 text-sm mt-2">
                    {result.user.role === 'student' ? 'Murid' : 'Karyawan'}
                    {result.user.classes?.name ? ` — ${result.user.classes.name}` : ''}
                  </p>
                </div>
                <div className="bg-green-500/20 border border-green-500/50 rounded-xl px-6 py-2.5">
                  <p className="text-green-400 font-medium">
                    Absensi tercatat · {format(new Date(), 'HH:mm')}
                  </p>
                </div>
              </div>
            )}

            {scanState === 'duplicate' && result?.user && (
              <div className="flex flex-col items-center gap-4 animate-fade-in text-center">
                <div className="h-20 w-20 rounded-full bg-yellow-500/20 border-4 border-yellow-500 flex items-center justify-center">
                  <AlertCircle className="h-10 w-10 text-yellow-400" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">{firstName(result.user.name)}</h2>
                  <p className="text-gray-400 text-sm">
                    {result.user.role === 'student' ? 'Murid' : 'Karyawan'}
                  </p>
                </div>
                <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-xl px-6 py-3">
                  <p className="text-yellow-400 font-semibold text-lg">Sudah Absen Hari Ini</p>
                  <p className="text-yellow-300/70 text-sm">
                    Pukul {format(new Date(result.checkInAt), 'HH:mm:ss')}
                  </p>
                </div>
              </div>
            )}

            {scanState === 'error' && (
              <div className="flex flex-col items-center gap-4 animate-fade-in text-center">
                <div className="h-20 w-20 rounded-full bg-red-500/20 border-4 border-red-500 flex items-center justify-center">
                  <XCircle className="h-10 w-10 text-red-400" />
                </div>
                <div className="bg-red-500/20 border border-red-500/50 rounded-xl px-6 py-3">
                  <p className="text-red-400 font-semibold text-lg">Gagal</p>
                  <p className="text-red-300/70 text-sm">{result?.message}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-3 bg-gray-800/80 flex justify-between items-center text-xs text-gray-500">
        <span>Layar otomatis kembali normal setelah beberapa detik</span>
        <a href="/dashboard" className="text-blue-400 hover:text-blue-300">
          Admin Dashboard →
        </a>
      </div>
    </div>
  )
}
