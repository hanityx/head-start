import { useCallback, useEffect, useRef, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useSpat } from "@/hooks/useSpat";
import { useLocationBootstrap } from "@/hooks/useLocationBootstrap";
import { DEFAULT_ITST_ID } from "@/lib/defaults";
import type { NearbyItem, SpatItem } from "@/lib/types";

const DEFAULT_TIMEOUT_MS = "25000";
const AUTO_REFRESH_MS = 3000;
const NEARBY_SUGGEST_COUNT = 5;
const sanitizeDigits = (raw: string) => raw.replace(/\D/g, "");

const DIR_LETTER: Record<string, string> = {
  nt: "N", st: "S", et: "E", wt: "W",
  ne: "NE", nw: "NW", se: "SE", sw: "SW",
};

const DEV_PHASE_ALLOWLIST_BY_ITST: Record<string, Set<string>> = {
  "1560": new Set(["etStsgStatNm", "wtStsgStatNm"]),
};
const DEV_PHASE_LOCK_ENABLED = process.env.NEXT_PUBLIC_DEV_PHASE_LOCK === "1";

function SignalCard({ item }: { item: SpatItem }) {
  const isGo = item.status === "protected-Movement-Allowed";
  const letter = DIR_LETTER[item.dirCode ?? ""] ?? (item.dirCode?.charAt(0)?.toUpperCase() ?? "?");
  const sec = item.sec != null ? Math.round(item.sec) : null;

  return (
    <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 relative overflow-hidden">
      <div className="absolute left-0 top-0 h-full w-1.5" style={{ background: isGo ? "#10b981" : "#f43f5e" }} />
      <div style={{ paddingLeft: 4 }}>
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center font-black text-slate-400 text-sm select-none">
              {letter}
            </div>
            <h4 className="font-bold text-lg text-slate-900 leading-tight">{item.title}</h4>
          </div>
          <span
            className="material-symbols-outlined text-2xl"
            style={{ color: isGo ? "#10b981" : "#f43f5e", fontVariationSettings: "'FILL' 1" }}
          >
            {isGo ? "check_circle" : "do_not_disturb_on"}
          </span>
        </div>
        <div className="flex items-end justify-between">
          <div className="flex flex-col">
            <span className="text-xs text-slate-400 mb-1 font-medium">{isGo ? "남은 시간" : "대기 시간"}</span>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-black" style={{ color: "#0f172a", opacity: isGo ? 1 : 0.35 }}>
                {sec !== null ? String(sec).padStart(2, "0") : "--"}
              </span>
              <span className="text-sm font-bold text-slate-400">초</span>
            </div>
          </div>
          <div
            className="px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-1.5"
            style={{ background: isGo ? "rgba(16,185,129,0.1)" : "rgba(244,63,94,0.1)", color: isGo ? "#059669" : "#f43f5e" }}
          >
            <span className="material-symbols-outlined text-lg">{isGo ? "directions_walk" : "front_hand"}</span>
            {isGo ? "보행 가능" : "보행 정지"}
          </div>
        </div>
      </div>
    </div>
  );
}

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function useInstallPrompt() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIos, setIsIos] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setIsIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    setIsStandalone(window.matchMedia("(display-mode: standalone)").matches);
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const triggerInstall = useCallback(async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  }, [installPrompt]);

  return { installPrompt, isIos, isStandalone, triggerInstall };
}

export default function QuickPage() {
  const [itstId, setItstId] = useState(DEFAULT_ITST_ID);
  const [autoFetchOnce, setAutoFetchOnce] = useState(false);
  const [isAuto, setIsAuto] = useState(false);
  const [itstNameHint, setItstNameHint] = useState("");
  const [nearbyItems, setNearbyItems] = useState<NearbyItem[]>([]);
  const [showNearby, setShowNearby] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { installPrompt, isIos, isStandalone, triggerInstall } = useInstallPrompt();

  const { spatData, error, isLoading, fetchSpat } = useSpat({ itstId, timeoutMs: DEFAULT_TIMEOUT_MS });
  const {
    loading: nearbyLoading,
    gpsLoading,
    error: nearbyError,
    status: nearbyStatus,
    bootstrapByIp,
    bootstrapByGps,
  } = useLocationBootstrap(NEARBY_SUGGEST_COUNT);

  const applyNearbyItems = useCallback((items: NearbyItem[]) => {
    setNearbyItems(items);
    if (!items.length) return;
    const nearest = items[0];
    setItstId(nearest.itstId);
    setItstNameHint(nearest.itstNm ?? "");
    localStorage.setItem("lastItstId", nearest.itstId);
    setShowNearby(true);
  }, []);

  const selectNearby = (item: NearbyItem) => {
    setItstId(item.itstId);
    setItstNameHint(item.itstNm ?? "");
    localStorage.setItem("lastItstId", item.itstId);
    setAutoFetchOnce(true);
  };

  const handleUseCurrentLocation = async () => {
    const result = await bootstrapByGps();
    if (result.items.length > 0) {
      applyNearbyItems(result.items);
      setAutoFetchOnce(true);
    }
  };

  const runIpBasedBootstrap = useCallback(async () => {
    const result = await bootstrapByIp();
    if (result.items.length > 0) applyNearbyItems(result.items);
  }, [bootstrapByIp, applyNearbyItems]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let active = true;
    const boot = async () => {
      const params = new URLSearchParams(window.location.search);
      const fromQuery = sanitizeDigits(params.get("itstId") ?? "");
      const fromStorage = sanitizeDigits(localStorage.getItem("lastItstId") ?? "");
      const shouldAuto = params.get("auto") === "1";
      const nextId = fromQuery || fromStorage || DEFAULT_ITST_ID;
      setItstId(nextId);
      localStorage.setItem("lastItstId", nextId);
      if (fromQuery || fromStorage) { if (shouldAuto) setAutoFetchOnce(true); return; }
      await runIpBasedBootstrap();
      if (active && shouldAuto) setAutoFetchOnce(true);
    };
    void boot();
    return () => { active = false; };
  }, [runIpBasedBootstrap]);

  useEffect(() => {
    if (typeof window === "undefined" || !itstId.trim()) return;
    localStorage.setItem("lastItstId", itstId);
  }, [itstId]);

  useEffect(() => {
    if (!spatData || spatData.itstId !== itstId) return;
    if (spatData.itstNm) setItstNameHint(spatData.itstNm);
  }, [itstId, spatData]);

  useEffect(() => {
    if (!autoFetchOnce || !itstId.trim()) return;
    void fetchSpat(); setAutoFetchOnce(false);
  }, [autoFetchOnce, fetchSpat, itstId]);

  useEffect(() => {
    if (!isAuto) { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } return; }
    void fetchSpat();
    timerRef.current = setInterval(() => { void fetchSpat(); }, AUTO_REFRESH_MS);
    return () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };
  }, [fetchSpat, isAuto]);

  const activeName = (spatData?.itstId === itstId ? spatData.itstNm : null) || nearbyItems.find((it) => it.itstId === itstId)?.itstNm || itstNameHint || "";
  const staleBlocked = Boolean(spatData?.isStale);
  const filteredItems = (() => {
    const items = spatData?.items ?? [];
    if (!DEV_PHASE_LOCK_ENABLED) return items;
    const allow = DEV_PHASE_ALLOWLIST_BY_ITST[itstId.trim()];
    if (!allow) return items;
    return items.filter((it) => !!it.phaseKey && allow.has(String(it.phaseKey)));
  })();
  const goCount = filteredItems.filter((it) => it.status === "protected-Movement-Allowed").length;

  return (
    <>
      <Head>
        <title>{activeName ? `${activeName} · 신호` : "신호 조회"}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>

      <div className="min-h-dvh flex flex-col" style={{ background: "#f3f4f6", maxWidth: 480, margin: "0 auto" }}>

        {/* 헤더 */}
        <header className="bg-white border-b border-slate-100 px-6 pt-10 pb-4 sticky top-0 z-20">
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest">현재 교차로</span>
              <h1 className="text-xl font-black text-slate-900 leading-tight mt-0.5">{activeName || "교차로 선택"}</h1>
            </div>
            <button
              onClick={() => setIsAuto((v) => !v)}
              className="w-9 h-9 rounded-full flex items-center justify-center"
              style={{ background: isAuto ? "rgba(16,185,129,0.1)" : "rgba(0,0,0,0.04)", color: isAuto ? "#059669" : "#94a3b8" }}
            >
              <span className="material-symbols-outlined text-xl">{isAuto ? "pause_circle" : "play_circle"}</span>
            </button>
          </div>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xl pointer-events-none">tag</span>
            <input
              value={itstId}
              onChange={(e) => { setItstId(sanitizeDigits(e.target.value)); setItstNameHint(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") void fetchSpat(); }}
              placeholder="교차로 ID 입력..."
              className="w-full pl-11 pr-20 py-3 bg-gray-50 border border-slate-200 rounded-2xl text-sm font-medium outline-none"
            />
            <button
              onClick={() => void fetchSpat()}
              disabled={isLoading}
              className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-xl text-xs font-bold"
              style={{ background: "#ec5b13", color: "#fff", opacity: isLoading ? 0.6 : 1 }}
            >
              {isLoading ? "조회 중" : "조회"}
            </button>
          </div>
        </header>

        {/* PWA 설치 배너 */}
        {!isStandalone && installPrompt && (
          <div className="px-6 py-3 bg-orange-50 border-b border-orange-100 flex items-center justify-between">
            <span className="text-sm text-orange-700 font-medium">홈 화면에 추가하면 더 빠르게 열 수 있어요</span>
            <button
              onClick={() => void triggerInstall()}
              className="ml-3 px-3 py-1.5 rounded-xl text-xs font-bold text-white"
              style={{ background: "#ec5b13" }}
            >
              앱 설치
            </button>
          </div>
        )}
        {!isStandalone && isIos && !installPrompt && (
          <div className="px-6 py-3 bg-slate-50 border-b border-slate-100 text-xs text-slate-500 text-center">
            iPhone/iPad: Safari 공유 버튼 → 홈 화면에 추가
          </div>
        )}

        {/* 메인 */}
        <main className="flex-1 overflow-y-auto px-6 pt-4 pb-28 space-y-4">

          {/* LIVE STATUS */}
          <div className="rounded-3xl p-5 text-white relative overflow-hidden" style={{ background: "linear-gradient(135deg,#1e293b,#0f172a)" }}>
            <div className="absolute right-0 top-0 w-32 h-32 rounded-full blur-2xl -mr-10 -mt-10" style={{ background: "rgba(255,255,255,0.05)" }} />
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-2">
                <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-widest uppercase" style={{ background: "rgba(255,255,255,0.15)" }}>Live Status</span>
                {staleBlocked ? (
                  <span className="text-xs font-semibold text-yellow-400">데이터 지연</span>
                ) : spatData ? (
                  <div className="flex items-center gap-1.5">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative rounded-full h-2.5 w-2.5 bg-emerald-500" />
                    </span>
                    <span className="text-xs font-semibold text-emerald-400">실시간 수신 중</span>
                  </div>
                ) : null}
              </div>
              <h2 className="text-lg font-bold mb-1">안전 보행 가이드</h2>
              <p className="text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>
                {filteredItems.length ? <><span style={{ color: "#34d399", fontWeight: 700 }}>{goCount}개 방향</span> 보행 가능</> : isLoading ? "신호 조회 중..." : "조회 버튼을 눌러주세요"}
              </p>
            </div>
          </div>

          {error && <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 text-sm text-red-600 font-medium">{error}</div>}
          {staleBlocked && <div className="bg-yellow-50 border border-yellow-200 rounded-2xl px-4 py-3 text-sm text-yellow-700 font-medium">실시간성 미달 — ageSec {spatData?.ageSec?.toFixed(1)}s 초과</div>}

          {/* 신호 카드 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">방향별 신호</h3>
              {spatData?.fetchedAtKst && <span className="text-[10px] text-slate-400">{spatData.fetchedAtKst.slice(11, 19)}</span>}
            </div>
            {isLoading && !filteredItems.length && (
              [1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 animate-pulse" style={{ height: 128 }} />
              ))
            )}
            {!staleBlocked && filteredItems.map((item: SpatItem) => (
              <SignalCard key={item.key ?? item.phaseKey ?? item.title} item={item} />
            ))}
            {!filteredItems.length && !isLoading && !error && (
              <div className="bg-white rounded-3xl p-8 text-center shadow-sm border border-slate-100">
                <span className="material-symbols-outlined text-4xl text-slate-200">traffic</span>
                <p className="text-slate-400 mt-3 text-sm font-medium">교차로 ID를 입력 후 조회하세요</p>
              </div>
            )}
          </div>

          {/* 주변 교차로 */}
          <div>
            {/* 위치 버튼 — 항상 노출 */}
            <div className="flex gap-2 mb-2">
              <button onClick={() => void handleUseCurrentLocation()} disabled={gpsLoading || nearbyLoading}
                className="flex-1 py-2.5 bg-white rounded-2xl border border-slate-200 text-sm font-semibold text-slate-700 flex items-center justify-center gap-1.5 disabled:opacity-50">
                <span className="material-symbols-outlined text-base" style={{ color: "#ec5b13" }}>my_location</span>
                {gpsLoading ? "확인 중..." : "현재 위치"}
              </button>
              <button onClick={() => void runIpBasedBootstrap()} disabled={nearbyLoading || gpsLoading}
                className="flex-1 py-2.5 bg-white rounded-2xl border border-slate-200 text-sm font-semibold text-slate-700 flex items-center justify-center gap-1.5 disabled:opacity-50">
                <span className="material-symbols-outlined text-base" style={{ color: "#ec5b13" }}>location_searching</span>
                {nearbyLoading ? "찾는 중..." : "대략 위치"}
              </button>
            </div>
            {nearbyStatus && <p className="text-xs text-slate-500 px-1 mb-1">{nearbyStatus}</p>}
            {nearbyError && <p className="text-xs text-red-500 px-1 mb-1">{nearbyError}</p>}

            {/* 주변 목록 — 접기/펼치기 */}
            {nearbyItems.length > 0 && (
              <>
                <button onClick={() => setShowNearby((v) => !v)} className="w-full flex items-center justify-between px-1 py-2">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">주변 교차로</h3>
                  <span className="material-symbols-outlined text-slate-400 text-sm">{showNearby ? "expand_less" : "expand_more"}</span>
                </button>
                {showNearby && (
                  <div className="space-y-2 mt-1">
                    {nearbyItems.map((item) => (
                      <button key={item.itstId} onClick={() => selectNearby(item)}
                        className="w-full flex items-center justify-between p-4 rounded-2xl border text-left"
                        style={{ background: item.itstId === itstId ? "#fff7ed" : "#fff", borderColor: item.itstId === itstId ? "#fed7aa" : "#f1f5f9" }}>
                        <div>
                          <div className="font-bold text-sm" style={{ color: item.itstId === itstId ? "#c2410c" : "#0f172a" }}>{item.itstNm}</div>
                          <div className="text-xs text-slate-400 mt-0.5">ID {item.itstId}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold text-slate-600">
                            {item.distanceM >= 1000 ? `${(item.distanceM / 1000).toFixed(1)}km` : `${Math.round(item.distanceM)}m`}
                          </div>
                          <div className="text-[10px] text-slate-400">직선 거리</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </main>

        {/* 하단 내비 */}
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 px-6 py-2 z-30"
          style={{ maxWidth: 480, margin: "0 auto", boxShadow: "0 -4px 20px rgba(0,0,0,0.05)", paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}>
          <div className="flex justify-between items-center">
            <Link href="/" className="flex flex-col items-center gap-1 p-2 flex-1 text-slate-400 hover:text-orange-500 transition-colors">
              <span className="material-symbols-outlined text-2xl">home</span>
              <span className="text-[10px] font-bold">홈</span>
            </Link>
            <div className="flex flex-col items-center gap-1 p-2 flex-1" style={{ color: "#ec5b13" }}>
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center -mt-8 mb-1"
                style={{ background: "#ec5b13", boxShadow: "0 8px 20px rgba(236,91,19,0.35)" }}>
                <span className="material-symbols-outlined text-white text-2xl">traffic</span>
              </div>
              <span className="text-[10px] font-bold">신호</span>
            </div>
            <Link href={`/view?itstId=${itstId}&auto=1`} className="flex flex-col items-center gap-1 p-2 flex-1 text-slate-400 hover:text-orange-500 transition-colors">
              <span className="material-symbols-outlined text-2xl">map</span>
              <span className="text-[10px] font-bold">지도</span>
            </Link>
          </div>
        </nav>
      </div>
    </>
  );
}
