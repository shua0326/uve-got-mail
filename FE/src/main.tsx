import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Stylesheet order is load-bearing — see tldraw-theme.css for the full
// reasoning. In short:
//
//   1. tldraw's own CSS first, so everything below can override it.
//   2. Nunito before pouf.css: pouf's `--font-pouf` names the family
//      'Nunito Variable', which @fontsource-variable/nunito registers.
//   3. Caveat likewise: theme-letter.css names the family 'Caveat Variable',
//      which @fontsource-variable/caveat registers.
//   4. pouf.css is THE Tailwind entry — its first line is `@import
//      'tailwindcss'`. There must be no second one anywhere (pouf docs,
//      Install), which is why index.css below is plain CSS.
//   5. theme-letter.css: re-points pouf's tokens at a warm palette.
//   6. index.css: this app's positioning-only rules, built on pouf's tokens.
//   7. tldraw-theme.css last, so its `@layer base` preflight guards land
//      after pouf's own base rules within that layer.
import 'tldraw/tldraw.css'
import '@fontsource-variable/nunito'
// Caveat is the theme's ONE accent face — the wordmark and empty-state titles
// only (theme-letter.css §1/§6). Everything else, including all body copy and
// every control, is Nunito above.
import '@fontsource-variable/caveat'
import './components/pouf/pouf.css'
// The paper-and-ink retheme. AFTER pouf.css and deliberately outside it — see
// that file's header for why it isn't edits to the registry copy, and how
// unlayered CSS is what lets it win.
import './theme-letter.css'
import './index.css'
import './tldraw-theme.css'

import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
