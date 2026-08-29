import { useCallback, useState } from 'react'
import { Tldraw, type Editor } from 'tldraw'
import { usePlayer } from '../replay/usePlayer'
import type { Recording } from '../replay/format'

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

const SPEEDS = [0.5, 1, 2, 4]

function formatMs(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function LetterPlayer({ recording, onBack }: { recording: Recording; onBack: () => void }) {
  const [editor, setEditor] = useState<Editor | null>(null)
  const handleMount = useCallback((e: Editor) => setEditor(e), [])

  const { status, playhead, durationMs, speed, errorMessage, play, pause, seek, setSpeed, replay } = usePlayer(
    editor,
    recording,
  )

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Tldraw options={CAMERA_OPTIONS} onMount={handleMount} />

      {status === 'error' ? (
        <div className="player-hud player-hud-error">
          <span>⚠️ {errorMessage}</span>
          <button onClick={onBack}>← Back to compose</button>
        </div>
      ) : (
        <div className="player-hud">
          <button onClick={onBack}>← Back to compose</button>

          <button onClick={status === 'playing' ? pause : status === 'finished' ? replay : play}>
            {status === 'playing' ? 'Pause' : status === 'finished' ? 'Replay' : 'Play'}
          </button>

          <input
            type="range"
            min={0}
            max={durationMs || 1}
            value={Math.min(playhead, durationMs)}
            onChange={(e) => seek(Number(e.target.value))}
            style={{ flex: 1 }}
          />

          <span className="player-time">
            {formatMs(playhead)} / {formatMs(durationMs)}
          </span>

          <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
            {SPEEDS.map((s) => (
              <option key={s} value={s}>
                {s}×
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  )
}
