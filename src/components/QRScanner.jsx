import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'

export function QRScanner({ onScan, onError, facingMode = 'environment' }) {
  const [hasCamera, setHasCamera] = useState(true)
  // Simpan callback terbaru di ref supaya scanner tidak perlu restart tiap render
  const onScanRef = useRef(onScan)
  onScanRef.current = onScan

  const scannerRef = useRef(null)
  const containerIdRef = useRef('qr-reader-' + Math.random().toString(36).slice(2, 8))

  useEffect(() => {
    const containerId = containerIdRef.current
    const scanner = new Html5Qrcode(containerId)
    scannerRef.current = scanner
    let active = true

    ;(async () => {
      try {
        const cameras = await Html5Qrcode.getCameras()
        if (!cameras || cameras.length === 0) {
          setHasCamera(false)
          return
        }
        if (!active) return
        await scanner.start(
          { facingMode },
          {
            fps: 10,
            qrbox: (viewfinderWidth, viewfinderHeight) => {
              // Responsive QR box — 70% dari sisi terkecil, minimal 200px
              const minDim = Math.min(viewfinderWidth, viewfinderHeight)
              const size = Math.max(200, Math.floor(minDim * 0.7))
              return { width: size, height: size }
            },
          },
          (decodedText) => onScanRef.current?.(decodedText),
          () => {} // abaikan error decode per-frame (normal saat belum ada QR)
        )
      } catch (err) {
        console.error('QR scanner error:', err)
        onError?.(err)
        setHasCamera(false)
      }
    })()

    return () => {
      active = false
      try {
        // 2 = SCANNING; hanya stop kalau memang sedang berjalan
        if (scanner.getState && scanner.getState() === 2) {
          scanner.stop().then(() => scanner.clear()).catch(() => {})
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
          <p className="font-medium">Kamera tidak tersedia</p>
          <p className="text-sm mt-1">Pastikan browser memiliki izin akses kamera</p>
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
