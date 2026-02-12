import { useEffect, useRef, useState } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useNearby } from "@/hooks/useNearby";
import type { GeocodeResponse, NearbyItem } from "@/lib/types";

const LOCATION_RETRY_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 12000,
  maximumAge: 60000,
};

const LOCATION_STRICT_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 8000,
  maximumAge: 0,
};

const INITIAL_RESULT_COUNT = 5;
const RESULT_STEP = 5;
const MAX_RESULT_COUNT = 50;
const MAP_ZOOM_LEVEL = 17;
const MAP_LAT_DELTA = 0.0022;
const MAP_LON_DELTA = 0.0032;

const clampCoord = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const buildOsmEmbedUrl = (lat: number, lon: number) => {
  const safeLat = clampCoord(lat, -85, 85);
  const safeLon = clampCoord(lon, -180, 180);
  const bboxLeft = clampCoord(safeLon - MAP_LON_DELTA, -180, 180);
  const bboxRight = clampCoord(safeLon + MAP_LON_DELTA, -180, 180);
  const bboxBottom = clampCoord(safeLat - MAP_LAT_DELTA, -85, 85);
  const bboxTop = clampCoord(safeLat + MAP_LAT_DELTA, -85, 85);

  const params = new URLSearchParams({
    bbox: `${bboxLeft},${bboxBottom},${bboxRight},${bboxTop}`,
    layer: "mapnik",
    marker: `${safeLat},${safeLon}`,
  });
  return `https://www.openstreetmap.org/export/embed.html?${params.toString()}`;
};

const buildOsmMapUrl = (lat: number, lon: number) => {
  const safeLat = clampCoord(lat, -85, 85);
  const safeLon = clampCoord(lon, -180, 180);
  return `https://www.openstreetmap.org/?mlat=${safeLat}&mlon=${safeLon}#map=${MAP_ZOOM_LEVEL}/${safeLat}/${safeLon}`;
};

function InlineMapPreview({
  mapKey,
  itstNm,
  lat,
  lon,
}: {
  mapKey: string;
  itstNm: string;
  lat: number;
  lon: number;
}) {
  return (
    <div className="rounded-md border border-border/60 bg-muted/10 p-3">
      <div className="mb-2 text-xs font-semibold text-foreground">
        지도 미리보기 · {itstNm}
      </div>
      <div className="overflow-hidden rounded-md border border-border/60">
        <iframe
          title={`교차로 위치 지도-${mapKey}`}
          src={buildOsmEmbedUrl(lat, lon)}
          className="h-64 w-full"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span>
          위도 {lat.toFixed(6)}, 경도 {lon.toFixed(6)}
        </span>
        <a
          href={buildOsmMapUrl(lat, lon)}
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-2"
        >
          큰 지도에서 보기
        </a>
      </div>
    </div>
  );
}

export function NearbySection({
  onSelectItstId,
  autoSelectNearest = false,
}: {
  onSelectItstId: (value: string) => void;
  autoSelectNearest?: boolean;
}) {
  const [address, setAddress] = useState("");
  const [lat, setLat] = useState("37.5665");
  const [lon, setLon] = useState("126.9780");
  const [geoError, setGeoError] = useState<string>("");
  const [geoStatus, setGeoStatus] = useState<string>("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [resultCount, setResultCount] = useState(INITIAL_RESULT_COUNT);
  const [mapTarget, setMapTarget] = useState<{
    key: string;
    itstNm: string;
    lat: number;
    lon: number;
  } | null>(null);
  const [favorites, setFavorites] = useState<
    { itstId: string; itstNm: string; lat: number; lon: number }[]
  >([]);
  const [showFavorites, setShowFavorites] = useState(false);
  const didAutoInitRef = useRef(false);
  const { nearbyData, error, isLoading, fetchNearby } = useNearby({
    lat,
    lon,
    k: resultCount,
  });

  useEffect(() => {
    try {
      const raw = localStorage.getItem("favorites");
      if (raw) setFavorites(JSON.parse(raw));
    } catch {
      setFavorites([]);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("favorites", JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    if (process.env.NODE_ENV === "test") return;
    if (didAutoInitRef.current) return;
    didAutoInitRef.current = true;

    let active = true;
    const run = async () => {
      try {
        const resp = await fetch("/api/ip-location");
        const json = (await resp.json()) as {
          lat?: number;
          lon?: number;
          label?: string;
          error?: string;
        };
        if (!resp.ok || !Number.isFinite(json.lat) || !Number.isFinite(json.lon)) return;

        const nextLat = String(json.lat);
        const nextLon = String(json.lon);
        const nextCount = INITIAL_RESULT_COUNT;
        setLat(nextLat);
        setLon(nextLon);
        setResultCount(nextCount);
        const nearby = await fetchNearby({ lat: nextLat, lon: nextLon, k: nextCount });
        if (
          active &&
          autoSelectNearest &&
          nearby?.items &&
          nearby.items.length > 0
        ) {
          onSelectItstId(nearby.items[0].itstId);
        }
        if (!active) return;
        setGeoStatus(
          json.label
            ? `초기 위치(${json.label}) 기준으로 조회됨`
            : "초기 위치 기준으로 조회됨",
        );
      } catch {
        // Skip blocking errors on initial auto-load.
      }
    };

    void run();
    return () => {
      active = false;
    };
  }, [autoSelectNearest, fetchNearby, onSelectItstId]);

  const getCurrentPosition = (options: PositionOptions) =>
    new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, options);
    });

  const fetchNearbyFrom = async (nextLat: string, nextLon: string) => {
    const nextCount = INITIAL_RESULT_COUNT;
    setLat(nextLat);
    setLon(nextLon);
    setResultCount(nextCount);
    return await fetchNearby({ lat: nextLat, lon: nextLon, k: nextCount });
  };

  const handleAddressSearch = async () => {
    if (!address.trim()) {
      setGeoError("주소를 입력해 주세요.");
      return;
    }
    setGeoError("");
    setGeoStatus("");
    setSearchLoading(true);
    try {
      const res = await fetch(
        `/api/geocode?q=${encodeURIComponent(address.trim())}`,
      );
      const json = (await res.json()) as unknown;
      if (!res.ok) {
        const errMsg =
          json && typeof json === "object" && "error" in json
            ? String((json as { error?: string }).error)
            : "주소 검색 실패";
        throw new Error(errMsg);
      }
      const data = json as GeocodeResponse;
      const nextLat = String(data.lat);
      const nextLon = String(data.lon);
      await fetchNearbyFrom(nextLat, nextLon);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setGeoError(msg);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleUseLocation = async () => {
    if (!navigator?.geolocation) {
      setGeoError("현재 위치 사용을 지원하지 않는 브라우저입니다.");
      return;
    }
    const isLocalhost =
      typeof window !== "undefined" &&
      ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
    if (
      typeof window !== "undefined" &&
      !window.isSecureContext &&
      !isLocalhost
    ) {
      setGeoError("현재 위치 기능은 HTTPS 또는 localhost에서만 동작합니다.");
      return;
    }

    setGeoError("");
    setGeoStatus("");
    setLocationLoading(true);
    try {
      let pos: GeolocationPosition;
      try {
        pos = await getCurrentPosition(LOCATION_STRICT_OPTIONS);
      } catch (error: unknown) {
        const geErr = error as GeolocationPositionError;
        if (geErr?.code === geErr?.PERMISSION_DENIED) {
          setGeoError("위치 권한을 허용해 주세요.");
          return;
        }
        pos = await getCurrentPosition(LOCATION_RETRY_OPTIONS);
      }

      const nextLat = String(pos.coords.latitude);
      const nextLon = String(pos.coords.longitude);
      await fetchNearbyFrom(nextLat, nextLon);
      setGeoStatus("GPS 위치로 조회됨");
    } catch (error: unknown) {
      const geErr = error as GeolocationPositionError;
      if (geErr?.code === geErr?.PERMISSION_DENIED) {
        setGeoError("위치 권한을 허용해 주세요.");
        return;
      }
      if (geErr?.code === geErr?.TIMEOUT) {
        setGeoError("위치 조회 시간이 초과되었습니다. 다시 시도해 주세요.");
        return;
      }
      if (geErr?.code === geErr?.POSITION_UNAVAILABLE) {
        try {
          const resp = await fetch("/api/ip-location");
          const json = (await resp.json()) as {
            lat?: number;
            lon?: number;
            label?: string;
            error?: string;
          };
          if (
            !resp.ok ||
            !Number.isFinite(json.lat) ||
            !Number.isFinite(json.lon)
          ) {
            const msg = json?.error ?? "현재 위치를 확인할 수 없습니다.";
            setGeoError(msg);
            return;
          }

          const nextLat = String(json.lat);
          const nextLon = String(json.lon);
          await fetchNearbyFrom(nextLat, nextLon);
          setGeoStatus(
            json.label
              ? `GPS 위치를 가져오지 못해 대략 위치(${json.label})로 조회했습니다.`
              : "GPS 위치를 가져오지 못해 대략 위치로 조회했습니다.",
          );
          return;
        } catch {
          setGeoError(
            "현재 위치를 확인할 수 없습니다. GPS/네트워크를 확인해 주세요.",
          );
          return;
        }
      }
      const msg = error instanceof Error ? error.message : String(error);
      setGeoError(msg || "현재 위치를 가져오지 못했습니다.");
    } finally {
      setLocationLoading(false);
    }
  };

  const addFavorite = (it: NearbyItem) => {
    if (favorites.some((f) => f.itstId === it.itstId)) return;
    setFavorites([
      ...favorites,
      {
        itstId: it.itstId,
        itstNm: it.itstNm,
        lat: it.lat,
        lon: it.lon,
      },
    ]);
  };

  const removeFavorite = (itstId: string) => {
    setFavorites(favorites.filter((f) => f.itstId !== itstId));
  };

  const toggleMapTarget = (target: {
    key: string;
    itstNm: string;
    lat: number;
    lon: number;
  }) => {
    setMapTarget((prev) => (prev?.key === target.key ? null : target));
  };

  const canLoadMore = Boolean(
    nearbyData?.items &&
    nearbyData.items.length > 0 &&
    nearbyData.items.length === resultCount &&
    resultCount < MAX_RESULT_COUNT,
  );

  const handleLoadMore = async () => {
    const nextCount = Math.min(resultCount + RESULT_STEP, MAX_RESULT_COUNT);
    if (nextCount === resultCount) return;
    setResultCount(nextCount);
    await fetchNearby({ k: nextCount });
  };

  return (
    <section className="space-y-4">
      <Card className="border border-border/70">
        <CardHeader>
          <CardTitle className="text-base font-semibold">
            주변 교차로 찾기
          </CardTitle>
          <CardDescription>
            아래 목록에서 위치 입력 후, 교차로를 선택해 ID를 자동 입력하세요.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border border-border/60 bg-muted/20 p-3">
            <div className="mb-3 text-xs font-semibold text-foreground">
              위치 정하기
            </div>
            <div className="grid gap-3 sm:grid-cols-[1.5fr_auto] sm:items-end">
              <label className="text-xs text-muted-foreground">
                주소/역 이름으로 찾기
                <Input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="mt-2"
                  placeholder="예: 강남역, 도로명 "
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={handleAddressSearch}
                  disabled={searchLoading || locationLoading}
                >
                  {searchLoading ? "찾는 중..." : "주소 검색"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => void handleUseLocation()}
                  disabled={searchLoading || locationLoading}
                >
                  {locationLoading ? "위치 확인 중..." : "현재 위치"}
                </Button>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              처음 접속 시 대략 위치 기준으로 자동 조회됩니다.
            </p>
            {geoStatus && (
              <div className="mt-2 flex items-center">
                <Badge variant="outline">{geoStatus}</Badge>
              </div>
            )}
          </div>

          {geoError && (
            <Alert variant="destructive">
              <AlertTitle>위치 확인 실패</AlertTitle>
              <AlertDescription>{geoError}</AlertDescription>
            </Alert>
          )}

          <div className="rounded-md border border-border/60 bg-muted/20 p-3">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="text-xs font-semibold text-foreground">
                교차로 선택
              </div>
              {nearbyData?.items?.length ? (
                <Badge variant="outline">
                  상위 {nearbyData.items.length}개
                </Badge>
              ) : null}
            </div>

            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 2 }).map((_, idx) => (
                  <Card key={idx} className="border border-border/60">
                    <CardContent className="space-y-3 pt-4">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-52" />
                      <Skeleton className="h-8 w-28" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : nearbyData ? (
              !nearbyData.items || nearbyData.items.length === 0 ? (
                <div className="rounded-md border border-border/60 bg-muted/40 p-3 text-xs text-muted-foreground">
                  결과가 없습니다. 다른 키워드나 현재 위치로 다시 시도해 주세요.
                </div>
              ) : (
                <div className="space-y-2">
                  {nearbyData.items.map((it: NearbyItem) => {
                    const mapKey = `nearby-${it.itstId}`;
                    const isMapOpen = mapTarget?.key === mapKey;
                    return (
                      <Card key={it.itstId} className="border border-border/60">
                        <CardContent className="space-y-2 pt-4">
                          <div className="text-sm font-semibold">
                            {it.itstNm} (ID: {it.itstId})
                          </div>
                          <div className="text-xs text-muted-foreground">
                            거리: 약 {Math.round(it.distanceM)}m
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onSelectItstId(it.itstId)}
                            >
                              이 ID로 조회
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => addFavorite(it)}
                            >
                              즐겨찾기 추가
                            </Button>
                            <Button
                              size="sm"
                              variant={isMapOpen ? "secondary" : "ghost"}
                              onClick={() =>
                                toggleMapTarget({
                                  key: mapKey,
                                  itstNm: it.itstNm,
                                  lat: it.lat,
                                  lon: it.lon,
                                })
                              }
                            >
                              {isMapOpen ? "지도 닫기" : "지도보기"}
                            </Button>
                          </div>
                          {isMapOpen && (
                            <InlineMapPreview
                              mapKey={mapKey}
                              itstNm={it.itstNm}
                              lat={it.lat}
                              lon={it.lon}
                            />
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                  {canLoadMore && (
                    <div className="flex justify-center pt-1">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => void handleLoadMore()}
                      >
                        더보기 (+{RESULT_STEP})
                      </Button>
                    </div>
                  )}
                </div>
              )
            ) : (
              <div className="rounded-md border border-dashed border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
                아직 검색 결과가 없습니다. 위에서 위치를 먼저 선택해 주세요.
              </div>
            )}
          </div>

          <div className="rounded-md border border-border/60 bg-muted/20 p-3">
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                즐겨찾기 ({favorites.length})
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowFavorites((v) => !v)}
              >
                {showFavorites ? "숨기기" : "보기"}
              </Button>
            </div>

            {showFavorites && (
              <div className="mt-3 space-y-2">
                {favorites.length === 0 ? (
                  <div className="rounded-md border border-border/60 bg-muted/40 p-3 text-xs text-muted-foreground">
                    즐겨찾기한 교차로가 없습니다.
                  </div>
                ) : (
                  favorites.map((f) => {
                    const mapKey = `favorite-${f.itstId}`;
                    const isMapOpen = mapTarget?.key === mapKey;
                    return (
                      <Card key={f.itstId} className="border border-border/60">
                        <CardContent className="space-y-2 pt-4">
                          <div className="text-sm font-semibold">
                            {f.itstNm} (ID: {f.itstId})
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onSelectItstId(f.itstId)}
                            >
                              조회
                            </Button>
                            <Button
                              size="sm"
                              variant={isMapOpen ? "secondary" : "ghost"}
                              onClick={() =>
                                toggleMapTarget({
                                  key: mapKey,
                                  itstNm: f.itstNm,
                                  lat: f.lat,
                                  lon: f.lon,
                                })
                              }
                            >
                              {isMapOpen ? "지도 닫기" : "지도보기"}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => removeFavorite(f.itstId)}
                            >
                              제거
                            </Button>
                          </div>
                          {isMapOpen && (
                            <InlineMapPreview
                              mapKey={mapKey}
                              itstNm={f.itstNm}
                              lat={f.lat}
                              lon={f.lon}
                            />
                          )}
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTitle>교차로 검색 실패</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
