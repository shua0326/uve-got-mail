/**
 * tldraw's licence key, read once and shared by both canvas screens.
 *
 * WHY THIS IS NOT INLINED AT THE TWO CALL SITES
 *
 * Two components mount an editor — LetterCanvas (composing) and LetterPlayer
 * (replaying) — and a key applied to only one of them is the worst outcome:
 * the composer looks fine in testing while every received letter is the one
 * that misbehaves, or the reverse. One export, imported twice, makes that
 * failure impossible to introduce by editing a single file.
 *
 * WHY IT DOES NOT THROW, UNLIKE lib/supabaseClient.ts
 *
 * Supabase's keys are load-bearing at every startup: without them there is no
 * session and no app, so failing loudly at import time is the honest thing.
 * A tldraw licence is different — the editor runs unlicensed, it is only
 * watermarked/gated — and a hard throw would mean a teammate who has cloned
 * the repo without the key gets a blank app instead of a working dev
 * environment. So a missing key degrades rather than breaks, and the warning
 * below is scoped to production, where a missing key is genuinely a mistake.
 *
 * The `VITE_` prefix is correct and not an oversight: tldraw licence keys are
 * designed to be embedded in the client bundle and are validated against the
 * domain they are served from, so this value is public by nature — the same
 * reasoning as VITE_SUPABASE_ANON_KEY. Do NOT move it server-side; Vite would
 * not inline it and the editor would never see it.
 */
const RAW = import.meta.env.VITE_TLDRAW_LICENSE_KEY

/**
 * `undefined` rather than `''` when unset, deliberately. tldraw's `licenseKey`
 * prop is optional, and passing `undefined` is indistinguishable from not
 * passing it at all — so an unconfigured dev environment behaves exactly as it
 * did before this file existed. An empty string is NOT equivalent: that is a
 * present-but-invalid key, which tldraw reports as a licence error rather than
 * as an absent licence.
 *
 * Trimmed because the key is long enough that it is pasted rather than typed,
 * and a trailing newline or space picked up on the way into a dashboard env
 * var is otherwise a silent invalid-licence failure.
 */
export const TLDRAW_LICENSE_KEY: string | undefined = RAW?.trim() || undefined

if (import.meta.env.PROD && !TLDRAW_LICENSE_KEY) {
  console.warn(
    '[tldraw] No VITE_TLDRAW_LICENSE_KEY set for this production build. ' +
      'The editor will run unlicensed. Vite inlines this at BUILD time, so ' +
      'setting it on the host after a deploy does nothing — set it, then ' +
      'rebuild.',
  )
}
