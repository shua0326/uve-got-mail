import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const BACKEND = 'http://localhost:3000'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // IMPLEMENTATION_PLAN.md §8: proxy backend routes through the dev server
    // so the frontend calls them same-origin — avoids CORS/cross-port issues
    // entirely rather than relying on the backend's CORS headers.
    proxy: {
      '/auth': BACKEND,
      '/giphy': BACKEND,
      '/recordings': BACKEND,
    },
  },
})
