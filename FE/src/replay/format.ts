import type { RecordsDiff, UnknownRecord } from '@tldraw/store'

export const RECORDING_FORMAT_VERSION = 1

/**
 * The page a letter is written on, in tldraw page coordinates.
 *
 * The composer's camera is constrained to it, the player's camera is
 * constrained to it, and the player frames exactly this on load — so what the
 * recipient sees is the sheet the author was looking at, not a crop of it and
 * not a zoom onto whatever they happened to draw. It lives here, beside the
 * recording format, because it is part of the contract between the two ends:
 * change it and every existing recording is reframed.
 *
 * 16:9 is not arbitrary either — `.desk` in index.css sizes the frame from it,
 * so the sheet on screen is the same shape as the page inside it.
 */
export const LETTER_PAGE = { x: 0, y: 0, w: 1600, h: 900 } as const

/** A RecordsDiff stripped for forward-only application. */
export interface ForwardDiff {
  a?: Record<string, unknown> // added:   id -> full record
  u?: Record<string, unknown> // updated: id -> `to` record ONLY
  r?: string[]                // removed: ids ONLY
}

export interface Frame {
  t: number // ms since recording start
  d: ForwardDiff
}

export interface Keyframe {
  frameIndex: number // this snapshot is the state AFTER frames[0..frameIndex-1]
  snapshot: unknown
}

export interface Recording {
  version: typeof RECORDING_FORMAT_VERSION
  tldrawVersion: string
  schema: unknown
  createdAt: string
  durationMs: number
  baseSnapshot: unknown
  frames: Frame[]
  keyframes: Keyframe[]
}

/** Strip a RecordsDiff down to the forward-only wire format. `from` is never read by
 * `store.applyDiff`, and `removed` values are discarded there too. */
export function strip(diff: RecordsDiff<UnknownRecord>): ForwardDiff {
  const out: ForwardDiff = {}

  const added = Object.entries(diff.added)
  if (added.length) {
    out.a = {}
    for (const [id, record] of added) out.a[id] = record
  }

  const updated = Object.entries(diff.updated)
  if (updated.length) {
    out.u = {}
    for (const [id, [, to]] of updated) out.u[id] = to
  }

  const removedIds = Object.keys(diff.removed)
  if (removedIds.length) out.r = removedIds

  return out
}

/** Rehydrate a ForwardDiff back into a RecordsDiff tldraw's store.applyDiff can consume. */
export function toRecordsDiff(d: ForwardDiff): RecordsDiff<UnknownRecord> {
  const updated: Record<string, [UnknownRecord, UnknownRecord]> = {}
  for (const [id, to] of Object.entries(d.u ?? {})) {
    updated[id] = [to as UnknownRecord, to as UnknownRecord] // `from` is unused by applyDiff
  }
  const removed: Record<string, UnknownRecord> = {}
  for (const id of d.r ?? []) removed[id] = null as unknown as UnknownRecord // keys only

  return {
    added: (d.a ?? {}) as Record<string, UnknownRecord>,
    updated,
    removed,
  }
}
