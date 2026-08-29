import { Request, Response } from "express";
import { TtlCache } from "../../cache/ttlCache";

const ONE_HOUR_MS = 60 * 60 * 1000;
const cache = new TtlCache<unknown>(ONE_HOUR_MS);

export async function searchGiphy(req: Request, res: Response): Promise<void> {
  const apiKey = process.env.GIPHY_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "GIPHY_API_KEY not configured on the server" });
    return;
  }

  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const type = req.query.type === "stickers" ? "stickers" : "gifs";
  const offset = typeof req.query.offset === "string" ? req.query.offset : "0";

  if (!q) {
    res.json({ data: [] });
    return;
  }

  const cacheKey = `${type}:${q}:${offset}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    res.json(cached);
    return;
  }

  const url = new URL(`https://api.giphy.com/v1/${type}/search`);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("q", q);
  url.searchParams.set("limit", "24");
  url.searchParams.set("offset", offset);
  url.searchParams.set("rating", "pg-13");

  try {
    const giphyRes = await fetch(url);
    if (!giphyRes.ok) {
      res.status(giphyRes.status).json({ error: "Giphy request failed" });
      return;
    }
    const body = await giphyRes.json();
    cache.set(cacheKey, body);
    res.json(body);
  } catch (err) {
    console.error("Giphy proxy error:", err);
    res.status(502).json({ error: "Failed to reach Giphy" });
  }
}
