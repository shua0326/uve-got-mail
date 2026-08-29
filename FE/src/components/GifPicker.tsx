import { useEffect, useRef, useState } from 'react'
import { AssetRecordType, createShapeId, type Editor } from 'tldraw'
import { searchGiphy, type GiphyResult } from '../api'
import { IconButton } from './pouf/Button'
import { Empty, ErrorNote, Skeleton } from './pouf/feedback'
import { Icon } from './pouf/Icon'
import { Input } from './pouf/Input'
import { Grid, Row } from './pouf/layout'
import { Segmented } from './pouf/Segmented'
import { Card } from './pouf/surface'

const DEBOUNCE_MS = 400

export default function GifPicker({ editor, onClose }: { editor: Editor; onClose: () => void }) {
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
  }

  const searched = query.trim().length > 0

  return (
    <div className="gif-panel">
      {/* `flush` because the panel supplies its own padding and, more to the
          point, owns a scroll region that has to reach the card's edges. */}
      <Card variant="flush">
        <div className="gif-panel-inner">
          <Row gap={3} justify="between" align="center" wrap={false}>
            <Segmented<'gifs' | 'stickers'>
              label="Result type"
              value={type}
              onChange={setType}
              options={[
                { value: 'gifs', label: 'GIFs' },
                { value: 'stickers', label: 'Stickers' },
              ]}
            />
            <IconButton icon={<Icon name="close" />} label="Close" variant="quiet" size="sm" onClick={onClose} />
          </Row>

          <Input
            // Without this the panel opens with focus still on the canvas, and
            // every keystroke is a tldraw tool shortcut instead of a search —
            // typing "cat" silently switches to the text tool.
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

            {searched && results.length > 0 && (
              <Grid cols={2} gap={2}>
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
        </div>
      </Card>
    </div>
  )
}
