import type { NextApiRequest, NextApiResponse } from "next";
import { logError, logInfo, logWarn } from "@/lib/logger";

type IpApiResponse = {
  latitude?: number;
  longitude?: number;
  city?: string;
  region?: string;
  country_name?: string;
};

type IpWhoIsResponse = {
  success?: boolean;
  latitude?: number;
  longitude?: number;
  city?: string;
  region?: string;
  country?: string;
};

type LocationPayload = {
  lat: number;
  lon: number;
  label: string;
};

const PROVIDERS = [
  {
    name: "ipapi",
    url: "https://ipapi.co/json/",
    parse: (data: unknown): LocationPayload | null => {
      const v = data as IpApiResponse;
      const lat = Number(v.latitude);
      const lon = Number(v.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
      return {
        lat,
        lon,
        label: [v.city, v.region, v.country_name].filter(Boolean).join(", "),
      };
    },
  },
  {
    name: "ipwhois",
    url: "https://ipwho.is/",
    parse: (data: unknown): LocationPayload | null => {
      const v = data as IpWhoIsResponse;
      if (v.success === false) return null;
      const lat = Number(v.latitude);
      const lon = Number(v.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
      return {
        lat,
        lon,
        label: [v.city, v.region, v.country].filter(Boolean).join(", "),
      };
    },
  },
] as const;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    let sawTimeout = false;
    for (const provider of PROVIDERS) {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 4000);
      try {
        logInfo(`[ip-location] try provider=${provider.name}`);
        const resp = await fetch(provider.url, {
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });

        const text = await resp.text();
        logInfo(
          `[ip-location] provider=${provider.name} status=${resp.status} bodyLength=${text.length}`
        );
        if (!resp.ok) {
          logWarn(
            `[ip-location] provider=${provider.name} non-ok status=${resp.status} body=${text.slice(
              0,
              180
            )}`
          );
          continue;
        }

        let json: unknown = null;
        try {
          json = JSON.parse(text);
        } catch {
          logWarn(
            `[ip-location] provider=${provider.name} non-json body=${text.slice(0, 180)}`
          );
          continue;
        }

        const payload = provider.parse(json);
        if (!payload) {
          logWarn(
            `[ip-location] provider=${provider.name} invalid payload sample=${JSON.stringify(
              json
            ).slice(0, 180)}`
          );
          continue;
        }

        return res.status(200).json(payload);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        const isAbort = e instanceof Error && e.name === "AbortError";
        if (isAbort) sawTimeout = true;
        logWarn(
          `[ip-location] provider=${provider.name} ${
            isAbort ? "timeout" : "error"
          }=${msg}`
        );
      } finally {
        clearTimeout(t);
      }
    }
    if (sawTimeout) {
      return res.status(504).json({ error: "ip-location timeout" });
    }
    return res.status(502).json({ error: "ip-location upstream failed" });
  } catch (e: unknown) {
    if (e instanceof Error && e.name === "AbortError") {
      return res.status(504).json({ error: "ip-location timeout" });
    }
    const msg = e instanceof Error ? e.message : String(e);
    logError(`[ip-location] error=${msg}`);
    return res.status(500).json({ error: msg });
  }
}
