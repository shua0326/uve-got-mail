import { useCallback, useState } from 'react'
import { Tldraw, type Editor, type TLUiOverrides } from 'tldraw'
import { useRecorder } from '../replay/useRecorder'
import type { Recording } from '../replay/format'
import GifPicker from './GifPicker'
import { Button } from './pouf/Button'
import { Row } from './pouf/layout'
import { Status } from './pouf/status'
import { Card } from './pouf/surface'
import { toast } from './pouf/toaster'

const CAMERA_OPTIONS = {
  camera: {
    constraints: {
      bounds: { x: 0, y: 0, w: 1600, h: 900 },
      padding: { x: 0, y: 0 },
      origin: { x: 0.5, y: 0.5 },
      behavior: { x: 'contain', y: 'contain' } as const,
      initialZoom: 'fit-max' as const,
      baseZoom: 'fit-max' as const,
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
const COMPOSER_COMPONENTS = {
  PageMenu: null,
}

const COMPOSER_OVERRIDES: TLUiOverrides = {
  actions(_editor, actions) {
    delete actions['move-to-new-page']
    delete actions['change-page-next']
    delete actions['change-page-prev']
    return actions
  },
}

export default function LetterCanvas({ onFinish }: { onFinish: (recording: Recording) => void }) {
  const [editor, setEditor] = useState<Editor | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const { isRecording, frameCount, finish } = useRecorder(editor)

  const handleMount = useCallback((e: Editor) => setEditor(e), [])

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
    <div className="stage">
      <Tldraw
        options={CAMERA_OPTIONS}
        onMount={handleMount}
        components={COMPOSER_COMPONENTS}
        overrides={COMPOSER_OVERRIDES}
      />
      {/* The HUD's absolute placement lives on this plain wrapper: pouf takes
          no `style` or `className`, so the Card supplies the surface and the
          div supplies the position. */}
      <div className="hud hud--top">
        <Card variant="tight">
          <Row gap={3} align="center" justify="center">
            <Status
              label={isRecording ? `Recording — ${frameCount} frames` : 'Draw to start recording'}
              tone={isRecording ? 'down' : 'idle'}
            />
            <Button size="sm" variant="quiet" disabled={!editor} onClick={() => setPickerOpen((v) => !v)}>
              {pickerOpen ? 'Close GIFs' : 'Add GIF/Sticker'}
            </Button>
            <Button size="sm" tone="mint" onClick={handleFinish}>
              Finish &amp; preview
            </Button>
          </Row>
        </Card>
      </div>
      {pickerOpen && editor && <GifPicker editor={editor} onClose={() => setPickerOpen(false)} />}
    </div>
  )
}
