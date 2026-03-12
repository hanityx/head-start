import { useCallback, useEffect, useRef, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { Search, RefreshCw, Zap, Satellite, ChevronDown, Locate, Radio, MapPin } from "lucide-react";
import type { NearbyItem } from "@/lib/types";
import { useLocationBootstrap } from "@/hooks/useLocationBootstrap";
import { useSpat } from "@/hooks/useSpat";
import { IntersectionView } from "@/components/IntersectionView";
import { BearingVerifyMap } from "@/components/BearingVerifyMap";
import { OnboardingTour } from "@/components/OnboardingTour";
import type { TourStep } from "@/components/OnboardingTour";
import { haversineMeters, computeBearing } from "@/lib/utils";

const NEARBY_K = 10;
const DEFAULT_ITST_ID = "1954";
const SEOUL_CENTER = { lat: 37.5665, lon: 126.9780 };
const AUTO_REFRESH_MS = 3000;

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
  if (!localDone && cookieDone) localStorage.setItem(ONBOARDING_STORAGE_KEY, ONBOARDING_DONE_VALUE);
  if (localDone && !cookieDone) writeCookie(ONBOARDING_COOKIE_KEY, ONBOARDING_DONE_VALUE, ONBOARDING_COOKIE_MAX_AGE_SEC);
  return localDone || cookieDone;
};

const firstQueryValue = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

const parseFlag = (value: string | string[] | undefined) => {
  const raw = firstQueryValue(value);
  if (!raw) return null;
  const normalized = raw.toLowerCase();
  if (["1", "true", "on", "yes"].includes(normalized)) return true;
  if (["0", "false", "off", "no"].includes(normalized)) return false;
  return null;
};

const sanitizeDigits = (value: string) => value.replace(/\D+/g, "");

function bearingToArrow(deg: number): string {
  const arrows = ["↑", "↗", "→", "↘", "↓", "↙", "←", "↖"];
  return arrows[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
}

const HOME_TOUR_STEPS_DESKTOP: TourStep[] = [
  {
    selector: '[data-tour="sidebar-toggle"]',
    title: "교차로를 선택하세요",
    description: "클릭하면 주변 교차로 목록과 검색창이 열립니다.",
  },
];

const HOME_TOUR_STEPS_MOBILE: TourStep[] = [
  {
    selector: '[data-tour="sidebar-toggle"]',
    title: "교차로 선택",
    description: "탭하면 주변 교차로 목록이 열립니다.",
  },
];

export default function Home() {
  const router = useRouter();
  const [itstId, setItstId] = useState<string>(DEFAULT_ITST_ID);
  const [itstNm, setItstNm] = useState<string | null>(null);
  const [roadBearings, setRoadBearings] = useState<number[] | undefined>(undefined);
  const [autoFetch, setAutoFetch] = useState(false);

  // 신호 컨트롤 상태
  const [isAuto, setIsAuto] = useState(false);
  const [verifyMode, setVerifyMode] = useState(false);
  const [userGps, setUserGps] = useState<{ lat: number; lon: number } | null>(null);
  const [geoSource, setGeoSource] = useState<"osm" | "fallback" | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [metaCoords, setMetaCoords] = useState<{ lat: number; lon: number; itstNm: string | null } | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const geoFetchedForRef = useRef<string | null>(null);

  // 검색 오버레이 상태
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [nearbyItems, setNearbyItems] = useState<NearbyItem[]>([]);
  const [locationLabel, setLocationLabel] = useState("");
  const [sortBy, setSortBy] = useState<"distance" | "name">("distance");
  const [searchResults, setSearchResults] = useState<NearbyItem[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [isTourOpen, setIsTourOpen] = useState(false);
  const [tourRestartKey, setTourRestartKey] = useState(0);
  const restoredSelectionRef = useRef<string | null>(null);
  const nearbySelectionResolvedRef = useRef(false);
  const initialRouteAppliedRef = useRef(false);

  const { loading, gpsLoading, fetchNearby, bootstrapByIp, bootstrapByGps } =
    useLocationBootstrap(NEARBY_K);

  const { spatData, error, errorDetail, isLoading: spatLoading, fetchSpat } = useSpat({
    itstId,
    timeoutMs: "25000",
  });

  // 1) 마지막 교차로 meta 로드
  useEffect(() => {
    if (!router.isReady || initialRouteAppliedRef.current) return;
    initialRouteAppliedRef.current = true;

    const queryItstId = sanitizeDigits(firstQueryValue(router.query.itstId) ?? "");
    const queryAuto = parseFlag(router.query.auto);
    const queryVerify = parseFlag(router.query.verify);
    const savedId =
      typeof window !== "undefined"
        ? (localStorage.getItem("lastItstId") ?? DEFAULT_ITST_ID)
        : DEFAULT_ITST_ID;
    const initialId = queryItstId || savedId;

    restoredSelectionRef.current = initialId || null;
    if (queryItstId) nearbySelectionResolvedRef.current = true;
    if (queryAuto !== null) setIsAuto(queryAuto);
    if (queryVerify !== null) setVerifyMode(queryVerify);
    setItstId(initialId);
    setAutoFetch(true);
    if (typeof window !== "undefined") localStorage.setItem("lastItstId", initialId);

    fetch(`/api/itst-meta?itstId=${initialId}`)
      .then((r) => r.json())
      .then((data: { lat: number | null; lon: number | null; itstNm: string | null }) => {
        if (data.itstNm) setItstNm(data.itstNm);
        if (data.lat && data.lon) setMetaCoords({ lat: data.lat, lon: data.lon, itstNm: data.itstNm });
      })
      .catch(() => {});
  }, [router.isReady, router.query.auto, router.query.itstId, router.query.verify]);

  // 2) IP 부트스트랩 → 주변 교차로
  useEffect(() => {
    const boot = async () => {
      const result = await bootstrapByIp();
      if (result.items.length > 0) {
        setNearbyItems(result.items);
        setLocationLabel(result.label ?? "");
        return;
      }
      try {
        const items = await fetchNearby(SEOUL_CENTER.lat, SEOUL_CENTER.lon);
        setNearbyItems(items);
        setLocationLabel("서울 전체");
      } catch { /* noop */ }
    };
    void boot();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 3) 주변 교차로 로드 → 가장 가까운 교차로 자동 선택
  useEffect(() => {
    if (nearbySelectionResolvedRef.current || nearbyItems.length === 0) return;

    const restoredId = restoredSelectionRef.current;
    const matched = restoredId
      ? nearbyItems.find((item) => item.itstId === restoredId) ?? null
      : null;
    const target = matched ?? (!restoredId ? nearbyItems[0] : null);

    nearbySelectionResolvedRef.current = true;
    if (!target) return;

    geoFetchedForRef.current = null;
    setItstId(target.itstId);
    setItstNm(target.itstNm);
    setMetaCoords({ lat: target.lat, lon: target.lon, itstNm: target.itstNm });
    if (typeof window !== "undefined") localStorage.setItem("lastItstId", target.itstId);
    setAutoFetch(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nearbyItems]);

  // 4) 신호 1회 조회 (autoFetch가 true일 때만)
  useEffect(() => {
    if (!autoFetch) return;
    void fetchSpat();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itstId, autoFetch]);

  // 5) OSM 도로 각도 fetch — itstId당 1회만 실행 (좌표 세팅이 여러 번 일어나도 중복 방지)
  useEffect(() => {
    const lat =
      spatData?.itstId === itstId ? spatData.lat ?? metaCoords?.lat : metaCoords?.lat;
    const lon =
      spatData?.itstId === itstId ? spatData.lon ?? metaCoords?.lon : metaCoords?.lon;
    if (!lat || !lon) return;
    // 이 itstId는 이미 처리 완료 → 스킵
    if (geoFetchedForRef.current === itstId) return;
    geoFetchedForRef.current = itstId;

    // localStorage 캐시 우선 확인
    const cached = typeof window !== "undefined" ? localStorage.getItem(`bearing_v2_${itstId}`) : null;
    if (cached) {
      try {
        setRoadBearings(JSON.parse(cached) as number[]);
        setGeoSource("fallback");
      } catch { /* 캐시 손상 무시 */ }
      setGeoLoading(false);
      return;
    }

    setGeoError(null);
    setGeoLoading(true);
    void (async () => {
      try {
        const res = await fetch(`/api/intersection-geometry?lat=${lat}&lon=${lon}&itstId=${itstId}`);
        const json = (await res.json()) as { bearings?: number[]; source?: string; error?: string };
        if (res.ok && Array.isArray(json.bearings)) {
          setRoadBearings(json.bearings);
          setGeoSource(json.source === "osm" ? "osm" : "fallback");
          if (typeof window !== "undefined" && json.bearings.length >= 2)
            localStorage.setItem(`bearing_v2_${itstId}`, JSON.stringify(json.bearings));
        } else if (!res.ok) {
          setGeoError(`OSM ${res.status}: ${json.error ?? "unknown"}`);
        }
      } catch (e: unknown) {
        setGeoError(`OSM fetch error: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setGeoLoading(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itstId, spatData?.lat, spatData?.lon, metaCoords?.lat, metaCoords?.lon]);

  // 자동 갱신 (순차 setTimeout)
  useEffect(() => {
    if (!isAuto) {
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
      return;
    }
    let cancelled = false;
    const runLoop = async () => {
      if (cancelled) return;
      await fetchSpat();
      if (!cancelled) timerRef.current = setTimeout(runLoop, AUTO_REFRESH_MS);
    };
    void runLoop();
    return () => {
      cancelled = true;
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    };
  }, [fetchSpat, isAuto]);

  // 위성검증 모드일 때만 GPS 추적
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

  useEffect(() => {
    if (!router.isReady || !initialRouteAppliedRef.current) return;

    const nextQuery: Record<string, string> = {};
    if (itstId) nextQuery.itstId = itstId;
    if (isAuto) nextQuery.auto = "1";
    if (verifyMode) nextQuery.verify = "1";

    const nextParams = new URLSearchParams(nextQuery).toString();
    const nextUrl = nextParams ? `/?${nextParams}` : "/";
    const currentUrl =
      typeof window !== "undefined"
        ? `${window.location.pathname}${window.location.search}`
        : router.asPath;
    if (currentUrl === nextUrl) return;

    void router.replace(
      nextUrl,
      undefined,
      { shallow: true, scroll: false },
    );
  }, [itstId, isAuto, verifyMode, router, router.asPath, router.isReady]);

  // 모바일 뷰포트
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(max-width: 640px)");
    const apply = () => setIsMobileViewport(mq.matches);
    apply();
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", apply);
    } else {
      (mq as MediaQueryList).addListener(apply);
    }
    return () => {
      if (typeof mq.removeEventListener === "function") {
        mq.removeEventListener("change", apply);
      } else {
        (mq as MediaQueryList).removeListener(apply);
      }
    };
  }, []);

  // 온보딩 투어
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (process.env.NODE_ENV === "test") return;
    if (hasCompletedOnboarding()) return;
    const timer = window.setTimeout(() => {
      setTourRestartKey((prev) => prev + 1);
      setIsTourOpen(true);
    }, 350);
    return () => window.clearTimeout(timer);
  }, []);

  const markTourCompleted = useCallback(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(ONBOARDING_STORAGE_KEY, ONBOARDING_DONE_VALUE);
    writeCookie(ONBOARDING_COOKIE_KEY, ONBOARDING_DONE_VALUE, ONBOARDING_COOKIE_MAX_AGE_SEC);
  }, []);

  const handleCloseTour = useCallback(() => {
    setIsTourOpen(false);
    markTourCompleted();
  }, [markTourCompleted]);

  const handleCompleteTour = useCallback(() => {
    setIsTourOpen(false);
    markTourCompleted();
  }, [markTourCompleted]);

  const handleUseGps = async () => {
    const result = await bootstrapByGps();
    if (result.items.length > 0) {
      nearbySelectionResolvedRef.current = true;
      setNearbyItems(result.items);
      setLocationLabel("현재 위치");
    }
  };

  const goToSignal = (item: NearbyItem) => {
    if (typeof window !== "undefined") localStorage.setItem("lastItstId", item.itstId);
    restoredSelectionRef.current = item.itstId;
    nearbySelectionResolvedRef.current = true;
    geoFetchedForRef.current = null; // 새 교차로 → fetch 허용
    setItstId(item.itstId);
    setItstNm(item.itstNm);
    setMetaCoords({ lat: item.lat, lon: item.lon, itstNm: item.itstNm });
    setRoadBearings(undefined);
    setGeoSource(null);
    setGeoError(null);
    setGeoLoading(true);
    setSearchOpen(false);
    setAutoFetch(true);
  };

  const tourSteps = isMobileViewport ? HOME_TOUR_STEPS_MOBILE : HOME_TOUR_STEPS_DESKTOP;

  const displayItems = (() => {
    const items = searchResults !== null ? [...searchResults] : [...nearbyItems];
    if (sortBy === "name") items.sort((a, b) => a.itstNm.localeCompare(b.itstNm, "ko"));
    return items;
  })();

  const activeSpat = spatData?.itstId === itstId ? spatData : null;
  const spatItems = activeSpat && !activeSpat.isStale ? activeSpat.items : [];
  const hasEmptySpat = Boolean(activeSpat && !activeSpat.isStale && spatItems.length === 0);
  const verifyLat = activeSpat?.lat ?? metaCoords?.lat;
  const verifyLon = activeSpat?.lon ?? metaCoords?.lon;

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
        <title>{itstNm ? `${itstNm} — 신호 안내` : "신호 안내"}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div
        className="h-screen relative overflow-hidden"
        style={{ background: "linear-gradient(160deg, #0f1e35 0%, #0c1220 50%, #090c18 100%)" }}
      >
        {/* 배경 대기 광원 */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0">
          <div style={{
            position: "absolute", inset: 0,
            background: "radial-gradient(ellipse 90% 55% at 50% -5%, rgba(70,110,240,0.18) 0%, transparent 65%)",
          }} />
          <div style={{
            position: "absolute", inset: 0,
            background: "radial-gradient(ellipse 70% 40% at 50% 100%, rgba(40,70,140,0.13) 0%, transparent 65%)",
          }} />
        </div>

        {/* 교차로 시각화 — verifyMode 시 절반으로 축소 */}
        <div className={`pointer-events-none absolute inset-y-0 left-0 transition-all duration-300 ${verifyMode ? "w-0 overflow-hidden md:w-1/2 md:overflow-visible" : "w-full inset-0"}`}>
          <IntersectionView
            items={spatItems}
            roadBearings={roadBearings}
            isLoading={spatLoading || geoLoading}
            isStale={activeSpat?.isStale}
            emptyTitle={hasEmptySpat ? "신호 항목 없음" : undefined}
            emptyDescription={hasEmptySpat ? "이 교차로는 현재 SPaT 값이 비어 있습니다" : undefined}
            className="w-full h-full"
          />
        </div>

        {/* 위성 검증 지도 */}
        {verifyMode && verifyLat && verifyLon && (
          <div className="absolute inset-y-0 right-0 w-full md:w-1/2 md:border-l-2 md:border-purple-400/40 z-[15]">
            {/* 모바일 닫기 버튼 (헤더 아래) */}
            <button
              onClick={() => setVerifyMode(false)}
              className="md:hidden absolute top-[68px] left-4 flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold text-purple-200 transition-all"
              style={{
                zIndex: 1002,
                background: "rgba(2,6,23,0.85)",
                backdropFilter: "blur(8px)",
                border: "1px solid rgba(167,139,250,0.4)",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
              검증 닫기
            </button>

            {/* 데스크탑 상단 레이블 */}
            <div className="hidden md:block" style={{
              position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)",
              zIndex: 1001, background: "rgba(2,6,23,0.85)", backdropFilter: "blur(8px)",
              borderRadius: 8, padding: "5px 12px",
              border: "1px solid rgba(167,139,250,0.4)",
              fontSize: 11, fontWeight: 700, color: "#a78bfa", whiteSpace: "nowrap",
            }}>
              {geoLoading
                ? "위성사진 — OSM bearing 로드 중..."
                : roadBearings && roadBearings.length > 0
                  ? "위성사진 + OSM bearing — 선이 실제 도로와 일치하는지 확인"
                  : "위성사진 — 도로 형상 없음"}
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
              loading={geoLoading}
              label={itstNm ?? itstId}
              userLat={userGps?.lat}
              userLon={userGps?.lon}
            />
          </div>
        )}

        {/* 상단/하단 페이드 */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/60 to-transparent z-10" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/50 to-transparent z-10" />

        {/* 헤더 — z-30으로 위성검증 지도(z-15) 위에 표시 */}
        <header className="absolute inset-x-0 top-3 z-30 flex justify-center px-3">
          <div
            className="glass-panel rounded-2xl flex items-center pl-4 pr-2 gap-2 w-full max-w-3xl"
            style={{ minHeight: 52, ...(verifyMode && { background: "rgba(2,6,23,0.45)", backdropFilter: "blur(8px)" }) }}
          >
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest shrink-0">
              신호 안내
            </span>
            <div className="w-px h-5 bg-white/10 shrink-0" />
            <button
              data-tour="sidebar-toggle"
              className="flex-1 min-w-0 flex items-center gap-2 text-left group"
              onClick={() => setSearchOpen(true)}
            >
              {autoFetch && spatData && (
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0 animate-pulse" />
              )}
              <span className="text-sm font-semibold text-white truncate group-hover:text-slate-300 transition-colors">
                {itstNm ?? "교차로 선택…"}
              </span>
              {isAuto && <Radio className="h-3 w-3 text-sky-400 shrink-0" />}
              <Search className="h-3.5 w-3.5 text-slate-500 group-hover:text-slate-400 transition-colors shrink-0 ml-auto" />
            </button>
            <div className="flex items-center gap-1 shrink-0">
              {verifyLat && verifyLon && (
                <button
                  onClick={() => setVerifyMode((v) => !v)}
                  className={`glass-panel flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold transition-all border ${
                    verifyMode ? "border-purple-400/40 text-purple-300 bg-purple-400/10" : "border-white/10 text-slate-300 hover:text-white"
                  }`}
                >
                  <Satellite className="h-3.5 w-3.5" />
                  <span className="hidden md:inline">{verifyMode ? "검증 OFF" : "위성 검증"}</span>
                </button>
              )}
              <button
                onClick={() => setIsAuto((v) => !v)}
                className={`glass-panel flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold transition-all border ${
                  isAuto ? "border-sky-400/40 text-sky-400 bg-sky-400/10" : "border-white/10 text-slate-300 hover:text-white"
                }`}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isAuto ? "animate-spin" : ""}`} />
                <span className="hidden md:inline">{isAuto ? "자동 ON" : "자동 OFF"}</span>
              </button>
              <button
                onClick={() => void fetchSpat()}
                disabled={spatLoading}
                className="glass-panel flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:text-white border border-white/10 transition-all disabled:opacity-40"
              >
                <Zap className="h-3.5 w-3.5" />
                <span className="hidden md:inline">조회</span>
              </button>
            </div>
          </div>
        </header>

        {/* 우측 정보 패널 (데스크탑만, verifyMode 아닐 때) */}
        <aside className={`absolute right-4 top-20 z-30 w-64 flex-col gap-3 pointer-events-auto hidden md:flex ${verifyMode ? "md:hidden" : ""}`}>
          {/* 시스템 상태 */}
          <div className="glass-panel rounded-2xl overflow-hidden">
            <button
              className="flex w-full items-center justify-between p-3 hover:bg-white/5 transition-colors"
              onClick={() => setPanelOpen((v) => !v)}
            >
              <div className="flex items-center gap-2">
                <Locate className="h-3.5 w-3.5 text-sky-400" />
                <span className="text-xs font-bold text-slate-200">시스템 상태</span>
              </div>
              <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform ${panelOpen ? "rotate-180" : ""}`} />
            </button>
            {panelOpen && (
              <div className="px-3 pb-3 space-y-2">
                <StatusRow
                  icon={<Radio className="h-4 w-4 text-emerald-400" />}
                  label="SPaT 연결"
                  sub={error ? "오류" : hasEmptySpat ? "빈 응답" : activeSpat ? "정상" : "대기"}
                  valueClass={error ? "text-rose-400" : hasEmptySpat ? "text-amber-400" : activeSpat ? "text-emerald-400" : "text-slate-400"}
                  detail={activeSpat?.ageSec != null ? `ageSec: ${activeSpat.ageSec.toFixed(2)}s` : undefined}
                />
                <StatusRow
                  icon={<MapPin className="h-4 w-4 text-sky-400" />}
                  label="도로 형태"
                  sub={
                    geoError
                      ? "오류"
                      : geoLoading
                        ? "대기"
                        : roadBearings
                          ? roadBearings.length > 0
                            ? geoSource === "osm"
                              ? "OSM 실측"
                              : "캐시"
                            : "없음"
                          : "대기"
                  }
                  valueClass={geoError ? "text-rose-400" : geoSource === "osm" ? "text-emerald-400" : "text-slate-400"}
                  detail={
                    geoError
                      ?? (roadBearings
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
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">신호 현황</div>
              {spatItems.slice(0, 6).map((item) => {
                const isGo = item.status === "protected-Movement-Allowed" || item.status === "permissive-Movement-Allowed";
                const isStop = item.status === "stop-And-Remain";
                return (
                  <div key={item.key ?? item.title} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="h-2 w-2 rounded-full shrink-0" style={{ background: isGo ? "#10b981" : isStop ? "#ef4444" : "#64748b" }} />
                      <span className="text-xs text-slate-300 truncate">{item.title}</span>
                    </div>
                    <span className="text-xs font-bold tabular-nums shrink-0" style={{ color: isGo ? "#10b981" : isStop ? "#ef4444" : "#64748b" }}>
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
            </div>
          )}
        </aside>

        {/* 모바일 신호 요약 (우상단, verifyMode 시 숨김) */}
        {spatItems.length > 0 && !verifyMode && (
          <div className="md:hidden absolute right-3 top-20 z-30 glass-panel rounded-xl p-2 space-y-1 pointer-events-none max-w-[120px]">
            {spatItems.slice(0, 4).map((item) => {
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

        {/* 하단 정보바 */}
        {activeSpat && !verifyMode && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 max-w-[90vw]">
            <div className="glass-panel rounded-full px-4 py-1.5 flex items-center gap-3 text-[11px] text-slate-400 whitespace-nowrap overflow-hidden">
              <span className="font-semibold text-slate-300 truncate max-w-[120px]">{activeSpat.itstNm ?? itstId}</span>
              {activeSpat.fetchedAtKst && <span className="hidden sm:inline">{activeSpat.fetchedAtKst}</span>}
              {activeSpat.ageSec != null && (
                <span className={activeSpat.isStale ? "text-rose-400" : "text-emerald-400"}>
                  {activeSpat.ageSec.toFixed(2)}s
                </span>
              )}
            </div>
          </div>
        )}

        {/* 검색 오버레이 */}
        {searchOpen && (
          <div
            className="fixed inset-0 z-50 overlay-slide-in"
            style={{ background: "rgba(8,12,20,0.82)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}
          >
            <div className="flex flex-col h-full max-w-2xl mx-auto px-4 pt-4 pb-6">
              {/* 검색 입력 */}
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
                  <input
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="교차로 이름 또는 ID..."
                    className="w-full pl-10 pr-4 py-3 rounded-xl text-sm text-slate-200 placeholder-slate-500 outline-none"
                    style={{
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.1)",
                    }}
                  />
                </div>
                <button
                  onClick={() => { setSearchOpen(false); setQuery(""); }}
                  className="text-slate-400 hover:text-white px-2 py-2 text-sm shrink-0"
                >
                  닫기
                </button>
              </div>

              {/* 정렬 + GPS */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex gap-1">
                  <button
                    onClick={() => setSortBy("distance")}
                    className="px-3 py-1 text-xs font-bold rounded-lg transition-all"
                    style={{
                      background: sortBy === "distance" ? "rgba(255,255,255,0.1)" : "transparent",
                      color: sortBy === "distance" ? "#e2e8f0" : "#64748b",
                    }}
                  >
                    가까운 순
                  </button>
                  <button
                    onClick={() => setSortBy("name")}
                    className="px-3 py-1 text-xs font-medium rounded-lg transition-all"
                    style={{
                      background: sortBy === "name" ? "rgba(255,255,255,0.1)" : "transparent",
                      color: sortBy === "name" ? "#e2e8f0" : "#64748b",
                    }}
                  >
                    이름 순
                  </button>
                </div>
                <button
                  onClick={() => void handleUseGps()}
                  disabled={gpsLoading}
                  className="flex items-center gap-1.5 text-xs text-slate-400 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-sm" style={{ color: "#4ea86e" }}>
                    gps_fixed
                  </span>
                  {gpsLoading ? "확인 중..." : "현재 위치"}
                </button>
              </div>

              {/* 위치 레이블 */}
              {locationLabel && (
                <div className="flex items-center gap-1.5 mb-3 text-xs text-slate-500">
                  <span className="material-symbols-outlined text-sm">my_location</span>
                  <span>{locationLabel} 기준 교차로를 불러왔습니다.</span>
                </div>
              )}

              {/* 목록 */}
              <div className="flex-1 overflow-y-auto flex flex-col gap-2">
                {(loading && !nearbyItems.length) || searchLoading
                  ? [...Array(3)].map((_, i) => (
                      <div
                        key={i}
                        className="rounded-xl p-4 animate-pulse skeleton-shimmer"
                        style={{ background: "rgba(255,255,255,0.04)", height: 72 }}
                      />
                    ))
                  : null}

                {displayItems.map((item) => (
                  <button
                    key={item.itstId}
                    onClick={() => goToSignal(item)}
                    className="rounded-xl p-4 flex items-center justify-between text-left w-full transition-colors item-fade-in"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-white truncate">{item.itstNm}</div>
                      <div className="text-xs mt-0.5 flex items-center gap-2" style={{ color: "#475569" }}>
                        <span
                          className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium"
                          style={{
                            background: "rgba(255,255,255,0.06)",
                            border: "1px solid rgba(255,255,255,0.08)",
                          }}
                        >
                          ID {item.itstId}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-4">
                      <span className="block text-base font-bold text-white">
                        {item.distanceM >= 1000
                          ? `${(item.distanceM / 1000).toFixed(1)}km`
                          : `${Math.round(item.distanceM)}m`}
                      </span>
                      <span className="text-[10px]" style={{ color: "#475569" }}>직선 거리</span>
                    </div>
                  </button>
                ))}

                {!loading && !displayItems.length && nearbyItems.length > 0 && (
                  <div className="text-center py-10 text-slate-500 text-sm">
                    검색 결과가 없습니다.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
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
    <div className="flex items-center justify-between rounded-lg bg-white/5 border border-white/5 px-2.5 py-2 gap-2">
      <div className="flex items-center gap-2">
        <div className="bg-white/5 p-1.5 rounded-lg">{icon}</div>
        <div>
          <div className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">{label}</div>
          <div className="text-xs font-bold text-white">{sub}</div>
        </div>
      </div>
      <div className="text-right">
        <div className={`text-xs font-bold ${valueClass}`}>{sub}</div>
        {detail && <div className="text-[9px] text-slate-500">{detail}</div>}
      </div>
    </div>
  );
}
