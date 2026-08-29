import { useCallback, useState } from 'react'
import { Tldraw, type Editor, type TLUiOverrides } from 'tldraw'
import { usePlayer } from '../replay/usePlayer'
import type { Recording } from '../replay/format'
import { Button, IconButton } from './pouf/Button'
import { Select } from './pouf/controls'
import { ErrorNote } from './pouf/feedback'
import { Icon } from './pouf/Icon'
import { Row, Stack } from './pouf/layout'
import { Slider } from './pouf/slider'
import { Card } from './pouf/surface'
import { Text } from './pouf/text'

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

// Readonly (usePlayer.ts §13) already blocks edits and makes tldraw's own
// toolbar filter itself down to just Select/Hand/Laser — the three tools
// marked `readonlyOk`. Select and Hand are exactly "manipulate the canvas
// view" (marquee-select does nothing destructive; Hand pans); Laser isn't a
// view control, so it's the one thing removed on top of that filtering.
// The style panel has no reason to appear with no drawing tool ever
// reachable, but it's hidden explicitly rather than left to infer that.
const PLAYER_COMPONENTS = {
  StylePanel: null,
}

const PLAYER_OVERRIDES: TLUiOverrides = {
  tools(_editor, tools) {
    delete tools.laser
    return tools
  },
}

const SPEEDS = [0.5, 1, 2, 4]
const SPEED_OPTIONS = SPEEDS.map((s) => ({ value: String(s), label: `${s}×` }))

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
}: {
  recording: Recording
  onBack: () => void
  /** Where "back" actually goes. The player is reached from the composer and
   *  from the inbox, and a hard-coded "Back to compose" is wrong half the
   *  time — so the caller, which is the only thing that knows, names it. */
  backLabel: string
}) {
  const [editor, setEditor] = useState<Editor | null>(null)
  const handleMount = useCallback((e: Editor) => setEditor(e), [])

  const { status, playhead, durationMs, speed, errorMessage, play, pause, seek, setSpeed, replay } = usePlayer(
    editor,
    recording,
  )

  return (
    <div className="stage">
      <Tldraw
        options={CAMERA_OPTIONS}
        onMount={handleMount}
        components={PLAYER_COMPONENTS}
        overrides={PLAYER_OVERRIDES}
      />

      {status === 'error' ? (
        <div className="hud hud--bottom">
          <Card variant="tight">
            <Stack gap={3}>
              <ErrorNote>{errorMessage}</ErrorNote>
              <Button size="sm" variant="quiet" onClick={onBack}>
                ← {backLabel}
              </Button>
            </Stack>
          </Card>
        </div>
      ) : (
        <div className="hud hud--bottom">
          <Card variant="tight">
            <Row gap={3} align="center" wrap={false}>
              <Button size="sm" variant="quiet" onClick={onBack}>
                ← {backLabel}
              </Button>

              <IconButton
                icon={<Icon name={status === 'playing' ? 'pause' : 'play'} />}
                label={status === 'playing' ? 'Pause' : status === 'finished' ? 'Replay' : 'Play'}
                tone="purple"
                variant="solid"
                size="sm"
                onClick={status === 'playing' ? pause : status === 'finished' ? replay : play}
              />

              {/* Pouf's Slider is range-capable, hence the array on both ends. */}
              <div className="hud-grow">
                <Slider
                  label="Seek"
                  min={0}
                  max={durationMs || 1}
                  value={[Math.min(playhead, durationMs)]}
                  onChange={([next]) => seek(next)}
                />
              </div>

              <Text size="sm" muted num>
                {formatMs(playhead)} / {formatMs(durationMs)}
              </Text>

              <Select
                label="Playback speed"
                value={String(speed)}
                onChange={(next) => setSpeed(Number(next))}
                options={SPEED_OPTIONS}
              />
            </Row>
          </Card>
        </div>
      )}
    </div>
  )
}
