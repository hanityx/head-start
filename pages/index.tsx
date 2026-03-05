import { useCallback, useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import type { NearbyItem } from "@/lib/types";
import { useLocationBootstrap } from "@/hooks/useLocationBootstrap";

const NEARBY_K = 10;
const SEOUL_CENTER = { lat: 37.5665, lon: 126.9780 };

const ONBOARDING_STORAGE_KEY = "onboarding:v1";
const ONBOARDING_COOKIE_KEY = "onboarding_v1";
const ONBOARDING_DONE_VALUE = "done";
const ONBOARDING_COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 365 * 2;

const readCookie = (key: string) => {
  if (typeof document === "undefined") return null;
  const encodedKey = `${encodeURIComponent(key)}=`;
  const found = document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith(encodedKey));
  if (!found) return null;
  return decodeURIComponent(found.slice(encodedKey.length));
};

const writeCookie = (key: string, value: string, maxAgeSec: number) => {
  if (typeof document === "undefined") return;
  document.cookie = `${encodeURIComponent(key)}=${encodeURIComponent(
    value,
  )}; path=/; max-age=${maxAgeSec}; samesite=lax`;
};

const hasCompletedOnboarding = () => {
  if (typeof window === "undefined") return true;
  const localDone =
    localStorage.getItem(ONBOARDING_STORAGE_KEY) === ONBOARDING_DONE_VALUE;
  const cookieDone = readCookie(ONBOARDING_COOKIE_KEY) === ONBOARDING_DONE_VALUE;

  if (!localDone && cookieDone) {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, ONBOARDING_DONE_VALUE);
  }
  if (localDone && !cookieDone) {
    writeCookie(
      ONBOARDING_COOKIE_KEY,
      ONBOARDING_DONE_VALUE,
      ONBOARDING_COOKIE_MAX_AGE_SEC,
    );
  }

  return localDone || cookieDone;
};

const HOME_TOUR_STEPS_DESKTOP: TourStep[] = [
  {
    selector: '[data-tour="signal-input"]',
    title: "교차로 ID를 먼저 확인하세요",
    description: "여기서 ID를 직접 입력하거나, 오른쪽 주변 교차로 목록 선택으로 자동 입력할 수 있습니다.",
  },
  {
    selector: '[data-tour="signal-fetch"]',
    title: "조회 버튼으로 즉시 확인",
    description: "조회 버튼을 누르면 현재 신호 상태와 잔여시간을 바로 가져옵니다.",
  },
  {
    selector: '[data-tour="signal-auto"]',
    title: "자동 갱신으로 계속 보기",
    description: "같은 교차로를 계속 볼 때 자동 갱신을 켜면 일정 주기마다 값을 다시 받아옵니다.",
  },
  {
    selector: '[data-tour="nearby-location"]',
    title: "주소/현재 위치로 탐색",
    description: "위치 정하기에서 주소 검색 또는 현재 위치 버튼으로 주변 교차로를 빠르게 찾을 수 있습니다.",
  },
  {
    selector: '[data-tour="nearby-select"]',
    title: "목록에서 바로 조회 연결",
    description: "교차로 선택 영역에서 이 ID로 조회를 누르면 입력창과 조회가 한 번에 연결됩니다.",
  },
];

const HOME_TOUR_STEPS_MOBILE: TourStep[] = [
  {
    selector: '[data-tour="signal-input"]',
    title: "교차로 ID",
    description: "왼쪽(모바일은 위) 입력창에 ID를 넣거나, 주변 목록 선택으로 자동 입력하세요.",
  },
  {
    selector: '[data-tour="signal-fetch"]',
    title: "조회",
    description: "조회 버튼으로 현재 신호 상태와 남은 시간을 바로 확인합니다.",
  },
  {
    selector: '[data-tour="signal-auto"]',
    title: "자동 갱신",
    description: "계속 볼 때 자동 갱신을 켜면 주기적으로 업데이트됩니다.",
  },
  {
    selector: '[data-tour="nearby-location"]',
    title: "위치 선택",
    description: "주소 검색 또는 현재 위치로 주변 교차로를 찾습니다.",
  },
  {
    selector: '[data-tour="nearby-select"]',
    title: "목록에서 조회 연결",
    description: "목록의 이 ID로 조회를 누르면 입력과 조회가 바로 연결됩니다.",
  },
];

export default function Home() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [nearbyItems, setNearbyItems] = useState<NearbyItem[]>([]);
  const [locationLabel, setLocationLabel] = useState("");
  const [sortBy, setSortBy] = useState<"distance" | "name">("distance");
  const [searchResults, setSearchResults] = useState<NearbyItem[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);

  const { loading, gpsLoading, error, status, fetchNearby, bootstrapByIp, bootstrapByGps } =
    useLocationBootstrap(NEARBY_K);

  const handleUseGps = async () => {
    const result = await bootstrapByGps();
    if (result.items.length > 0) {
      setNearbyItems(result.items);
      setLocationLabel("현재 위치");
    }
  };

  // 검색 debounce
  useEffect(() => {
    const q = query.trim();
    if (!q) { setSearchResults(null); return; }
    setSearchLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search-intersections?q=${encodeURIComponent(q)}`);
        const json = (await res.json()) as { items?: NearbyItem[] };
        setSearchResults(Array.isArray(json.items) ? json.items : []);
      } catch { setSearchResults([]); }
      finally { setSearchLoading(false); }
    }, 250);
    return () => { clearTimeout(timer); setSearchLoading(false); };
  }, [query]);

  // 마운트 시 IP → 서울 fallback 부트스트랩
  useEffect(() => {
    const boot = async () => {
      const result = await bootstrapByIp();
      if (result.items.length > 0) {
        setNearbyItems(result.items);
        setLocationLabel(result.label ?? "");
        return;
      }
      // IP 실패 시 서울 중심부 fallback
      try {
        const items = await fetchNearby(SEOUL_CENTER.lat, SEOUL_CENTER.lon);
        setNearbyItems(items);
        setLocationLabel("서울 전체");
      } catch { /* error already shown by bootstrapByIp */ }
    };
    void boot();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const displayItems = (() => {
    let items = searchResults !== null ? searchResults : [...nearbyItems];
    if (sortBy === "name") items.sort((a, b) => a.itstNm.localeCompare(b.itstNm, "ko"));
    return items;
  })();

  const goToSignal = (item: NearbyItem) => {
    if (typeof window !== "undefined") localStorage.setItem("lastItstId", item.itstId);
    void router.push(`/view?itstId=${item.itstId}&auto=1`);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (typeof window.matchMedia !== "function") return;
    const mediaQuery = window.matchMedia("(max-width: 640px)");
    const apply = () => {
      setIsMobileViewport(mediaQuery.matches);
    };
    apply();
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", apply);
    } else {
      mediaQuery.addListener(apply);
    }
    return () => {
      if (typeof mediaQuery.removeEventListener === "function") {
        mediaQuery.removeEventListener("change", apply);
      } else {
        mediaQuery.removeListener(apply);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (process.env.NODE_ENV === "test") return;
    const completed = hasCompletedOnboarding();
    if (completed) return;
    const timer = window.setTimeout(() => {
      setTourRestartKey((prev) => prev + 1);
      setIsTourOpen(true);
    }, 350);
    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  const handleItstIdChange = (value: string) => {
    setItstId(value);
    setAllowAutoNearest(false);
  };

  const handleSelectItstIdAndFetch = (value: string) => {
    setItstId(value);
    setAllowAutoNearest(false);
    setExternalFetchTrigger((prev) => prev + 1);
  };

  const markTourCompleted = useCallback(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(ONBOARDING_STORAGE_KEY, ONBOARDING_DONE_VALUE);
    writeCookie(
      ONBOARDING_COOKIE_KEY,
      ONBOARDING_DONE_VALUE,
      ONBOARDING_COOKIE_MAX_AGE_SEC,
    );
  }, []);

  const handleOpenTour = () => {
    setTourRestartKey((prev) => prev + 1);
    setIsTourOpen(true);
  };

  const handleCloseTour = useCallback(() => {
    setIsTourOpen(false);
    markTourCompleted();
  }, [markTourCompleted]);

  const handleCompleteTour = useCallback(() => {
    setIsTourOpen(false);
    markTourCompleted();
  }, [markTourCompleted]);

  const tourSteps = isMobileViewport
    ? HOME_TOUR_STEPS_MOBILE
    : HOME_TOUR_STEPS_DESKTOP;

  return (
    <>
      <Head>
        <title>지능형 보행 신호 안내</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="min-h-screen relative" style={{ background: "#020617" }}>
        {/* 그리드 배경 */}
        <div className="fixed inset-0 pointer-events-none" style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.03) 1px,transparent 1px)",
          backgroundSize: "40px 40px",
        }} />
        <div className="fixed inset-0 pointer-events-none" style={{
          background: "linear-gradient(to bottom, rgba(2,6,23,0.9) 0%, rgba(2,6,23,0.8) 50%, rgba(2,6,23,0.9) 100%)",
        }} />

        {/* 헤더 */}
        <header className="relative z-10 w-full h-20 border-b flex items-center justify-between px-6 lg:px-12"
          style={{ borderColor: "rgba(255,255,255,0.05)", background: "rgba(2,6,23,0.5)", backdropFilter: "blur(12px)" }}>
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-3xl" style={{ color: "#38bdf8" }}>traffic</span>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight leading-none">지능형 보행 신호 안내</h1>
              <span className="text-xs font-medium mt-1" style={{ color: "#64748b" }}>Smart Pedestrian Signal</span>
            </div>
          </div>

          {/* 데스크톱 검색 */}
          <div className="flex-1 max-w-2xl mx-8 hidden md:block">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "#64748b" }}>search</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="교차로 이름 또는 ID로 검색..."
                className="w-full pl-12 pr-4 py-3 rounded-xl text-sm text-slate-200 placeholder-slate-500 outline-none transition-all"
                style={{ background: "rgba(15,23,42,0.5)", border: "1px solid rgba(255,255,255,0.1)" }}
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={() => void handleUseGps()} disabled={gpsLoading}
              className="hidden md:flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
              style={{ color: "#94a3b8" }}>
              <span className="material-symbols-outlined text-base" style={{ color: "#38bdf8" }}>my_location</span>
              {gpsLoading ? "확인 중..." : "현재 위치"}
            </button>
          </div>
        </header>

        {/* 모바일 검색 */}
        <div className="md:hidden px-4 py-3 relative z-10 border-b" style={{ borderColor: "rgba(255,255,255,0.05)", background: "rgba(2,6,23,0.5)", backdropFilter: "blur(12px)" }}>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">search</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="교차로 검색..."
              className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm text-slate-200 placeholder-slate-500 outline-none"
              style={{ background: "rgba(15,23,42,0.5)", border: "1px solid rgba(255,255,255,0.1)" }}
            />
          </div>
        </div>

        {/* 메인 */}
        <main className="relative z-10 container mx-auto px-4 lg:px-12 py-8 max-w-4xl pb-20">

          {/* 주변 교차로 헤더 */}
          <div className="mb-4 px-1 sticky top-0 py-2 z-20"
            style={{ background: "rgba(2,6,23,0.8)", backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-1">
              <div className="flex items-center justify-between md:justify-start md:gap-4">
                <h2 className="text-base font-bold text-white">주변 교차로</h2>
                <div className="flex items-center p-1 rounded-lg border" style={{ background: "rgba(30,41,59,1)", borderColor: "rgba(255,255,255,0.05)" }}>
                  <button onClick={() => setSortBy("distance")}
                    className="px-3 py-1 text-xs font-bold rounded transition-all"
                    style={{ background: sortBy === "distance" ? "#38bdf8" : "transparent", color: sortBy === "distance" ? "#020617" : "#64748b" }}>
                    가까운 순
                  </button>
                  <button onClick={() => setSortBy("name")}
                    className="px-3 py-1 text-xs font-medium rounded transition-all"
                    style={{ color: sortBy === "name" ? "#e2e8f0" : "#64748b" }}>
                    이름 순
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-end gap-1.5 text-xs" style={{ color: "#64748b" }}>
                <span className="material-symbols-outlined text-sm">my_location</span>
                <span className="truncate max-w-[200px]">{locationLabel || (loading ? "위치 확인 중..." : "위치 미확인")}</span>
                <button onClick={() => void handleUseGps()} disabled={gpsLoading} className="md:hidden disabled:opacity-50">
                  <span className="material-symbols-outlined text-sm" style={{ color: "#38bdf8" }}>gps_fixed</span>
                </button>
              </div>
            </div>
          </div>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-xl text-sm font-medium" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#fca5a5" }}>
              {error}
            </div>
          )}
          {status && (
            <div className="mb-4 px-4 py-3 rounded-xl text-sm" style={{ background: "rgba(56,189,248,0.08)", border: "1px solid rgba(56,189,248,0.15)", color: "#7dd3fc" }}>
              {status}
            </div>
          )}

          {/* 교차로 목록 */}
          <div className="flex flex-col gap-3">
            {(loading && !nearbyItems.length) || searchLoading ? (
              [...Array(3)].map((_, i) => (
                <div key={i} className="rounded-xl p-4 animate-pulse" style={{ background: "rgba(15,23,42,0.75)", border: "1px solid rgba(255,255,255,0.06)", height: 72 }} />
              ))
            ) : null}

            {displayItems.map((item) => (
              <button
                key={item.itstId}
                onClick={() => goToSignal(item)}
                className="rounded-xl p-4 flex items-center justify-between text-left group transition-colors w-full"
                style={{ background: "rgba(15,23,42,0.75)", border: "1px solid rgba(255,255,255,0.06)", backdropFilter: "blur(12px)" }}
              >
                <div className="flex items-center gap-4 flex-1">
                  <div className="h-12 w-12 rounded-full flex items-center justify-center flex-shrink-0 transition-all"
                    style={{ background: "rgba(30,41,59,1)", border: "1px solid rgba(255,255,255,0.05)" }}>
                    <span className="material-symbols-outlined" style={{ color: "#64748b" }}>traffic</span>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white group-hover:text-sky-400 transition-colors">{item.itstNm}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium"
                        style={{ background: "rgba(30,41,59,1)", color: "#38bdf8", border: "1px solid rgba(56,189,248,0.2)" }}>
                        ID {item.itstId}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className="block text-lg font-bold text-white">
                    {item.distanceM >= 1000 ? `${(item.distanceM / 1000).toFixed(1)}km` : `${Math.round(item.distanceM)}m`}
                  </span>
                  <span className="text-[10px]" style={{ color: "#475569" }}>직선 거리</span>
                </div>
              </button>
            ))}

            {!loading && !displayItems.length && nearbyItems.length > 0 && (
              <div className="text-center py-10 text-slate-500 text-sm">검색 결과가 없습니다.</div>
            )}
          </div>
        </main>

        {/* 지도 보기 FAB */}
        <div className="fixed bottom-6 right-6 z-50">
          <Link href="/view"
            className="flex items-center gap-2 font-bold text-sm px-5 py-3.5 rounded-full transition-all"
            style={{ background: "#38bdf8", color: "#020617", boxShadow: "0 0 20px rgba(56,189,248,0.35)" }}>
            <span className="material-symbols-outlined text-xl">map</span>
            <span className="hidden md:inline">지도 보기</span>
          </Link>
        </div>
      </div>

      <OnboardingTour
        open={isTourOpen}
        steps={tourSteps}
        restartKey={tourRestartKey}
        onClose={handleCloseTour}
        onComplete={handleCompleteTour}
      />
    </>
  );
}
