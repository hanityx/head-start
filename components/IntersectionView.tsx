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
  go:      { color: "#10b981", glow: "traffic-light-glow-green",  label: "보행 중", icon: "🚶" },
  stop:    { color: "#ef4444", glow: "traffic-light-glow-red",    label: "대기 중", icon: "✋" },
  caution: { color: "#f59e0b", glow: "traffic-light-glow-yellow", label: "주의",    icon: "⚠️" },
  unknown: { color: "#64748b", glow: "",                          label: "미확인",  icon: "❓" },
};

// ── 헬퍼 ──────────────────────────────────────────────────────
/**
 * 방위각 → CSS 중심(50%,50%) 기준 % 오프셋
 * bearing 0=북=위, 90=동=오른쪽 (CSS y축 아래 방향 반영)
 */
function bearingOffset(bearing: number, distPct: number) {
  const r = (bearing * Math.PI) / 180;
  return {
    left: `${50 + distPct * Math.sin(r)}%`,
    top:  `${50 - distPct * Math.cos(r)}%`,
  };
}

/**
 * 도로 암(arm): 기본이 아래(남)로 향하므로 bearing+180° 회전
 */
function roadRotation(bearing: number) {
  return (bearing + 180) % 360;
}

// ── SVG 카운트다운 링 ─────────────────────────────────────────
const RING_R = 18;
const RING_C = 2 * Math.PI * RING_R; // ≈ 113

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
function PedestrianDots({ bearing }: { bearing: number }) {
  const pos = bearingOffset(bearing, 15);
  return (
    <div
      style={{
        position: "absolute",
        ...pos,
        width: 128,
        height: 52,
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

function SignalBubble({ dir }: { dir: DirData }) {
  const cfg = TONE[dir.tone];
  const sec = dir.item?.sec ?? null;
  const secAtMsg = dir.item?.secAtMsg ?? null;
  const pos = bearingOffset(dir.bearing, 38);

  return (
    <div
      className={`glass-panel ${cfg.glow}`}
      style={{
        position: "absolute",
        ...pos,
        transform: "translate(-50%, -50%)",
        zIndex: 50,
        borderRadius: 20,
        padding: "10px 16px",
        display: "flex",
        alignItems: "center",
        gap: 10,
        cursor: "default",
        transition: "transform 0.25s cubic-bezier(0.34,1.56,0.64,1)",
        border: `1px solid ${cfg.color}22`,
        minWidth: 130,
      }}
    >
      {/* 방향 레이블 */}
      <div style={{ borderRight: "1px solid rgba(255,255,255,0.1)", paddingRight: 10 }}>
        <div style={{ fontSize: 8, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.12em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
          {DIR_EN[dir.dirCode] ?? dir.dirCode}
        </div>
        <div style={{ fontSize: 18, marginTop: 2 }}>{cfg.icon}</div>
      </div>

      {/* 링 + 숫자 */}
      <div style={{ position: "relative", width: 42, height: 42, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <CountdownRing sec={sec} secAtMsg={secAtMsg} color={cfg.color} />
        <span style={{ fontSize: 15, fontWeight: 900, color: cfg.color, fontVariantNumeric: "tabular-nums", fontFamily: "monospace", zIndex: 1 }}>
          {sec != null ? Math.round(sec) : "—"}
        </span>
      </div>

      {/* 상태 텍스트 */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: cfg.color }}>{cfg.label}</div>
        <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>
          {DIR_KO[dir.dirCode] ?? dir.dirCode}측
        </div>
      </div>
    </div>
  );
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────
export type IntersectionViewProps = {
  items: SpatItem[];
  roadBearings?: number[]; // OSM에서 가져온 실제 도로 각도 (optional)
  isLoading?: boolean;
  isStale?: boolean;
  className?: string;
};

const FALLBACK_BEARINGS = [0, 90, 180, 270]; // 데이터 없을 때 기본 4방향

export function IntersectionView({
  items,
  roadBearings,
  isLoading = false,
  isStale = false,
  className = "",
}: IntersectionViewProps) {

  // 방향별 신호 데이터 그룹핑
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

  // 도로 각도: OSM > dirCode > 기본 4방향
  const drawBearings = React.useMemo(() => {
    if (roadBearings && roadBearings.length >= 2) return roadBearings;
    const fromData = dirSignals.map((d) => d.bearing);
    return fromData.length >= 2 ? fromData : FALLBACK_BEARINGS;
  }, [roadBearings, dirSignals]);

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{ background: "radial-gradient(circle at center, #1e293b 0%, #020617 70%)" }}
    >
      {/* 격자 배경 */}
      <div className="absolute inset-0 map-bg-grid pointer-events-none" />

      {/* ── 도로 암(arm) ── */}
      {drawBearings.map((bearing) => (
        <React.Fragment key={`road-${bearing}`}>
          {/* 도로 표면 */}
          <div
            style={{
              position: "absolute",
              top: "50%", left: "50%",
              width: 132, height: "52%",
              background: "#334155",
              transformOrigin: "top center",
              transform: `translate(-50%, 0) rotate(${roadRotation(bearing)}deg)`,
              zIndex: 1,
            }}
          >
            {/* 중앙선 점선 */}
            <div style={{
              position: "absolute", top: 0, left: "50%", width: 2, height: "100%",
              background: "repeating-linear-gradient(to bottom, #64748b 0px, #64748b 14px, transparent 14px, transparent 28px)",
              transform: "translateX(-50%)", opacity: 0.5,
            }} />
          </div>

          {/* 횡단보도 */}
          <div
            style={{
              position: "absolute",
              ...bearingOffset(bearing, 15),
              width: 132, height: 56,
              transform: `translate(-50%, -50%) rotate(${bearing}deg)`,
              backgroundImage: "repeating-linear-gradient(90deg, transparent, transparent 10px, rgba(226,232,240,0.6) 10px, rgba(226,232,240,0.6) 26px)",
              zIndex: 3,
            }}
          />

          {/* 정지선 */}
          <div
            style={{
              position: "absolute",
              ...bearingOffset(bearing, 10.5),
              width: 132, height: 5,
              background: "rgba(255,255,255,0.85)",
              transform: `translate(-50%, -50%) rotate(${bearing}deg)`,
              zIndex: 4,
            }}
          />
        </React.Fragment>
      ))}

      {/* ── 신호 버블 ── */}
      {dirSignals.map((dir) => (
        <SignalBubble key={dir.dirCode} dir={dir} />
      ))}

      {/* ── 보행자 애니메이션 (진행 신호만) ── */}
      {dirSignals
        .filter((d) => d.tone === "go")
        .map((d) => (
          <PedestrianDots key={`ped-${d.dirCode}`} bearing={d.bearing} />
        ))}

      {/* ── 데이터 없을 때 중앙 안내 ── */}
      {!isLoading && items.length === 0 && (
        <div style={{
          position: "absolute", inset: 0, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", zIndex: 60, gap: 8,
        }}>
          <div style={{ fontSize: 13, color: "#94a3b8", fontWeight: 600 }}>교차로를 선택하세요</div>
          <div style={{ fontSize: 11, color: "#475569" }}>신호 데이터가 표시됩니다</div>
        </div>
      )}

      {/* ── 로딩 오버레이 ── */}
      {isLoading && (
        <div style={{
          position: "absolute", inset: 0, background: "rgba(2,6,23,0.55)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
        }}>
          <div style={{ fontSize: 13, color: "#38bdf8", fontWeight: 600, letterSpacing: "0.05em" }}>
            신호 데이터 조회 중…
          </div>
        </div>
      )}

      {/* ── 실시간성 미달 배너 ── */}
      {isStale && !isLoading && (
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 90,
          background: "rgba(239,68,68,0.2)", borderTop: "1px solid rgba(239,68,68,0.4)",
          padding: "6px 16px", textAlign: "center",
          fontSize: 11, color: "#fca5a5", fontWeight: 600,
        }}>
          실시간성 미달 — 데이터가 3초 이상 경과했습니다
        </div>
      )}
    </div>
  );
}
