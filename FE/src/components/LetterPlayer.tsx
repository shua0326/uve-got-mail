import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Tldraw, type Editor } from 'tldraw'
import { usePlayer } from '../replay/usePlayer'
import { LETTER_PAGE, type Recording } from '../replay/format'
import Stage from './Stage'
import { useLetterFrame } from '../replay/useLetterFrame'
import { Button, IconButton } from './pouf/Button'
import { Select } from './pouf/controls'
import { ErrorNote } from './pouf/feedback'
import { Icon } from './pouf/Icon'
import { Row } from './pouf/layout'
import { Slider } from './pouf/slider'
import { Card } from './pouf/surface'
import { Text } from './pouf/text'

const CAMERA_OPTIONS = {
  camera: {
    constraints: {
      bounds: LETTER_PAGE,
      padding: { x: 0, y: 0 },
      origin: { x: 0.5, y: 0.5 },
      behavior: { x: 'contain', y: 'contain' } as const,
      // `fit-min`, and on this screen it is the difference between showing
      // somebody the letter they were sent and showing them most of it. See
      // the long note in LetterCanvas.tsx: `fit-max` covers and crops, and at
      // the old frame's 2.3:1 that hid 23% of the page's height. Here there is
      // not even a toolbar to pan with — the recipient would simply never see
      // it. Immersive mode changes the frame's aspect ratio at runtime, which
      // makes a fit-the-whole-page rule the only safe one.
      initialZoom: 'fit-min' as const,
      baseZoom: 'fit-min' as const,
    },
  },
}

const SPEEDS = [0.5, 1, 2, 4]
const SPEED_OPTIONS = SPEEDS.map((s) => ({ value: String(s), label: `${s}×` }))

/** How long the immersive transport waits, after the pointer stops, before it
 *  takes itself away. Long enough that a pause to think doesn't lose the
 *  controls; short enough that the letter is alone while it plays. */
const IDLE_MS = 2600

function formatMs(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function LetterPlayer({
  recording,
  onBack,
  backLabel,
  action,
}: {
  recording: Recording
  onBack: () => void
  /** Where "back" actually goes. The player is reached from the composer and
   *  from the inbox, and a hard-coded "Back to compose" is wrong half the
   *  time — so the caller, which is the only thing that knows, names it. */
  backLabel: string
  /** What you can DO with the letter you are watching, if anything. In
   *  practice: the send trigger, present only while a just-composed draft is
   *  waiting. Goes in the bar above the sheet, never over it. */
  action?: ReactNode
}) {
  const [editor, setEditor] = useState<Editor | null>(null)
  const handleMount = useCallback((e: Editor) => setEditor(e), [])

  const { status, playhead, durationMs, speed, errorMessage, play, pause, seek, setSpeed, replay } = usePlayer(
    editor,
    recording,
  )

  // Frames the page on mount and keeps it framed as the sheet resizes — which
  // it does here, because immersive mode gives the sheet a bar's worth of
  // extra height. See the hook for why the camera constraints alone are not
  // enough.
  useLetterFrame(editor)

  // Immersive playback: the transport leaves the flow, the sheet grows into
  // the space it was taking, and the controls become an overlay that fades
  // out while the letter plays. The docked bar is the default because a
  // control that is always where you left it is the right default; this is
  // for the second watch, when you know what the controls are and you want
  // the letter as big as the window will give it.
  const [immersive, setImmersive] = useState(false)

  /* Whether the transport is allowed to take itself away at all.
   *
   * "Idle" has to mean idle WHILE PLAYING. A paused letter with its controls
   * fading out is a dead end — nothing on screen is moving to explain where
   * they went, and there is no reason to hide the one thing the viewer is
   * about to press. So the clock only runs in immersive playback; every other
   * state pins the bar open, and `hidden` is derived rather than stored so
   * that pinning takes effect on the same render as the state change. */
  const canHide = immersive && status === 'playing'
  const [idle, setIdle] = useState(false)
  const hidden = canHide && idle

  /* Restart the idle clock whenever that changes.
   *
   * Adjusted DURING RENDER rather than in an effect, which is React's own
   * guidance for resetting state that depends on other state ("You Might Not
   * Need an Effect"). An effect would paint one frame of the stale value
   * first, and the stale value here is `idle: true` left over from the last
   * time the letter played — so pressing play, or re-entering immersive mode,
   * would flash a transport that is already gone. */
  const [armedFor, setArmedFor] = useState(canHide)
  if (armedFor !== canHide) {
    setArmedFor(canHide)
    setIdle(false)
  }

  useEffect(() => {
    if (!canHide) return

    let timer = window.setTimeout(() => setIdle(true), IDLE_MS)

    function wake() {
      window.clearTimeout(timer)
      setIdle(false)
      timer = window.setTimeout(() => setIdle(true), IDLE_MS)
    }

    /* The pointer has to have MOVED, not merely fired an event.
     *
     * Chrome re-dispatches `pointermove` at the cursor's existing coordinates
     * whenever the element under a stationary cursor changes, so that hover
     * state stays correct. A replaying letter changes what is under the cursor
     * on almost every frame — that is the entire point of it — so leaving the
     * cursor anywhere over the sheet produced a continuous stream of
     * zero-distance moves, each one restarting the clock. Measured: the bar
     * did not hide once in 20 seconds of playback with the mouse untouched.
     *
     * Comparing coordinates is the standard fix and it costs one ref. A real
     * move of a single pixel still counts, which is what "the viewer reached
     * for the controls" looks like. */
    const last = { x: -1, y: -1 }
    function onPointerMove(event: PointerEvent) {
      const { clientX: x, clientY: y } = event
      if (x === last.x && y === last.y) return
      last.x = x
      last.y = y
      wake()
    }

    // On `window` rather than on the stage: tldraw's canvas handles its own
    // pointer events and a React handler on an ancestor is not guaranteed to
    // see them. `pointermove` covers mouse, pen and touch-drag in one.
    // Hovering or tabbing into the bar keeps it up too — that half is in CSS
    // (`.stage-hud:hover, :has(:focus-visible)`), where it belongs.
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('keydown', wake)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('keydown', wake)
    }
  }, [canHide])

  useEffect(() => {
    if (!immersive) return
    function onKey(e: KeyboardEvent) {
      // Escape leaves immersive rather than leaving the letter. It is the
      // convention for every maximised view, and with `hideUi` there is no
      // tldraw menu underneath competing for the key.
      if (e.key === 'Escape') setImmersive(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [immersive])

  /* A letter that cannot be replayed has nothing to transport, so the bar goes
   * and the reason takes the sheet. It used to be squeezed into the control
   * row beside a back button — a full sentence in a 56px strip that the bar's
   * fixed height would have clipped, and the least readable place on the
   * screen to put the only thing worth reading. "Back" is in the bar above in
   * both cases, so nothing is lost by removing this row. */
  const failure =
    status === 'error' ? (
      <div className="stage-cover">
        <div className="stage-center">
          <ErrorNote>{errorMessage}</ErrorNote>
        </div>
      </div>
    ) : null

  const transport =
    status === 'error' ? null : (
      <Row gap={3} align="center" justify="center" wrap={false}>
        <IconButton
          icon={<Icon name={status === 'playing' ? 'pause' : 'play'} />}
          label={status === 'playing' ? 'Pause' : status === 'finished' ? 'Replay' : 'Play'}
          tone="purple"
          variant="solid"
          size="sm"
          onClick={status === 'playing' ? pause : status === 'finished' ? replay : play}
        />

        {/* Pouf's Slider is range-capable, hence the array on both ends. */}
        <div className="bar-grow">
          <Slider
            label="Seek"
            min={0}
            max={durationMs || 1}
            value={[Math.min(playhead, durationMs)]}
            onChange={([next]) => seek(next)}
          />
        </div>

        <span className="bar-time">
          <Text size="sm" muted num>
            {/* Clamped, like the scrubber's value just above it. The loop adds
                a whole frame's `dt` before it checks whether it has finished,
                so the last tick overshoots — on a stalled tab, by a lot. It
                read "0:25 / 0:20" for a 20-second letter. */}
            {formatMs(Math.min(playhead, durationMs))} / {formatMs(durationMs)}
          </Text>
        </span>

        <div className="bar-speed">
          <Select
            label="Playback speed"
            value={String(speed)}
            onChange={(next) => setSpeed(Number(next))}
            options={SPEED_OPTIONS}
          />
        </div>

        <IconButton
          icon={<Icon name={immersive ? 'fullscreen-exit' : 'fullscreen'} />}
          label={immersive ? 'Show the controls' : 'Give the letter the whole frame'}
          variant="quiet"
          size="sm"
          onClick={() => setImmersive((v) => !v)}
        />
      </Row>
    )

  return (
    <Stage
      // The back link and the send action are page chrome, and they stay put
      // in both modes — they are beside the letter, never on it, so immersive
      // has no reason to take them away.
      toolbar={
        <Row gap={3} align="center" justify="start" wrap={false}>
          <Button size="sm" variant="quiet" onClick={onBack}>
            ← {backLabel}
          </Button>
          <span className="bar-spacer" />
          {action}
        </Row>
      }
      transport={immersive ? undefined : transport ?? undefined}
      overlay={
        failure ?? (immersive && transport ? (
          <div className="stage-hud" data-hidden={hidden ? 'true' : 'false'}>
            {/* A Card here and NOT in the docked bar, and the difference is
                the background: page chrome sits on the cream page and needs no
                surface of its own, but these controls are over somebody's
                drawing and would be unreadable without one. */}
            <Card variant="tight">{transport}</Card>
          </div>
        ) : undefined)
      }
    >
      <Tldraw
        options={CAMERA_OPTIONS}
        onMount={handleMount}
        // Nothing of tldraw's own, at all.
        //
        // Readonly (usePlayer.ts §13) already filtered the toolbar down to
        // Select/Hand/Laser and the style panel was hidden explicitly — but
        // that still left a toolbar, a main menu, a page menu and a zoom
        // stepper with a minimap around the letter, in three of its four
        // corners. None of them can do anything worth doing here: the camera
        // is pinned to the page bounds at `fit-min`, so the whole letter is
        // already on screen and there is nothing to select, pan to or zoom
        // toward. They were chrome for a canvas app, drawn on top of a letter.
        //
        // `hideUi` rather than nulling nine components one by one: the list
        // would need maintaining against every tldraw release, and "no editor
        // UI on this screen" is the thing actually being said.
        hideUi
      />
    </Stage>
  )
}
