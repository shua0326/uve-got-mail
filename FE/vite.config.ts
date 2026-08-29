import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

/**
 * The backend's port lives in BE/.env (`PORT`), and hardcoding a second copy
 * here is what silently broke the proxy before: BE moved to 8888 while this
 * file still pointed at 3000, so every /auth, /mail and /recordings call died
 * with ECONNREFUSED and the app looked like an auth failure. Read the real
 * value instead of duplicating it.
 *
 * 127.0.0.1 rather than `localhost`: on a dual-stack machine `localhost` can
 * resolve to ::1 first, and Node's proxy agent then reports the same opaque
 * AggregateError [ECONNREFUSED] even when the server is up on IPv4.
 */
function backendUrl(): string {
  if (process.env.VITE_BACKEND_URL) return process.env.VITE_BACKEND_URL
  const envPath = fileURLToPath(new URL('../BE/.env', import.meta.url))
  let port = '3000'
  try {
    const match = readFileSync(envPath, 'utf8').match(/^\s*PORT\s*=\s*["']?(\d+)/m)
    if (match) port = match[1]
  } catch {
    // BE/.env not checked out (e.g. FE-only clone) — fall back to the
    // server's own default, which is what BE/src/server.ts uses too.
  }
  return `http://127.0.0.1:${port}`
}

const BACKEND = backendUrl()

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // Mirrors the `@/*` -> `./src/*` alias in tsconfig.json /
    // tsconfig.app.json. Both halves are required: TS resolves types, Vite
    // resolves the actual module at build/dev time.
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
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
      '/user': BACKEND,
      '/friends': BACKEND,
    },
  },
})
