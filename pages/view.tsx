import { useCallback, useEffect, useRef, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { MapPin, Search, RefreshCw, ChevronDown, Locate, Radio, Zap, Satellite } from "lucide-react";

import { IntersectionView } from "@/components/IntersectionView";
import { BearingVerifyMap } from "@/components/BearingVerifyMap";
import { useSpat } from "@/hooks/useSpat";
import { DEFAULT_ITST_ID } from "@/lib/defaults";
import { haversineMeters, computeBearing } from "@/lib/utils";

const AUTO_REFRESH_MS = 3000;
const DEFAULT_TIMEOUT_MS = "5000";
const sanitizeDigits = (raw: string) => raw.replace(/\D/g, "");

function bearingToArrow(deg: number): string {
  const arrows = ["↑", "↗", "→", "↘", "↓", "↙", "←", "↖"];
  return arrows[Math.round(((deg % 360) + 360) % 360 / 45) % 8];
}

export default function ViewPage() {
  const [itstId, setItstId] = useState(DEFAULT_ITST_ID);
  const [inputVal, setInputVal] = useState(DEFAULT_ITST_ID);
  const [isAuto, setIsAuto] = useState(false);
  const [metaCoords, setMetaCoords] = useState<{ lat: number; lon: number; itstNm: string | null } | null>(null);
  const [roadBearings, setRoadBearings] = useState<number[] | undefined>(undefined);
  const [geoSource, setGeoSource] = useState<"osm" | "fallback" | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false); // 모바일 기본 닫힘, 데스크탑은 mount 후 열림
  const [autoFetch, setAutoFetch] = useState(false);
  const [verifyMode, setVerifyMode] = useState(false);
  const [userGps, setUserGps] = useState<{ lat: number; lon: number } | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const watchIdRef = useRef<number | null>(null);

  const { spatData, error, errorDetail, isLoading, fetchSpat } = useSpat({ itstId, timeoutMs: DEFAULT_TIMEOUT_MS });

  // ── bootstrap: URL 파라미터 → localStorage ──────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const fromQuery = sanitizeDigits(params.get("itstId") ?? "");
    const fromStorage = sanitizeDigits(localStorage.getItem("lastItstId") ?? "");
    const id = fromQuery || fromStorage || DEFAULT_ITST_ID;
    setItstId(id);
    setInputVal(id);
    if (params.get("auto") === "1") setAutoFetch(true);
    // 데스크탑에서는 패널 기본 열림
    if (window.innerWidth >= 768) setPanelOpen(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── itstId 변경 시 localStorage 저장 ────────────────────────
  useEffect(() => {
    if (typeof window !== "undefined" && itstId.trim()) {
      localStorage.setItem("lastItstId", itstId);
    }
  }, [itstId]);

  // ── autoFetch 플래그: itstId가 업데이트된 후 fetchSpat 실행 ──
  useEffect(() => {
    if (!autoFetch || !itstId.trim()) return;
    void fetchSpat();
    setAutoFetch(false);
  }, [autoFetch, fetchSpat, itstId]);

  // ── itstId 변경 시 itstMeta에서 좌표 선취득 (SPaT 실패해도 위성검증 가능) ──
  useEffect(() => {
    if (!itstId.trim()) return;
    setMetaCoords(null);
    void (async () => {
      try {
        const res = await fetch(`/api/itst-meta?itstId=${encodeURIComponent(itstId)}`);
        if (res.ok) {
          const json = (await res.json()) as { lat: number | null; lon: number | null; itstNm: string | null };
          if (json.lat && json.lon) setMetaCoords({ lat: json.lat, lon: json.lon, itstNm: json.itstNm });
        }
      } catch { /* ignore */ }
    })();
  }, [itstId]);

  // ── OSM 도로 각도 fetch (좌표 확보되면 실행, spatData 또는 metaCoords 둘 다 가능) ──
  useEffect(() => {
    const lat = spatData?.lat ?? metaCoords?.lat;
    const lon = spatData?.lon ?? metaCoords?.lon;
    if (!lat || !lon) return;
    setGeoError(null);
    void (async () => {
      try {
        const res = await fetch(
          `/api/intersection-geometry?lat=${lat}&lon=${lon}`
        );
        const json = (await res.json()) as { bearings?: number[]; source?: string; error?: string };
        if (res.ok && Array.isArray(json.bearings) && json.bearings.length >= 2) {
          setRoadBearings(json.bearings);
          setGeoSource(json.source === "osm" ? "osm" : "fallback");
        } else if (!res.ok) {
          setGeoError(`OSM ${res.status}: ${json.error ?? "unknown"}`);
        }
      } catch (e: unknown) {
        setGeoError(`OSM fetch error: ${e instanceof Error ? e.message : String(e)}`);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spatData?.lat, spatData?.lon, metaCoords?.lat, metaCoords?.lon]);

  // ── 위성검증 모드일 때만 GPS 추적 (배터리 절약) ──────────────
  useEffect(() => {
    if (!verifyMode) {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setUserGps(null);
      return;
    }
    if (!navigator.geolocation) return;
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => setUserGps({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => { /* GPS 거부/불가 시 무시 */ },
      { enableHighAccuracy: true }
    );
    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [verifyMode]);

  // ── 자동 갱신 ────────────────────────────────────────────────
  useEffect(() => {
    if (!isAuto) {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      return;
    }
    void fetchSpat();
    timerRef.current = setInterval(() => void fetchSpat(), AUTO_REFRESH_MS);
    return () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };
  }, [fetchSpat, isAuto]);

  const handleSubmit = useCallback(() => {
    const id = sanitizeDigits(inputVal);
    if (!id) return;
    setItstId(id);
    setRoadBearings(undefined);
    setGeoSource(null);
    setAutoFetch(true);
  }, [inputVal]);

  const itstNm = (spatData?.itstId === itstId ? spatData.itstNm : null) ?? metaCoords?.itstNm ?? null;
  const items = spatData?.itstId === itstId && !spatData.isStale ? (spatData.items ?? []) : [];
  const verifyLat = spatData?.lat ?? metaCoords?.lat;
  const verifyLon = spatData?.lon ?? metaCoords?.lon;

  // 내 위치 → 교차로 거리·방향
  const distM = (userGps && verifyLat && verifyLon)
    ? haversineMeters(userGps.lat, userGps.lon, verifyLat, verifyLon)
    : null;
  const distArrow = (distM != null && userGps && verifyLat && verifyLon)
    ? bearingToArrow(computeBearing(userGps.lat, userGps.lon, verifyLat, verifyLon))
    : null;
  const distLabel = distM != null
    ? (distM < 1000 ? `${Math.round(distM)}m` : `${(distM / 1000).toFixed(1)}km`)
    : null;

  return (
    <>
      <Head>
        <title>{itstNm ? `${itstNm} — 신호 조회` : "교차로 신호 실시간 안내"}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>

      <div className="relative h-screen overflow-hidden bg-navy-950 font-display text-slate-200 selection:bg-sky-accent/30">

        {/* ── 교차로 시각화 ── */}
        <div className={`pointer-events-none absolute inset-y-0 left-0 transition-all duration-300 ${verifyMode ? "w-0 overflow-hidden md:w-1/2 md:overflow-visible" : "w-full"}`}>
          <IntersectionView
            items={items}
            roadBearings={roadBearings}
            isLoading={isLoading}
            isStale={spatData?.isStale}
            className="w-full h-full"
          />
        </div>

        {/* ── 위성 검증 지도 ── */}
        {verifyMode && verifyLat && verifyLon && (
          <div className="absolute inset-y-0 right-0 w-full md:w-1/2 md:border-l-2 md:border-purple-400/40">
            {/* 상단 레이블 (데스크탑만) */}
            <div className="hidden md:block" style={{
              position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)",
              zIndex: 1001, background: "rgba(2,6,23,0.85)", backdropFilter: "blur(8px)",
              borderRadius: 8, padding: "5px 12px",
              border: "1px solid rgba(167,139,250,0.4)",
              fontSize: 11, fontWeight: 700, color: "#a78bfa", whiteSpace: "nowrap",
            }}>
              {roadBearings ? "위성사진 + OSM bearing — 선이 실제 도로와 일치하는지 확인" : "위성사진 — OSM bearing 로드 중..."}
            </div>

            {/* 내 위치 거리 배지 */}
            <div style={{
              position: "absolute", bottom: 8, right: 8, zIndex: 1001,
              background: "rgba(2,6,23,0.85)", backdropFilter: "blur(8px)",
              borderRadius: 8, padding: "8px 12px",
              border: `1px solid ${userGps ? "rgba(34,197,94,0.4)" : "rgba(255,255,255,0.08)"}`,
              display: "flex", flexDirection: "column", gap: 2, minWidth: 80,
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                내 위치
              </div>
              {distLabel ? (
                <div style={{ fontSize: 18, fontWeight: 800, color: "#22c55e", fontFamily: "monospace", lineHeight: 1.2 }}>
                  {distLabel} {distArrow}
                </div>
              ) : (
                <div style={{ fontSize: 11, color: "#64748b" }}>GPS 대기 중...</div>
              )}
            </div>

            <BearingVerifyMap
              lat={verifyLat}
              lon={verifyLon}
              bearings={roadBearings ?? []}
              label={itstNm ?? itstId}
              userLat={userGps?.lat}
              userLon={userGps?.lon}
            />
          </div>
        )}

        {/* ── 상단 페이드 ── */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-navy-950/80 to-transparent z-10" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-navy-950/70 to-transparent z-10" />

        {/* ── 헤더 ── */}
        <header className="absolute inset-x-0 top-0 z-20 flex h-20 items-center justify-between px-5 gap-4">
          {/* 타이틀 */}
          <div className="shrink-0">
            <h1 className="flex items-center gap-2 text-base font-bold text-white leading-tight">
              교차로 신호 안내
              {isAuto && (
                <span className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-sky-accent/10 text-sky-accent border border-sky-accent/20">
                  <Radio className="h-2.5 w-2.5" />
                  LIVE
                </span>
              )}
            </h1>
            {itstNm && (
              <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[160px]">{itstNm}</p>
            )}
          </div>

          {/* 검색바 */}
          <div className="flex-1 max-w-sm">
            <div className="glass-panel rounded-full flex items-center gap-2 px-3 py-1.5 ring-0 focus-within:ring-2 focus-within:ring-sky-accent/40 transition-all">
              <MapPin className="h-4 w-4 text-sky-accent shrink-0" />
              <input
                className="flex-1 bg-transparent text-sm text-white placeholder-slate-400 focus:outline-none"
                placeholder="교차로 ID 입력..."
                value={inputVal}
                onChange={(e) => setInputVal(sanitizeDigits(e.target.value))}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              />
              <button
                onClick={handleSubmit}
                className="bg-navy-800 hover:bg-navy-700 text-slate-200 p-1.5 rounded-full transition-colors"
              >
                <Search className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* 버튼들 */}
          <div className="flex items-center gap-1.5 shrink-0">
            {verifyLat && verifyLon && (
              <button
                onClick={() => setVerifyMode((v) => !v)}
                className={`glass-panel flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold transition-all border ${
                  verifyMode
                    ? "border-purple-400/40 text-purple-300 bg-purple-400/10"
                    : "border-white/10 text-slate-300 hover:text-white"
                }`}
              >
                <Satellite className="h-3.5 w-3.5" />
                <span className="hidden md:inline">{verifyMode ? "검증 OFF" : "위성 검증"}</span>
              </button>
            )}
            <button
              onClick={() => setIsAuto((v) => !v)}
              className={`glass-panel flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold transition-all border ${
                isAuto
                  ? "border-sky-accent/40 text-sky-accent bg-sky-accent/10"
                  : "border-white/10 text-slate-300 hover:text-white"
              }`}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isAuto ? "animate-spin" : ""}`} />
              <span className="hidden md:inline">{isAuto ? "자동 ON" : "자동 OFF"}</span>
            </button>
            <button
              onClick={() => void fetchSpat()}
              disabled={isLoading}
              className="glass-panel flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:text-white border border-white/10 transition-all disabled:opacity-40"
            >
              <Zap className="h-3.5 w-3.5" />
              <span className="hidden md:inline">조회</span>
            </button>
            <Link
              href="/"
              className="glass-panel hidden md:flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:text-white border border-white/10 transition-all"
            >
              목록 보기
            </Link>
          </div>
        </header>

        {/* ── 우측 정보 패널 (데스크탑만) ── */}
        <aside className={`absolute right-4 top-24 z-20 w-64 flex-col gap-3 pointer-events-auto hidden md:flex ${verifyMode ? "md:hidden" : ""}`}>

          {/* 시스템 상태 */}
          <div className="glass-panel rounded-2xl overflow-hidden">
            <button
              className="flex w-full items-center justify-between p-3 hover:bg-white/5 transition-colors"
              onClick={() => setPanelOpen((v) => !v)}
            >
              <div className="flex items-center gap-2">
                <Locate className="h-3.5 w-3.5 text-sky-accent" />
                <span className="text-xs font-bold text-slate-200">시스템 상태</span>
              </div>
              <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform ${panelOpen ? "rotate-180" : ""}`} />
            </button>

            {panelOpen && (
              <div className="px-3 pb-3 space-y-2">
                <StatusRow
                  icon={<Radio className="h-4 w-4 text-emerald-400" />}
                  label="SPaT 연결"
                  sub={error ? "오류" : spatData ? "정상" : "대기"}
                  valueClass={error ? "text-rose-400" : spatData ? "text-emerald-400" : "text-slate-400"}
                  detail={spatData?.ageSec != null ? `ageSec: ${spatData.ageSec.toFixed(2)}s` : undefined}
                />
                <StatusRow
                  icon={<MapPin className="h-4 w-4 text-sky-accent" />}
                  label="도로 형태"
                  sub={geoError ? "오류" : geoSource === "osm" ? "OSM 실측" : geoSource === "fallback" ? "캐시" : roadBearings ? "취득됨" : "대기"}
                  valueClass={geoError ? "text-rose-400" : geoSource === "osm" ? "text-emerald-400" : "text-slate-400"}
                  detail={geoError ?? (roadBearings ? `${roadBearings.length}방향` : undefined)}
                />
              </div>
            )}
          </div>

          {/* 신호 목록 (데이터 있을 때) */}
          {items.length > 0 && (
            <div className="glass-panel rounded-2xl p-3 space-y-2">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">신호 현황</div>
              {items.slice(0, 6).map((item) => {
                const isGo =
                  item.status === "protected-Movement-Allowed" ||
                  item.status === "permissive-Movement-Allowed";
                const isStop = item.status === "stop-And-Remain";
                return (
                  <div key={item.key ?? item.title} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ background: isGo ? "#10b981" : isStop ? "#ef4444" : "#64748b" }}
                      />
                      <span className="text-xs text-slate-300 truncate">{item.title}</span>
                    </div>
                    <span
                      className="text-xs font-bold tabular-nums shrink-0"
                      style={{ color: isGo ? "#10b981" : isStop ? "#ef4444" : "#64748b" }}
                    >
                      {item.sec != null ? `${item.sec.toFixed(1)}s` : "—"}
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
                조회 실패 {errorDetail ? `(HTTP ${errorDetail.httpStatus})` : ""}
              </div>
              <div className="text-[11px] text-rose-300/80 font-mono">
                {errorDetail?.error ?? error}
              </div>
              {errorDetail?.failedEndpoints && errorDetail.failedEndpoints.length > 0 && (
                <div className="text-[10px] text-slate-400 space-y-0.5 border-t border-white/5 pt-1.5">
                  {errorDetail.failedEndpoints.map((ep) => {
                    const errMsg = ep === "timing" ? errorDetail.timingErr : errorDetail.phaseErr;
                    return (
                      <div key={ep} className="flex gap-1.5">
                        <span className="text-rose-400/80 shrink-0">{ep}:</span>
                        <span className="text-slate-400 truncate">{errMsg ?? "—"}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </aside>

        {/* ── 모바일 신호 요약 (우상단) ── */}
        {items.length > 0 && (
          <div className="md:hidden absolute right-3 top-24 z-20 glass-panel rounded-xl p-2 space-y-1 pointer-events-none max-w-[120px]">
            {items.slice(0, 4).map((item) => {
              const isGo = item.status === "protected-Movement-Allowed" || item.status === "permissive-Movement-Allowed";
              const isStop = item.status === "stop-And-Remain";
              return (
                <div key={item.key ?? item.title} className="flex items-center justify-between gap-1.5">
                  <div className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: isGo ? "#10b981" : isStop ? "#ef4444" : "#64748b" }} />
                  <span className="text-[10px] text-slate-300 truncate flex-1">{item.title}</span>
                  <span className="text-[10px] font-bold tabular-nums shrink-0" style={{ color: isGo ? "#10b981" : isStop ? "#ef4444" : "#64748b" }}>
                    {item.sec != null ? `${Math.round(item.sec)}s` : "—"}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* ── 좌측 하단 컨트롤 ── */}
        <div className="absolute bottom-5 left-4 z-20 flex flex-col gap-2">
          <div className="glass-panel rounded-xl p-1.5 flex flex-col gap-1">
            <Link href="/quick" className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 transition-colors text-xs font-bold">
              Q
            </Link>
            <div className="h-px bg-white/10 mx-1" />
            <Link href="/" className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 transition-colors text-xs font-bold">
              ≡
            </Link>
          </div>
        </div>

        {/* ── 하단 정보바 ── */}
        {spatData && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 max-w-[90vw]">
            <div className="glass-panel rounded-full px-4 py-1.5 flex items-center gap-3 text-[11px] text-slate-400 whitespace-nowrap overflow-hidden">
              <span className="font-semibold text-slate-300 truncate max-w-[120px]">{spatData.itstNm ?? itstId}</span>
              {spatData.fetchedAtKst && <span className="hidden sm:inline">{spatData.fetchedAtKst}</span>}
              {spatData.ageSec != null && (
                <span className={spatData.isStale ? "text-rose-400" : "text-emerald-400"}>
                  {spatData.ageSec.toFixed(2)}s
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ── 상태 행 컴포넌트 ────────────────────────────────────────
function StatusRow({
  icon, label, sub, valueClass, detail,
}: {
  icon: React.ReactNode;
  label: string;
  sub: string;
  valueClass: string;
  detail?: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-navy-900/50 border border-white/5 px-2.5 py-2 gap-2">
      <div className="flex items-center gap-2">
        <div className="bg-white/5 p-1.5 rounded-lg">{icon}</div>
        <div>
          <div className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">{label}</div>
          <div className="text-xs font-bold text-white">{label}</div>
        </div>
      </div>
      <div className="text-right">
        <div className={`text-xs font-bold ${valueClass}`}>{sub}</div>
        {detail && <div className="text-[9px] text-slate-500">{detail}</div>}
      </div>
    </div>
  );
}
