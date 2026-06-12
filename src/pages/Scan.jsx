import { useState, useEffect, useRef, useCallback } from 'react'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import { CheckCircle2, XCircle, AlertCircle, MapPin, LogOut } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { QRScanner } from '../components/QRScanner'
import { Spinner } from '../components/ui/spinner'

const CHECKOUT_MIN_GAP_MS = 5 * 60 * 1000
const EARLY_CHECKOUT_HOUR = 17

function getGreeting(date) {
  const h = date.getHours()
  if (h < 11) return 'Selamat Pagi'
  if (h < 15) return 'Selamat Siang'
  if (h < 18) return 'Selamat Sore'
  return 'Selamat Malam'
}

const firstName = (name) => (name || '').trim().split(/\s+/)[0]

const roleLabel = (role) => {
  if (role === 'student') return 'Murid'
  if (role === 'sensei') return 'Sensei'
  return 'Staff'
}

const playAudio = (src) => {
  try {
    const audio = new Audio(src)
    audio.volume = 1.0
    audio.play().catch(() => {})
  } catch (_) {}
}

const REASONS = [
  { value: 'izin', label: 'Izin', icon: '📋' },
  { value: 'sakit', label: 'Sakit', icon: '🏥' },
  { value: 'dinas_keluar', label: 'Dinas Keluar', icon: '🚗' },
  { value: 'others', label: 'Lainnya', icon: '📝' },
]

export default function Scan() {
  const [now, setNow] = useState(new Date())
  const [scanState, setScanState] = useState('idle') // idle | processing | reason | success | checkout | duplicate | error
  const [result, setResult] = useState(null)
  const [locations, setLocations] = useState([])
  const [locationId, setLocationId] = useState(() => localStorage.getItem('scan_location_id') || '')
  const [earlyCheckout, setEarlyCheckout] = useState(null) // { user, existingId, checkInAt }
  const lockRef = useRef(false)

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    supabase.from('locations').select('id, name').order('name').then(({ data }) => {
      setLocations(data || [])
      const saved = localStorage.getItem('scan_location_id')
      if (saved && data && !data.some(l => l.id === saved)) {
        localStorage.removeItem('scan_location_id')
        setLocationId('')
      }
    })
  }, [])

  const handleLocationChange = (e) => {
    const v = e.target.value
    setLocationId(v)
    if (v) localStorage.setItem('scan_location_id', v)
    else localStorage.removeItem('scan_location_id')
  }

  const handleScan = useCallback(async (qrValue) => {
    if (lockRef.current) return
    lockRef.current = true
    setScanState('processing')

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
        .select('id, check_in_at, check_out_at')
        .eq('user_id', user.id)
        .eq('date', today)
        .maybeSingle()

      // ---- Belum absen hari ini → catat MASUK ----
      if (!existing) {
        const { error: insertErr } = await supabase
          .from('attendance')
          .insert({
            user_id: user.id,
            method: 'qr',
            date: today,
            location_id: locationId || null,
          })

        if (insertErr) {
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
        playAudio('/audio/datang.mp3')
        finish(5000)
        return
      }

      // ---- Sudah masuk, belum pulang ----
      if (!existing.check_out_at) {
        const sinceCheckIn = Date.now() - new Date(existing.check_in_at).getTime()

        if (sinceCheckIn < CHECKOUT_MIN_GAP_MS) {
          setResult({ type: 'duplicate', user, checkInAt: existing.check_in_at })
          setScanState('duplicate')
          finish(2500)
          return
        }

        // Pulang lebih awal → tampilkan pilihan alasan
        if (new Date().getHours() < EARLY_CHECKOUT_HOUR) {
          setEarlyCheckout({ user, existingId: existing.id, checkInAt: existing.check_in_at })
          setScanState('reason')
          // lockRef tetap true — dilepas setelah reason dipilih
          return
        }

        // Pulang normal (≥ 17:00)
        const { error: updateErr } = await supabase
          .from('attendance')
          .update({ check_out_at: new Date().toISOString() })
          .eq('id', existing.id)
        if (updateErr) throw updateErr

        setResult({ type: 'checkout', user, checkInAt: existing.check_in_at })
        setScanState('checkout')
        playAudio('/audio/pulang.mp3')
        finish(5000)
        return
      }

      // ---- Sudah masuk DAN pulang ----
      setResult({
        type: 'done',
        user,
        checkInAt: existing.check_in_at,
        checkOutAt: existing.check_out_at,
      })
      setScanState('duplicate')
      finish(2500)
    } catch (err) {
      console.error(err)
      setResult({ type: 'error', message: 'Terjadi kesalahan sistem' })
      setScanState('error')
      setTimeout(() => {
        setScanState('idle')
        setResult(null)
        lockRef.current = false
      }, 2500)
    }
  }, [locationId])

  const handleReasonSelect = useCallback(async (reason) => {
    if (!earlyCheckout) return
    setScanState('processing')
    try {
      const { error } = await supabase
        .from('attendance')
        .update({
          check_out_at: new Date().toISOString(),
          early_checkout_reason: reason,
        })
        .eq('id', earlyCheckout.existingId)
      if (error) throw error

      setResult({ type: 'checkout', user: earlyCheckout.user, checkInAt: earlyCheckout.checkInAt })
      setScanState('checkout')
      playAudio('/audio/pulang.mp3')
      setTimeout(() => {
        setScanState('idle')
        setResult(null)
        setEarlyCheckout(null)
        lockRef.current = false
      }, 5000)
    } catch (err) {
      console.error(err)
      setResult({ type: 'error', message: 'Gagal menyimpan alasan' })
      setScanState('error')
      setTimeout(() => {
        setScanState('idle')
        setResult(null)
        setEarlyCheckout(null)
        lockRef.current = false
      }, 2500)
    }
  }, [earlyCheckout])

  const currentLocationName = locations.find(l => l.id === locationId)?.name

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {/* Header bar */}
      <div className="flex items-center justify-between px-6 py-4 bg-gray-800/80 backdrop-blur-sm gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <img src="/logo.png" alt="Ichikara" className="h-9 w-auto bg-white rounded-md px-2 py-1 shrink-0" />
          <h1 className="font-bold text-sm leading-none hidden sm:block">Absensi QR</h1>
        </div>

        <div className="flex items-center gap-2 min-w-0">
          <MapPin className={`h-4 w-4 shrink-0 ${locationId ? 'text-green-400' : 'text-yellow-400'}`} />
          <select
            value={locationId}
            onChange={handleLocationChange}
            className="bg-gray-700 text-white text-sm rounded-md px-3 py-2 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-[180px] truncate"
          >
            <option value="">Pilih Lokasi…</option>
            {locations.map(l => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>

        <div className="text-right shrink-0">
          <div className="text-2xl font-mono font-bold tabular-nums">
            {format(now, 'HH:mm:ss')}
          </div>
          <div className="text-xs text-gray-400">
            {format(now, 'EEEE, d MMMM yyyy', { locale: id })}
          </div>
        </div>
      </div>

      {locations.length > 0 && !locationId && (
        <div className="bg-yellow-500/20 border-b border-yellow-500/40 text-yellow-300 text-center text-sm py-2 px-4">
          ⚠ Pilih lokasi kantor di atas — absensi tanpa lokasi tetap tercatat tapi tidak diketahui kantornya
        </div>
      )}

      <div className="flex-1 relative flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm">
          <p className="text-center text-gray-300 mb-2">Arahkan QR code ke kamera</p>
          {currentLocationName && (
            <p className="text-center text-xs text-green-400/80 mb-4 flex items-center justify-center gap-1">
              <MapPin className="h-3 w-3" /> {currentLocationName}
            </p>
          )}
          <div className="rounded-2xl overflow-hidden shadow-2xl border border-gray-700">
            <QRScanner onScan={handleScan} />
          </div>
          <p className="text-center text-xs text-gray-500 mt-4">
            Scan pertama = masuk · scan kedua = pulang
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

            {/* PILIH ALASAN PULANG LEBIH AWAL */}
            {scanState === 'reason' && earlyCheckout && (
              <div className="flex flex-col items-center gap-6 animate-fade-in text-center max-w-xs w-full">
                <div>
                  <p className="text-orange-300/90 text-xl">Pulang lebih awal,</p>
                  <h2 className="text-4xl font-bold mt-1">{firstName(earlyCheckout.user.name)}</h2>
                  <p className="text-gray-400 text-sm mt-2">
                    Masuk {format(new Date(earlyCheckout.checkInAt), 'HH:mm')}
                  </p>
                </div>
                <p className="text-gray-300 text-sm font-medium">Pilih alasan kepulangan:</p>
                <div className="grid grid-cols-2 gap-3 w-full">
                  {REASONS.map(({ value, label, icon }) => (
                    <button
                      key={value}
                      onClick={() => handleReasonSelect(value)}
                      className="bg-gray-700 hover:bg-gray-600 active:scale-95 transition-all rounded-xl p-4 text-center border border-gray-600 hover:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-400"
                    >
                      <div className="text-2xl mb-2">{icon}</div>
                      <div className="font-medium text-sm">{label}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* MASUK */}
            {scanState === 'success' && result?.user && (
              <div className="flex flex-col items-center gap-5 animate-fade-in text-center">
                <div className="relative">
                  {result.user.photo_url ? (
                    <img src={result.user.photo_url} alt={result.user.name} className="h-28 w-28 rounded-full object-cover border-4 border-green-500" />
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
                    {roleLabel(result.user.role)}
                    {result.user.classes?.name ? ` — ${result.user.classes.name}` : ''}
                  </p>
                </div>
                <div className="bg-green-500/20 border border-green-500/50 rounded-xl px-6 py-2.5">
                  <p className="text-green-400 font-medium">
                    Absen masuk tercatat · {format(new Date(), 'HH:mm')}
                    {currentLocationName ? ` · ${currentLocationName}` : ''}
                  </p>
                </div>
              </div>
            )}

            {/* PULANG */}
            {scanState === 'checkout' && result?.user && (
              <div className="flex flex-col items-center gap-5 animate-fade-in text-center">
                <div className="relative">
                  {result.user.photo_url ? (
                    <img src={result.user.photo_url} alt={result.user.name} className="h-28 w-28 rounded-full object-cover border-4 border-blue-500" />
                  ) : (
                    <div className="h-28 w-28 rounded-full bg-blue-500/20 border-4 border-blue-500 flex items-center justify-center text-4xl font-bold text-blue-400">
                      {result.user.name?.charAt(0)?.toUpperCase()}
                    </div>
                  )}
                  <div className="absolute -bottom-2 -right-2 bg-blue-500 rounded-full p-1 animate-check-bounce">
                    <LogOut className="h-7 w-7 text-white" />
                  </div>
                </div>
                <div>
                  <p className="text-xl text-blue-300/90">Sampai Jumpa,</p>
                  <h2 className="text-4xl font-bold mt-1">{firstName(result.user.name)}</h2>
                  <p className="text-gray-400 text-sm mt-2">
                    Masuk {format(new Date(result.checkInAt), 'HH:mm')}
                  </p>
                </div>
                <div className="bg-blue-500/20 border border-blue-500/50 rounded-xl px-6 py-2.5">
                  <p className="text-blue-400 font-medium">
                    Absen pulang tercatat · {format(new Date(), 'HH:mm')}
                  </p>
                </div>
              </div>
            )}

            {/* DUPLIKAT / SUDAH LENGKAP */}
            {scanState === 'duplicate' && result?.user && (
              <div className="flex flex-col items-center gap-4 animate-fade-in text-center">
                <div className="h-20 w-20 rounded-full bg-yellow-500/20 border-4 border-yellow-500 flex items-center justify-center">
                  <AlertCircle className="h-10 w-10 text-yellow-400" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">{firstName(result.user.name)}</h2>
                  <p className="text-gray-400 text-sm">{roleLabel(result.user.role)}</p>
                </div>
                <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-xl px-6 py-3">
                  {result.type === 'done' ? (
                    <>
                      <p className="text-yellow-400 font-semibold text-lg">Absensi Hari Ini Lengkap</p>
                      <p className="text-yellow-300/70 text-sm">
                        Masuk {format(new Date(result.checkInAt), 'HH:mm')} · Pulang {format(new Date(result.checkOutAt), 'HH:mm')}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-yellow-400 font-semibold text-lg">Baru Saja Absen Masuk</p>
                      <p className="text-yellow-300/70 text-sm">
                        Pukul {format(new Date(result.checkInAt), 'HH:mm:ss')} — scan pulang tersedia 5 menit setelah masuk
                      </p>
                    </>
                  )}
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

      <div className="px-6 py-3 bg-gray-800/80 flex justify-between items-center text-xs text-gray-500">
        <span>Layar otomatis kembali normal setelah beberapa detik</span>
        <a href="/dashboard" className="text-blue-400 hover:text-blue-300">
          Admin Dashboard →
        </a>
      </div>
    </div>
  )
}
