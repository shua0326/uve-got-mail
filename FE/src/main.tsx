import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Stylesheet order is load-bearing — see tldraw-theme.css for the full
// reasoning. In short:
//
//   1. tldraw's own CSS first, so everything below can override it.
//   2. Nunito before pouf.css: pouf's `--font-pouf` names the family
//      'Nunito Variable', which @fontsource-variable/nunito registers.
//   3. pouf.css is THE Tailwind entry — its first line is `@import
//      'tailwindcss'`. There must be no second one anywhere (pouf docs,
//      Install), which is why index.css below is plain CSS.
//   4. index.css: this app's positioning-only rules, built on pouf's tokens.
//   5. tldraw-theme.css last, so its `@layer base` preflight guards land
//      after pouf's own base rules within that layer.
import 'tldraw/tldraw.css'
import '@fontsource-variable/nunito'
import './components/pouf/pouf.css'
import './index.css'
import './tldraw-theme.css'

import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
