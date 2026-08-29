import type { ReactNode } from 'react'

/**
 * The desk: one sheet, with a strip of page chrome above and/or below it.
 *
 * WHY THIS EXISTS — the canvas is not a place to put controls.
 *
 * Every app control used to float ON the drawing: the composer's dateline and
 * Finish button in a card pinned to the top of the canvas, the player's whole
 * transport in a card pinned near the bottom. Both sat over the one thing the
 * screen is for. On the player that was the worst of it — a 780px card across
 * the middle-bottom of a letter somebody drew by hand, with tldraw's own
 * toolbar stacked underneath it, and no way to put either away.
 *
 * So the frame is the letter and nothing else, and everything else is page
 * chrome in a bar OUTSIDE it. The bars are deliberately NOT cards: a cushion
 * around the controls would read as a third surface competing with the sheet.
 * They sit straight on the page, the way a caption sits under a plate.
 *
 * THE GEOMETRY, because it is load-bearing (see `.desk` in index.css):
 *
 * The column's height is fixed at `--frame-h + --bar-slot` and its width is
 * capped at `--frame-h * 16/9`. A screen with exactly one bar therefore leaves
 * the frame at `--frame-h` tall and `--frame-h * 16/9` wide — which is the
 * 1600x900 letter's own aspect ratio, so tldraw fits it edge to edge with no
 * letterbox and, more importantly, no CROP. A screen with no bars (Inbox,
 * Requests, Profile) gives the whole column to the frame; nothing in those is
 * aspect-sensitive.
 *
 * `overlay` is the escape hatch for the one thing that genuinely does belong
 * over the canvas: the player's transport in immersive mode, where the point
 * is that it is over the letter and gets out of the way on its own.
 */
export default function Stage({
  toolbar,
  transport,
  overlay,
  children,
}: {
  /** Page chrome above the sheet. Composer: dateline, recording state, actions. */
  toolbar?: ReactNode
  /** Page chrome below the sheet. Player: the docked transport. */
  transport?: ReactNode
  /** Rendered INSIDE the frame, over the canvas. Position it yourself. */
  overlay?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="stage">
      {toolbar ? <div className="stage__bar stage__bar--top">{toolbar}</div> : null}
      <div className="stage__frame">
        {children}
        {overlay}
      </div>
      {transport ? <div className="stage__bar stage__bar--bottom">{transport}</div> : null}
    </div>
  )
}
