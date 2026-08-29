import { useEffect, useRef, useState } from 'react'
import { AssetRecordType, createShapeId, type Editor } from 'tldraw'
import { searchGiphy, type GiphyResult } from '../api'
import { Button } from './pouf/Button'
import { Dialog } from './pouf/controls'
import { Empty, ErrorNote, Skeleton } from './pouf/feedback'
import { Input } from './pouf/Input'
import { Grid, Stack } from './pouf/layout'
import { Segmented } from './pouf/Segmented'
import { toast } from './pouf/toaster'

const DEBOUNCE_MS = 400

/**
 * Picks a GIF or sticker and drops it into the middle of the letter.
 *
 * WAS A CANVAS PANEL, IS NOW A DIALOG.
 *
 * It used to be a 300px column pinned down the left of the drawing surface
 * from y=60 to y=72-from-the-bottom — a fifth of the letter, covered, for as
 * long as it was open, and it opened over whatever you had already drawn
 * there. The justification for a non-modal panel is that you need to see the
 * document while you use it, and that is not true here: you search, you pick
 * one, and it lands in the centre of the page. Nothing about the letter
 * informs the choice while the panel is up.
 *
 * As a modal it costs the canvas nothing, dismisses on Escape and on a click
 * outside, traps focus while it is up, and becomes a full-height sheet on a
 * phone for free (pouf.css does that to every dialog under 900px). `Dialog`
 * rather than `Confirm` on purpose — pouf's note: an alert dialog is for a
 * decision with consequences and refuses to be dismissed by clicking away.
 * This is browsing.
 */
export default function GifPicker({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [type, setType] = useState<'gifs' | 'stickers'>('gifs')
  const [results, setResults] = useState<GiphyResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    // Nothing to fetch for an empty query — `results`/`error` are only ever
    // rendered when `query.trim()` is truthy (see render below), so there's
    // no stale-state cleanup needed here.
    if (!query.trim()) return

    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await searchGiphy(query, type)
        setResults(data)
      } catch (err) {
        console.error('Giphy search failed', err)
        setError('Search failed — is the backend running?')
      } finally {
        setLoading(false)
      }
    }, DEBOUNCE_MS)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, type])

  const insert = (gif: GiphyResult) => {
    const img = gif.images.fixed_height
    const w = Number(img.width)
    const h = Number(img.height)
    const center = editor.getViewportPageBounds().center

    const assetId = AssetRecordType.createId()
    const shapeId = createShapeId()

    // Single batch so the asset + shape land as one recorder frame (plan §1.4/§5.3).
    editor.run(() => {
      editor.createAssets([
        AssetRecordType.create({
          id: assetId,
          type: 'image',
          props: {
            src: img.url, // remote Giphy CDN URL — never inlined as base64 (plan §1.4)
            w,
            h,
            name: gif.title || 'gif',
            isAnimated: true,
            mimeType: 'image/gif',
          },
        }),
      ])
      editor.createShape({
        id: shapeId,
        type: 'image',
        x: center.x - w / 2,
        y: center.y - h / 2,
        props: { assetId, w, h },
      })
    })

    // Step 5.4: confirm the recorded shape/asset carry the Giphy URL, not base64.
    const asset = editor.getAsset(assetId)
    const src = asset && 'src' in asset.props ? asset.props.src : undefined
    console.info(
      `[gif insert] asset src is ${src?.startsWith('data:') ? 'BASE64 (bad!)' : 'a remote URL (good)'}:`,
      src,
    )

    // Closing on insert is the point of the modal: the thing you came for has
    // happened and it happened on the canvas, which is behind this. The toast
    // is what tells you so, because the dialog closing is not by itself proof
    // that anything landed — the sticker arrives in the CENTRE of the page,
    // which may not be where you were looking.
    setOpen(false)
    toast.success('Added to your letter', {
      description: 'Drag it where you want it.',
    })
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      // A reopened picker starts clean. Keeping the last search would show
      // results for a letter you have since finished thinking about, and the
      // grid is the first thing your eye lands on.
      setQuery('')
      setResults([])
      setError(null)
    }
    setOpen(next)
  }

  const searched = query.trim().length > 0

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
      size="lg"
      title="Add a GIF or sticker"
      description="It lands in the middle of the page — drag it from there."
      trigger={
        <Button size="sm" variant="quiet">
          Add GIF
        </Button>
      }
    >
      <Stack gap={4}>
        <Segmented<'gifs' | 'stickers'>
          label="Result type"
          value={type}
          onChange={setType}
          options={[
            { value: 'gifs', label: 'GIFs' },
            { value: 'stickers', label: 'Stickers' },
          ]}
        />

        <Input
          // Without this the picker opens with focus still on the canvas, and
          // every keystroke is a tldraw tool shortcut instead of a search —
          // typing "cat" silently switched to the text tool. Radix's focus
          // trap makes this less load-bearing than it was on the old non-modal
          // panel, but it is still what puts the caret where you are looking.
          autoFocus
          label={`Search ${type}`}
          value={query}
          onChange={setQuery}
          placeholder={`Search ${type}…`}
          autoComplete="off"
          spellCheck={false}
        />

        <div className="gif-scroll">
          {loading && <Skeleton variant="row" count={3} />}
          {searched && !loading && error && <ErrorNote>{error}</ErrorNote>}
          {searched && !loading && !error && results.length === 0 && (
            <Empty icon="search" title="No results" />
          )}
          {!searched && !loading && (
            <Empty icon="search" title="What are you after?">
              Try a word or two — "hello", "cat", "thank you".
            </Empty>
          )}

          {searched && results.length > 0 && (
            <Grid cols={4} gap={2}>
              {results.map((gif) => (
                // Stays a raw button: pouf has no fluid image-tile component
                // — `Figure` takes fixed width/height, which a responsive
                // grid cell can't supply. Styled in index.css off pouf's own
                // control radius. (DESIGN_MIGRATION_PLAN.md §9.6.)
                <button
                  key={gif.id}
                  type="button"
                  className="gif-tile"
                  onClick={() => insert(gif)}
                  title={gif.title}
                >
                  <img src={gif.images.fixed_height.url} alt={gif.title} loading="lazy" />
                </button>
              ))}
            </Grid>
          )}
        </div>
      </Stack>
    </Dialog>
  )
}
