/**
 * hooks/useIntersectionGeometry.ts
 *
 * 교차로 도로 방위각(bearing)을 가져옵니다.
 * 우선순위: localStorage 캐시 → /api/intersection-geometry (정적 캐시 → Overpass API)
 *
 * itstId당 1회만 fetch 실행 (좌표 세팅이 여러 번 일어나도 중복 방지).
 */

import { useEffect, useRef, useState } from "react";
import { readStorage, writeStorage } from "@/lib/onboarding";

const BEARING_CACHE_PREFIX = "bearing_v2_";

function getBearingCacheKey(itstId: string) {
  return `${BEARING_CACHE_PREFIX}${itstId}`;
}

type UseIntersectionGeometryParams = {
  itstId: string;
  lat: number | null | undefined;
  lon: number | null | undefined;
};

type UseIntersectionGeometryResult = {
  roadBearings: number[] | undefined;
  geoSource: "osm" | "fallback" | null;
  geoError: string | null;
  geoLoading: boolean;
};

export function useIntersectionGeometry({
  itstId,
  lat,
  lon,
}: UseIntersectionGeometryParams): UseIntersectionGeometryResult {
  const [roadBearings, setRoadBearings] = useState<number[] | undefined>(
    undefined,
  );
  const [geoSource, setGeoSource] = useState<"osm" | "fallback" | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  // 이미 fetch한 itstId를 기억해 중복 요청 방지
  const fetchedForRef = useRef<string | null>(null);

  useEffect(() => {
    if (!lat || !lon) return;
    // 이 itstId는 이미 처리 완료 → 스킵
    if (fetchedForRef.current === itstId) return;

    // 새 교차로로 전환 — 이전 데이터 초기화
    if (fetchedForRef.current !== null) {
      setRoadBearings(undefined);
      setGeoSource(null);
      setGeoError(null);
    }
    fetchedForRef.current = itstId;

    // 1순위: localStorage 캐시
    const cached = readStorage(getBearingCacheKey(itstId));
    if (cached) {
      try {
        setRoadBearings(JSON.parse(cached) as number[]);
        setGeoSource("fallback");
      } catch {
        /* 캐시 손상 무시 */
      }
      setGeoLoading(false);
      return;
    }

    // 2순위: API 조회
    setGeoError(null);
    setGeoLoading(true);
    void (async () => {
      try {
        const res = await fetch(
          `/api/intersection-geometry?lat=${lat}&lon=${lon}&itstId=${itstId}`,
        );
        const json = (await res.json()) as {
          bearings?: number[];
          source?: string;
          error?: string;
        };
        if (res.ok && Array.isArray(json.bearings)) {
          setRoadBearings(json.bearings);
          setGeoSource(json.source === "osm" ? "osm" : "fallback");
          // 방향이 2개 이상일 때만 캐싱 (단순 직선은 제외)
          if (json.bearings.length >= 2)
            writeStorage(
              getBearingCacheKey(itstId),
              JSON.stringify(json.bearings),
            );
        } else if (!res.ok) {
          setGeoError(`OSM ${res.status}: ${json.error ?? "unknown"}`);
        }
      } catch (e: unknown) {
        setGeoError(
          `OSM fetch error: ${e instanceof Error ? e.message : String(e)}`,
        );
      } finally {
        setGeoLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itstId, lat, lon]);

  return { roadBearings, geoSource, geoError, geoLoading };
}
