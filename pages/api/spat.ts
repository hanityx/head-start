import { NextApiRequest, NextApiResponse } from "next";
import {
  buildUpstreamUrl,
  extractPhaseStatus,
  extractTimingItems,
  type FetchJsonResult,
  fetchJsonWithTimeout,
  findFirstArrayPayload,
  mergeItems,
  nowKstString,
  parseTransmissionTimeMs,
  toKstMsString,
} from "@/lib/utils";
import { loadItstMeta } from "@/lib/itstMeta";
import { logDebug, logError, logInfo, logWarn } from "@/lib/logger";
import type { SpatResponse } from "@/lib/types";

const ENDPOINT_TIMING =
  "https://t-data.seoul.go.kr/apig/apiman-gateway/tapi/v2xSignalPhaseTimingInformation/1.0";
const ENDPOINT_PHASE =
  "https://t-data.seoul.go.kr/apig/apiman-gateway/tapi/v2xSignalPhaseInformation/1.0";

const toNumberOrNull = (value: string | null) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const formatQuota = (q: { limit: string | null; remaining: string | null; reset: string | null }) =>
  `limit=${q.limit ?? "-"} remaining=${q.remaining ?? "-"} resetSec=${q.reset ?? "-"}`;

type KeySource = "primary" | "sub";

const isRateLimited = (result: FetchJsonResult) => {
  if (result.status === 429) return true;
  const body = result.json;
  if (!body || typeof body !== "object" || Array.isArray(body)) return false;
  const payload = body as Record<string, unknown>;
  const responseCode = Number(payload.responseCode ?? payload.code ?? payload.status);
  const failureCode = Number(payload.failureCode);
  const message = String(payload.message ?? "").toLowerCase();
  return responseCode === 429 || failureCode === 10005 || message.includes("rate limit");
};

const readApiKeys = (): Array<{ source: KeySource; value: string }> => {
  const primary = String(process.env.TDATA_API_KEY || "").trim();
  const sub = String(process.env.TDATA_API_KEY_SUB || "").trim();
  const out: Array<{ source: KeySource; value: string }> = [];
  const seen = new Set<string>();
  for (const candidate of [
    { source: "primary" as const, value: primary },
    { source: "sub" as const, value: sub },
  ]) {
    if (!candidate.value || seen.has(candidate.value)) continue;
    seen.add(candidate.value);
    out.push(candidate);
  }
  return out;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const itstId = String(req.query.itstId || "").trim();
    if (!itstId) return res.status(400).json({ error: "missing itstId" });

    const apiKeys = readApiKeys();
    if (!apiKeys.length) {
      return res.status(400).json({
        error: "missing apiKey (set TDATA_API_KEY and optional TDATA_API_KEY_SUB env)",
      });
    }

    const timeoutMsRaw = Number(req.query.timeoutMs);
    const timeoutMs = Number.isFinite(timeoutMsRaw)
      ? Math.max(2000, timeoutMsRaw)
      : 25000;
    logInfo(`[spat] req itstId=${itstId} timeoutMs=${timeoutMs}`);

    let timing: FetchJsonResult | null = null;
    let phase: FetchJsonResult | null = null;
    let keySource: KeySource = apiKeys[0].source;

    for (let i = 0; i < apiKeys.length; i += 1) {
      const { source, value: apiKey } = apiKeys[i];
      const urlTiming = buildUpstreamUrl(ENDPOINT_TIMING, {
        apiKey,
        itstId,
        type: "json",
        pageNo: 1,
        numOfRows: 10,
      });
      const urlPhase = buildUpstreamUrl(ENDPOINT_PHASE, {
        apiKey,
        itstId,
        type: "json",
        pageNo: 1,
        numOfRows: 10,
      });

      logDebug(`[timing URL][${source}] ${urlTiming.replace(apiKey, "***")}`);
      logDebug(`[phase URL][${source}] ${urlPhase.replace(apiKey, "***")}`);

      const [timingRes, phaseRes] = await Promise.all([
        fetchJsonWithTimeout(urlTiming, timeoutMs),
        fetchJsonWithTimeout(urlPhase, timeoutMs),
      ]);

      logInfo(
        `[spat] upstream itstId=${itstId} keySource=${source} timingStatus=${timingRes.status} phaseStatus=${phaseRes.status} ` +
          `timingQuota(${formatQuota(timingRes.rateLimit)}) phaseQuota(${formatQuota(phaseRes.rateLimit)})`
      );

      const limited = isRateLimited(timingRes) || isRateLimited(phaseRes);
      const hasFallback = i < apiKeys.length - 1;
      if (limited && hasFallback) {
        logWarn(
          `[spat] keySource=${source} rate-limited, retrying with fallback key`
        );
        continue;
      }

      timing = timingRes;
      phase = phaseRes;
      keySource = source;
      break;
    }

    if (!timing || !phase) {
      throw new Error("failed to fetch upstream responses");
    }

    if (isRateLimited(timing) || isRateLimited(phase)) {
      return res.status(429).json({
        error: "upstream rate limit exceeded (all configured API keys exhausted)",
        upstream: {
          keySource,
          timing: { status: timing.status, rateLimit: timing.rateLimit },
          phase: { status: phase.status, rateLimit: phase.rateLimit },
        },
      });
    }

    if (!timing.json) {
      logError(
        `[spat] non-json timing itstId=${itstId} status=${timing.status} body=${String(
          timing.text || ""
        ).slice(0, 300)}`
      );
      return res.status(502).json({
        error: "timing upstream non-json",
        upstreamStatus: timing.status,
        bodyPreview: String(timing.text || "").slice(0, 500),
      });
    }
    if (!phase.json) {
      logError(
        `[spat] non-json phase itstId=${itstId} status=${phase.status} body=${String(
          phase.text || ""
        ).slice(0, 300)}`
      );
      return res.status(502).json({
        error: "phase upstream non-json",
        upstreamStatus: phase.status,
        bodyPreview: String(phase.text || "").slice(0, 500),
      });
    }

    const timingRecords = findFirstArrayPayload(timing.json);
    const phaseRecords = findFirstArrayPayload(phase.json);

    if (!Array.isArray(timingRecords) || !Array.isArray(phaseRecords)) {
      logError(
        `[spat] unexpected shape itstId=${itstId} timingStatus=${timing.status} phaseStatus=${phase.status}`
      );
      return res.status(502).json({
        error: "unexpected upstream shape (array not found)",
        timingStatus: timing.status,
        phaseStatus: phase.status,
        timingSample: timing.json,
        phaseSample: phase.json,
      });
    }

    const pickLatest = (records: Array<Record<string, unknown>>) => {
      const candidates = records
        .filter((r) => String(r?.itstId ?? "") === itstId)
        .slice()
        .sort(
          (a, b) => parseTransmissionTimeMs(b) - parseTransmissionTimeMs(a)
        );
      return candidates[0] || null;
    };

    const latestTiming = pickLatest(
      timingRecords.filter(
        (r): r is Record<string, unknown> =>
          !!r && typeof r === "object" && !Array.isArray(r)
      )
    );
    const latestPhase = pickLatest(
      phaseRecords.filter(
        (r): r is Record<string, unknown> =>
          !!r && typeof r === "object" && !Array.isArray(r)
      )
    );

    logDebug(`[data] timing=${!!latestTiming} phase=${!!latestPhase}`);
    if (!latestTiming || !latestPhase) {
      logWarn(
        `[spat] missing latest record itstId=${itstId} latestTiming=${!!latestTiming} latestPhase=${!!latestPhase}`
      );
    }

    const trsmMs = Math.max(
      parseTransmissionTimeMs(latestTiming),
      parseTransmissionTimeMs(latestPhase)
    );
    const ageSecRaw = trsmMs ? (Date.now() - trsmMs) / 1000 : null;
    const ageSec =
      ageSecRaw === null ? null : Number(Math.max(0, ageSecRaw).toFixed(3));

    const isStale = ageSec !== null ? ageSec > 3.0 : true;

    const timingItems = extractTimingItems(latestTiming, ageSec ?? 0);
    const phaseItems = extractPhaseStatus(latestPhase);
    const items = mergeItems(timingItems, phaseItems);

    const itstMetaById = loadItstMeta();
    const meta = itstMetaById.get(itstId) || {
      itstNm: null,
      lat: null,
      lon: null,
    };
    const trsmKst = trsmMs ? toKstMsString(trsmMs) : null;
    const timingQuota = {
      limit: toNumberOrNull(timing.rateLimit.limit),
      remaining: toNumberOrNull(timing.rateLimit.remaining),
      resetSec: toNumberOrNull(timing.rateLimit.reset),
    };
    const phaseQuota = {
      limit: toNumberOrNull(phase.rateLimit.limit),
      remaining: toNumberOrNull(phase.rateLimit.remaining),
      resetSec: toNumberOrNull(phase.rateLimit.reset),
    };
    const quota = {
      limit: timingQuota.limit ?? phaseQuota.limit,
      remaining: timingQuota.remaining ?? phaseQuota.remaining,
      resetSec: timingQuota.resetSec ?? phaseQuota.resetSec,
    };

    const payload: SpatResponse = {
      itstId,
      itstNm: meta.itstNm,
      lat: meta.lat,
      lon: meta.lon,

      trsmKst,
      ageSec,
      isStale,

      items,

      fetchedAtKst: nowKstString(),
      upstream: {
        keySource,
        timing: { status: timing.status, rateLimit: timingQuota },
        phase: { status: phase.status, rateLimit: phaseQuota },
      },
      quota,
      note: "잔여시간(*RmdrCs)은 '현재 켜진 신호' 기준입니다. '다음 보행 시작까지 남은 시간'은 직접 제공되지 않으며, 관측 기반 추정이 필요합니다.",
    };

    logInfo(
      `[spat] ok itstId=${itstId} keySource=${keySource} items=${items.length} ageSec=${
        ageSec ?? "-"
      } quotaRemaining=${
        quota.remaining ?? "-"
      }`
    );
    res.status(200).json(payload);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    logError(`ERROR /api/spat ${msg}`);
    if (msg.includes("aborted") || msg.includes("AbortError")) {
      return res.status(504).json({ error: "upstream timeout", detail: msg });
    }
    return res.status(500).json({ error: msg });
  }
}
