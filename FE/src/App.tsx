import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useSession } from './auth/useSession'
import Header, { type Tab } from './components/Header'
import Inbox from './components/Inbox'
import Requests from './components/Requests'
import SendLetterDialog from './components/SendLetterDialog'
import LetterCanvas from './components/LetterCanvas'
import LetterPlayer from './components/LetterPlayer'
import Login from './components/Login'
import Stage from './components/Stage'
import SetUsername from './components/SetUsername'
import UserProfile from './components/UserProfile'
import { Button } from './components/pouf/Button'
import { ErrorNote, Skeleton } from './components/pouf/feedback'
import { Stack } from './components/pouf/layout'
import { Toaster } from './components/pouf/toaster'
import { encode } from './replay/codec'
import type { Recording } from './replay/format'
import { loadLetter, needsUsername, type MailListItem } from './api'

type Mode = Tab | 'play' | 'loading' | 'load-error'

const TABS: Tab[] = ['inbox', 'compose', 'requests', 'profile']

function isTab(mode: Mode): mode is Tab {
  return (TABS as Mode[]).includes(mode)
}

function letterIdFromUrl(): string | null {
  return new URLSearchParams(window.location.search).get('letter')
}

function clearLetterParam() {
  const url = new URL(window.location.href)
  url.searchParams.delete('letter')
  window.history.replaceState({}, '', url)
}

/**
 * How a screen arrives.
 *
 * The premise of this product is that a letter does not turn up when you want
 * it to, and an interface that snaps between screens is arguing with that. So
 * a screen is a sheet being laid onto the desk: it comes from a little above,
 * a hair large, and settles. `ease` is a pure deceleration curve with no
 * overshoot — paper does not bounce, and the whole point is that it stops.
 * The same curve is `--ease-settle` in theme-letter.css, which is where the
 * CSS-driven half of the motion (dialogs, controls) reads it from.
 *
 * Kept small on purpose: this fires on every tab change, and a transition you
 * notice on the fourth use is a transition that is too big.
 */
const PAGE = {
  initial: { opacity: 0, y: -10, scale: 1.008 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 6, scale: 0.996 },
  transition: { duration: 0.34, ease: [0.22, 0.61, 0.28, 1] as const },
}

/** Reduced motion keeps the crossfade and drops every movement. pouf's base
 *  layer neutralises CSS transitions globally, but framer animates in JS and
 *  is not covered by that — this is the equivalent, done explicitly. */
const PAGE_STILL = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.18 },
}

function App() {
  const { status: sessionStatus, user, setUser, backendError, signOut } = useSession()
  const reduceMotion = useReducedMotion()
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
  const [loadError, setLoadError] = useState<string | null>(null)

  // Cross-client replay: a second browser/tab opening this same URL fetches
  // the gzipped recording over HTTP from the backend and replays it
  // independently — no shared React state with whichever client composed it.
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

    // Measurement gate: log recording size so it's easy to see whether
    // bucketing/stripping/gzip are enough.
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

  const activeTab: Tab = isTab(mode) ? mode : returnTo
  // The two screens that mount a tldraw editor and therefore build their own
  // Stage. Everything else is a panel the shell frames for it.
  const isCanvasMode = mode === 'compose' || (mode === 'play' && recording !== null)

  if (sessionStatus === 'loading') {
    return (
      <div className="page-center">
        <Skeleton variant="card" />
      </div>
    )
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
    <>
      <div className="app-shell">
        <Header active={activeTab} onNavigate={handleNavigate} onSignOut={signOut} />
        {backendError && (
          <ErrorNote>
            Signed in, but the backend didn't answer ({backendError}). Check that it's
            running on the port in BE/.env.
          </ErrorNote>
        )}
        <div className="desk">
          {/* `mode="wait"` and not the default: two screens cross-fading here
              would mean two tldraw editors mounted at once, each with its own
              store and its own rAF loop, over the same box. The outgoing
              sheet leaves before the next one is laid down. */}
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={mode} className="stage-anim" {...(reduceMotion ? PAGE_STILL : PAGE)}>
              {/* The two canvas screens render their own `Stage`, because only
                  they know what goes in its bars. Everything else is a panel
                  with no chrome of its own, so the shell supplies the bare
                  frame for it. */}
              {mode === 'compose' && <LetterCanvas onFinish={handleFinish} />}

              {mode === 'play' && recording && (
                <LetterPlayer
                  recording={recording}
                  onBack={handleBack}
                  // The player is reached two ways, and its back button should
                  // say which one — "compose" is a lie when you arrived from
                  // the inbox or a shared ?letter= link.
                  backLabel={returnTo === 'compose' ? 'Back to compose' : 'Back to inbox'}
                  // Rendered only while a draft exists — which is exactly when
                  // its trigger should be on screen. The dialog owns its own
                  // open state; App only owns the draft. It goes in the
                  // player's top bar rather than over the letter: sending is
                  // the one thing you do to a letter you have just previewed,
                  // and it belongs beside the preview, not on top of it.
                  action={
                    draft ? (
                      <SendLetterDialog
                        letter={draft}
                        onSent={() => {
                          setDraft(null)
                          handleNavigate('inbox')
                        }}
                      />
                    ) : undefined
                  }
                />
              )}

              {!isCanvasMode && (
                <Stage>
                  {mode === 'inbox' && <Inbox onView={handleViewMail} />}
                  {mode === 'requests' && <Requests />}
                  {mode === 'profile' && user && <UserProfile user={user} onUpdated={setUser} />}
                  {mode === 'loading' && (
                    <div className="stage-center">
                      <Skeleton variant="card" />
                    </div>
                  )}
                  {mode === 'load-error' && (
                    <div className="stage-center">
                      <Stack gap={4}>
                        <ErrorNote>{loadError}</ErrorNote>
                        <Button tone="purple" onClick={handleBack}>
                          Back to inbox
                        </Button>
                      </Stack>
                    </div>
                  )}
                </Stage>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
      {/* Pouf's Toaster is a sibling, not a wrapper — it takes no children.
          It also renders BARE items with no positioned wrapper of its own, by
          design: its source notes that the shell owns the single
          `.pouf-toasts` stack, so that two toast systems can't mount two fixed
          stacks at identical coordinates and hide each other. Supplying that
          stack is the app's job, and without it the toasts render static and
          full-bleed at the bottom of the document. */}
      <div className="pouf-toasts">
        <Toaster />
      </div>
    </>
  )
}

export default App
