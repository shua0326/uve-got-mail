import { useCallback, useState } from 'react'
import { Tldraw, type Editor, type TLUiOverrides } from 'tldraw'
import { useRecorder } from '../replay/useRecorder'
import { LETTER_PAGE, type Recording } from '../replay/format'
import GifPicker from './GifPicker'
import Stage from './Stage'
import { useLetterFrame } from '../replay/useLetterFrame'
import { Button } from './pouf/Button'
import { Row } from './pouf/layout'
import { Status } from './pouf/status'
import { toast } from './pouf/toaster'

const CAMERA_OPTIONS = {
  camera: {
    constraints: {
      bounds: LETTER_PAGE,
      padding: { x: 0, y: 0 },
      origin: { x: 0.5, y: 0.5 },
      behavior: { x: 'contain', y: 'contain' } as const,
      // `fit-min`, NOT `fit-max`. This is a correctness fix, not a preference.
      //
      // `fit-max` fills the LARGER axis and lets the other overflow, i.e. it
      // covers and crops. The stage used to be a 2.3:1 box around this 1.78:1
      // page, so 23% of the letter's height was off-screen: you could draw
      // near the top of the page, have it recorded, and never see it again.
      // `fit-min` fits the whole page inside the viewport instead.
      //
      // The frame is now 16:9 as well (index.css, `.desk`), so on the ordinary
      // path the two agree exactly and there is no letterbox either. This is
      // what keeps it correct off that path — a phone in portrait, a short
      // window, immersive playback.
      initialZoom: 'fit-min' as const,
      baseZoom: 'fit-min' as const,
    },
  },
}

// A letter is one page. The recorder only captures document-scope diffs
// (§1.2), and which page is *current* is instance/session state, not
// document state — so a second page's shapes are recorded but the replay
// never switches to it, and the recipient sees a blank canvas (see
// IMPLEMENTATION_PLAN.md §14). Rather than teach the recorder/player about
// multiple pages, page creation is removed from the composer outright.
// There are three distinct ways tldraw lets a user create a page, all
// closed here: the page-menu dropdown (hidden via `components`), the
// shape-context-menu "Move to new page" action, and the alt+arrow
// change-page shortcut silently creating a new page when run off the end
// of the (single) page list — the latter two removed via `overrides`.
//
// `NavigationPanel` goes with it, and that is about clutter rather than
// correctness: it is a zoom stepper and a minimap of a single, fully visible
// page, parked over the bottom-left corner of the letter. There is nothing
// off-screen for a minimap to find — the camera is pinned to the page bounds
// and `fit-min` shows all of it — so it was 160x110px of the drawing surface
// spent saying "you are looking at the whole thing". Zoom itself still works
// (ctrl/⌘+wheel, pinch), and panning stays inside the bounds.
//
// `HelpMenu` is the keyboard-shortcuts/about cluster: a general-purpose
// canvas app's chrome, in the corner of somebody's letter.
const COMPOSER_COMPONENTS = {
  PageMenu: null,
  NavigationPanel: null,
  HelpMenu: null,
}

const COMPOSER_OVERRIDES: TLUiOverrides = {
  actions(_editor, actions) {
    delete actions['move-to-new-page']
    delete actions['change-page-next']
    delete actions['change-page-prev']
    return actions
  },
}

/** The line a letter opens with, before anything is said. Computed once per
 *  mount rather than per render — it is the date you started writing, and a
 *  value that ticked over at midnight mid-letter would be a small lie. */
function today(): string {
  return new Date().toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  })
}

export default function LetterCanvas({ onFinish }: { onFinish: (recording: Recording) => void }) {
  const [dateline] = useState(today)
  const [editor, setEditor] = useState<Editor | null>(null)
  const { isRecording, frameCount, finish } = useRecorder(editor)

  // Puts the camera on the page the recipient will be shown. Without it the
  // composer sat at 100% zoom on a 1600x900 page and the author was drawing on
  // roughly the top-left third of it — see the hook, where that is measured.
  useLetterFrame(editor)

  const handleMount = useCallback((e: Editor) => {
    setEditor(e)
    // You arrive at this screen to write a letter, so the pen is already in
    // your hand. tldraw opens on `select`, which means the first thing the
    // composer asks you to do is pick up a tool — a step that exists for a
    // general-purpose canvas and not for this one. Instance state, not
    // document state, so the recorder never sees it (replay/useRecorder.ts
    // captures document-scope diffs only) and the recipient's playback is
    // unchanged.
    e.setCurrentTool('draw')
  }, [])

  const handleFinish = useCallback(() => {
    const recording = finish()
    if (!recording) {
      // Was `window.alert`, which freezes the whole page — and a browser modal
      // is a jarring thing to meet in the middle of drawing. A toast says the
      // same thing without taking the canvas away.
      toast.warning('Nothing to send yet', {
        description: 'Draw something on the canvas first.',
      })
      return
    }
    onFinish(recording)
  }, [finish, onFinish])

  return (
    <Stage
      toolbar={
        <Row gap={3} align="center" justify="start" wrap={false}>
          {/* You are writing something today. Saying so — in the same small
              caps a letter's dateline is set in — is the cheapest way to make
              the composer feel like a sheet of paper rather than a drawing app
              that happens to send things. */}
          <span className="dateline">{dateline}</span>
          {/* Wrapped so the bar can drop it at phone width — see `.bar-status`
              in index.css. Pouf's `Status` renders a bare `Row` with no class
              of its own, and it is not this app's to add one to. */}
          <span className="bar-status">
            <Status
              label={isRecording ? `Recording — ${frameCount} frames` : 'Draw to start recording'}
              tone={isRecording ? 'down' : 'idle'}
            />
          </span>
          <span className="bar-spacer" />
          {/* Renders its own trigger, so the control and the thing it controls
              stay in one file. It needs an editor to insert into, hence the
              null guard rather than a disabled button — a button that can
              never be pressed is worse than one that isn't there for the two
              frames before tldraw mounts. */}
          {editor && <GifPicker editor={editor} />}
          <Button size="sm" tone="mint" onClick={handleFinish}>
            Finish &amp; preview
          </Button>
        </Row>
      }
    >
      <Tldraw
        options={CAMERA_OPTIONS}
        onMount={handleMount}
        components={COMPOSER_COMPONENTS}
        overrides={COMPOSER_OVERRIDES}
        // The style panel is the pen: colour, weight, dash, fill. It has to
        // stay reachable — but tldraw's DESKTOP layout parks it open in the
        // top-right corner permanently, 150x290px of somebody's letter spent
        // on a control they touch a few times per drawing. Its mobile layout
        // puts exactly the same panel behind a button on the toolbar, which
        // is the hidable version of the same thing.
        //
        // `forceMobile` is tldraw's own supported way to ask for that layout
        // (TLUiContextProviderProps), so this is a breakpoint choice rather
        // than a hack: on a sheet this size the mobile arrangement is simply
        // the right one, at every window width.
        forceMobile
      />
    </Stage>
  )
}
