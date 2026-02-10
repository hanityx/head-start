import { useEffect, useState } from "react";

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

export function NearbySection({
  onSelectItstId,
}: {
  onSelectItstId: (value: string) => void;
}) {
  const [address, setAddress] = useState("");
  const [lat, setLat] = useState("37.5665");
  const [lon, setLon] = useState("126.9780");
  const [geoError, setGeoError] = useState<string>("");
  const [geoStatus, setGeoStatus] = useState<string>("");
  const [geoLoading, setGeoLoading] = useState(false);
  const [favorites, setFavorites] = useState<
    { itstId: string; itstNm: string; lat: number; lon: number }[]
  >([]);
  const [showFavorites, setShowFavorites] = useState(false);
  const { nearbyData, error, isLoading, fetchNearby } = useNearby({ lat, lon });

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

  const getCurrentPosition = (options: PositionOptions) =>
    new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, options);
    });

  const handleAddressSearch = async () => {
    if (!address.trim()) {
      setGeoError("주소를 입력해 주세요.");
      return;
    }
    setGeoError("");
    setGeoStatus("");
    setGeoLoading(true);
    try {
      const res = await fetch(
        `/api/geocode?q=${encodeURIComponent(address.trim())}`
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
      setLat(nextLat);
      setLon(nextLon);
      await fetchNearby({ lat: nextLat, lon: nextLon });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setGeoError(msg);
    } finally {
      setGeoLoading(false);
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
    if (typeof window !== "undefined" && !window.isSecureContext && !isLocalhost) {
      setGeoError("현재 위치 기능은 HTTPS 또는 localhost에서만 동작합니다.");
      return;
    }

    setGeoError("");
    setGeoStatus("");
    setGeoLoading(true);
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
      setLat(nextLat);
      setLon(nextLon);
      await fetchNearby({ lat: nextLat, lon: nextLon });
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
          if (!resp.ok || !Number.isFinite(json.lat) || !Number.isFinite(json.lon)) {
            const msg = json?.error ?? "현재 위치를 확인할 수 없습니다.";
            setGeoError(msg);
            return;
          }

          const nextLat = String(json.lat);
          const nextLon = String(json.lon);
          setLat(nextLat);
          setLon(nextLon);
          await fetchNearby({ lat: nextLat, lon: nextLon });
          setGeoStatus(
            json.label
              ? `GPS 위치를 가져오지 못해 대략 위치(${json.label})로 조회했습니다.`
              : "GPS 위치를 가져오지 못해 대략 위치로 조회했습니다."
          );
          return;
        } catch {
          setGeoError("현재 위치를 확인할 수 없습니다. GPS/네트워크를 확인해 주세요.");
          return;
        }
      }
      const msg = error instanceof Error ? error.message : String(error);
      setGeoError(msg || "현재 위치를 가져오지 못했습니다.");
    } finally {
      setGeoLoading(false);
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

  return (
    <section className="space-y-4">
    <Card className="border border-border/70">
      <CardHeader>
        <CardTitle className="text-base font-semibold">
          위치로 가까운 교차로 찾기
        </CardTitle>
        <CardDescription>
          ※ 교차로 목록(data/data.json)에 없는 경우 검색되지 않습니다.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[1.5fr_auto] sm:items-end">
          <label className="text-xs text-muted-foreground">
            주소/역 이름으로 찾기
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="mt-2"
              placeholder="예: 지역명, 교차로명, 도로명 주소"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleAddressSearch} disabled={geoLoading}>
              {geoLoading ? "검색 중..." : "주소 검색"}
            </Button>
            <Button
              variant="outline"
              onClick={() => void handleUseLocation()}
              disabled={geoLoading}
            >
              현재 위치
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          역 이름(권장), 사거리/교차로명, 도로명 주소 모두 검색할 수 있습니다.
        </p>
        <p className="text-xs text-muted-foreground">
          예: 중심역, 중앙사거리, 중앙로 10
        </p>
        {geoStatus && (
          <div className="flex items-center">
            <Badge variant="outline">{geoStatus}</Badge>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-muted-foreground">
            위도
            <Input
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              className="mt-2"
            />
          </label>
          <label className="text-xs text-muted-foreground">
            경도
            <Input
              value={lon}
              onChange={(e) => setLon(e.target.value)}
              className="mt-2"
            />
          </label>
        </div>
        <Button variant="secondary" onClick={() => void fetchNearby()}>
          가까운 교차로 찾기
        </Button>

        {geoError && (
          <Alert variant="destructive">
            <AlertTitle>위치 확인 실패</AlertTitle>
            <AlertDescription>{geoError}</AlertDescription>
          </Alert>
        )}

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
          <div className="space-y-2">
            {favorites.length === 0 ? (
              <div className="rounded-md border border-border/60 bg-muted/40 p-3 text-xs text-muted-foreground">
                즐겨찾기한 교차로가 없습니다.
              </div>
            ) : (
              favorites.map((f) => (
                <Card key={f.itstId} className="border border-border/60">
                  <CardContent className="flex items-center justify-between gap-3 pt-4">
                    <div>
                      <div className="text-sm font-semibold">
                        {f.itstNm} (ID: {f.itstId})
                      </div>
                      <div className="text-xs text-muted-foreground">
                        좌표: {f.lat}, {f.lon}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onSelectItstId(f.itstId)}
                      >
                        조회
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeFavorite(f.itstId)}
                      >
                        제거
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}

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
          <div className="space-y-2">
            {!nearbyData.items || nearbyData.items.length === 0 ? (
              <div className="rounded-md border border-border/60 bg-muted/40 p-3 text-xs text-muted-foreground">
                결과 없음(교차로 목록 미로드 또는 좌표 범위 확인)
              </div>
            ) : (
              <>
                <div className="text-xs text-muted-foreground">
                  가장 가까운 교차로 (상위 {nearbyData.items.length}개)
                </div>
                {nearbyData.items.map((it: NearbyItem) => (
                  <Card key={it.itstId} className="border border-border/60">
                    <CardContent className="space-y-2 pt-4">
                      <div className="text-sm font-semibold">
                        {it.itstNm} (ID: {it.itstId})
                      </div>
                      <div className="text-xs text-muted-foreground">
                        거리: {it.distanceM.toFixed(0)}m · 좌표: {it.lat},{" "}
                        {it.lon}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onSelectItstId(it.itstId)}
                      >
                        이 교차로로 조회
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => addFavorite(it)}
                      >
                        즐겨찾기 추가
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </>
            )}
          </div>
        ) : null}

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
