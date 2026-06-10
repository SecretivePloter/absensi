import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'

export function QRScanner({ onScan, onError }) {
  const [hasCamera, setHasCamera] = useState(true)
  // Simpan callback terbaru di ref supaya scanner tidak perlu restart tiap render
  const onScanRef = useRef(onScan)
  onScanRef.current = onScan

  useEffect(() => {
    const scanner = new Html5Qrcode('qr-reader')
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
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 } },
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
    }
  }, [])

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
    <div className="relative w-full">
      <div id="qr-reader" className="w-full rounded-lg overflow-hidden" />
    </div>
  )
}
