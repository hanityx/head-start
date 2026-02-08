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
import { SignalCountdownCard } from "@/components/SignalCountdownCard";
import { useSpat } from "@/hooks/useSpat";
import type { SpatItem } from "@/lib/types";

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

export function SignalSection({
  itstId,
  onItstIdChange,
}: {
  itstId: string;
  onItstIdChange: (value: string) => void;
}) {
  const [timeoutMs, setTimeoutMs] = useState("25000");
  const [intervalMs, setIntervalMs] = useState("3000");
  const [debug, setDebug] = useState(false);
  const [isAuto, setIsAuto] = useState(false);
  const autoTimerRef = useRef<NodeJS.Timeout | null>(null);

  const { spatData, error, isLoading, fetchSpat } = useSpat({
    itstId,
    timeoutMs,
    debug,
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

    const ms = Math.max(700, Number(intervalMs || 3000));
    fetchSpat();
    autoTimerRef.current = setInterval(fetchSpat, ms);

    return () => {
      if (autoTimerRef.current) {
        clearInterval(autoTimerRef.current);
        autoTimerRef.current = null;
      }
    };
  }, [fetchSpat, intervalMs, isAuto]);

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
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <label className="text-xs text-muted-foreground">
              교차로 ID
              <Input
                value={itstId}
                onChange={(e) => onItstIdChange(e.target.value)}
                className="mt-2"
              />
            </label>
            <label className="text-xs text-muted-foreground">
              요청 타임아웃(ms)
              <Input
                value={timeoutMs}
                onChange={(e) => setTimeoutMs(e.target.value)}
                className="mt-2"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button onClick={fetchSpat}>조회</Button>
              <Button variant="outline" onClick={() => setIsAuto((prev) => !prev)}>
                {isAuto ? "자동 갱신 중지" : "자동 갱신 시작"}
              </Button>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
            <label className="text-xs text-muted-foreground">
              간격(ms)
              <Input
                value={intervalMs}
                onChange={(e) => setIntervalMs(e.target.value)}
                className="mt-2"
              />
            </label>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={debug}
                onChange={(e) => setDebug(e.target.checked)}
              />
              디버그
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
                  조회 시각(KST): <b>{spatData.fetchedAtKst ?? "-"}</b>
                </span>
                <span>
                  교차로: <b>{spatData.itstNm ?? "-"}</b>
                </span>
                <span>
                  위치:{" "}
                  <b>
                    {spatData.lat && spatData.lon
                      ? `${spatData.lat}, ${spatData.lon}`
                      : "-"}
                  </b>
                </span>
                <span>
                  데이터 시각(KST): <b>{spatData.trsmKst ?? "-"}</b>
                </span>
                <span>
                  데이터 경과: <b>{spatData.ageSec ?? "-"}s</b>
                </span>
              </div>
            )
          )}

          {debug && spatData && (
            <div className="rounded-md border border-border/60 bg-muted/40 p-3 text-xs text-muted-foreground">
              <div>
                전송 시각(KST):{" "}
                <span className="rounded bg-muted/70 px-2 py-0.5 font-mono">
                  {spatData.trsmKst ?? "-"}
                </span>
              </div>
              <div className="mt-1">
                경과 초:{" "}
                <span className="rounded bg-muted/70 px-2 py-0.5 font-mono">
                  {spatData.ageSec ?? "-"}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border border-border/70">
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base font-semibold">
              신호 리스트
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={fetchSpat}>
              새로고침
            </Button>
          </div>
          <CardDescription>상태와 잔여 시간을 함께 확인하세요.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!spatData && isLoading ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, idx) => (
                <Card key={idx} className="border border-border/60">
                  <CardContent className="space-y-3 pt-4">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-7 w-24" />
                    <Skeleton className="h-3 w-40" />
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
                    statusLabel={statusInfo?.text ?? "상태 확인"}
                    tone={tone}
                    timeLabel={sec === null ? "-" : fmtSec(sec)}
                    emphasis={emphasis}
                    size="md"
                    isLoading={isLoading}
                    footer={
                      debug
                        ? `수신 ${fmtSec(it.secAtMsg ?? null)} · 보정 ${fmtSec(
                            sec ?? null
                          )}`
                        : undefined
                    }
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
