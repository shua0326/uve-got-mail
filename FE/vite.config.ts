import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const BACKEND = 'http://localhost:3000'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Pinned rather than left to Vite's auto-increment-on-conflict default:
    // Supabase's OAuth redirect only returns to URLs allowlisted in the
    // project's Auth settings, so a drifting port (5173 -> 5174 -> ...)
    // silently breaks Google sign-in the moment the port doesn't match
    // what's registered there.
    port: 5173,
    strictPort: true,
    // IMPLEMENTATION_PLAN.md §8: proxy backend routes through the dev server
    // so the frontend calls them same-origin — avoids CORS/cross-port issues
    // entirely rather than relying on the backend's CORS headers.
    proxy: {
      '/auth': BACKEND,
      '/giphy': BACKEND,
      '/recordings': BACKEND,
      '/mail': BACKEND,
    },
  },
})
