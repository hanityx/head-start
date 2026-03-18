import { useState } from "react";
import { ChevronDown, Locate, MapPin, Radio } from "lucide-react";
import type { SpatItem, SpatResponse } from "@/lib/types";
import type { SpatErrorDetail } from "@/hooks/useSpat";

type StatusPanelProps = {
  verifyMode: boolean;
  error: string;
  errorDetail: SpatErrorDetail | null;
  activeSpat: SpatResponse | null;
  hasEmptySpat: boolean;
  spatItems: SpatItem[];
  roadBearings: number[] | undefined;
  geoSource: "osm" | "fallback" | null;
  geoError: string | null;
  geoLoading: boolean;
};

// ── 상태 행 컴포넌트 ────────────────────────────────────────

function StatusRow({
  icon,
  label,
  sub,
  valueClass,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  sub: string;
  valueClass: string;
  detail?: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-white/5 border border-white/5 px-2.5 py-2 gap-2">
      <div className="flex items-center gap-2">
        <div className="bg-white/5 p-1.5 rounded-lg">{icon}</div>
        <div className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">
          {label}
        </div>
      </div>
      <div className="text-right">
        <div className={`text-xs font-bold ${valueClass}`}>{sub}</div>
        {detail && <div className="text-[9px] text-slate-500">{detail}</div>}
      </div>
    </div>
  );
}

// ── 데스크탑 우측 패널 + 모바일 요약 ─────────────────────────

export function StatusPanel({
  verifyMode,
  error,
  errorDetail,
  activeSpat,
  hasEmptySpat,
  spatItems,
  roadBearings,
  geoSource,
  geoError,
  geoLoading,
}: StatusPanelProps) {
  const [panelOpen, setPanelOpen] = useState(false);

  return (
    <>
      {/* 우측 정보 패널 (데스크탑만, verifyMode 아닐 때) */}
      <aside
        className={`absolute right-4 top-20 z-30 w-64 flex-col gap-3 pointer-events-auto hidden md:flex ${verifyMode ? "md:hidden" : ""}`}
      >
        {/* 시스템 상태 */}
        <div className="glass-panel rounded-2xl overflow-hidden">
          <button
            className="flex w-full items-center justify-between p-3 hover:bg-white/5 transition-colors"
            onClick={() => setPanelOpen((v) => !v)}
          >
            <div className="flex items-center gap-2">
              <Locate className="h-3.5 w-3.5 text-sky-400" />
              <span className="text-xs font-bold text-slate-200">
                시스템 상태
              </span>
            </div>
            <ChevronDown
              className={`h-3.5 w-3.5 text-slate-400 transition-transform ${panelOpen ? "rotate-180" : ""}`}
            />
          </button>
          {panelOpen && (
            <div className="px-3 pb-3 space-y-2">
              <StatusRow
                icon={<Radio className="h-4 w-4 text-emerald-400" />}
                label="신호 연결"
                sub={
                  error
                    ? "오류"
                    : hasEmptySpat
                      ? "가져오지 못함"
                      : activeSpat?.isStale
                        ? "지연됨"
                        : activeSpat
                          ? "정상"
                          : "대기"
                }
                valueClass={
                  error
                    ? "text-rose-400"
                    : hasEmptySpat || activeSpat?.isStale
                      ? "text-amber-400"
                      : activeSpat
                        ? "text-emerald-400"
                        : "text-slate-400"
                }
                detail={
                  activeSpat?.ageSec != null
                    ? `${Math.round(activeSpat.ageSec)}초 전 수신`
                    : undefined
                }
              />
              <StatusRow
                icon={<MapPin className="h-4 w-4 text-sky-400" />}
                label="교차로 구조"
                sub={
                  geoError
                    ? "오류"
                    : geoLoading
                      ? "대기"
                      : roadBearings
                        ? roadBearings.length > 0
                          ? geoSource === "osm"
                            ? "실측 데이터"
                            : "저장된 값"
                          : "정보 없음"
                        : "대기"
                }
                valueClass={
                  geoError
                    ? "text-rose-400"
                    : geoSource === "osm"
                      ? "text-emerald-400"
                      : "text-slate-400"
                }
                detail={
                  geoError ??
                  (roadBearings
                    ? roadBearings.length > 0
                      ? `${roadBearings.length}방향`
                      : "교차로 형상 없음"
                    : undefined)
                }
              />
            </div>
          )}
        </div>

        {/* 신호 현황 */}
        {spatItems.length > 0 && (
          <div className="glass-panel rounded-2xl p-3 space-y-2">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              신호 현황
            </div>
            {spatItems.slice(0, 6).map((item) => {
              const isGo =
                item.status === "protected-Movement-Allowed" ||
                item.status === "permissive-Movement-Allowed";
              const isStop = item.status === "stop-And-Remain";
              return (
                <div
                  key={item.key ?? item.title}
                  className="flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{
                        background: isGo
                          ? "#10b981"
                          : isStop
                            ? "#ef4444"
                            : "#64748b",
                      }}
                    />
                    <span className="text-xs text-slate-300 truncate">
                      {item.title}
                    </span>
                  </div>
                  <span
                    className="text-xs font-bold tabular-nums shrink-0"
                    style={{
                      color: isGo
                        ? "#10b981"
                        : isStop
                          ? "#ef4444"
                          : "#64748b",
                    }}
                  >
                    {item.sec != null ? `${item.sec.toFixed(1)}초` : "—"}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* 에러 */}
        {error && (
          <div className="glass-panel rounded-2xl p-3 border border-rose-500/30 space-y-1.5">
            <div className="text-xs text-rose-400 font-semibold">
              조회 실패{" "}
              {errorDetail ? `(HTTP ${errorDetail.httpStatus})` : ""}
            </div>
            <div className="text-[11px] text-rose-300/80 font-mono">
              {errorDetail?.error ?? error}
            </div>
          </div>
        )}
      </aside>

      {/* 모바일 신호 요약 (우상단, verifyMode 시 숨김) */}
      {spatItems.length > 0 && !verifyMode && (
        <div className="md:hidden absolute right-3 top-20 z-30 glass-panel rounded-xl p-2 space-y-1 pointer-events-none max-w-[120px]">
          {spatItems.slice(0, 4).map((item) => {
            const isGo =
              item.status === "protected-Movement-Allowed" ||
              item.status === "permissive-Movement-Allowed";
            const isStop = item.status === "stop-And-Remain";
            return (
              <div
                key={item.key ?? item.title}
                className="flex items-center justify-between gap-1.5"
              >
                <div
                  className="h-1.5 w-1.5 rounded-full shrink-0"
                  style={{
                    background: isGo
                      ? "#10b981"
                      : isStop
                        ? "#ef4444"
                        : "#64748b",
                  }}
                />
                <span className="text-[10px] text-slate-300 truncate flex-1">
                  {item.title}
                </span>
                <span
                  className="text-[10px] font-bold tabular-nums shrink-0"
                  style={{
                    color: isGo ? "#10b981" : isStop ? "#ef4444" : "#64748b",
                  }}
                >
                  {item.sec != null ? `${Math.round(item.sec)}초` : "—"}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
