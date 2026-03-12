import type { NextApiRequest, NextApiResponse } from "next";
import { logInfo, logWarn } from "@/lib/logger";

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

type IpApiComResponse = {
  status?: string;
  lat?: number;
  lon?: number;
  city?: string;
  regionName?: string;
  country?: string;
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
  {
    name: "ip-api",
    url: "http://ip-api.com/json/?fields=status,lat,lon,city,regionName,country",
    parse: (data: unknown): LocationPayload | null => {
      const v = data as IpApiComResponse;
      if (v.status !== "success") return null;
      const lat = Number(v.lat);
      const lon = Number(v.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
      return {
        lat,
        lon,
        label: [v.city, v.regionName, v.country].filter(Boolean).join(", "),
      };
    },
  },
];

const TIMEOUT_MS = 5000;

async function tryProvider(provider: typeof PROVIDERS[number]): Promise<LocationPayload> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const resp = await fetch(provider.url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!resp.ok) throw new Error(`non-ok status=${resp.status}`);
    const text = await resp.text();
    let json: unknown;
    try { json = JSON.parse(text); } catch { throw new Error("non-json"); }
    const payload = provider.parse(json);
    if (!payload) throw new Error("invalid payload");
    logInfo(`[ip-location] provider=${provider.name} ok lat=${payload.lat}`);
    return payload;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    logWarn(`[ip-location] provider=${provider.name} failed=${msg}`);
    throw e;
  } finally {
    clearTimeout(t);
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // 모든 provider 병렬 시도 — 가장 먼저 성공한 것 반환
    const payload = await Promise.any(PROVIDERS.map((p) => tryProvider(p)));
    return res.status(200).json(payload);
  } catch (err) {
    // AggregateError: 모든 provider 실패
    const errors: unknown[] = err instanceof AggregateError ? err.errors : [err];
    const allTimeout = errors.every(
      (e) => e instanceof Error && e.name === "AbortError"
    );
    if (allTimeout) {
      return res.status(504).json({ error: "ip-location upstream timed out" });
    }
    return res.status(502).json({ error: "ip-location upstream failed" });
  }
}
