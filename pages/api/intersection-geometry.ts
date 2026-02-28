import type { NextApiRequest, NextApiResponse } from "next";
import { logDebug, logError } from "@/lib/logger";
import { haversineMeters, computeBearing } from "@/lib/utils";

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 1주 — 도로는 변하지 않음
const cache = new Map<string, { ts: number; bearings: number[] }>();

type OsmNode = { lat: number; lon: number };
type OsmWay = { id: number; geometry: OsmNode[] };
type OverpassResponse = { elements: (OsmWay & { type: string })[] };

function extractBearings(way: OsmWay, cLat: number, cLon: number): number[] {
  const g = way.geometry;
  if (g.length < 2) return [];

  let minDist = Infinity;
  let ci = 0;
  for (let i = 0; i < g.length; i++) {
    const d = haversineMeters(cLat, cLon, g[i].lat, g[i].lon);
    if (d < minDist) { minDist = d; ci = i; }
  }

  const bearings: number[] = [];
  if (ci > 0) bearings.push(computeBearing(cLat, cLon, g[ci - 1].lat, g[ci - 1].lon));
  if (ci < g.length - 1) bearings.push(computeBearing(cLat, cLon, g[ci + 1].lat, g[ci + 1].lon));
  return bearings;
}

function clusterBearings(raw: number[], thresh = 22): number[] {
  if (!raw.length) return [];
  const sorted = [...raw].sort((a, b) => a - b);
  const clusters: number[][] = [[sorted[0]]];

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - sorted[i - 1] <= thresh) {
      clusters[clusters.length - 1].push(sorted[i]);
    } else {
      clusters.push([sorted[i]]);
    }
  }

  // wrap-around merge
  if (clusters.length > 1) {
    const first = clusters[0][0];
    const last = clusters[clusters.length - 1].at(-1)!;
    if (first + 360 - last <= thresh) {
      const merged = [...clusters.pop()!, ...clusters[0].map((b) => b + 360)];
      clusters[0] = merged;
    }
  }

  return clusters
    .map((c) => Math.round(c.reduce((s, b) => s + b, 0) / c.length) % 360)
    .sort((a, b) => a - b);
}

async function fetchBearings(lat: number, lon: number): Promise<number[]> {
  const query = `[out:json][timeout:15];
way(around:100,${lat},${lon})["highway"~"^(trunk|primary|secondary|tertiary|unclassified|residential|trunk_link|primary_link|secondary_link|tertiary_link)$"];
out geom;`;

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 14000);
  try {
    const resp = await fetch(OVERPASS_URL, {
      method: "POST",
      body: query,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
      signal: controller.signal,
    });
    if (!resp.ok) throw new Error(`overpass ${resp.status}`);
    const data = (await resp.json()) as OverpassResponse;

    const ways = data.elements.filter((e) => e.type === "way" && e.geometry?.length > 1);
    const allBearings: number[] = [];
    for (const way of ways) {
      allBearings.push(...extractBearings(way as OsmWay, lat, lon));
    }
    return clusterBearings(allBearings);
  } finally {
    clearTimeout(t);
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon))
    return res.status(400).json({ error: "invalid lat/lon" });
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180)
    return res.status(400).json({ error: "invalid coordinate range" });

  const key = `${lat.toFixed(5)},${lon.toFixed(5)}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    logDebug(`[intersection-geometry] cache hit key=${key}`);
    res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate=3600");
    return res.status(200).json({ bearings: cached.bearings, source: "cache" });
  }

  try {
    const bearings = await fetchBearings(lat, lon);
    logDebug(`[intersection-geometry] key=${key} bearings=${JSON.stringify(bearings)}`);
    cache.set(key, { ts: Date.now(), bearings });
    res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate=3600");
    return res.status(200).json({ bearings, source: "osm" });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    logError(`[intersection-geometry] error=${msg}`);
    return res.status(502).json({ error: "geometry fetch failed" });
  }
}
