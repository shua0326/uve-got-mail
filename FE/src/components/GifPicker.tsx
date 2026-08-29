import { useEffect, useRef, useState } from 'react'
import { AssetRecordType, createShapeId, type Editor } from 'tldraw'
import { searchGiphy, type GiphyResult } from '../api'

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

  return (
    <div className="gif-picker">
      <div className="gif-picker-header">
        <div className="gif-picker-tabs">
          <button className={type === 'gifs' ? 'active' : ''} onClick={() => setType('gifs')}>
            GIFs
          </button>
          <button className={type === 'stickers' ? 'active' : ''} onClick={() => setType('stickers')}>
            Stickers
          </button>
        </div>
        <button className="gif-picker-close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>

      <input
        className="gif-picker-search"
        type="text"
        placeholder={`Search ${type}…`}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus
      />

      {loading && <div className="gif-picker-status">Searching…</div>}
      {query.trim() && error && <div className="gif-picker-status gif-picker-error">{error}</div>}
      {query.trim() && !loading && !error && results.length === 0 && (
        <div className="gif-picker-status">No results</div>
      )}

      <div className="gif-picker-grid">
        {(query.trim() ? results : []).map((gif) => (
          <button
            key={gif.id}
            className="gif-picker-item"
            onClick={() => insert(gif)}
            title={gif.title}
          >
            <img src={gif.images.fixed_height.url} alt={gif.title} loading="lazy" />
          </button>
        ))}
      </div>
    </div>
  )
}
