import type { NextApiRequest, NextApiResponse } from "next";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<
  string,
  { ts: number; value: { lat: string; lon: string; displayName: string } }
>();

type NominatimItem = {
  lat: string;
  lon: string;
  display_name?: string;
  name?: string;
  class?: string;
  type?: string;
  addresstype?: string;
};

const normalize = (text: string) => text.toLowerCase().replace(/\s+/g, "");

function pickBestCandidate(q: string, items: NominatimItem[]) {
  const qNorm = normalize(q);
  const queryLooksLikeStation = q.includes("역");
  const queryLooksLikeAddress = /\d/.test(q) || q.includes("로") || q.includes("길");

  let best: { item: NominatimItem; score: number } | null = null;
  for (const item of items) {
    const name = item.name ?? "";
    const display = item.display_name ?? "";
    const nameNorm = normalize(name);
    const displayNorm = normalize(display);

    let score = 0;
    if (displayNorm.includes(qNorm)) score += 15;
    if (nameNorm === qNorm) score += 20;
    if (nameNorm.includes(qNorm)) score += 10;
    if (display.includes("역")) score += 6;
    if (display.includes("사거리") || display.includes("교차로")) score += 8;
    if (item.class === "railway") score += 10;
    if (item.type === "station" || item.type === "subway") score += 12;
    if (queryLooksLikeStation && display.includes("역")) score += 10;
    if (queryLooksLikeAddress && (item.addresstype === "road" || item.addresstype === "house_number")) {
      score += 8;
    }

    if (!best || score > best.score) {
      best = { item, score };
    }
  }

  return best?.item ?? items[0];
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const qRaw = String(req.query.q || "").trim();
  const q = qRaw.replace(/\s+/g, " ");
  if (!q) return res.status(400).json({ error: "missing q" });
  if (q.length < 2) return res.status(400).json({ error: "query too short" });
  if (q.length > 200)
    return res.status(400).json({ error: "query too long" });

  const cacheKey = q.toLowerCase();
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=60");
    return res.status(200).json(cached.value);
  }

  const url = new URL(NOMINATIM_URL);
  url.searchParams.set("q", q);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "5");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("accept-language", "ko");
  url.searchParams.set("countrycodes", "kr");

  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 5000);
    try {
      const resp = await fetch(url.toString(), {
        signal: controller.signal,
        headers: {
          "User-Agent": "spat-nextjs/1.0 (contact: local)",
          Accept: "application/json",
        },
      });
      const text = await resp.text();
      if (!resp.ok) {
        return res.status(502).json({
          error: "geocode upstream failed",
          status: resp.status,
          bodyPreview: text.slice(0, 200),
        });
      }
      const data = JSON.parse(text) as NominatimItem[];
      if (!Array.isArray(data) || data.length === 0) {
        return res.status(404).json({ error: "not found" });
      }
      const item = pickBestCandidate(q, data);
      const payload = {
        lat: item.lat,
        lon: item.lon,
        displayName: item.display_name ?? "",
      };
      cache.set(cacheKey, { ts: Date.now(), value: payload });
      res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=60");
      return res.status(200).json(payload);
    } finally {
      clearTimeout(t);
    }
  } catch (e: unknown) {
    if (e instanceof Error && e.name === "AbortError") {
      return res.status(504).json({ error: "geocode timeout" });
    }
    const msg = e instanceof Error ? e.message : String(e);
    return res.status(500).json({ error: msg });
  }
}
