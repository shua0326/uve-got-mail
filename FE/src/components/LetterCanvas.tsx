import { useCallback, useState } from 'react'
import { Tldraw, type Editor } from 'tldraw'
import { useRecorder } from '../replay/useRecorder'
import type { Recording } from '../replay/format'
import GifPicker from './GifPicker'

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

export default function LetterCanvas({ onFinish }: { onFinish: (recording: Recording) => void }) {
  const [editor, setEditor] = useState<Editor | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const { isRecording, frameCount, finish } = useRecorder(editor)

  const handleMount = useCallback((e: Editor) => setEditor(e), [])

  const handleFinish = useCallback(() => {
    const recording = finish()
    if (!recording) {
      window.alert('Draw something first!')
      return
    }
    onFinish(recording)
  }, [finish, onFinish])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Tldraw options={CAMERA_OPTIONS} onMount={handleMount} />
      <div className="recorder-hud">
        <span className={`recorder-dot ${isRecording ? 'recorder-dot--live' : ''}`} />
        <span>{isRecording ? `Recording — ${frameCount} frames` : 'Draw to start recording'}</span>
        <button onClick={() => setPickerOpen((v) => !v)} disabled={!editor}>
          {pickerOpen ? 'Close GIFs' : 'Add GIF/Sticker'}
        </button>
        <button className="recorder-finish-btn" onClick={handleFinish}>
          Finish &amp; Preview Replay
        </button>
      </div>
      {pickerOpen && editor && <GifPicker editor={editor} onClose={() => setPickerOpen(false)} />}
    </div>
  )
}
