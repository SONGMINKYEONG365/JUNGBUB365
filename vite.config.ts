import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Vercel deployment works best with the default root base.
  // For GitHub Pages sub-path deployment, Vite handles asset mapping via relative imports in build.
  base: './',
})