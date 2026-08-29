import { useCallback, useEffect, useState } from 'react'
import './App.css'
import { useSession } from './auth/useSession'
import AddFriendDialog from './components/AddFriendDialog'
import Header, { type Tab } from './components/Header'
import Inbox from './components/Inbox'
import Requests from './components/Requests'
import SendLetterDialog from './components/SendLetterDialog'
import { Toaster } from '@/components/ui/toast'
import LetterCanvas from './components/LetterCanvas'
import LetterPlayer from './components/LetterPlayer'
import Login from './components/Login'
import SetUsername from './components/SetUsername'
import { encode } from './replay/codec'
import type { Recording } from './replay/format'
import { loadLetter, needsUsername, type MailListItem } from './api'

type Mode = 'inbox' | 'compose' | 'requests' | 'play' | 'loading' | 'load-error'

function letterIdFromUrl(): string | null {
  return new URLSearchParams(window.location.search).get('letter')
}

function clearLetterParam() {
  const url = new URL(window.location.href)
  url.searchParams.delete('letter')
  window.history.replaceState({}, '', url)
}

function App() {
  const { status: sessionStatus, user, setUser, backendError, signOut } = useSession()
  const [mode, setMode] = useState<Mode>(() => (letterIdFromUrl() ? 'loading' : 'inbox'))
  // Where the "back" action returns to once a letter finishes playing —
  // the inbox (viewed from the mail list / a shared link) or the composer
  // (just-finished draft preview).
  const [returnTo, setReturnTo] = useState<Tab>('inbox')
  const [recording, setRecording] = useState<Recording | null>(null)
  // The just-composed letter, gzipped and ready to post. Held rather than
  // sent immediately: there is no recipient-less upload route — a letter and
  // its recipient are created by the same call — so the draft waits here
  // while the composer previews it and picks who it's for.
  const [draft, setDraft] = useState<Blob | null>(null)
  const [sendOpen, setSendOpen] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [addFriendOpen, setAddFriendOpen] = useState(false)

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
          return await loadLetter(id!, controller.signal)
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
        setReturnTo('inbox')
        setMode('play')
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        console.error('Failed to load recording', err)
        setLoadError(`Couldn't load that letter (${String(err)}).`)
        setReturnTo('inbox')
        setMode('load-error')
      })

    return () => {
      controller.abort()
    }
  }, [])

  const handleFinish = useCallback(async (rec: Recording) => {
    setRecording(rec)
    setReturnTo('compose')
    setMode('play')
    setDraft(null)

    // Step 3.4 measurement gate (IMPLEMENTATION_PLAN.md §3.4): log recording
    // size so it's easy to see whether bucketing/stripping/gzip are enough.
    const raw = JSON.stringify(rec)
    const gz = await encode(rec)
    console.info(
      `[recording] frames=${rec.frames.length} keyframes=${rec.keyframes.length} ` +
        `durationMs=${rec.durationMs} raw=${(raw.length / 1024).toFixed(1)}KB gzip=${(gz.size / 1024).toFixed(1)}KB`,
    )
    setDraft(gz)
  }, [])

  const handleViewMail = useCallback((mail: MailListItem) => {
    setDraft(null)
    setReturnTo('inbox')
    setMode('loading')
    loadLetter(mail.recordingId)
      .then((rec) => {
        setRecording(rec)
        setMode('play')
      })
      .catch((err) => {
        console.error('Failed to load recording', err)
        setLoadError(`Couldn't load that letter (${String(err)}).`)
        setMode('load-error')
      })
  }, [])

  const handleBack = useCallback(() => {
    clearLetterParam()
    setRecording(null)
    setDraft(null)
    setLoadError(null)
    setMode(returnTo)
  }, [returnTo])

  const handleNavigate = useCallback((tab: Tab) => {
    clearLetterParam()
    setRecording(null)
    setDraft(null)
    setLoadError(null)
    setMode(tab)
  }, [])

  const activeTab: Tab =
    mode === 'compose' || mode === 'inbox' || mode === 'requests' ? mode : returnTo

  if (sessionStatus === 'loading') {
    return <div className="centered-status">Loading…</div>
  }

  if (sessionStatus === 'signed-out') {
    return <Login />
  }

  // First login seeds `username` with the account's email
  // (BE/src/controllers/auth/authController.ts) — hold the app behind the
  // username picker until they've chosen a real one. `user` is null only
  // while /auth/callback is still in flight.
  if (user && needsUsername(user)) {
    return <SetUsername user={user} onDone={setUser} onSignOut={signOut} />
  }

  return (
    <Toaster>
    <div id="app-shell">
      <Header
        active={activeTab}
        onNavigate={handleNavigate}
        onAddFriend={() => setAddFriendOpen(true)}
        onSignOut={signOut}
      />
      <AddFriendDialog open={addFriendOpen} onOpenChange={setAddFriendOpen} />
      <SendLetterDialog
        open={sendOpen}
        onOpenChange={setSendOpen}
        letter={draft}
        onSent={() => {
          setDraft(null)
          handleNavigate('inbox')
        }}
      />
      {backendError && (
        <div className="backend-banner">
          Signed in, but the backend didn't answer ({backendError}). Check that it's
          running on the port in BE/.env.
        </div>
      )}
      <div id="whiteboard-container">
        {mode === 'inbox' && <Inbox onView={handleViewMail} />}
        {mode === 'requests' && <Requests />}
        {mode === 'compose' && <LetterCanvas onFinish={handleFinish} />}
        {mode === 'loading' && <div className="centered-status">Loading letter…</div>}
        {mode === 'load-error' && (
          <div className="centered-status">
            <p>{loadError}</p>
            <button onClick={handleBack}>Back to inbox</button>
          </div>
        )}
        {mode === 'play' && recording && (
          <>
            <LetterPlayer recording={recording} onBack={handleBack} />
            {draft && (
              <div className="share-banner">
                <button type="button" className="send-draft-button" onClick={() => setSendOpen(true)}>
                  Send this letter…
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
    </Toaster>
  )
}

export default App
