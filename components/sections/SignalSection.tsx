import { useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfidenceBadge } from "@/components/ConfidenceBadge";
import {
  SignalCountdownCard,
  type SignalGuide,
} from "@/components/SignalCountdownCard";
import { useSpat } from "@/hooks/useSpat";
import type { SpatItem } from "@/lib/types";
import type { LucideIcon } from "lucide-react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Car,
  CircleHelp,
  CornerUpLeft,
  CornerUpRight,
  Footprints,
  Loader2,
  RotateCcw,
} from "lucide-react";
import itstMetaJson from "@/data/itst-meta.json";

const STATUS_MAP: Record<string, { text: string; color: string }> = {
  "stop-And-Remain": {
    text: "🔴 정지",
    color: "red",
  },
  "protected-Movement-Allowed": {
    text: "🟢 진행",
    color: "green",
  },
  "permissive-Movement-Allowed": {
    text: "🟡 주의 진행",
    color: "yellow",
  },
  "protected-clearance": {
    text: "🟡 정리 시간",
    color: "yellow",
  },
  "permissive-clearance": {
    text: "🟡 주의 정리",
    color: "yellow",
  },
  "caution-Conflicting-Traffic": {
    text: "⚠️ 충돌 주의",
    color: "yellow",
  },
  unavailable: {
    text: "사용 불가",
    color: "gray",
  },
  dark: {
    text: "소등",
    color: "gray",
  },
};

const translateStatus = (raw: string | null) => {
  if (!raw) return null;
  return STATUS_MAP[raw] || { text: raw, color: "blue" };
};

const fmtSec = (sec: number | null) => {
  if (sec === null || sec === undefined) return "-";
  if (!Number.isFinite(sec)) return "-";
  if (sec >= 600) return "10분+";
  if (sec >= 60) {
    const min = Math.floor(sec / 60);
    const rem = Math.round(sec % 60);
    return `${min}분 ${rem}초`;
  }
  return sec.toFixed(1) + "초";
};

const describeRemain = (status: string | null, sec: number | null) => {
  const t = fmtSec(sec);
  if (t === "-") return "-";
  if (status === "stop-And-Remain") return `다음 진행까지 ${t}`;
  if (
    status === "protected-Movement-Allowed" ||
    status === "permissive-Movement-Allowed" ||
    status === "protected-clearance" ||
    status === "permissive-clearance" ||
    status === "caution-Conflicting-Traffic"
  ) {
    return `현재 진행 종료까지 ${t}`;
  }
  return `남은 ${t}`;
};

const TIMEOUT_SEC_DEFAULT = 25;
const TIMEOUT_SEC_MIN = 0;
const TIMEOUT_SEC_MAX = 60;

const INTERVAL_SEC_DEFAULT = 3;
const INTERVAL_SEC_MIN = 0;
const INTERVAL_SEC_MAX = 30;

const clampInt = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Math.round(value)));

const sanitizeDigits = (raw: string) => raw.replace(/\D/g, "");

const finalizeSeconds = (
  raw: string,
  min: number,
  max: number,
  fallback: number,
) => {
  const n = Number(raw);
  if (!Number.isFinite(n)) return String(fallback);
  return String(clampInt(n, min, max));
};

const getDirectionInfo = (title: string) => {
  if (title.includes("동측") || title.includes("동축"))
    return { label: "동측", icon: ArrowRight as LucideIcon };
  if (title.includes("서측") || title.includes("서축"))
    return { label: "서측", icon: ArrowLeft as LucideIcon };
  if (title.includes("남측") || title.includes("남축"))
    return { label: "남측", icon: ArrowDown as LucideIcon };
  if (title.includes("북측") || title.includes("북축"))
    return { label: "북측", icon: ArrowUp as LucideIcon };
  return null;
};

const explainSignal = (item: SpatItem): SignalGuide => {
  const title = String(item.title || "");
  const direction = getDirectionInfo(title);

  if (title.includes("보행") || item.kind === "보행") {
    return {
      icon: Footprints,
      label: "보행",
      directionLabel: direction?.label,
      directionIcon: direction?.icon,
    };
  }

  if (title.includes("직진"))
    return {
      icon: ArrowUp,
      label: "직진",
      directionLabel: direction?.label,
      directionIcon: direction?.icon,
    };
  if (title.includes("좌회전"))
    return {
      icon: CornerUpLeft,
      label: "좌회전",
      directionLabel: direction?.label,
      directionIcon: direction?.icon,
    };
  if (title.includes("우회전"))
    return {
      icon: CornerUpRight,
      label: "우회전",
      directionLabel: direction?.label,
      directionIcon: direction?.icon,
    };
  if (title.includes("유턴"))
    return {
      icon: RotateCcw,
      label: "유턴",
      directionLabel: direction?.label,
      directionIcon: direction?.icon,
    };

  if (item.kind === "차량")
    return {
      icon: Car,
      label: "차량",
      directionLabel: direction?.label,
      directionIcon: direction?.icon,
    };
  return { icon: CircleHelp, label: "기타" };
};

const ITST_NAME_BY_ID = new Map<string, string | null>(
  (itstMetaJson as Array<{ itstId?: string | number; itstNm?: string | null }>)
    .filter((row) => row && row.itstId !== undefined && row.itstId !== null)
    .map((row) => [String(row.itstId), row.itstNm ?? null]),
);

const DEV_PHASE_ALLOWLIST_BY_ITST: Record<string, Set<string>> = {
  "1560": new Set(["etStsgStatNm", "wtStsgStatNm"]),
};
const DEV_PHASE_LOCK_ENABLED = process.env.NEXT_PUBLIC_DEV_PHASE_LOCK === "1";

export function SignalSection({
  itstId,
  onItstIdChange,
  defaultItstId,
  externalFetchTrigger = 0,
}: {
  itstId: string;
  onItstIdChange: (value: string) => void;
  defaultItstId: string;
  externalFetchTrigger?: number;
}) {
  const [timeoutSec, setTimeoutSec] = useState(String(TIMEOUT_SEC_DEFAULT));
  const [intervalSec, setIntervalSec] = useState(String(INTERVAL_SEC_DEFAULT));
  const [isAuto, setIsAuto] = useState(false);
  const autoTimerRef = useRef<NodeJS.Timeout | null>(null);
  const handledExternalFetchRef = useRef(0);

  const timeoutMs = String(
    clampInt(
      Number(timeoutSec || TIMEOUT_SEC_DEFAULT),
      TIMEOUT_SEC_MIN,
      TIMEOUT_SEC_MAX,
    ) * 1000,
  );
  const intervalMs =
    clampInt(
      Number(intervalSec || INTERVAL_SEC_DEFAULT),
      INTERVAL_SEC_MIN,
      INTERVAL_SEC_MAX,
    ) * 1000;

  const { spatData, error, isLoading, fetchSpat } = useSpat({
    itstId,
    timeoutMs,
  });
  const confidenceLevel =
    spatData == null || spatData.ageSec == null
      ? "stale"
      : spatData.ageSec <= 2
        ? "high"
        : spatData.ageSec <= 5
          ? "medium"
          : spatData.ageSec <= 10
            ? "low"
            : "stale";

  useEffect(() => {
    if (!isAuto) {
      if (autoTimerRef.current) {
        clearInterval(autoTimerRef.current);
        autoTimerRef.current = null;
      }
      return;
    }

    if (intervalMs <= 0) {
      fetchSpat();
      if (autoTimerRef.current) {
        clearInterval(autoTimerRef.current);
        autoTimerRef.current = null;
      }
      return;
    }

    const ms = Math.max(700, intervalMs);
    fetchSpat();
    autoTimerRef.current = setInterval(fetchSpat, ms);

    return () => {
      if (autoTimerRef.current) {
        clearInterval(autoTimerRef.current);
        autoTimerRef.current = null;
      }
    };
  }, [fetchSpat, intervalMs, isAuto]);

  useEffect(() => {
    if (externalFetchTrigger <= 0) return;
    if (externalFetchTrigger === handledExternalFetchRef.current) return;
    handledExternalFetchRef.current = externalFetchTrigger;
    if (!itstId.trim()) return;
    fetchSpat();
  }, [externalFetchTrigger, fetchSpat, itstId]);

  const inlineItstNm = useMemo(() => {
    const trimmed = itstId.trim();
    if (!trimmed || !/^\d+$/.test(trimmed)) return null;
    if (spatData && spatData.itstId === trimmed && spatData.itstNm) return spatData.itstNm;
    return ITST_NAME_BY_ID.get(trimmed) ?? null;
  }, [itstId, spatData]);

  const staleBlocked = Boolean(spatData?.isStale);
  const filteredItems = useMemo(() => {
    const items = spatData?.items ?? [];
    if (!DEV_PHASE_LOCK_ENABLED) return items;
    const allow = DEV_PHASE_ALLOWLIST_BY_ITST[itstId.trim()];
    if (!allow) return items;
    return items.filter((it) => !!it.phaseKey && allow.has(String(it.phaseKey)));
  }, [itstId, spatData]);

  const renderSignalList = ({
    title,
    description,
    showRefresh,
  }: {
    title: string;
    description: string;
    showRefresh?: boolean;
  }) => (
    <Card className="border border-border/70">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-semibold">{title}</CardTitle>
          {showRefresh ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchSpat}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  갱신 중
                </>
              ) : (
                "새로고침"
              )}
            </Button>
          ) : null}
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({
              length: filteredItems.length > 0 ? filteredItems.length : 4,
            }).map((_, idx) => (
              <Card
                key={idx}
                className="animate-in fade-in duration-300 border border-border/60"
                style={{ animationDelay: `${idx * 70}ms` }}
              >
                <CardContent className="space-y-3 pt-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-5 w-16" />
                    </div>
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-7 w-7 rounded-full" />
                      <Skeleton className="h-6 w-20 rounded-full" />
                      <Skeleton className="h-6 w-14 rounded-full" />
                    </div>
                    <Skeleton className="h-10 w-28" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : staleBlocked ? (
          <Alert variant="destructive">
            <AlertTitle>실시간성 미달로 표시 중단</AlertTitle>
            <AlertDescription>
              ageSec가 3초를 초과했습니다
              {spatData?.ageSec != null ? ` (${spatData.ageSec.toFixed(3)}초)` : ""}.
              오판 방지를 위해 신호 리스트를 숨깁니다.
            </AlertDescription>
          </Alert>
        ) : !spatData ? null : filteredItems.length === 0 ? (
          <div className="rounded-md border border-border/60 bg-muted/40 p-3 text-xs text-muted-foreground">
            표시할 신호 항목이 없습니다. (확정 phase 필터 또는 현재 수신 상태를 확인)
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {filteredItems.map((it: SpatItem) => {
              const sourceSec = it.sec;
              const sec =
                sourceSec === null || sourceSec === undefined
                  ? null
                  : Number(Math.max(0, sourceSec).toFixed(1));
              const statusInfo = translateStatus(it.status);
              const stableKey =
                it.key ??
                it.phaseKey ??
                `${it.dirCode ?? "dir"}-${it.movCode ?? "mov"}-${it.title}`;
              const tone =
                statusInfo?.color === "red"
                  ? "red"
                  : statusInfo?.color === "green"
                    ? "green"
                    : statusInfo?.color === "yellow"
                      ? "yellow"
                      : "gray";
              const emphasis =
                sec !== null && sec !== undefined && sec < 10
                  ? "critical"
                  : "normal";

              return (
                <SignalCountdownCard
                  key={`corr-${stableKey}`}
                  title={it.title}
                  guide={explainSignal(it)}
                  statusLabel={statusInfo?.text ?? "상태 확인"}
                  tone={tone}
                  timeLabel={describeRemain(it.status, sec)}
                  emphasis={emphasis}
                  size="md"
                  isLoading={isLoading}
                />
              );
            })}
          </div>
        )}

        {error && showRefresh ? (
          <Alert variant="destructive">
            <AlertTitle>데이터 수신 실패</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );

  return (
    <section className="space-y-4">
      <Card className="border border-border/70">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-sm font-semibold">신호 조회</CardTitle>
            {error ? (
              <Badge variant="destructive">오류/미수신</Badge>
            ) : isLoading && spatData ? (
              <Badge variant="secondary">업데이트 중</Badge>
            ) : isLoading ? (
              <Badge variant="secondary">로딩 중</Badge>
            ) : spatData ? (
              <ConfidenceBadge level={confidenceLevel} />
            ) : (
              <Badge variant="outline">대기</Badge>
            )}
          </div>
          <CardDescription className="text-sm">
            현재 켜진 신호가 끝날 때까지 남은 시간을 표시합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 rounded-md border border-border/50 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
            주변 교차로 찾기에서 선택하면 ID가 자동 입력됩니다.
          </div>

          <div className="grid gap-3 sm:grid-cols-[minmax(190px,1.15fr)_80px_80px_auto] sm:items-end">
            <label className="text-xs text-muted-foreground" data-tour="signal-input">
              교차로 ID
              {inlineItstNm ? ` · ${inlineItstNm}` : ""}
              <Input
                value={itstId}
                onChange={(e) => onItstIdChange(e.target.value)}
                className="mt-2"
                placeholder={`예: ${defaultItstId}`}
              />
            </label>
            <label className="text-xs text-muted-foreground">
              대기(초)
              <Input
                type="number"
                min={TIMEOUT_SEC_MIN}
                max={TIMEOUT_SEC_MAX}
                step={1}
                inputMode="numeric"
                pattern="[0-9]*"
                value={timeoutSec}
                onChange={(e) => setTimeoutSec(sanitizeDigits(e.target.value))}
                onBlur={() =>
                  setTimeoutSec(
                    finalizeSeconds(
                      timeoutSec,
                      TIMEOUT_SEC_MIN,
                      TIMEOUT_SEC_MAX,
                      TIMEOUT_SEC_DEFAULT,
                    ),
                  )
                }
                className="mt-2"
              />
            </label>
            <label className="text-xs text-muted-foreground">
              자동(초)
              <Input
                type="number"
                min={INTERVAL_SEC_MIN}
                max={INTERVAL_SEC_MAX}
                step={1}
                inputMode="numeric"
                pattern="[0-9]*"
                value={intervalSec}
                onChange={(e) => setIntervalSec(sanitizeDigits(e.target.value))}
                onBlur={() =>
                  setIntervalSec(
                    finalizeSeconds(
                      intervalSec,
                      INTERVAL_SEC_MIN,
                      INTERVAL_SEC_MAX,
                      INTERVAL_SEC_DEFAULT,
                    ),
                  )
                }
                className="mt-2"
              />
            </label>
            <div className="flex w-full flex-nowrap gap-2 overflow-x-auto pb-1 sm:w-auto sm:overflow-visible sm:pb-0">
              <Button
                size="sm"
                className="shrink-0"
                data-tour="signal-fetch"
                onClick={fetchSpat}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    조회중
                  </>
                ) : (
                  "조회"
                )}
              </Button>
              <Button
                size="sm"
                className="shrink-0"
                variant="outline"
                onClick={() => onItstIdChange(defaultItstId)}
              >
                초기화
              </Button>
              <Button
                size="sm"
                className="shrink-0"
                variant="outline"
                data-tour="signal-auto"
                onClick={() => setIsAuto((prev) => !prev)}
              >
                {isAuto ? "자동 갱신 끄기" : "자동 갱신 켜기"}
              </Button>
            </div>
          </div>
          <div className="rounded-md border border-border/50 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            `대기(초)`/`자동(초)`은 0 설정 가능. 0일 때 자동 갱신은 반복 없이 1회 조회만 수행됩니다.
          </div>

          {isLoading && !spatData ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {Array.from({ length: 5 }).map((_, idx) => (
                <Skeleton key={idx} className="h-4 w-44" />
              ))}
            </div>
          ) : (
            spatData && (
              <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                <span>
                  방금 조회한 시간: <b>{spatData.fetchedAtKst ?? "-"}</b>
                </span>
                <span>
                  교차로: <b>{spatData.itstNm ?? "-"}</b>
                </span>
                <span>
                  신호가 바뀐 시간: <b>{spatData.trsmKst ?? "-"}</b>
                </span>
                <span>
                  신호 반영까지 걸린 시간: <b>{spatData.ageSec ?? "-"}초</b>
                </span>
                {spatData.isStale ? (
                  <span className="sm:col-span-2 text-destructive">
                    ageSec &gt; 3초로 판단되어 신호 리스트 표시를 차단합니다.
                  </span>
                ) : null}
              </div>
            )
          )}
        </CardContent>
      </Card>

      {renderSignalList({
        title: "신호 리스트",
        description:
          "현재 시각 기준으로 ageSec를 반영해 남은 시간을 보정한 값입니다.",
        showRefresh: true,
      })}
    </section>
  );
}
