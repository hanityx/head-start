import * as React from "react";
import Head from "next/head";
import { IntersectionView } from "@/components/IntersectionView";
import { BearingVerifyMap } from "@/components/BearingVerifyMap";
import { DEMO_SCENARIOS } from "@/lib/demo-data";
import type { SpatItem } from "@/lib/types";

// ── 카운트다운 시뮬레이터 ────────────────────────────────────
type SimItem = SpatItem & { _maxSec: number };

function buildSimItems(items: SpatItem[]): SimItem[] {
  return items.map((it) => ({ ...it, _maxSec: it.secAtMsg ?? it.sec ?? 30 }));
}

function tickItems(items: SimItem[]): SimItem[] {
  return items.map((it) => {
    const nextSec = (it.sec ?? 0) - 1;
    if (nextSec <= 0) {
      // 신호 전환
      const isGo = it.status === "protected-Movement-Allowed";
      const newStatus = isGo ? "stop-And-Remain" : "protected-Movement-Allowed";
      const newMax = it._maxSec;
      return { ...it, status: newStatus, sec: newMax, secAtMsg: newMax };
    }
    return { ...it, sec: nextSec };
  });
}

// ── 메인 페이지 ───────────────────────────────────────────────
export default function DemoPage() {
  const [scenarioIdx, setScenarioIdx] = React.useState(0);
  const [simItems, setSimItems] = React.useState<SimItem[]>([]);
  const [autoNext, setAutoNext] = React.useState(false);
  const [tick, setTick] = React.useState(0);
  const [verifyMode, setVerifyMode] = React.useState(false);

  const scenario = DEMO_SCENARIOS[scenarioIdx];

  // 시나리오 변경 시 simItems 초기화
  React.useEffect(() => {
    setSimItems(buildSimItems(scenario.response.items));
  }, [scenarioIdx, scenario.response.items]);

  // 1초마다 카운트다운
  React.useEffect(() => {
    const id = setInterval(() => {
      setSimItems((prev) => tickItems(prev));
      setTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // 자동 시나리오 순환 (20초마다)
  React.useEffect(() => {
    if (!autoNext) return;
    const id = setInterval(() => {
      setScenarioIdx((i) => (i + 1) % DEMO_SCENARIOS.length);
    }, 20000);
    return () => clearInterval(id);
  }, [autoNext]);

  const handlePrev = () =>
    setScenarioIdx((i) => (i - 1 + DEMO_SCENARIOS.length) % DEMO_SCENARIOS.length);
  const handleNext = () =>
    setScenarioIdx((i) => (i + 1) % DEMO_SCENARIOS.length);

  const goCount = simItems.filter((it) => it.status === "protected-Movement-Allowed").length;
  const stopCount = simItems.filter((it) => it.status === "stop-And-Remain").length;

  return (
    <>
      <Head>
        <title>교차로 시각화 데모 — Head Start</title>
      </Head>

      <div
        style={{
          height: "100vh",
          background: "#020617",
          display: "flex",
          flexDirection: "column",
          fontFamily: "system-ui, -apple-system, 'Apple SD Gothic Neo', sans-serif",
          overflow: "hidden",
        }}
      >
        {/* ── 상단 헤더 ── */}
        <header
          className="glass-panel"
          style={{
            borderBottom: "1px solid rgba(255,255,255,0.07)",
            padding: "14px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {/* 시나리오 네비 */}
            <button
              onClick={handlePrev}
              style={navBtnStyle}
              aria-label="이전 시나리오"
            >
              ‹
            </button>

            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#f1f5f9", letterSpacing: "-0.02em" }}>
                {scenario.label}
              </div>
              <div style={{ fontSize: 11, color: "#38bdf8", fontWeight: 600, marginTop: 2 }}>
                {scenario.tag}
              </div>
            </div>

            <button
              onClick={handleNext}
              style={navBtnStyle}
              aria-label="다음 시나리오"
            >
              ›
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* 시나리오 도트 인디케이터 */}
            <div style={{ display: "flex", gap: 6 }}>
              {DEMO_SCENARIOS.map((s, i) => (
                <button
                  key={i}
                  onClick={() => setScenarioIdx(i)}
                  style={{
                    width: i === scenarioIdx ? 20 : 8,
                    height: 8,
                    borderRadius: 4,
                    background: i === scenarioIdx ? "#38bdf8" : "rgba(255,255,255,0.2)",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                    transition: "width 0.25s ease, background 0.2s ease",
                  }}
                  aria-label={s.label}
                />
              ))}
            </div>

            {/* 자동 순환 토글 */}
            <button
              onClick={() => setAutoNext((v) => !v)}
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: "6px 14px",
                borderRadius: 8,
                border: `1px solid ${autoNext ? "#38bdf8" : "rgba(255,255,255,0.15)"}`,
                background: autoNext ? "rgba(56,189,248,0.15)" : "transparent",
                color: autoNext ? "#38bdf8" : "#94a3b8",
                cursor: "pointer",
                letterSpacing: "0.04em",
                transition: "all 0.2s",
              }}
            >
              {autoNext ? "⏸ 자동" : "▶ 자동"}
            </button>

            {/* 위성지도 검증 토글 */}
            <button
              onClick={() => setVerifyMode((v) => !v)}
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: "6px 14px",
                borderRadius: 8,
                border: `1px solid ${verifyMode ? "#a78bfa" : "rgba(255,255,255,0.15)"}`,
                background: verifyMode ? "rgba(167,139,250,0.15)" : "transparent",
                color: verifyMode ? "#a78bfa" : "#94a3b8",
                cursor: "pointer",
                letterSpacing: "0.04em",
                transition: "all 0.2s",
              }}
            >
              {verifyMode ? "✕ 검증 끄기" : "위성 검증"}
            </button>
          </div>
        </header>

        {/* ── 메인: 교차로 뷰 + 사이드 패널 ── */}
        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
          {/* 교차로 시각화 — 모바일: verifyMode면 숨김 */}
          <div
            className={`transition-all duration-300 ${verifyMode ? "hidden md:block md:flex-1" : "flex-1"}`}
          >
            <IntersectionView
              key={scenarioIdx}
              items={simItems}
              roadBearings={scenario.roadBearings}
              isLoading={false}
              isStale={false}
              className="w-full h-full"
            />
          </div>

          {/* 위성 검증 지도 — 모바일: full screen, 데스크탑: 50% */}
          {verifyMode && scenario.response.lat && scenario.response.lon && (
            <div
              className="flex-1 relative md:border-l-2 md:border-purple-400/40"
            >
              <div className="hidden md:block" style={{
                position: "absolute", top: 10, left: "50%", transform: "translateX(-50%)",
                zIndex: 1000, background: "rgba(2,6,23,0.85)", backdropFilter: "blur(8px)",
                borderRadius: 8, padding: "6px 14px",
                border: "1px solid rgba(167,139,250,0.4)",
                fontSize: 11, fontWeight: 700, color: "#a78bfa", whiteSpace: "nowrap",
              }}>
                위성사진 + OSM bearing 선 — 선이 실제 도로와 일치하는지 확인
              </div>
              <BearingVerifyMap
                lat={scenario.response.lat}
                lon={scenario.response.lon}
                bearings={scenario.roadBearings}
                label={scenario.label}
              />
            </div>
          )}

          {/* 우측 정보 패널 — 모바일 숨김 */}
          <aside
            className="glass-panel hidden md:flex"
            style={{
              width: 220,
              borderLeft: "1px solid rgba(255,255,255,0.07)",
              padding: "20px 16px",
              flexDirection: "column",
              gap: 16,
              overflowY: "auto",
            }}
          >
            {/* OSM 소스 배지 */}
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.1em",
                color: "#38bdf8",
                textTransform: "uppercase",
                paddingBottom: 10,
                borderBottom: "1px solid rgba(255,255,255,0.07)",
              }}
            >
              📡 시뮬레이션 모드
            </div>

            {/* 도로 각도 목록 */}
            <div>
              <div style={sectionLabelStyle}>도로 방위각 (OSM)</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                {scenario.roadBearings.map((b) => (
                  <span key={b} style={badgeStyle}>
                    {b}°
                  </span>
                ))}
              </div>
            </div>

            {/* 신호 요약 */}
            <div>
              <div style={sectionLabelStyle}>신호 요약</div>
              <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 11, color: "#94a3b8" }}>진행 중</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: "#10b981" }}>{goCount}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 11, color: "#94a3b8" }}>대기 중</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: "#ef4444" }}>{stopCount}</span>
                </div>
              </div>
            </div>

            {/* 신호 상세 */}
            <div>
              <div style={sectionLabelStyle}>보행 신호 상세</div>
              <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
                {simItems.map((it) => {
                  const isGo = it.status === "protected-Movement-Allowed";
                  return (
                    <div
                      key={it.key}
                      style={{
                        background: "rgba(255,255,255,0.04)",
                        borderRadius: 8,
                        padding: "8px 10px",
                        border: `1px solid ${isGo ? "rgba(16,185,129,0.25)" : "rgba(239,68,68,0.2)"}`,
                      }}
                    >
                      <div style={{ fontSize: 11, color: "#cbd5e1", fontWeight: 600 }}>
                        {it.title}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "baseline",
                          marginTop: 4,
                        }}
                      >
                        <span style={{ fontSize: 10, color: isGo ? "#10b981" : "#ef4444" }}>
                          {isGo ? "🚶 보행 중" : "✋ 대기 중"}
                        </span>
                        <span
                          style={{
                            fontSize: 16,
                            fontWeight: 900,
                            color: isGo ? "#10b981" : "#ef4444",
                            fontFamily: "monospace",
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {Math.round(it.sec ?? 0)}s
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 교차로 메타 */}
            <div
              style={{
                marginTop: "auto",
                paddingTop: 12,
                borderTop: "1px solid rgba(255,255,255,0.07)",
              }}
            >
              <div style={sectionLabelStyle}>교차로 정보</div>
              <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                <MetaRow label="ID" value={scenario.response.itstId} />
                <MetaRow label="명칭" value={scenario.response.itstNm} />
                <MetaRow label="lat" value={String(scenario.response.lat?.toFixed(6))} />
                <MetaRow label="lon" value={String(scenario.response.lon?.toFixed(6))} />
                <MetaRow label="tick" value={String(tick)} />
              </div>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}

// ── 보조 컴포넌트 & 스타일 ──────────────────────────────────
function MetaRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
      <span style={{ fontSize: 10, color: "#475569" }}>{label}</span>
      <span style={{ fontSize: 10, color: "#94a3b8", fontFamily: "monospace" }}>{value ?? "—"}</span>
    </div>
  );
}

const navBtnStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.05)",
  color: "#94a3b8",
  fontSize: 20,
  lineHeight: 1,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "background 0.2s",
};

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.1em",
  color: "#475569",
  textTransform: "uppercase",
};

const badgeStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  padding: "3px 8px",
  borderRadius: 6,
  background: "rgba(56,189,248,0.12)",
  color: "#38bdf8",
  border: "1px solid rgba(56,189,248,0.25)",
  fontFamily: "monospace",
};
