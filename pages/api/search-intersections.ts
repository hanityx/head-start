import type { NextApiRequest, NextApiResponse } from "next";
import { loadItstMeta } from "@/lib/itstMeta";
import type { NearbyItem } from "@/lib/types";

const MAX_RESULTS = 20;

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const q = String(req.query.q ?? "").trim().toLowerCase();
  if (q.length < 1) return res.status(400).json({ error: "query too short" });

  const itstMetaById = loadItstMeta();
  if (!itstMetaById || itstMetaById.size === 0) {
    return res.status(503).json({ error: "data source unavailable" });
  }

  const results: NearbyItem[] = [];
  for (const [itstId, m] of itstMetaById.entries()) {
    const name = (m.itstNm ?? "").toLowerCase();
    if (name.includes(q) || itstId.includes(q)) {
      results.push({
        itstId,
        itstNm: m.itstNm ?? "-",
        lat: m.lat ?? 0,
        lon: m.lon ?? 0,
        distanceM: 0,
      });
      if (results.length >= MAX_RESULTS) break;
    }
  }

  return res.status(200).json({ items: results });
}
