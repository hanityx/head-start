import { useCallback, useEffect, useRef, useState } from "react";
import Head from "next/head";
import Link from "next/link";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useSpat } from "@/hooks/useSpat";
import { DEFAULT_ITST_ID } from "@/lib/defaults";
import type { NearbyItem, SpatItem } from "@/lib/types";

const DEFAULT_TIMEOUT_MS = "25000";
const AUTO_REFRESH_MS = 3000;
const NEARBY_SUGGEST_COUNT = 5;
const GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 8000,
  maximumAge: 60000,
};

const sanitizeDigits = (raw: string) => raw.replace(/\D/g, "");

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const isIos = (ua: string) => /iphone|ipad|ipod/i.test(ua);
const isSafari = (ua: string) =>
  /safari/i.test(ua) && !/crios|chrome|fxios|edgios|edg/i.test(ua);

const statusLabel = (status: string | null) => {
  if (!status) return "상태 미확인";
  if (status === "stop-And-Remain") return "정지";
  if (status === "protected-Movement-Allowed") return "진행";
  if (status === "permissive-Movement-Allowed") return "주의 진행";
  return status;
};

const timeLabel = (sec: number | null) => {
  if (sec === null || sec === undefined || !Number.isFinite(sec)) return "-";
  return `${sec.toFixed(1)}초`;
};

export default function QuickPage() {
  const [itstId, setItstId] = useState(DEFAULT_ITST_ID);
  const [autoFetchOnce, setAutoFetchOnce] = useState(false);
  const [isAuto, setIsAuto] = useState(false);
  const [itstNameHint, setItstNameHint] = useState("");
  const [nearbyItems, setNearbyItems] = useState<NearbyItem[]>([]);
  const [nearbyError, setNearbyError] = useState("");
  const [nearbyStatus, setNearbyStatus] = useState("");
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIosSafari, setIsIosSafari] = useState(false);
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [installLoading, setInstallLoading] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<InstallPromptEvent | null>(
    null
  );
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { spatData, error, isLoading, fetchSpat } = useSpat({
    itstId,
    timeoutMs: DEFAULT_TIMEOUT_MS,
  });

  const resolveNearby = useCallback(async (lat: number, lon: number) => {
    const res = await fetch(
      `/api/nearby?lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(
        String(lon)
      )}&k=${encodeURIComponent(String(NEARBY_SUGGEST_COUNT))}`
    );
    const json = (await res.json()) as { items?: NearbyItem[]; error?: string };
    if (!res.ok) {
      throw new Error(json.error ?? "주변 교차로를 찾지 못했습니다.");
    }
    return Array.isArray(json.items) ? json.items : [];
  }, []);

  const applyNearbyItems = useCallback((items: NearbyItem[]) => {
    setNearbyItems(items);
    if (!items.length) return;
    const nearest = items[0];
    setItstId(nearest.itstId);
    setItstNameHint(nearest.itstNm ?? "");
    localStorage.setItem("lastItstId", nearest.itstId);
  }, []);

  const selectNearby = (item: NearbyItem) => {
    setItstId(item.itstId);
    setItstNameHint(item.itstNm ?? "");
    localStorage.setItem("lastItstId", item.itstId);
    setAutoFetchOnce(true);
  };

  const runIpBasedBootstrap = useCallback(async () => {
    setNearbyError("");
    setNearbyStatus("대략 위치로 주변 교차로 찾는 중...");
    setNearbyLoading(true);
    try {
      const ipRes = await fetch("/api/ip-location");
      const ipJson = (await ipRes.json()) as {
        lat?: number;
        lon?: number;
        label?: string;
        error?: string;
      };
      const lat = Number(ipJson.lat);
      const lon = Number(ipJson.lon);
      if (!ipRes.ok || !Number.isFinite(lat) || !Number.isFinite(lon)) {
        throw new Error(ipJson.error ?? "위치를 확인하지 못했습니다.");
      }

      const items = await resolveNearby(lat, lon);
      applyNearbyItems(items);
      setNearbyStatus(
        ipJson.label
          ? `대략 위치(${ipJson.label}) 기준 교차로를 불러왔습니다.`
          : "대략 위치 기준 교차로를 불러왔습니다."
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setNearbyError(msg);
      setNearbyStatus("");
    } finally {
      setNearbyLoading(false);
    }
  }, [applyNearbyItems, resolveNearby]);

  const handleUseCurrentLocation = async () => {
    if (!navigator?.geolocation) {
      setNearbyError("현재 위치를 지원하지 않는 브라우저입니다.");
      return;
    }
    const isLocalhost =
      typeof window !== "undefined" &&
      ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
    if (typeof window !== "undefined" && !window.isSecureContext && !isLocalhost) {
      setNearbyError("현재 위치는 HTTPS 환경에서만 사용할 수 있습니다.");
      return;
    }

    setNearbyError("");
    setNearbyStatus("현재 위치 확인 중...");
    setGpsLoading(true);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, GEO_OPTIONS);
      });

      const items = await resolveNearby(pos.coords.latitude, pos.coords.longitude);
      applyNearbyItems(items);
      setNearbyStatus("현재 위치 기준 교차로를 불러왔습니다.");
      setAutoFetchOnce(true);
    } catch (e: unknown) {
      const geErr = e as GeolocationPositionError;
      if (geErr?.code === geErr?.PERMISSION_DENIED) {
        setNearbyError("위치 권한을 허용해 주세요.");
      } else if (geErr?.code === geErr?.TIMEOUT) {
        setNearbyError("위치 확인 시간이 초과되었습니다.");
      } else {
        const msg = e instanceof Error ? e.message : String(e);
        setNearbyError(msg || "현재 위치를 확인하지 못했습니다.");
      }
      setNearbyStatus("");
    } finally {
      setGpsLoading(false);
    }
  };

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

      if (fromQuery || fromStorage) {
        if (shouldAuto) setAutoFetchOnce(true);
        return;
      }

      await runIpBasedBootstrap();
      if (active && shouldAuto) {
        setAutoFetchOnce(true);
      }
    };

    void boot();
    return () => {
      active = false;
    };
  }, [runIpBasedBootstrap]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    setIsStandalone(standalone);

    const ua = navigator.userAgent.toLowerCase();
    const iosSafari = isIos(ua) && isSafari(ua);
    setIsIosSafari(iosSafari);
    if (!standalone && iosSafari) {
      setShowInstallGuide(true);
    }

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as InstallPromptEvent);
      setShowInstallGuide(true);
    };

    const onInstalled = () => {
      setDeferredPrompt(null);
      setShowInstallGuide(false);
      setIsStandalone(true);
    };

    const mql = window.matchMedia("(display-mode: standalone)");
    const onDisplayModeChange = (event: MediaQueryListEvent) => {
      if (event.matches) {
        setIsStandalone(true);
        setShowInstallGuide(false);
      }
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    mql.addEventListener("change", onDisplayModeChange);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      mql.removeEventListener("change", onDisplayModeChange);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!itstId.trim()) return;
    localStorage.setItem("lastItstId", itstId);
  }, [itstId]);

  useEffect(() => {
    if (!spatData) return;
    if (spatData.itstId !== itstId) return;
    if (spatData.itstNm) {
      setItstNameHint(spatData.itstNm);
    }
  }, [itstId, spatData]);

  useEffect(() => {
    if (!autoFetchOnce || !itstId.trim()) return;
    void fetchSpat();
    setAutoFetchOnce(false);
  }, [autoFetchOnce, fetchSpat, itstId]);

  useEffect(() => {
    if (!isAuto) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    void fetchSpat();
    timerRef.current = setInterval(() => {
      void fetchSpat();
    }, AUTO_REFRESH_MS);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [fetchSpat, isAuto]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    setInstallLoading(true);
    try {
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice;
    } finally {
      setInstallLoading(false);
      setDeferredPrompt(null);
    }
  };

  const canPromptInstall = Boolean(deferredPrompt);
  const shouldShowInstallGuide = !isStandalone && showInstallGuide;
  const activeName =
    (spatData?.itstId === itstId ? spatData.itstNm : null) ||
    nearbyItems.find((item) => item.itstId === itstId)?.itstNm ||
    itstNameHint ||
    "";

  return (
    <>
      <Head>
        <title>빠른 신호 조회</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>

      <main className="mx-auto min-h-dvh w-full max-w-lg space-y-4 px-4 pb-8 pt-5">
        {shouldShowInstallGuide ? (
          <Card className="border border-border/70">
            <CardHeader className="space-y-2">
              <CardTitle className="text-sm">앱처럼 빠르게 사용</CardTitle>
              <div className="text-xs text-muted-foreground">
                {canPromptInstall
                  ? "설치 후 홈 화면 아이콘으로 바로 실행할 수 있습니다."
                  : "처음 한 번만 설치하면 다음부터 1탭으로 열립니다."}
              </div>
              {isIosSafari ? (
                <div className="text-xs text-muted-foreground">
                  iPhone/iPad: Safari 공유 버튼 → 홈 화면에 추가
                </div>
              ) : null}
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {canPromptInstall ? (
                <Button size="sm" onClick={() => void handleInstall()} disabled={installLoading}>
                  {installLoading ? "설치 준비 중..." : "앱 설치"}
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowInstallGuide(false)}
              >
                안내 닫기
              </Button>
            </CardContent>
          </Card>
        ) : null}

        <Card className="border border-border/70">
          <CardHeader className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">빠른 신호 조회</CardTitle>
              <Badge variant={isAuto ? "default" : "outline"}>
                {isAuto ? "자동 갱신 중" : "수동"}
              </Badge>
            </div>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">
                <div className="flex items-center justify-between gap-2">
                  <span>교차로 ID</span>
                  {activeName ? (
                    <span className="truncate text-[11px] text-foreground">{activeName}</span>
                  ) : null}
                </div>
                <Input
                  className="mt-2"
                  value={itstId}
                  onChange={(e) => {
                    setItstId(sanitizeDigits(e.target.value));
                    setItstNameHint("");
                  }}
                  placeholder={`예: ${DEFAULT_ITST_ID}`}
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void fetchSpat()} disabled={isLoading}>
                  {isLoading ? "조회 중..." : "조회"}
                </Button>
                <Button variant="outline" onClick={() => setIsAuto((prev) => !prev)}>
                  {isAuto ? "자동 끄기" : "자동 켜기"}
                </Button>
                <Button variant="ghost" asChild>
                  <Link href="/">전체 화면</Link>
                </Button>
              </div>
              <div className="rounded-md border border-border/60 bg-muted/20 p-3">
                <div className="mb-2 text-xs font-semibold text-foreground">
                  위치 기반으로 교차로 선택
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void handleUseCurrentLocation()}
                    disabled={gpsLoading || nearbyLoading}
                  >
                    {gpsLoading ? "위치 확인 중..." : "현재 위치 사용"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void runIpBasedBootstrap()}
                    disabled={nearbyLoading}
                  >
                    {nearbyLoading ? "불러오는 중..." : "대략 위치로 찾기"}
                  </Button>
                </div>
                {nearbyStatus ? (
                  <div className="mt-2 text-[11px] text-muted-foreground">{nearbyStatus}</div>
                ) : null}
                {nearbyError ? (
                  <div className="mt-2 text-[11px] text-destructive">{nearbyError}</div>
                ) : null}
                {nearbyItems.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {nearbyItems.map((item) => (
                      <Button
                        key={item.itstId}
                        size="sm"
                        variant={item.itstId === itstId ? "default" : "outline"}
                        onClick={() => selectNearby(item)}
                        className="h-auto py-1.5"
                      >
                        {item.itstNm}
                      </Button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {spatData ? (
              <div className="text-xs text-muted-foreground">
                <div>
                  교차로: <b>{spatData.itstNm ?? "-"}</b>
                </div>
                <div>
                  조회 시간: <b>{spatData.fetchedAtKst ?? "-"}</b>
                </div>
              </div>
            ) : null}

            {error ? (
              <Alert variant="destructive">
                <AlertTitle>조회 실패</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            {spatData?.items?.length ? (
              <div className="space-y-2">
                {spatData.items.map((item: SpatItem) => (
                  <div
                    key={item.key ?? item.phaseKey ?? `${item.title}-${item.dirCode}-${item.movCode}`}
                    className="rounded-md border border-border/60 bg-muted/20 p-3"
                  >
                    <div className="text-sm font-semibold">{item.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {statusLabel(item.status)} · 남은 {timeLabel(item.sec)}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </main>
    </>
  );
}
