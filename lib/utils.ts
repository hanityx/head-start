import { logDebug } from "@/lib/logger";

export function nowKstString(withMs = false) {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const pad3 = (n: number) => String(n).padStart(3, "0");
  const base =
    `${kst.getUTCFullYear()}-${pad2(kst.getUTCMonth() + 1)}-${pad2(
      kst.getUTCDate(),
    )} ` +
    `${pad2(kst.getUTCHours())}:${pad2(kst.getUTCMinutes())}:${pad2(
      kst.getUTCSeconds(),
    )}`;
  return withMs ? `${base}.${pad3(kst.getUTCMilliseconds())}` : base;
}

export const DIR_NAME: Record<string, string> = {
  nt: "북측",
  et: "동측",
  st: "남측",
  wt: "서측",
  ne: "북동측",
  se: "남동측",
  sw: "남서측",
  nw: "북서측",
};

export const MOV_NAME: Record<string, string> = {
  PdsgRmdrCs: "보행",
  StsgRmdrCs: "직진",
  LtsgRmdrCs: "좌회전",
  UtsgRmdrCs: "유턴",
  BssgRmdrCs: "버스",
  BcsgRmdrCs: "자전거",
  PdsgStatNm: "보행",
  StsgStatNm: "직진",
  LtsgStatNm: "좌회전",
  UtsgStatNm: "유턴",
  BssgStatNm: "버스",
  BcsgStatNm: "자전거",
};

export type TimingItem = {
  title: string;
  kind: string;
  sec: number;
  secAtMsg: number;
  dirCode: string;
  movCode: string;
  key: string;
};

export type PhaseItem = {
  title: string;
  kind: string;
  status: string;
  dirCode: string;
  movCode: string;
  key: string;
};

export type MergedItem = {
  title: string;
  kind: string;
  sec: number | null;
  secAtMsg: number | null;
  status: string | null;
  dirCode: string;
  movCode: string;
  key: string | null;
  phaseKey: string | null;
};

export function parseTransmissionTimeMs(rec: unknown): number {
  const obj =
    rec && typeof rec === "object"
      ? (rec as Record<string, unknown>)
      : null;
  const tVal = obj?.trsmUtcTime;
  const t =
    typeof tVal === "number" || typeof tVal === "string"
      ? Number(tVal)
      : NaN;
  if (Number.isFinite(t) && t > 0) return t;

  const reg = obj?.regDt;
  if (typeof reg === "number" && Number.isFinite(reg)) return reg;
  if (typeof reg === "string") {
    const asNum = Number(reg);
    if (Number.isFinite(asNum) && asNum > 0) return asNum;
    const ms = Date.parse(reg);
    if (!Number.isNaN(ms)) return ms;
  }
  return 0;
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

export async function fetchJsonWithTimeout(url: string, timeoutMs: number) {
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
    return { ok: res.ok, status: res.status, text, json };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    logDebug(`[fetch error] ${msg}`);
    throw e;
  } finally {
    clearTimeout(t);
  }
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
  }
) {
  const url = new URL(base);
  url.searchParams.set("type", type);
  url.searchParams.set("pageNo", String(pageNo));
  url.searchParams.set("numOfRows", String(numOfRows));
  if (itstId) url.searchParams.set("itstId", itstId);
  url.searchParams.set("apikey", apiKey);
  return url.toString();
}

// raw -> seconds 변환: 문서 기준 1/10초 단위 => /10
export function timingRawToSeconds(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return n / 10;
}

export function extractTimingItems(
  latestRec: Record<string, unknown> | null,
  ageSec: number
): TimingItem[] {
  if (!latestRec || typeof latestRec !== "object") return [];
  const out: TimingItem[] = [];

  for (const [key, v] of Object.entries(latestRec)) {
    if (!key.endsWith("RmdrCs")) continue;
    if (v === null || v === undefined) continue;

    const dirCode = key.slice(0, 2);
    const movCode = key.slice(2);
    const dirName = DIR_NAME[dirCode] ?? dirCode;
    const movName = MOV_NAME[movCode] ?? movCode;

    const secAtMsg = timingRawToSeconds(v);
    if (secAtMsg === null) continue;

    const secNow = Math.max(0, secAtMsg - (ageSec ?? 0));

    out.push({
      title: `${dirName} ${movName}`,
      kind: movName,
      sec: Number(secNow.toFixed(1)),
      secAtMsg: Number(secAtMsg.toFixed(1)),
      dirCode,
      movCode,
      key,
    });
  }

  out.sort((a, b) => a.sec - b.sec);
  return out;
}

export function extractPhaseStatus(
  latestRec: Record<string, unknown> | null
): PhaseItem[] {
  if (!latestRec || typeof latestRec !== "object") return [];
  const out: PhaseItem[] = [];

  for (const [key, v] of Object.entries(latestRec)) {
    if (!key.endsWith("StatNm")) continue;
    if (v === null || v === undefined) continue;

    const dirCode = key.slice(0, 2);
    const movCode = key.slice(2);
    const dirName = DIR_NAME[dirCode] ?? dirCode;
    const movName = MOV_NAME[movCode] ?? movCode;

    out.push({
      title: `${dirName} ${movName}`,
      kind: movName,
      status: String(v),
      dirCode,
      movCode,
      key,
    });
  }

  out.sort((a, b) => a.title.localeCompare(b.title));
  return out;
}

export function mergeItems(
  timingItems: TimingItem[],
  phaseItems: PhaseItem[]
): MergedItem[] {
  const by = new Map<string, MergedItem>();

  for (const t of timingItems) {
    const baseMov = t.movCode.replace("RmdrCs", "");
    const k = `${t.dirCode}:${baseMov}`;
    by.set(k, { ...t, status: null, phaseKey: null });
  }

  for (const p of phaseItems) {
    const baseMov = p.movCode.replace("StatNm", "");
    const k = `${p.dirCode}:${baseMov}`;
    const existing = by.get(k);
    if (existing) {
      existing.status = p.status;
      existing.phaseKey = p.key;
    } else {
      by.set(k, {
        title: p.title,
        kind: p.kind,
        sec: null,
        secAtMsg: null,
        status: p.status,
        dirCode: p.dirCode,
        movCode: p.movCode,
        key: null,
        phaseKey: p.key,
      });
    }
  }

  const arr = Array.from(by.values());
  const isPed = (x: MergedItem) => x.kind === "보행";

  arr.sort((a, b) => {
    if (isPed(a) !== isPed(b)) return isPed(a) ? -1 : 1;
    const aHas = a.sec !== null && a.sec !== undefined;
    const bHas = b.sec !== null && b.sec !== undefined;
    if (aHas !== bHas) return aHas ? -1 : 1;
    if (aHas && bHas) return (a.sec ?? 0) - (b.sec ?? 0);
    return a.title.localeCompare(b.title);
  });

  return arr;
}

export function toKstMsString(epochMs: number): string | null {
  if (!epochMs) return null;
  const kst = new Date(epochMs + 9 * 60 * 60 * 1000);
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const pad3 = (n: number) => String(n).padStart(3, "0");
  return (
    `${kst.getUTCFullYear()}-${pad2(kst.getUTCMonth() + 1)}-${pad2(
      kst.getUTCDate(),
    )} ` +
    `${pad2(kst.getUTCHours())}:${pad2(kst.getUTCMinutes())}:${pad2(
      kst.getUTCSeconds(),
    )}.${pad3(kst.getUTCMilliseconds())}`
  );
}

export function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
