import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'  // ✅ alias 설정용 추가

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
  // ✅ alias 추가
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
