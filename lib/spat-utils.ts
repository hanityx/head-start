import { logWarn } from "@/lib/logger";

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

// raw → seconds 변환: 문서 기준 1/10초 단위 => /10
export function timingRawToSeconds(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  const byDeci = n / 10;
  const MAX_REASONABLE_SEC = 600; // 10분 초과는 이상치로 간주
  if (byDeci <= MAX_REASONABLE_SEC) return byDeci;

  // 간헐적으로 단위가 다르게 들어올 가능성 대비 (centisecond fallback)
  const byCenti = n / 100;
  if (byCenti <= MAX_REASONABLE_SEC) {
    logWarn(
      `[timingRawToSeconds] fallback unit raw=${n} deci=${byDeci} centi=${byCenti}`,
    );
    return byCenti;
  }

  logWarn(`[timingRawToSeconds] drop outlier raw=${n} sec=${byDeci}`);
  return null;
}

export function extractTimingItems(
  latestRec: Record<string, unknown> | null,
  ageSec: number,
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
  latestRec: Record<string, unknown> | null,
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
  phaseItems: PhaseItem[],
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
