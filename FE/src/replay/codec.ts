import type { Recording } from './format'

// Streams are drained by hand rather than via `new Response(stream)`. The
// latter works in a plain browser but was observed to throw a spurious
// "TypeError: Failed to fetch" here specifically when this runs inside a
// page controlled by the claude-in-chrome automation extension — its
// network-instrumentation appears to hook Response/fetch and mishandle a
// Response built from a stream that never went through a real fetch() call.
// Reading the stream directly sidesteps that entirely and has no downside.
async function drainStream(stream: ReadableStream<Uint8Array>): Promise<Uint8Array[]> {
  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
  }
  return chunks
}

/** JSON + gzip a recording, using native browser streams — no dependency. */
export async function encode(rec: Recording): Promise<Blob> {
  const stream = new Blob([JSON.stringify(rec)]).stream().pipeThrough(new CompressionStream('gzip'))
  return new Blob(await drainStream(stream) as BlobPart[])
}

export async function decode(buf: ArrayBuffer): Promise<Recording> {
  const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))
  const chunks = await drainStream(stream)
  const decoder = new TextDecoder()
  const text = chunks.map((chunk) => decoder.decode(chunk, { stream: true })).join('') + decoder.decode()
  return JSON.parse(text) as Recording
}
