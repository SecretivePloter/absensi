import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { clsx } from 'clsx'

export function QRScanner({ onScan, onError, active = true }) {
  const scannerRef = useRef(null)
  const containerRef = useRef(null)
  const [isStarted, setIsStarted] = useState(false)
  const [hasCamera, setHasCamera] = useState(true)

  useEffect(() => {
    if (!active) return

    const scannerId = 'qr-reader'
    const scanner = new Html5Qrcode(scannerId)
    scannerRef.current = scanner

    const start = async () => {
      try {
        const cameras = await Html5Qrcode.getCameras()
        if (!cameras || cameras.length === 0) {
          setHasCamera(false)
          return
        }

        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            onScan?.(decodedText)
          },
          () => {}
        )
        setIsStarted(true)
      } catch (err) {
        console.error('QR scanner error:', err)
        onError?.(err)
        setHasCamera(false)
      }
    }

    start()

    return () => {
      if (scannerRef.current && isStarted) {
        scannerRef.current.stop().catch(() => {})
      }
    }
  }, [active])

  if (!hasCamera) {
    return (
      <div className="flex items-center justify-center h-64 rounded-lg bg-muted text-muted-foreground text-center p-6">
        <div>
          <p className="font-medium">Kamera tidak tersedia</p>
          <p className="text-sm mt-1">Pastikan browser memiliki izin akses kamera</p>
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <div id="qr-reader" className="w-full rounded-lg overflow-hidden" />
    </div>
  )
}
