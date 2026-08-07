/**
 * Simple static file server untuk generator sertifikat.
 * Jalankan: node server.js
 * Lalu buka: http://localhost:3456/index.html
 *            http://localhost:3456/adjust.html
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import url from 'node:url'

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))

const PORT = 3456
const ROOT = __dirname  // folder sertifikat/

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.pdf': 'application/pdf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
}

const server = http.createServer((req, res) => {
  let pathname = url.parse(req.url).pathname
  if (pathname === '/' || pathname === '') pathname = '/index.html'

  const filePath = path.join(ROOT, pathname)

  // Security: stay within ROOT
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403)
    return res.end('Forbidden')
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' })
        res.end('404 Not Found: ' + pathname)
      } else {
        res.writeHead(500)
        res.end('Server Error: ' + err.message)
      }
      return
    }

    const ext = path.extname(filePath).toLowerCase()
    const mime = MIME[ext] || 'application/octet-stream'
    res.writeHead(200, {
      'Content-Type': mime,
      'Cache-Control': 'no-cache',
      // Allow SVG fetch from same origin
      'Access-Control-Allow-Origin': '*',
    })
    res.end(data)
  })
})

server.listen(PORT, '127.0.0.1', () => {
  console.log('='.repeat(55))
  console.log('  Generator Sertifikat — Server Lokal')
  console.log('='.repeat(55))
  console.log('')
  console.log('  Generator : http://localhost:' + PORT + '/index.html')
  console.log('  Adjuster  : http://localhost:' + PORT + '/adjust.html')
  console.log('')
  console.log('  Tekan Ctrl+C untuk menghentikan server.')
  console.log('='.repeat(55))
})
