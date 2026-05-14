import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // /api로 시작하는 모든 요청을 Spring Boot(8080)으로 전달 → CORS 문제 없음
      '/api': 'http://localhost:8080',
    },
  },
})
