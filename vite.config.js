import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Cloudflare Pages 호환 설정
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
  },
  server: {
    port: 5173,
    host: true,
  },
})
