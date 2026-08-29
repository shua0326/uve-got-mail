// Relative — routed through Vite's dev proxy (vite.config.ts) so requests
// stay same-origin. See IMPLEMENTATION_PLAN.md §8.
const API_BASE = "";

export interface GiphyImage {
  url: string;
  width: string;
  height: string;
}

export interface GiphyResult {
  id: string;
  title: string;
  is_sticker?: number;
  images: {
    fixed_height: GiphyImage;
  };
}

export async function searchGiphy(
  query: string,
  type: "gifs" | "stickers",
): Promise<GiphyResult[]> {
  const url = new URL(`${API_BASE}/giphy/search`, window.location.origin);
  url.searchParams.set("q", query);
  url.searchParams.set("type", type);

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Giphy search failed: ${res.status}`);
  const body = await res.json();
  return (body.data ?? []) as GiphyResult[];
}

export async function uploadRecording(blob: Blob): Promise<string> {
  const res = await fetch(`${API_BASE}/recordings`, {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream" },
    body: blob,
  });
  if (!res.ok) throw new Error(`Recording upload failed: ${res.status}`);
  const { id } = await res.json();
  return id as string;
}

export async function fetchRecording(id: string, signal?: AbortSignal): Promise<ArrayBuffer> {
  const res = await fetch(`${API_BASE}/recordings/${id}`, { signal });
  if (!res.ok) throw new Error(`Recording fetch failed: ${res.status}`);
  return res.arrayBuffer();
}
