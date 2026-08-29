import { useCallback, useEffect, useRef, useState } from 'react'
import type { Editor } from 'tldraw'
import { squashRecordDiffs } from '@tldraw/store'
import { toRecordsDiff, type ForwardDiff, type Recording } from './format'

export type PlayerStatus = 'idle' | 'playing' | 'paused' | 'finished' | 'error'

/**
 * Migrate one persisted record against the schema it was recorded with, up
 * to the local (live) schema. Returns null and logs on failure.
 */
function migrateRecord(editor: Editor, record: unknown, persistedSchema: unknown): unknown | null {
  const result = editor.store.schema.migratePersistedRecord(
    record as Parameters<Editor['store']['schema']['migratePersistedRecord']>[0],
    persistedSchema as Parameters<Editor['store']['schema']['migratePersistedRecord']>[1],
    'up',
  )
  if (result.type === 'error') {
    console.error('[player] record migration failed:', result.reason, record)
    return null
  }
  return result.value
}

/** Migrate every record in a ForwardDiff. Returns null if any record fails. */
function migrateForwardDiff(editor: Editor, d: ForwardDiff, persistedSchema: unknown): ForwardDiff | null {
  const out: ForwardDiff = {}

  if (d.a) {
    out.a = {}
    for (const [id, record] of Object.entries(d.a)) {
      const migrated = migrateRecord(editor, record, persistedSchema)
      if (migrated === null) return null
      out.a[id] = migrated
    }
  }
  if (d.u) {
    out.u = {}
    for (const [id, record] of Object.entries(d.u)) {
      const migrated = migrateRecord(editor, record, persistedSchema)
      if (migrated === null) return null
      out.u[id] = migrated
    }
  }
  if (d.r) out.r = d.r

  return out
}

/**
 * Drives an editor through a Recording on a virtual clock. See
 * IMPLEMENTATION_PLAN.md §4.
 *
 * Cross-client schema migration (§4.1 step 2) is implemented: whole-snapshot
 * loads (`loadStoreSnapshot`, used for the base state and backward-seek
 * keyframes) self-migrate against the schema embedded in the snapshot, so
 * those are wrapped in try/catch only to fail gracefully rather than crash.
 * Per-frame diffs applied via `applyDiff` do NOT self-migrate — snapshot
 * migration APIs only handle whole snapshots — so each frame's records are
 * run through `migratePersistedRecord` by hand when `recording.schema`
 * differs from the local editor's schema.
 */
export function usePlayer(editor: Editor | null, recording: Recording | null) {
  const [status, setStatus] = useState<PlayerStatus>('idle')
  const [playhead, setPlayhead] = useState(0) // ms
  const [speed, setSpeedState] = useState(1)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const playheadRef = useRef(0)
  const nextFrameRef = useRef(0)
  const speedRef = useRef(1)
  const lastTickRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)
  const loadedRef = useRef(false)
  const needsMigrationRef = useRef(false)

  const applyFramesUpTo = useCallback(
    (targetFrameIndex: number) => {
      if (!editor || !recording) return
      const from = nextFrameRef.current
      if (targetFrameIndex <= from) return

      const rawFrames = recording.frames.slice(from, targetFrameIndex)
      let forwardDiffs: ForwardDiff[]

      if (needsMigrationRef.current) {
        const migrated: ForwardDiff[] = []
        for (const f of rawFrames) {
          const m = migrateForwardDiff(editor, f.d, recording.schema)
          if (m === null) {
            setErrorMessage("This letter was recorded with an incompatible tldraw version and can't be replayed.")
            setStatus('error')
            return
          }
          migrated.push(m)
        }
        forwardDiffs = migrated
      } else {
        forwardDiffs = rawFrames.map((f) => f.d)
      }

      const diffs = forwardDiffs.map(toRecordsDiff)
      const squashed = diffs.length === 1 ? diffs[0] : squashRecordDiffs(diffs)
      // Recorded diffs come off the wire as untyped JSON; we trust them to be
      // valid TLRecords (they were captured from a real tldraw store, and
      // migrated above if the schema differed).
      editor.store.mergeRemoteChanges(() =>
        editor.store.applyDiff(squashed as unknown as Parameters<typeof editor.store.applyDiff>[0]),
      )
      nextFrameRef.current = targetFrameIndex
    },
    [editor, recording],
  )

  // Initial load: readonly, base state, camera framed to match the author.
  useEffect(() => {
    if (!editor || !recording) return

    const localSchema = editor.store.schema.serialize()
    needsMigrationRef.current = JSON.stringify(recording.schema) !== JSON.stringify(localSchema)

    editor.updateInstanceState({ isReadonly: true })

    let failure: string | null = null
    try {
      editor.store.mergeRemoteChanges(() => {
        editor.store.loadStoreSnapshot(
          recording.baseSnapshot as Parameters<typeof editor.store.loadStoreSnapshot>[0],
        )
      })
    } catch (err) {
      console.error('[player] failed to load base snapshot (schema mismatch?)', err)
      failure = "This letter can't be replayed on this version of the app."
    }

    if (failure) {
      // One-time failure transition tied to the imperative snapshot load
      // above, not a plain prop-to-state mirror.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setErrorMessage(failure)
      setStatus('error')
      return
    }

    nextFrameRef.current = 0
    playheadRef.current = 0
    loadedRef.current = true
    // Autoplay on mount is the locked UX (plan §3.4/§4.4) — this kicks off
    // playback as part of the same imperative setup as the snapshot load
    // and camera framing above, not a plain prop-to-state mirror.
    setStatus('playing')
    requestAnimationFrame(() => editor.zoomToFit())

    return () => {
      loadedRef.current = false
    }
  }, [editor, recording])

  // Playback loop.
  useEffect(() => {
    if (status !== 'playing' || !editor || !recording) return

    lastTickRef.current = null

    const tick = (now: number) => {
      if (lastTickRef.current === null) lastTickRef.current = now
      const dt = now - lastTickRef.current
      lastTickRef.current = now

      playheadRef.current += dt * speedRef.current
      setPlayhead(playheadRef.current)

      let target = nextFrameRef.current
      while (target < recording.frames.length && recording.frames[target].t <= playheadRef.current) target++
      applyFramesUpTo(target)

      if (playheadRef.current >= recording.durationMs && nextFrameRef.current >= recording.frames.length) {
        setStatus('finished')
        return
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [status, editor, recording, applyFramesUpTo])

  const seek = useCallback(
    (targetMs: number) => {
      if (!editor || !recording) return
      const clamped = Math.max(0, Math.min(targetMs, recording.durationMs))
      const targetFrameIndex = recording.frames.findIndex((f) => f.t > clamped)
      const targetFrame = targetFrameIndex === -1 ? recording.frames.length : targetFrameIndex

      if (targetFrame < nextFrameRef.current) {
        // Seeking backward: §4.3 — restore the nearest keyframe at or before
        // the target, then replay forward. We gave up reverseRecordsDiff in
        // exchange for a smaller wire format (plan §1.3), so this is the way back.
        const keyframe = [...recording.keyframes].reverse().find((k) => k.frameIndex <= targetFrame)
        try {
          editor.store.mergeRemoteChanges(() => {
            editor.store.loadStoreSnapshot(
              (keyframe?.snapshot ?? recording.baseSnapshot) as Parameters<typeof editor.store.loadStoreSnapshot>[0],
            )
          })
        } catch (err) {
          console.error('[player] failed to load keyframe snapshot while seeking', err)
          setErrorMessage("This letter can't be replayed on this version of the app.")
          setStatus('error')
          return
        }
        nextFrameRef.current = keyframe?.frameIndex ?? 0
      }

      applyFramesUpTo(targetFrame)
      playheadRef.current = clamped
      setPlayhead(clamped)
      lastTickRef.current = null
    },
    [editor, recording, applyFramesUpTo],
  )

  const play = useCallback(() => {
    if (!recording) return
    if (status === 'finished') seek(0)
    setStatus('playing')
  }, [status, recording, seek])

  const pause = useCallback(() => setStatus('paused'), [])

  const setSpeed = useCallback((s: number) => {
    speedRef.current = s
    setSpeedState(s)
  }, [])

  const replay = useCallback(() => {
    seek(0)
    setStatus('playing')
  }, [seek])

  return {
    status,
    playhead,
    durationMs: recording?.durationMs ?? 0,
    speed,
    errorMessage,
    play,
    pause,
    seek,
    setSpeed,
    replay,
  }
}
