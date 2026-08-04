import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import { CheckCircle2, XCircle, AlertCircle, Maximize, Minimize, SwitchCamera, CalendarDays } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { QRScanner } from '../components/QRScanner'
import { Spinner } from '../components/ui/spinner'

const firstName = (name) => (name || '').trim().split(/\s+/)[0]

const playAudio = (src) => {
    try {
        const audio = new Audio(src)
        audio.volume = 1.0
        audio.play().catch(() => { })
    } catch (_) { }
}

export default function EventScan() {
    const { eventId } = useParams()
    const [now, setNow] = useState(new Date())
    const [eventData, setEventData] = useState(null)
    const [scanState, setScanState] = useState('idle') // idle | processing | success | duplicate | error
    const [result, setResult] = useState(null)

    const [facingMode, setFacingMode] = useState('environment')
    const lockRef = useRef(false)

    useEffect(() => {
        const t = setInterval(() => setNow(new Date()), 1000)
        return () => clearInterval(t)
    }, [])

    useEffect(() => {
        if (eventId) {
            supabase.from('events').select('name, is_active').eq('id', eventId).single().then(({ data }) => {
                if (data) setEventData(data)
            })
        }
    }, [eventId])

    const toggleCamera = () => {
        setFacingMode(prev => prev === 'environment' ? 'user' : 'environment')
    }

    const handleScan = useCallback(async (qrValue) => {
        if (lockRef.current || !eventData?.is_active) return
        lockRef.current = true
        setScanState('processing')

        const finish = (delay) => setTimeout(() => {
            setScanState('idle')
            setResult(null)
            lockRef.current = false
        }, delay)

        try {
            // 1. Dapatkan data user
            const { data: user, error: userErr } = await supabase
                .from('users')
                .select('id, name, role, photo_url, is_active')
                .eq('qr_code', qrValue)
                .single()

            if (userErr || !user) {
                setResult({ type: 'error', message: 'QR code tidak dikenali' })
                setScanState('error')
                finish(2500)
                return
            }

            if (!user.is_active) {
                setResult({ type: 'error', message: `${user.name} - Akun nonaktif` })
                setScanState('error')
                finish(2500)
                return
            }

            // 2. Cek apakah user adalah partisipan event
            const { data: participant } = await supabase
                .from('event_participants')
                .select('id')
                .eq('event_id', eventId)
                .eq('user_id', user.id)
                .maybeSingle()

            if (!participant) {
                setResult({ type: 'error', message: `${firstName(user.name)} belum didaftarkan sebagai peserta event ini.` })
                setScanState('error')
                finish(3500)
                return
            }

            // 3. Catat attendance event (hanya 1x per hari)
            const today = format(new Date(), 'yyyy-MM-dd')

            const { error: insertErr } = await supabase
                .from('event_attendance')
                .insert({
                    event_participant_id: participant.id,
                    date: today,
                })

            if (insertErr) {
                if (insertErr.code === '23505') {
                    setResult({ type: 'duplicate', user })
                    setScanState('duplicate')
                    finish(2500)
                    return
                }
                throw insertErr
            }

            setResult({ type: 'success', user })
            setScanState('success')
            playAudio('/audio/datang.mp3') // menggunakan suara sama seperti datang biasa
            finish(5000)

        } catch (err) {
            console.error(err)
            setResult({ type: 'error', message: 'Terjadi kesalahan sistem' })
            setScanState('error')
            finish(2500)
        }
    }, [eventId, eventData])

    const [isFullscreen, setIsFullscreen] = useState(false)

    useEffect(() => {
        const onChange = () => setIsFullscreen(!!document.fullscreenElement)
        document.addEventListener('fullscreenchange', onChange)
        return () => document.removeEventListener('fullscreenchange', onChange)
    }, [])

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => { })
        } else {
            document.exitFullscreen().catch(() => { })
        }
    }

    return (
        <div className="h-[100dvh] bg-gray-900 text-white flex flex-col overflow-hidden">
            {/* Header compact */}
            <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 bg-gray-800/90 backdrop-blur-sm border-b border-gray-700 shrink-0">
                <img src="/logo.png" alt="Ichikara" className="h-6 sm:h-7 w-auto bg-white rounded px-1 sm:px-1.5 py-0.5 shrink-0" />

                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <CalendarDays className="h-4 w-4 shrink-0 text-blue-400" />
                    <span className="text-xs sm:text-sm font-medium truncate text-blue-100">
                        {eventData?.name || 'Memuat...'}
                    </span>
                </div>

                <div className="text-right shrink-0 px-2 lg:px-4">
                    <div className="text-sm sm:text-base font-mono font-bold tabular-nums leading-none">
                        {format(now, 'HH:mm:ss')}
                    </div>
                    <div className="text-[9px] sm:text-[10px] text-gray-400 leading-none mt-0.5">
                        {format(now, 'EEE, d MMM yyyy', { locale: id })}
                    </div>
                </div>

                <button onClick={toggleCamera} className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-gray-700 active:bg-gray-600 transition-colors shrink-0">
                    <SwitchCamera className="h-4 w-4" />
                </button>

                <button onClick={toggleFullscreen} className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-gray-700 transition-colors shrink-0">
                    {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                </button>
            </div>

            {eventData && !eventData.is_active && (
                <div className="bg-red-500/20 border-b border-red-500/40 text-red-300 text-center text-xs py-2 px-4 shrink-0">
                    ⚠ Event ini sudah tidak aktif / selesai. Scanner dimatikan.
                </div>
            )}

            {/* Scanner area */}
            <div className="flex-1 relative flex flex-col items-center justify-center px-2 sm:px-3 py-2 sm:py-3 min-h-0">
                <div className="w-full max-w-sm flex flex-col h-full justify-center gap-1.5 sm:gap-2">
                    <p className="text-center text-gray-400 text-xs">
                        Arahkan QR code ke kamera
                    </p>
                    <div className="rounded-xl overflow-hidden shadow-2xl border border-gray-700 flex-1 min-h-0" style={{ maxHeight: '65dvh' }}>
                        <QRScanner onScan={handleScan} facingMode={facingMode} />
                    </div>
                    <p className="text-center text-[10px] sm:text-[11px] text-gray-600">
                        Pastikan Anda sudah dicalonkan sebagai peserta.
                    </p>
                </div>

                {/* Overlay hasil scan */}
                {scanState !== 'idle' && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-900/95 backdrop-blur-sm px-3 sm:px-4">

                        {scanState === 'processing' && (
                            <div className="flex flex-col items-center gap-3 sm:gap-4 animate-fade-in">
                                <Spinner size="lg" className="text-blue-400" />
                                <p className="text-gray-300 text-sm">Memproses...</p>
                            </div>
                        )}

                        {scanState === 'success' && result?.user && (
                            <div className="flex flex-col items-center gap-3 sm:gap-4 animate-fade-in text-center">
                                <div className="relative">
                                    {result.user.photo_url ? (
                                        <img src={result.user.photo_url} alt={result.user.name} className="h-20 w-20 sm:h-24 sm:w-24 rounded-full object-cover border-4 border-green-500" />
                                    ) : (
                                        <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-full bg-green-500/20 border-4 border-green-500 flex items-center justify-center text-2xl font-bold text-green-400">
                                            {result.user.name?.charAt(0)?.toUpperCase()}
                                        </div>
                                    )}
                                    <div className="absolute -bottom-2 -right-2 bg-green-500 rounded-full p-1 animate-check-bounce">
                                        <CheckCircle2 className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                                    </div>
                                </div>
                                <div>
                                    <p className="text-sm sm:text-base text-green-300/90">Berhasil,</p>
                                    <h2 className="text-2xl sm:text-3xl font-bold mt-0.5">{firstName(result.user.name)}</h2>
                                </div>
                                <div className="bg-green-500/20 border border-green-500/50 rounded-xl px-4 py-2">
                                    <p className="text-green-400 font-medium text-xs sm:text-sm">
                                        Kehadiran Event Tercatat
                                    </p>
                                </div>
                            </div>
                        )}

                        {scanState === 'duplicate' && result?.user && (
                            <div className="flex flex-col items-center gap-2.5 sm:gap-3 animate-fade-in text-center">
                                <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-full bg-yellow-500/20 border-4 border-yellow-500 flex items-center justify-center">
                                    <AlertCircle className="h-7 w-7 text-yellow-400" />
                                </div>
                                <div>
                                    <h2 className="text-lg sm:text-xl font-bold">{firstName(result.user.name)}</h2>
                                </div>
                                <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-xl px-4 py-2">
                                    <p className="text-yellow-400 font-semibold text-sm">Sudah Hadir Hari Ini</p>
                                </div>
                            </div>
                        )}

                        {scanState === 'error' && (
                            <div className="flex flex-col items-center gap-2.5 sm:gap-3 animate-fade-in text-center">
                                <div className="h-14 w-14 rounded-full bg-red-500/20 border-4 border-red-500 flex items-center justify-center">
                                    <XCircle className="h-7 w-7 text-red-400" />
                                </div>
                                <div className="bg-red-500/20 border border-red-500/50 rounded-xl px-4 py-2">
                                    <p className="text-red-400 font-semibold text-sm">Gagal</p>
                                    <p className="text-red-300/70 text-xs">{result?.message}</p>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
