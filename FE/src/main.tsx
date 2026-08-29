import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'tldraw/tldraw.css'
// index.css pulls in Tailwind; tldraw-theme.css must come after both so its
// `@layer base` overrides land last within that layer. See tldraw-theme.css.
import './index.css'
import './tldraw-theme.css'
import App from './App.tsx'
import '@fontsource-variable/nunito'
import './components/pouf/pouf.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
