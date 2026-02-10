import { useEffect, useRef, useState } from "react";

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
  return sec.toFixed(1) + "초";
};

const TIMEOUT_SEC_DEFAULT = 25;
const TIMEOUT_SEC_MIN = 2;
const TIMEOUT_SEC_MAX = 60;

const INTERVAL_SEC_DEFAULT = 3;
const INTERVAL_SEC_MIN = 1;
const INTERVAL_SEC_MAX = 30;

const clampInt = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Math.round(value)));

const sanitizeDigits = (raw: string) => raw.replace(/\D/g, "");

const finalizeSeconds = (
  raw: string,
  min: number,
  max: number,
  fallback: number
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

  const timeoutMs = String(
    clampInt(
      Number(timeoutSec || TIMEOUT_SEC_DEFAULT),
      TIMEOUT_SEC_MIN,
      TIMEOUT_SEC_MAX
    ) * 1000
  );
  const intervalMs = clampInt(
    Number(intervalSec || INTERVAL_SEC_DEFAULT),
    INTERVAL_SEC_MIN,
    INTERVAL_SEC_MAX
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
    fetchSpat();
  }, [externalFetchTrigger, fetchSpat]);

  return (
    <section className="space-y-4">
      <Card className="border border-border/70">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base font-semibold">
              신호 조회
            </CardTitle>
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
          <div className="rounded-md border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
            <p>
              교차로 ID를 모르겠다면 오른쪽 <b>가까운 교차로 찾기</b>에서 선택하면
              자동으로 입력됩니다.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <label className="text-xs text-muted-foreground">
              교차로 ID (숫자)
              <Input
                value={itstId}
                onChange={(e) => onItstIdChange(e.target.value)}
                className="mt-2"
                placeholder={`예: ${defaultItstId}`}
              />
            </label>
            <label className="text-xs text-muted-foreground">
              응답 대기 시간(초)
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
                      TIMEOUT_SEC_DEFAULT
                    )
                  )
                }
                className="mt-2"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button onClick={fetchSpat} disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    조회 중
                  </>
                ) : (
                  "조회"
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => onItstIdChange(defaultItstId)}
              >
                기본값으로 초기화
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsAuto((prev) => !prev)}
              >
                {isAuto ? "자동 갱신 끄기" : "자동 갱신 켜기"}
              </Button>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-1 sm:items-end">
            <label className="text-xs text-muted-foreground">
              자동 새로고침(초)
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
                      INTERVAL_SEC_DEFAULT
                    )
                  )
                }
                className="mt-2"
              />
            </label>
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
              </div>
            )
          )}

        </CardContent>
      </Card>

      <Card className="border border-border/70">
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base font-semibold">
              신호 리스트
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={fetchSpat} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  갱신 중
                </>
              ) : (
                "새로고침"
              )}
            </Button>
          </div>
          <CardDescription>
            아이콘은 동작(보행/직진/좌회전), 옆 배지는 방향(동/서/남/북)입니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({
                length:
                  spatData?.items?.length && spatData.items.length > 0
                    ? spatData.items.length
                    : 4,
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
          ) : !spatData ? null : !spatData.items || spatData.items.length === 0 ? (
            <div className="rounded-md border border-border/60 bg-muted/40 p-3 text-xs text-muted-foreground">
              표시할 신호 항목이 없습니다. (해당 교차로가 V2X 제공
              대상인지, 또는 현재 시각에 수신이 있는지 확인)
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {spatData.items.map((it: SpatItem) => {
                const sec = it.sec;
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
                    key={stableKey}
                    title={it.title}
                    guide={explainSignal(it)}
                    statusLabel={statusInfo?.text ?? "상태 확인"}
                    tone={tone}
                    timeLabel={sec === null ? "-" : fmtSec(sec)}
                    emphasis={emphasis}
                    size="md"
                    isLoading={isLoading}
                  />
                );
              })}
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertTitle>데이터 수신 실패</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
