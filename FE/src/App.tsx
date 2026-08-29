import { useCallback, useEffect, useState } from 'react'
import './App.css'
import LetterCanvas from './components/LetterCanvas'
import LetterPlayer from './components/LetterPlayer'
import { decode, encode } from './replay/codec'
import type { Recording } from './replay/format'
import { fetchRecording, uploadRecording } from './api'

type Mode = 'compose' | 'play' | 'loading' | 'load-error'

function letterIdFromUrl(): string | null {
  return new URLSearchParams(window.location.search).get('letter')
}

function App() {
  const [mode, setMode] = useState<Mode>(() => (letterIdFromUrl() ? 'loading' : 'compose'))
  const [recording, setRecording] = useState<Recording | null>(null)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Cross-client replay (IMPLEMENTATION_PLAN.md §4.1 step 1): a second
  // browser/tab opening this same URL fetches the gzipped recording over
  // HTTP from the backend and replays it independently — no shared React
  // state with whichever client composed it.
  useEffect(() => {
    const id = letterIdFromUrl()
    if (!id) return

    // StrictMode double-invokes this effect in dev (mount, cleanup, mount
    // again); an AbortController is React's documented way to make the
    // first, superseded fetch actually stop rather than race the second.
    const controller = new AbortController()
    const MAX_ATTEMPTS = 2

    async function load(): Promise<Recording> {
      let lastErr: unknown
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
          const buf = await fetchRecording(id!, controller.signal)
          return await decode(buf)
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') throw err
          lastErr = err
          if (attempt < MAX_ATTEMPTS) await new Promise((r) => setTimeout(r, 400))
        }
      }
      throw lastErr
    }

    load()
      .then((rec) => {
        setRecording(rec)
        setMode('play')
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        console.error('Failed to load recording', err)
        setLoadError(`Couldn't load that letter (${String(err)}).`)
        setMode('load-error')
      })

    return () => {
      controller.abort()
    }
  }, [])

  const handleFinish = useCallback(async (rec: Recording) => {
    setRecording(rec)
    setMode('play')
    setShareUrl(null)

    // Step 3.4 measurement gate (IMPLEMENTATION_PLAN.md §3.4): log recording
    // size so it's easy to see whether bucketing/stripping/gzip are enough.
    const raw = JSON.stringify(rec)
    const gz = await encode(rec)
    console.info(
      `[recording] frames=${rec.frames.length} keyframes=${rec.keyframes.length} ` +
        `durationMs=${rec.durationMs} raw=${(raw.length / 1024).toFixed(1)}KB gzip=${(gz.size / 1024).toFixed(1)}KB`,
    )

    try {
      const id = await uploadRecording(gz)
      const url = new URL(window.location.href)
      url.searchParams.set('letter', id)
      window.history.replaceState({}, '', url)
      setShareUrl(url.toString())
    } catch (err) {
      console.error('Recording upload failed', err)
    }
  }, [])

  const handleBack = useCallback(() => {
    const url = new URL(window.location.href)
    url.searchParams.delete('letter')
    window.history.replaceState({}, '', url)
    setRecording(null)
    setShareUrl(null)
    setLoadError(null)
    setMode('compose')
  }, [])

  return (
    <div id="whiteboard-container">
      {mode === 'compose' && <LetterCanvas onFinish={handleFinish} />}
      {mode === 'loading' && <div className="centered-status">Loading letter…</div>}
      {mode === 'load-error' && (
        <div className="centered-status">
          <p>{loadError}</p>
          <button onClick={handleBack}>Compose a new letter</button>
        </div>
      )}
      {mode === 'play' && recording && (
        <>
          <LetterPlayer recording={recording} onBack={handleBack} />
          {shareUrl && (
            <div className="share-banner">
              Open on another client: <code>{shareUrl}</code>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default App
