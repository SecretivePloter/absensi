import { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import { CheckCircle2, XCircle, AlertCircle, ScanLine } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { QRScanner } from '../components/QRScanner'
import { Spinner } from '../components/ui/spinner'
import { useThemeStore } from '../store/useThemeStore'

const RESET_DELAY = 3500

export default function Scan() {
  const { theme, toggle } = useThemeStore()
  const [now, setNow] = useState(new Date())
  const [scanState, setScanState] = useState('idle') // idle | scanning | processing | success | duplicate | error
  const [result, setResult] = useState(null)
  const [processing, setProcessing] = useState(false)

  // Clock tick
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const resetToIdle = useCallback(() => {
    setScanState('idle')
    setResult(null)
    setProcessing(false)
  }, [])

  const handleScan = useCallback(async (qrValue) => {
    if (processing || scanState !== 'idle') return
    setProcessing(true)
    setScanState('processing')

    try {
      // Find user by qr_code
      const { data: user, error: userErr } = await supabase
        .from('users')
        .select('id, name, role, photo_url, is_active, classes(name)')
        .eq('qr_code', qrValue)
        .single()

      if (userErr || !user) {
        setResult({ type: 'error', message: 'QR code tidak dikenali' })
        setScanState('error')
        setTimeout(resetToIdle, RESET_DELAY)
        return
      }

      if (!user.is_active) {
        setResult({ type: 'error', message: `${user.name} — Akun nonaktif`, user })
        setScanState('error')
        setTimeout(resetToIdle, RESET_DELAY)
        return
      }

      const today = format(new Date(), 'yyyy-MM-dd')

      // Check duplicate
      const { data: existing } = await supabase
        .from('attendance')
        .select('id, check_in_at')
        .eq('user_id', user.id)
        .eq('date', today)
        .maybeSingle()

      if (existing) {
        setResult({
          type: 'duplicate',
          user,
          checkInAt: existing.check_in_at,
        })
        setScanState('duplicate')
        setTimeout(resetToIdle, RESET_DELAY)
        return
      }

      // Insert attendance
      const { error: insertErr } = await supabase
        .from('attendance')
        .insert({ user_id: user.id, method: 'qr', date: today })

      if (insertErr) throw insertErr

      setResult({ type: 'success', user })
      setScanState('success')
      setTimeout(resetToIdle, RESET_DELAY)
    } catch (err) {
      console.error(err)
      setResult({ type: 'error', message: 'Terjadi kesalahan sistem' })
      setScanState('error')
      setTimeout(resetToIdle, RESET_DELAY)
    }
  }, [processing, scanState, resetToIdle])

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {/* Header bar */}
      <div className="flex items-center justify-between px-6 py-4 bg-gray-800/80 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <ScanLine className="h-6 w-6 text-blue-400" />
          <div>
            <h1 className="font-bold text-sm leading-none">Absensi QR</h1>
            <p className="text-xs text-gray-400 mt-0.5">Kursus Bahasa Jepang</p>
          </div>
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

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        {scanState === 'idle' && (
          <div className="w-full max-w-sm animate-fade-in">
            <p className="text-center text-gray-300 mb-6">Arahkan QR code ke kamera</p>
            <div className="rounded-2xl overflow-hidden shadow-2xl border border-gray-700">
              <QRScanner onScan={handleScan} active={scanState === 'idle'} />
            </div>
            <p className="text-center text-xs text-gray-500 mt-4">
              Scan otomatis — tidak perlu menekan tombol
            </p>
          </div>
        )}

        {scanState === 'processing' && (
          <div className="flex flex-col items-center gap-4 animate-fade-in">
            <Spinner size="lg" className="text-blue-400" />
            <p className="text-gray-300">Memproses...</p>
          </div>
        )}

        {scanState === 'success' && result?.user && (
          <div className="flex flex-col items-center gap-4 animate-fade-in max-w-xs text-center">
            <div className="relative">
              {result.user.photo_url ? (
                <img
                  src={result.user.photo_url}
                  alt={result.user.name}
                  className="h-24 w-24 rounded-full object-cover border-4 border-green-500"
                />
              ) : (
                <div className="h-24 w-24 rounded-full bg-green-500/20 border-4 border-green-500 flex items-center justify-center text-3xl font-bold text-green-400">
                  {result.user.name?.charAt(0)?.toUpperCase()}
                </div>
              )}
              <div className="absolute -bottom-2 -right-2 bg-green-500 rounded-full p-1 animate-check-bounce">
                <CheckCircle2 className="h-6 w-6 text-white" />
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-bold">{result.user.name}</h2>
              <p className="text-gray-400 text-sm">
                {result.user.role === 'student' ? 'Murid' : 'Karyawan'}
                {result.user.classes?.name ? ` — ${result.user.classes.name}` : ''}
              </p>
            </div>
            <div className="bg-green-500/20 border border-green-500/50 rounded-xl px-6 py-3">
              <p className="text-green-400 font-semibold text-lg">Absensi Tercatat!</p>
              <p className="text-green-300/70 text-sm">{format(new Date(), 'HH:mm:ss')}</p>
            </div>
          </div>
        )}

        {scanState === 'duplicate' && result?.user && (
          <div className="flex flex-col items-center gap-4 animate-fade-in max-w-xs text-center">
            <div className="h-20 w-20 rounded-full bg-yellow-500/20 border-4 border-yellow-500 flex items-center justify-center">
              <AlertCircle className="h-10 w-10 text-yellow-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">{result.user.name}</h2>
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
          <div className="flex flex-col items-center gap-4 animate-fade-in max-w-xs text-center">
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

      {/* Footer */}
      <div className="px-6 py-3 bg-gray-800/80 flex justify-between items-center text-xs text-gray-500">
        <span>Tekan Escape atau tunggu 3 detik untuk reset</span>
        <a href="/dashboard" className="text-blue-400 hover:text-blue-300">
          Admin Dashboard →
        </a>
      </div>
    </div>
  )
}
