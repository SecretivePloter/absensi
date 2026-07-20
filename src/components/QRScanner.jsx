import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'

/**
 * QRScanner — compatible with laptop (front cam) and Android (back cam).
 *
 * Strategy:
 * 1. Enumerate all cameras.
 * 2. Prefer the camera whose label contains 'back' / 'environment' when
 *    facingMode === 'environment', otherwise prefer 'front' / 'user'.
 * 3. Fall back to ANY available camera if preferred label not found.
 * 4. If the constraint-based start fails (OverconstrainedError on laptops),
 *    retry with the first available camera ID.
 */
export function QRScanner({ onScan, onError, facingMode = 'environment' }) {
  const [hasCamera, setHasCamera] = useState(true)
  const [errorMsg, setErrorMsg] = useState(null)
  const onScanRef = useRef(onScan)
  onScanRef.current = onScan

  const scannerRef = useRef(null)
  const containerIdRef = useRef('qr-reader-' + Math.random().toString(36).slice(2, 8))

  useEffect(() => {
    const containerId = containerIdRef.current
    const scanner = new Html5Qrcode(containerId)
    scannerRef.current = scanner
    let active = true

    const startConfig = {
      fps: 15,
      disableFlip: false // allow flipped codes for better detection
    };
    const decodeSuccess = (text) => onScanRef.current?.(text)
    const decodeError = () => { } // per-frame decode errors are normal

      ; (async () => {
        try {
          // --- 1. Enumerate cameras ---
          let cameras = []
          try {
            cameras = await Html5Qrcode.getCameras()
          } catch (permErr) {
            console.warn('getCameras failed:', permErr)
          }

          if (!active) return

          if (!cameras || cameras.length === 0) {
            setHasCamera(false)
            setErrorMsg('Tidak ada kamera yang terdeteksi. Pastikan browser memiliki izin akses kamera.')
            return
          }

          // --- 2. Pick best camera by label ---
          const wantBack = facingMode === 'environment'
          const backKeywords = ['back', 'environment', 'rear', 'belakang']
          const frontKeywords = ['front', 'user', 'depan']

          const preferred = cameras.find(c => {
            const label = (c.label || '').toLowerCase()
            return wantBack
              ? backKeywords.some(k => label.includes(k))
              : frontKeywords.some(k => label.includes(k))
          })
          const fallbackCam = cameras[0]
          const chosenCam = preferred || fallbackCam

          // --- 3. Try starting with facingMode constraint first (gives correct cam on mobile) ---
          let started = false
          if (active) {
            try {
              await scanner.start(
                { facingMode },
                startConfig,
                decodeSuccess,
                decodeError
              )
              started = true
            } catch (constraintErr) {
              // OverconstrainedError — common on laptops that have no rear cam.
              // Fall through to camera-ID approach.
              console.warn(`facingMode '${facingMode}' failed, falling back to camera ID:`, constraintErr?.message || constraintErr)
            }
          }

          // --- 4. Fallback: start by camera ID ---
          if (!started && active) {
            try {
              await scanner.start(
                chosenCam.id,
                startConfig,
                decodeSuccess,
                decodeError
              )
              started = true
            } catch (idErr) {
              // Last resort: try every camera
              for (const cam of cameras) {
                if (!active || started) break
                try {
                  await scanner.start(cam.id, startConfig, decodeSuccess, decodeError)
                  started = true
                } catch {
                  /* try next */
                }
              }
            }
          }

          if (!started) {
            setHasCamera(false)
            setErrorMsg('Kamera tidak bisa diaktifkan. Coba muat ulang halaman atau periksa izin browser.')
          }
        } catch (err) {
          if (!active) return
          console.error('QR scanner error:', err)
          onError?.(err)
          setHasCamera(false)
          setErrorMsg('Kamera tidak tersedia. Pastikan browser memiliki izin akses kamera.')
        }
      })()

    return () => {
      active = false
      try {
        if (scanner.getState && scanner.getState() === 2) {
          scanner.stop().then(() => scanner.clear()).catch(() => { })
        } else {
          scanner.clear?.()
        }
      } catch {
        /* noop */
      }
      scannerRef.current = null
    }
  }, [facingMode]) // restart scanner saat facingMode berubah

  if (!hasCamera) {
    return (
      <div className="flex items-center justify-center h-64 rounded-lg bg-gray-800 text-gray-300 text-center p-6">
        <div>
          <p className="font-medium">⚠ Kamera tidak tersedia</p>
          <p className="text-sm mt-2 text-gray-400">
            {errorMsg || 'Pastikan browser memiliki izin akses kamera dan muat ulang halaman.'}
          </p>
          <button
            onClick={() => { setHasCamera(true); setErrorMsg(null) }}
            className="mt-4 px-4 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
          >
            Coba Lagi
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="relative w-full h-full">
      <div
        id={containerIdRef.current}
        className="w-full h-full rounded-lg overflow-hidden"
        style={{ minHeight: '240px' }}
      />
      <style>{`
        #${containerIdRef.current} video {
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
        }
        #${containerIdRef.current} > div {
          border: none !important;
        }
      `}</style>
    </div>
  )
}
