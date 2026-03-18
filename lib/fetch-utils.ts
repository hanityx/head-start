import { logDebug } from "@/lib/logger";

export type RawRateLimitInfo = {
  limit: string | null;
  remaining: string | null;
  reset: string | null;
};

export type FetchJsonResult = {
  ok: boolean;
  status: number;
  text: string;
  json: unknown | null;
  rateLimit: RawRateLimitInfo;
};

function pickRawRateLimitInfo(headers: unknown): RawRateLimitInfo {
  const get = (name: string) => {
    if (!headers || typeof headers !== "object") return null;
    if (
      !("get" in headers) ||
      typeof (headers as { get?: unknown }).get !== "function"
    ) {
      return null;
    }
    try {
      const value = (headers as { get: (key: string) => string | null }).get(
        name,
      );
      return value ?? null;
    } catch {
      return null;
    }
  };

  return {
    limit: get("x-ratelimit-limit"),
    remaining: get("x-ratelimit-remaining"),
    reset: get("x-ratelimit-reset"),
  };
}

function maskSensitiveUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    const maskedParams = ["apikey", "apiKey", "token", "key"];
    for (const param of maskedParams) {
      if (parsed.searchParams.has(param)) {
        parsed.searchParams.set(param, "***");
      }
    }
    return parsed.toString();
  } catch {
    return rawUrl;
  }
}

export async function fetchJsonWithTimeout(
  url: string,
  timeoutMs: number,
): Promise<FetchJsonResult> {
  const maskedUrl = maskSensitiveUrl(url);
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    logDebug(`[fetch] ${maskedUrl}`);
    const res = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "spat-nextjs/1.0",
      },
    });
    const text = await res.text();
    logDebug(`[upstream] status=${res.status} bodyLength=${text.length}`);
    if (!res.ok || !text.trim().startsWith("{")) {
      logDebug(`[upstream] body=${text.slice(0, 200)}`);
    }
    let json = null;
    try {
      json = JSON.parse(text);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      logDebug(`[upstream json parse error] ${msg}`);
    }
    return {
      ok: res.ok,
      status: res.status,
      text,
      json,
      rateLimit: pickRawRateLimitInfo((res as { headers?: unknown }).headers),
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    logDebug(`[fetch error] ${msg}`);
    throw e;
  } finally {
    clearTimeout(t);
  }
}

export function buildUpstreamUrl(
  base: string,
  {
    apiKey,
    itstId,
    type = "json",
    pageNo = 1,
    numOfRows = 10,
  }: {
    apiKey: string;
    itstId?: string;
    type?: string;
    pageNo?: number;
    numOfRows?: number;
  },
) {
  const url = new URL(base);
  url.searchParams.set("type", type);
  url.searchParams.set("pageNo", String(pageNo));
  url.searchParams.set("numOfRows", String(numOfRows));
  if (itstId) url.searchParams.set("itstId", itstId);
  url.searchParams.set("apikey", apiKey);
  return url.toString();
}

export function findFirstArrayPayload(root: unknown): unknown[] | null {
  if (Array.isArray(root)) return root;
  if (!root || typeof root !== "object") return null;

  const commonKeys = [
    "data",
    "list",
    "items",
    "item",
    "result",
    "results",
    "body",
    "response",
  ];
  for (const k of commonKeys) {
    const value = (root as Record<string, unknown>)[k];
    if (Array.isArray(value)) return value;
  }

  const queue: unknown[] = [root];
  const seen = new Set<object>();
  while (queue.length) {
    const cur = queue.shift();
    if (!cur || typeof cur !== "object") continue;
    if (seen.has(cur)) continue;
    seen.add(cur);

    for (const v of Object.values(cur as Record<string, unknown>)) {
      if (Array.isArray(v)) return v;
      if (v && typeof v === "object") queue.push(v);
    }
  }
  return null;
}
