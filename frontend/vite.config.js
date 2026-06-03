import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // 로컬 실행용 dev 프록시: 브라우저는 :3000만 보고, /api는 백엔드(:8000)로 전달.
  // 단일 오리진이라 CORS·SameSite=Lax 쿠키 문제 없음. (배포는 vercel.json 프록시 사용)
  server: {
    port: 3000,
    strictPort: true,
    proxy: {
      '/api': { target: 'http://127.0.0.1:8000', changeOrigin: false },
    },
  },
})
