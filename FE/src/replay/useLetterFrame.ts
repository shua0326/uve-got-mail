import { useEffect } from 'react'
import type { Editor } from 'tldraw'
import { LETTER_PAGE } from './format'

/**
 * Put the camera on the letter's page, and keep it there.
 *
 * WHY THIS EXISTS AT ALL — the camera constraints are not enough.
 *
 * Both canvas screens pass `options.camera.constraints` with `bounds` set to
 * `LETTER_PAGE` and `initialZoom: 'fit-min'`. Those constraints are real and
 * worth keeping: they are what stops a pan from wandering off the page, and
 * what `baseZoom` measures the zoom steps against. What they do NOT do is move
 * the camera at construction. `Editor` merges `options.camera` into its camera
 * options atom and leaves the camera itself at z=1.
 *
 * Measured, before this hook existed: a 1040x517 sheet, `fit-min` = 0.574, and
 * the composer's actual zoom was 1.000. The author was drawing on a 1040x517
 * window onto a 1600x900 page — the top-left 37% of it — while the player
 * framed the whole page. So a letter came out smaller and further up and left
 * than it was drawn, every time, and the parts of the page the author could
 * not reach were simply unreachable.
 *
 * WHY IT ALSO HAS TO RE-RUN
 *
 * The sheet changes size at runtime: entering the player's immersive mode
 * gives it another bar's worth of height, and a window resize changes it
 * continuously. A camera left at the old zoom leaves the letter floating small
 * inside its own sheet, or overflowing it.
 *
 * A `ResizeObserver` on tldraw's own container is the signal — it is the
 * element whose size decides the answer, and the editor hands it over. The
 * observer also fires once on `observe`, which covers the mount.
 *
 * Deliberately NOT re-run on anything else. Zooming in to draw a detail, or
 * panning around a big drawing, are things a person did on purpose, and a
 * camera that snapped back would fight them.
 */
export function frameLetterPage(editor: Editor) {
  // `updateViewportScreenBounds` FIRST, and it is not optional.
  //
  // `zoomToBounds` divides by `editor.getViewportScreenBounds()` — tldraw's
  // own cached measurement, refreshed by tldraw's own ResizeObserver — and
  // there is no ordering guarantee between two observers on one element.
  // Without this the player measured the sheet the COMPOSER had been using
  // and framed the letter at 0.574 where it should have been 0.526: right
  // edge past the frame, bottom 44px off it, and nothing to correct it,
  // because the container never changed size again. Handing the element over
  // re-measures it before the division.
  editor.updateViewportScreenBounds(editor.getContainer())
  // `inset: 0` matters too: zoomToBounds otherwise subtracts a default padding
  // (up to 28% of the viewport) and the page would sit small inside its own
  // sheet. The sheet supplies the margin; the camera must not add another.
  editor.zoomToBounds(LETTER_PAGE, { inset: 0 })
}

export function useLetterFrame(editor: Editor | null) {
  useEffect(() => {
    if (!editor) return
    const container = editor.getContainer()
    let raf = 0
    const reframe = () => {
      // Coalesces the burst of observations a drag-resize produces into one
      // reframe per painted frame.
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => frameLetterPage(editor))
    }
    const observer = new ResizeObserver(reframe)
    observer.observe(container)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(raf)
    }
  }, [editor])
}
