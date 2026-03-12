import type { NextApiRequest, NextApiResponse } from "next";
import { loadItstMeta } from "@/lib/itstMeta";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const { itstId } = req.query;
  if (!itstId || typeof itstId !== "string" || !/^\d+$/.test(itstId)) {
    return res.status(400).json({ error: "itstId required" });
  }
  const meta = loadItstMeta().get(itstId);
  if (!meta) {
    return res.status(404).json({ error: "not found" });
  }
  return res.status(200).json(meta);
}
