import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFileSync, mkdirSync, existsSync, readdirSync } from 'fs'
import { join } from 'path'

// Plugin: auto-copy sertifikat SVG assets to public/ during dev & build
function copySertifikatAssets() {
  return {
    name: 'copy-sertifikat-assets',
    buildStart() {
      const src = join(__dirname, 'sertifikat')
      const dest = join(__dirname, 'public', 'sertifikat')
      if (!existsSync(dest)) mkdirSync(dest, { recursive: true })

      // Copy main SVG + calibration tool
      const svgFiles = ['front.svg', 'back.svg', 'adjust.html']
      for (const f of svgFiles) {
        const s = join(src, f), d = join(dest, f)
        if (existsSync(s)) {
          try { copyFileSync(s, d) } catch (e) { console.warn(`[vite] Could not copy ${f}: ${e.message}`) }
        }
      }

      // Copy image subfolders
      const imgFolders = ['front_images', 'back_images']
      for (const folder of imgFolders) {
        const srcDir = join(src, folder)
        const destDir = join(dest, folder)
        if (!existsSync(srcDir)) continue
        if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true })
        for (const file of readdirSync(srcDir)) {
          try { copyFileSync(join(srcDir, file), join(destDir, file)) } catch { }
        }
      }
      console.log('[vite] Sertifikat assets copied to public/sertifikat/')
    },
  }
}

export default defineConfig({
  plugins: [react(), copySertifikatAssets()],
  optimizeDeps: {
    include: ['jspdf'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-ui': ['recharts', 'lucide-react', 'date-fns'],
          'vendor-qr': ['html5-qrcode', 'qrcode'],
          'vendor-xlsx': ['xlsx-js-style'],
          'vendor-pdf': ['jspdf'],
        },
      },
    },
  },
})
