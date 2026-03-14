import { useEffect, useRef, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import type { NearbyItem } from "@/lib/types";
import { useLocationBootstrap } from "@/hooks/useLocationBootstrap";
import { useSpat } from "@/hooks/useSpat";
import { IntersectionView } from "@/components/IntersectionView";
import { OnboardingTour } from "@/components/OnboardingTour";
import { DEFAULT_ITST_ID } from "@/lib/defaults";
import { readStorage, writeStorage } from "@/lib/storage";
import { useIntersectionGeometry } from "@/hooks/useIntersectionGeometry";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { useGpsTrack } from "@/hooks/useGpsTrack";
import { useOnboarding } from "@/hooks/useOnboarding";
import { AppHeader } from "@/components/AppHeader";
import { BottomInfoBar } from "@/components/BottomInfoBar";
import { SearchOverlay } from "@/components/SearchOverlay";
import { VerifyMapPanel } from "@/components/VerifyMapPanel";
import { StatusPanel } from "@/components/StatusPanel";

const NEARBY_K = 10;
const SEOUL_CENTER = { lat: 37.5665, lon: 126.978 };
const AUTO_REFRESH_MS = 3000;
const LAST_ITST_ID_STORAGE_KEY = "lastItstId";

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

export default function Home() {
  const router = useRouter();
  const [itstId, setItstId] = useState<string>(DEFAULT_ITST_ID);
  const [itstNm, setItstNm] = useState<string | null>(null);
  const [autoFetch, setAutoFetch] = useState(false);

  // 신호 컨트롤 상태
  const [isAuto, setIsAuto] = useState(false);
  const [verifyMode, setVerifyMode] = useState(false);
  const [metaCoords, setMetaCoords] = useState<{
    lat: number;
    lon: number;
    itstNm: string | null;
  } | null>(null);
  // 검색 오버레이 상태
  const [searchOpen, setSearchOpen] = useState(false);
  const [nearbyItems, setNearbyItems] = useState<NearbyItem[]>([]);
  const [locationLabel, setLocationLabel] = useState("");
  const restoredSelectionRef = useRef<string | null>(null);
  const nearbySelectionResolvedRef = useRef(false);
  const initialRouteAppliedRef = useRef(false);

  const { loading, gpsLoading, fetchNearby, bootstrapByIp, bootstrapByGps } =
    useLocationBootstrap(NEARBY_K);

  const {
    spatData,
    error,
    errorDetail,
    isLoading: spatLoading,
    fetchSpat,
  } = useSpat({
    itstId,
    timeoutMs: "25000",
  });

  // 현재 교차로의 최우선 좌표 (SPaT 응답 → meta 순서로 사용)
  const geoLat =
    spatData?.itstId === itstId
      ? (spatData.lat ?? metaCoords?.lat)
      : metaCoords?.lat;
  const geoLon =
    spatData?.itstId === itstId
      ? (spatData.lon ?? metaCoords?.lon)
      : metaCoords?.lon;

  const { roadBearings, geoSource, geoError, geoLoading } =
    useIntersectionGeometry({ itstId, lat: geoLat, lon: geoLon });

  useAutoRefresh({ enabled: isAuto, fetchFn: fetchSpat, intervalMs: AUTO_REFRESH_MS });
  const { position: userGps } = useGpsTrack(verifyMode);
  const { isTourOpen, tourRestartKey, tourSteps, onCloseTour, onCompleteTour } =
    useOnboarding();

  // 1) 마지막 교차로 meta 로드
  useEffect(() => {
    if (!router.isReady || initialRouteAppliedRef.current) return;
    initialRouteAppliedRef.current = true;

    const queryItstId = sanitizeDigits(
      firstQueryValue(router.query.itstId) ?? "",
    );
    const queryAuto = parseFlag(router.query.auto);
    const queryVerify = parseFlag(router.query.verify);
    const savedId = readStorage(LAST_ITST_ID_STORAGE_KEY) ?? DEFAULT_ITST_ID;
    const initialId = queryItstId || savedId;

    restoredSelectionRef.current = initialId || null;
    if (queryItstId) nearbySelectionResolvedRef.current = true;
    if (queryAuto !== null) setIsAuto(queryAuto);
    if (queryVerify !== null) setVerifyMode(queryVerify);
    setItstId(initialId);
    setAutoFetch(true);
    writeStorage(LAST_ITST_ID_STORAGE_KEY, initialId);

    fetch(`/api/itst-meta?itstId=${initialId}`)
      .then((r) => r.json())
      .then(
        (data: {
          lat: number | null;
          lon: number | null;
          itstNm: string | null;
        }) => {
          if (data.itstNm) setItstNm(data.itstNm);
          if (data.lat && data.lon)
            setMetaCoords({
              lat: data.lat,
              lon: data.lon,
              itstNm: data.itstNm,
            });
        },
      )
      .catch(() => {});
  }, [
    router.isReady,
    router.query.auto,
    router.query.itstId,
    router.query.verify,
  ]);

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
      } catch {
        /* noop */
      }
    };
    void boot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 3) 주변 교차로 로드 → 가장 가까운 교차로 자동 선택
  useEffect(() => {
    if (nearbySelectionResolvedRef.current || nearbyItems.length === 0) return;

    const restoredId = restoredSelectionRef.current;
    const matched = restoredId
      ? (nearbyItems.find((item) => item.itstId === restoredId) ?? null)
      : null;
    const target = matched ?? (!restoredId ? nearbyItems[0] : null);

    nearbySelectionResolvedRef.current = true;
    if (!target) return;

    setItstId(target.itstId);
    setItstNm(target.itstNm);
    setMetaCoords({ lat: target.lat, lon: target.lon, itstNm: target.itstNm });
    writeStorage(LAST_ITST_ID_STORAGE_KEY, target.itstId);
    setAutoFetch(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nearbyItems]);

  // 4) 신호 1회 조회 (autoFetch가 true일 때만)
  useEffect(() => {
    if (!autoFetch) return;
    void fetchSpat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itstId, autoFetch]);

  const { asPath, isReady, replace } = router;

  useEffect(() => {
    if (!isReady || !initialRouteAppliedRef.current) return;

    const nextQuery: Record<string, string> = {};
    if (itstId) nextQuery.itstId = itstId;
    if (isAuto) nextQuery.auto = "1";
    if (verifyMode) nextQuery.verify = "1";

    const nextParams = new URLSearchParams(nextQuery).toString();
    const nextUrl = nextParams ? `/?${nextParams}` : "/";
    const currentUrl =
      typeof window !== "undefined"
        ? `${window.location.pathname}${window.location.search}`
        : asPath;
    if (currentUrl === nextUrl) return;

    void replace(nextUrl, undefined, { shallow: true, scroll: false });
  }, [itstId, isAuto, verifyMode, asPath, isReady, replace]);

  const handleUseGps = async () => {
    const result = await bootstrapByGps();
    if (result.items.length > 0) {
      nearbySelectionResolvedRef.current = true;
      setNearbyItems(result.items);
      setLocationLabel("현재 위치");
    }
  };

  const goToSignal = (item: NearbyItem) => {
    writeStorage(LAST_ITST_ID_STORAGE_KEY, item.itstId);
    restoredSelectionRef.current = item.itstId;
    nearbySelectionResolvedRef.current = true;
    setItstId(item.itstId);
    setItstNm(item.itstNm);
    setMetaCoords({ lat: item.lat, lon: item.lon, itstNm: item.itstNm });
    setSearchOpen(false);
    setAutoFetch(true);
  };

  const activeSpat = spatData?.itstId === itstId ? spatData : null;
  const spatItems = activeSpat && !activeSpat.isStale ? activeSpat.items : [];
  const hasEmptySpat = Boolean(
    activeSpat && !activeSpat.isStale && spatItems.length === 0,
  );

  return (
    <>
      <Head>
        <title>{itstNm ? `${itstNm} — 신호 안내` : "신호 안내"}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div
        className="h-screen relative overflow-hidden"
        style={{
          background:
            "linear-gradient(160deg, #0f1e35 0%, #0c1220 50%, #090c18 100%)",
        }}
      >
        {/* 배경 대기 광원 */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0"
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(ellipse 90% 55% at 50% -5%, rgba(70,110,240,0.18) 0%, transparent 65%)",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(ellipse 70% 40% at 50% 100%, rgba(40,70,140,0.13) 0%, transparent 65%)",
            }}
          />
        </div>

        {/* 교차로 시각화 — verifyMode 시 절반으로 축소 */}
        <div
          className={`pointer-events-none absolute inset-y-0 left-0 transition-all duration-300 ${verifyMode ? "w-0 overflow-hidden md:w-1/2 md:overflow-visible" : "w-full inset-0"}`}
        >
          <IntersectionView
            items={spatItems}
            roadBearings={roadBearings}
            isLoading={spatLoading || geoLoading}
            isStale={activeSpat?.isStale}
            emptyTitle={
              hasEmptySpat ? "지금은 신호 정보를 가져올 수 없어요" : undefined
            }
            emptyDescription={
              hasEmptySpat ? "잠시 후 다시 조회해 주세요" : undefined
            }
            className="w-full h-full"
          />
        </div>

        {/* 위성 검증 지도 */}
        {verifyMode && geoLat && geoLon && (
          <VerifyMapPanel
            lat={geoLat}
            lon={geoLon}
            itstLabel={itstNm ?? itstId}
            roadBearings={roadBearings ?? []}
            geoLoading={geoLoading}
            userGps={userGps}
            onClose={() => setVerifyMode(false)}
          />
        )}

        {/* 상단/하단 페이드 */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/60 to-transparent z-10" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/50 to-transparent z-10" />

        {/* 헤더 */}
        <AppHeader
          itstNm={itstNm}
          isConnected={autoFetch && !!spatData}
          isAuto={isAuto}
          verifyMode={verifyMode}
          hasGeo={!!(geoLat && geoLon)}
          spatLoading={spatLoading}
          onSearchOpen={() => setSearchOpen(true)}
          onVerifyToggle={() => setVerifyMode((v) => !v)}
          onAutoToggle={() => setIsAuto((v) => !v)}
          onFetch={() => void fetchSpat()}
        />

        <StatusPanel
          verifyMode={verifyMode}
          error={error}
          errorDetail={errorDetail}
          activeSpat={activeSpat}
          hasEmptySpat={hasEmptySpat}
          spatItems={spatItems}
          roadBearings={roadBearings}
          geoSource={geoSource}
          geoError={geoError}
          geoLoading={geoLoading}
        />

        {/* 하단 정보바 */}
        {activeSpat && !verifyMode && (
          <BottomInfoBar
            activeSpat={activeSpat}
            itstId={itstId}
            hasEmptySpat={hasEmptySpat}
          />
        )}

        {/* 검색 오버레이 */}
        {searchOpen && (
          <SearchOverlay
            onClose={() => setSearchOpen(false)}
            onSelect={goToSignal}
            nearbyItems={nearbyItems}
            locationLabel={locationLabel}
            loading={loading}
            gpsLoading={gpsLoading}
            onUseGps={() => void handleUseGps()}
          />
        )}
      </div>

      <OnboardingTour
        open={isTourOpen}
        steps={tourSteps}
        restartKey={tourRestartKey}
        onClose={onCloseTour}
        onComplete={onCompleteTour}
      />
    </>
  );
}