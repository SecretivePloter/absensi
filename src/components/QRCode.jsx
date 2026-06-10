import { useEffect, useRef, useState } from 'react'
import QRCodeLib from 'qrcode'
import { Button } from './ui/button'
import { Download, Printer } from 'lucide-react'

export function QRCodeDisplay({ value, userName, size = 200 }) {
  const canvasRef = useRef(null)
  const [dataUrl, setDataUrl] = useState('')

  useEffect(() => {
    if (!value) return
    QRCodeLib.toDataURL(value, {
      width: size,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    }).then(setDataUrl).catch(console.error)
  }, [value, size])

  useEffect(() => {
    if (!value || !canvasRef.current) return
    QRCodeLib.toCanvas(canvasRef.current, value, {
      width: size,
      margin: 2,
    }).catch(console.error)
  }, [value, size])

  const handleDownload = () => {
    if (!dataUrl) return
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = `qr_${userName || 'user'}.png`
    a.click()
  }

  const handlePrint = () => {
    const win = window.open('', '_blank')
    win.document.write(`
      <html><head><title>QR Code - ${userName}</title>
      <style>
        body { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; font-family: sans-serif; }
        .name { font-size: 20px; font-weight: bold; margin-top: 12px; }
        img { border: 1px solid #ddd; padding: 12px; border-radius: 8px; }
      </style></head>
      <body>
        <img src="${dataUrl}" width="${size}" />
        <p class="name">${userName || ''}</p>
      </body></html>
    `)
    win.document.close()
    win.print()
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <canvas ref={canvasRef} className="rounded-lg border" />
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={handleDownload}>
          <Download className="h-4 w-4 mr-1.5" />
          Download PNG
        </Button>
        <Button size="sm" variant="outline" onClick={handlePrint}>
          <Printer className="h-4 w-4 mr-1.5" />
          Print
        </Button>
      </div>
    </div>
  )
}
