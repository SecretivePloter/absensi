import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-ui': ['recharts', 'lucide-react', 'date-fns'],
          'vendor-qr': ['html5-qrcode', 'qrcode'],
          'vendor-xlsx': ['xlsx'],
        },
      },
    },
  },
})
