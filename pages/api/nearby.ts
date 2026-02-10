import { NextApiRequest, NextApiResponse } from "next";
import { haversineMeters } from "@/lib/utils";
import { loadItstMeta } from "@/lib/itstMeta";
import type { NearbyItem } from "@/lib/types";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const lat = Number(req.query.lat);
    const lon = Number(req.query.lon);
    const k = Math.max(1, Math.min(20, Number(req.query.k || 5)));
    const itstMetaById = loadItstMeta();

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return res.status(400).json({ error: "invalid lat/lon" });
    }
    if (!itstMetaById || itstMetaById.size === 0) {
      return res.status(200).json({ items: [] });
    }

    const arr: NearbyItem[] = [];
    for (const [itstId, m] of itstMetaById.entries()) {
      const latVal = m.lat;
      const lonVal = m.lon;
      if (
        latVal === null ||
        lonVal === null ||
        !Number.isFinite(latVal) ||
        !Number.isFinite(lonVal)
      )
        continue;
      const d = haversineMeters(lat, lon, latVal, lonVal);
      arr.push({
        itstId,
        itstNm: m.itstNm ?? "-",
        lat: latVal,
        lon: lonVal,
        distanceM: d,
      });
    }
    arr.sort((a, b) => a.distanceM - b.distanceM);

    return res.status(200).json({ items: arr.slice(0, k) });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return res.status(500).json({ error: msg });
  }
}
