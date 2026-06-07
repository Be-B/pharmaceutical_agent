import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // dev 프록시: 브라우저는 :3000만 보고, /api는 백엔드로 전달.
  // 단일 오리진이라 CORS·SameSite=Lax 쿠키 문제 없음. (배포는 vercel.json 프록시 사용)
  // target: 도커 compose에선 BACKEND_URL=http://backend:8000, 로컬 비-도커는 127.0.0.1:8000 폴백.
  server: {
    host: true, // 컨테이너에서 0.0.0.0 바인딩 → 호스트에서 :3000 접근 가능
    // 외부 도메인 접근 허용 (Vite dev host 체크). 콤마구분 ALLOWED_HOSTS 로 추가 가능.
    allowedHosts: ['kyunhome.iptime.org', ...(process.env.ALLOWED_HOSTS?.split(',').map(s => s.trim()).filter(Boolean) || [])],
    port: 3000,
    strictPort: true,
    proxy: {
      '/api': {
        target: process.env.BACKEND_URL || 'http://127.0.0.1:8000',
        changeOrigin: false,
      },
    },
  },
})
