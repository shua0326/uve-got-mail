import { useCallback, useEffect, useRef, useState } from 'react'
import type { Editor } from 'tldraw'
import type { RecordsDiff, UnknownRecord } from '@tldraw/store'
import { squashRecordDiffs } from '@tldraw/store'
import { RECORDING_FORMAT_VERSION, strip, type Frame, type Keyframe, type Recording } from './format'

const FLUSH_INTERVAL_MS = 60
const KEYFRAME_EVERY_N_FRAMES = 100

/**
 * Captures document-scope, user-sourced store changes into a time-bucketed
 * Recording. See IMPLEMENTATION_PLAN.md §3.3.
 */
export function useRecorder(editor: Editor | null) {
  const [isRecording, setIsRecording] = useState(false)
  const [frameCount, setFrameCount] = useState(0)

  const startedAtRef = useRef<number | null>(null)
  const bufferRef = useRef<RecordsDiff<UnknownRecord>[]>([])
  const framesRef = useRef<Frame[]>([])
  const keyframesRef = useRef<Keyframe[]>([])
  const baseSnapshotRef = useRef<unknown>(null)
  const schemaRef = useRef<unknown>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const flush = useCallback(() => {
    if (bufferRef.current.length === 0 || startedAtRef.current === null) return

    const buffer = bufferRef.current
    bufferRef.current = []
    const squashed = buffer.length === 1 ? buffer[0] : squashRecordDiffs(buffer)

    const frame: Frame = {
      t: Math.round(performance.now() - startedAtRef.current),
      d: strip(squashed),
    }
    framesRef.current.push(frame)
    setFrameCount(framesRef.current.length)

    if (framesRef.current.length % KEYFRAME_EVERY_N_FRAMES === 0 && editor) {
      keyframesRef.current.push({
        frameIndex: framesRef.current.length,
        snapshot: editor.store.getStoreSnapshot('document'),
      })
    }
  }, [editor])

  // t=0 reference is set on the first user change, not on mount, so idle
  // time before the user starts drawing isn't recorded as dead air.
  const armRecording = useCallback(() => {
    if (startedAtRef.current !== null) return
    startedAtRef.current = performance.now()
    intervalRef.current = setInterval(flush, FLUSH_INTERVAL_MS)
    setIsRecording(true)
  }, [flush])

  // Base snapshot + schema are captured as soon as the editor is available —
  // BEFORE any user change — so they reflect the true starting state. Doing
  // this lazily inside the listener would be too late: by the time the
  // listener fires, the triggering change is already committed to the store.
  useEffect(() => {
    if (!editor) return

    baseSnapshotRef.current = editor.store.getStoreSnapshot('document')
    schemaRef.current = editor.store.schema.serialize()
    startedAtRef.current = null
    bufferRef.current = []
    framesRef.current = []
    keyframesRef.current = []

    const unlisten = editor.store.listen(
      ({ changes }) => {
        armRecording()
        bufferRef.current.push(changes)
      },
      { scope: 'document', source: 'user' },
    )

    const flushOnPointerUp = () => flush()
    window.addEventListener('pointerup', flushOnPointerUp)

    return () => {
      unlisten()
      window.removeEventListener('pointerup', flushOnPointerUp)
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [editor, armRecording, flush])

  const finish = useCallback((): Recording | null => {
    if (!editor || startedAtRef.current === null) return null

    flush() // capture anything still buffered
    if (intervalRef.current) clearInterval(intervalRef.current)
    setIsRecording(false)

    const frames = framesRef.current
    const durationMs = frames.length ? frames[frames.length - 1].t : 0

    return {
      version: RECORDING_FORMAT_VERSION,
      tldrawVersion: '5.3.2',
      schema: schemaRef.current,
      createdAt: new Date().toISOString(),
      durationMs,
      baseSnapshot: baseSnapshotRef.current,
      frames,
      keyframes: keyframesRef.current,
    }
  }, [editor, flush])

  return { isRecording, frameCount, finish }
}
