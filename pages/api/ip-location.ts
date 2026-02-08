import type { NextApiRequest, NextApiResponse } from "next";

type IpApiResponse = {
  latitude?: number;
  longitude?: number;
  city?: string;
  region?: string;
  country_name?: string;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 4000);
    try {
      const resp = await fetch("https://ipapi.co/json/", {
        signal: controller.signal,
        headers: {
          Accept: "application/json",
        },
      });

      if (!resp.ok) {
        return res.status(502).json({ error: "ip-location upstream failed" });
      }

      const data = (await resp.json()) as IpApiResponse;
      const lat = Number(data.latitude);
      const lon = Number(data.longitude);

      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        return res.status(502).json({ error: "ip-location invalid response" });
      }

      return res.status(200).json({
        lat,
        lon,
        label: [data.city, data.region, data.country_name].filter(Boolean).join(", "),
      });
    } finally {
      clearTimeout(t);
    }
  } catch (e: unknown) {
    if (e instanceof Error && e.name === "AbortError") {
      return res.status(504).json({ error: "ip-location timeout" });
    }
    const msg = e instanceof Error ? e.message : String(e);
    return res.status(500).json({ error: msg });
  }
}
