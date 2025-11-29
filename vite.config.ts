import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Vercel 배포 시에는 base 설정을 삭제해야 경로 오류가 발생하지 않습니다.
  // base: "/repository-name/",  <-- 이 부분이 있다면 삭제된 상태입니다.
})