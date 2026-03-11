import * as React from "react";
import type { SpatItem } from "@/lib/types";

// ── 방향 코드 → 지리 방위각 (0=북, 90=동, 180=남, 270=서) ──────
const DIR_BEARING: Record<string, number> = {
  nt: 0, et: 90, st: 180, wt: 270,
  ne: 45, se: 135, sw: 225, nw: 315,
};
const DIR_KO: Record<string, string> = {
  nt: "북", et: "동", st: "남", wt: "서",
  ne: "북동", se: "남동", sw: "남서", nw: "북서",
};
const DIR_EN: Record<string, string> = {
  nt: "North", et: "East", st: "South", wt: "West",
  ne: "NE", se: "SE", sw: "SW", nw: "NW",
};

// ── 신호 상태 ──────────────────────────────────────────────────
type Tone = "go" | "stop" | "caution" | "unknown";

function toTone(status: string | null): Tone {
  if (status === "protected-Movement-Allowed" || status === "permissive-Movement-Allowed") return "go";
  if (status === "stop-And-Remain") return "stop";
  if (
    status === "protected-clearance" ||
    status === "permissive-clearance" ||
    status === "caution-Conflicting-Traffic"
  ) return "caution";
  return "unknown";
}

const TONE: Record<Tone, { color: string; glow: string; label: string; icon: string }> = {
  go:      { color: "#4ea86e", glow: "traffic-light-glow-green",  label: "보행 중", icon: "directions_walk" },
  stop:    { color: "#c05050", glow: "traffic-light-glow-red",    label: "대기 중", icon: "back_hand" },
  caution: { color: "#c09040", glow: "traffic-light-glow-yellow", label: "주의",    icon: "warning" },
  unknown: { color: "#64748b", glow: "",                          label: "미확인",  icon: "help" },
};

// ── 헬퍼 ──────────────────────────────────────────────────────
function bearingOffset(bearing: number, distPct: number) {
  const r = (bearing * Math.PI) / 180;
  return {
    left: `${50 + distPct * Math.sin(r)}%`,
    top:  `${50 - distPct * Math.cos(r)}%`,
  };
}

function roadRotation(bearing: number) {
  return (bearing + 180) % 360;
}

// ── 반응형 치수 계산 ─────────────────────────────────────────
type Dims = {
  roadW: number;
  cwH: number;
  cwDistPct: number;
  stopDistPct: number;
  stopH: number;
  bubbleDistPct: number;
  bubbleSize: number;
  bubbleFontSize: number;
  pedW: number;
  pedH: number;
  cwStripe: string;
};

function calcDims(sq: number, numBearings: number): Dims {
  const compact = sq < 480;
  const dense = numBearings > 4;

  if (compact && dense) {
    // 모바일 + 많은 방향: 매우 작게
    const roadW = Math.max(36, sq * 0.1);
    return {
      roadW,
      cwH: Math.max(14, sq * 0.035),
      cwDistPct: 17,
      stopDistPct: 12,
      stopH: 2,
      bubbleDistPct: 34,
      bubbleSize: 40,
      bubbleFontSize: 13,
      pedW: roadW - 4,
      pedH: 24,
      cwStripe: `repeating-linear-gradient(90deg, transparent, transparent 4px, rgba(226,232,240,0.5) 4px, rgba(226,232,240,0.5) ${Math.max(8, roadW * 0.15)}px)`,
    };
  }
  if (compact) {
    // 모바일 + 적은 방향
    const roadW = Math.max(60, sq * 0.18);
    return {
      roadW,
      cwH: Math.max(28, sq * 0.06),
      cwDistPct: 15,
      stopDistPct: 10.5,
      stopH: 3,
      bubbleDistPct: 32,
      bubbleSize: 52,
      bubbleFontSize: 15,
      pedW: roadW - 4,
      pedH: 40,
      cwStripe: `repeating-linear-gradient(90deg, transparent, transparent 8px, rgba(226,232,240,0.55) 8px, rgba(226,232,240,0.55) 20px)`,
    };
  }
  if (dense) {
    // 데스크탑 + 많은 방향
    const roadW = Math.max(60, Math.min(100, sq * 0.13));
    return {
      roadW,
      cwH: Math.max(30, sq * 0.05),
      cwDistPct: 16,
      stopDistPct: 11,
      stopH: 4,
      bubbleDistPct: 38,
      bubbleSize: 42,
      bubbleFontSize: 15,
      pedW: roadW - 4,
      pedH: 40,
      cwStripe: `repeating-linear-gradient(90deg, transparent, transparent 8px, rgba(226,232,240,0.6) 8px, rgba(226,232,240,0.6) 22px)`,
    };
  }
  // 데스크탑 + 적은 방향
  return {
    roadW: 132,
    cwH: 56,
    cwDistPct: 15,
    stopDistPct: 10.5,
    stopH: 5,
    bubbleDistPct: 38,
    bubbleSize: 42,
    bubbleFontSize: 15,
    pedW: 128,
    pedH: 52,
    cwStripe: "repeating-linear-gradient(90deg, transparent, transparent 10px, rgba(226,232,240,0.6) 10px, rgba(226,232,240,0.6) 26px)",
  };
}

// ── SVG 카운트다운 링 ─────────────────────────────────────────
const RING_R = 18;
const RING_C = 2 * Math.PI * RING_R;

function CountdownRing({ sec, secAtMsg, color }: { sec: number | null; secAtMsg: number | null; color: string }) {
  const progress =
    sec != null && secAtMsg != null && secAtMsg > 0
      ? Math.max(0, Math.min(1, sec / secAtMsg))
      : 0;
  const dashOffset = RING_C * (1 - progress);

  return (
    <svg
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", transform: "rotate(-90deg)" }}
      viewBox="0 0 40 40"
    >
      <circle cx="20" cy="20" r={RING_R} fill="transparent" stroke="rgba(255,255,255,0.1)" strokeWidth="2" />
      <circle
        cx="20" cy="20" r={RING_R}
        fill="transparent"
        stroke={color}
        strokeWidth="2"
        strokeDasharray={RING_C}
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.6s ease" }}
      />
    </svg>
  );
}

// ── 보행자 점 애니메이션 ──────────────────────────────────────
function PedestrianDots({ bearing, w, h }: { bearing: number; w: number; h: number }) {
  const pos = bearingOffset(bearing, 15);
  return (
    <div
      style={{
        position: "absolute",
        ...pos,
        width: w,
        height: h,
        transform: `translate(-50%, -50%) rotate(${bearing}deg)`,
        overflow: "hidden",
        zIndex: 8,
        pointerEvents: "none",
      }}
    >
      {[0, 1.8, 3.4].map((delay, i) => (
        <div
          key={i}
          className="ped-dot"
          style={{
            top: i % 2 === 0 ? "28%" : "58%",
            animationDelay: `${delay}s`,
            animationDuration: `${4.5 + i * 0.7}s`,
          }}
        />
      ))}
    </div>
  );
}

// ── 신호 버블 ─────────────────────────────────────────────────
type DirData = {
  dirCode: string;
  bearing: number;
  item: SpatItem | null;
  tone: Tone;
};

function SignalBubble({ dir, compact, dims }: { dir: DirData; compact: boolean; dims: Dims }) {
  const cfg = TONE[dir.tone];
  const sec = dir.item?.sec ?? null;
  const secAtMsg = dir.item?.secAtMsg ?? null;
  const pos = bearingOffset(dir.bearing, dims.bubbleDistPct);

  if (compact) {
    return (
      <div style={{
        position: "absolute", ...pos,
        transform: "translate(-50%, -50%)",
        zIndex: 50,
        display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
        pointerEvents: "none",
      }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: "#707078", letterSpacing: "0.1em" }}>
          {DIR_KO[dir.dirCode] ?? dir.dirCode}
        </div>
        <div style={{
          position: "relative", width: dims.bubbleSize, height: dims.bubbleSize, borderRadius: "50%",
          background: "rgba(20,20,22,0.92)", border: `1.5px solid ${cfg.color}44`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <CountdownRing sec={sec} secAtMsg={secAtMsg} color={cfg.color} />
          <span style={{ fontSize: dims.bubbleFontSize, fontWeight: 900, color: cfg.color, fontVariantNumeric: "tabular-nums", fontFamily: "monospace", zIndex: 1 }}>
            {sec != null ? Math.round(sec) : "—"}
          </span>
        </div>
        <span className="material-symbols-outlined" style={{ fontSize: 12, color: `${cfg.color}cc` }}>{cfg.icon}</span>
      </div>
    );
  }

  return (
    <div style={{
      position: "absolute", ...pos,
      transform: "translate(-50%, -50%)",
      zIndex: 50, borderRadius: 14, padding: "8px 14px",
      display: "flex", alignItems: "center", gap: 10,
      cursor: "default",
      transition: "transform 0.25s cubic-bezier(0.34,1.56,0.64,1)",
      background: "rgba(20,20,22,0.94)",
      border: `1px solid ${cfg.color}33`,
      boxShadow: "0 2px 12px rgba(0,0,0,0.4)",
      minWidth: 120,
    }}>
      <div style={{ borderRight: "1px solid rgba(255,255,255,0.1)", paddingRight: 10 }}>
        <div style={{ fontSize: 8, fontWeight: 700, color: "#707078", letterSpacing: "0.12em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
          {DIR_EN[dir.dirCode] ?? dir.dirCode}
        </div>
        <span className="material-symbols-outlined" style={{ fontSize: 18, marginTop: 2, color: cfg.color }}>{cfg.icon}</span>
      </div>
      <div style={{ position: "relative", width: dims.bubbleSize, height: dims.bubbleSize, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <CountdownRing sec={sec} secAtMsg={secAtMsg} color={cfg.color} />
        <span style={{ fontSize: dims.bubbleFontSize, fontWeight: 900, color: cfg.color, fontVariantNumeric: "tabular-nums", fontFamily: "monospace", zIndex: 1 }}>
          {sec != null ? Math.round(sec) : "—"}
        </span>
      </div>
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: cfg.color }}>{cfg.label}</div>
        <div style={{ fontSize: 10, color: "#707078", marginTop: 2 }}>{DIR_KO[dir.dirCode] ?? dir.dirCode}측</div>
      </div>
    </div>
  );
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────
export type IntersectionViewProps = {
  items: SpatItem[];
  roadBearings?: number[];
  isLoading?: boolean;
  isStale?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  className?: string;
};

const FALLBACK_BEARINGS = [0, 90, 180, 270];

export function IntersectionView({
  items,
  roadBearings,
  isLoading = false,
  isStale = false,
  emptyTitle = "교차로를 선택하세요",
  emptyDescription = "신호 데이터가 표시됩니다",
  className = "",
}: IntersectionViewProps) {

  const dirSignals = React.useMemo<DirData[]>(() => {
    const map = new Map<string, SpatItem[]>();
    for (const item of items) {
      if (!item.dirCode || !(item.dirCode in DIR_BEARING)) continue;
      const arr = map.get(item.dirCode) ?? [];
      arr.push(item);
      map.set(item.dirCode, arr);
    }
    return Array.from(map.entries()).map(([dirCode, dirItems]) => {
      const pedItem = dirItems.find((it) => it.movCode?.includes("Pdsg"));
      const primary = pedItem ?? dirItems[0] ?? null;
      return { dirCode, bearing: DIR_BEARING[dirCode], item: primary, tone: toTone(primary?.status ?? null) };
    }).sort((a, b) => a.bearing - b.bearing);
  }, [items]);

  const drawBearings = React.useMemo(() => {
    if (roadBearings && roadBearings.length >= 2) return roadBearings;
    const fromData = dirSignals.map((d) => d.bearing);
    return fromData.length >= 2 ? fromData : FALLBACK_BEARINGS;
  }, [roadBearings, dirSignals]);

  const containerRef = React.useRef<HTMLDivElement>(null);
  const [sq, setSq] = React.useState(400);
  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSq(Math.min(width, height));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const dims = React.useMemo(() => calcDims(sq, drawBearings.length), [sq, drawBearings.length]);
  const compact = sq < 480;

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden ${className}`}
      style={{ background: "radial-gradient(circle at center, #151c2e 0%, #0d0e14 80%)" }}
    >
      <div style={{
        position: "absolute", top: "50%", left: "50%",
        width: sq, height: sq,
        transform: "translate(-50%, -50%)",
      }}>
      {/* ── 교차로 중심 조명 효과 ── */}
      <div style={{
        position: "absolute", top: "50%", left: "50%",
        width: sq * 0.28, height: sq * 0.28,
        transform: "translate(-50%, -50%)",
        background: "radial-gradient(circle, rgba(80,110,200,0.11) 0%, transparent 70%)",
        zIndex: 2, pointerEvents: "none",
      }} />
      {/* ── 도로 암(arm) ── */}
      {drawBearings.map((bearing) => (
        <React.Fragment key={`road-${bearing}`}>
          {/* 도로 표면 */}
          <div
            style={{
              position: "absolute",
              top: "50%", left: "50%",
              width: dims.roadW, height: "52%",
              background: "#2c3045",
              transformOrigin: "top center",
              transform: `translate(-50%, 0) rotate(${roadRotation(bearing)}deg)`,
              zIndex: 1,
            }}
          >
            <div style={{
              position: "absolute", top: 0, left: "50%", width: 2, height: "100%",
              background: "repeating-linear-gradient(to bottom, #6878b0 0px, #6878b0 12px, transparent 12px, transparent 24px)",
              transform: "translateX(-50%)", opacity: 0.45,
            }} />
          </div>

          {/* 횡단보도 */}
          <div
            style={{
              position: "absolute",
              ...bearingOffset(bearing, dims.cwDistPct),
              width: dims.roadW, height: dims.cwH,
              transform: `translate(-50%, -50%) rotate(${bearing}deg)`,
              backgroundImage: dims.cwStripe,
              zIndex: 3,
            }}
          />

          {/* 정지선 */}
          <div
            style={{
              position: "absolute",
              ...bearingOffset(bearing, dims.stopDistPct),
              width: dims.roadW, height: dims.stopH,
              background: "rgba(255,255,255,0.85)",
              transform: `translate(-50%, -50%) rotate(${bearing}deg)`,
              zIndex: 4,
            }}
          />
        </React.Fragment>
      ))}

      {/* ── 신호 버블 ── */}
      {dirSignals.map((dir) => (
        <SignalBubble key={dir.dirCode} dir={dir} compact={compact} dims={dims} />
      ))}

      {/* ── 보행자 애니메이션 (진행 신호만) ── */}
      {dirSignals
        .filter((d) => d.tone === "go")
        .map((d) => (
          <PedestrianDots key={`ped-${d.dirCode}`} bearing={d.bearing} w={dims.pedW} h={dims.pedH} />
        ))}

      {/* ── 데이터 없을 때 중앙 안내 ── */}
      {!isLoading && items.length === 0 && (
        <div style={{
          position: "absolute", inset: 0, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", zIndex: 60, gap: 8,
        }}>
          <div style={{ fontSize: 13, color: "#94a3b8", fontWeight: 600 }}>{emptyTitle}</div>
          <div style={{ fontSize: 11, color: "#475569" }}>{emptyDescription}</div>
        </div>
      )}
      </div>{/* ── 정사각형 캔버스 끝 ── */}

      {/* ── 로딩 오버레이 ── */}
      {isLoading && (
        <div style={{
          position: "absolute", inset: 0, background: "rgba(16,16,18,0.6)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
        }}>
          <div style={{ fontSize: 13, color: "#909098", fontWeight: 600, letterSpacing: "0.05em" }}>
            신호 데이터 조회 중…
          </div>
        </div>
      )}

      {/* ── 실시간성 미달 배너 ── */}
      {isStale && !isLoading && (
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 90,
          background: "rgba(192,80,80,0.2)", borderTop: "1px solid rgba(192,80,80,0.4)",
          padding: "6px 16px", textAlign: "center",
          fontSize: 11, color: "#fca5a5", fontWeight: 600,
        }}>
          실시간성 미달 — 데이터가 3초 이상 경과했습니다
        </div>
      )}
    </div>
  );
}
