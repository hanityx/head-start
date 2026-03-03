import { useCallback, useState } from "react";
import type { NearbyItem } from "@/lib/types";

const GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 8000,
  maximumAge: 60000,
};

type BootstrapResult = {
  items: NearbyItem[];
  label?: string;
};

type State = {
  loading: boolean;
  gpsLoading: boolean;
  error: string;
  status: string;
};

export function useLocationBootstrap(nearbyK = 5) {
  const [state, setState] = useState<State>({
    loading: false,
    gpsLoading: false,
    error: "",
    status: "",
  });

  const fetchNearby = useCallback(
    async (lat: number, lon: number): Promise<NearbyItem[]> => {
      const res = await fetch(
        `/api/nearby?lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(String(lon))}&k=${nearbyK}`
      );
      const json = (await res.json()) as { items?: NearbyItem[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? "주변 교차로를 찾지 못했습니다.");
      return Array.isArray(json.items) ? json.items : [];
    },
    [nearbyK]
  );

  const bootstrapByIp = useCallback(async (): Promise<BootstrapResult> => {
    setState((s) => ({ ...s, loading: true, error: "", status: "대략 위치로 주변 교차로 찾는 중..." }));
    try {
      const ipRes = await fetch("/api/ip-location");
      const ipJson = (await ipRes.json()) as { lat?: number; lon?: number; label?: string; error?: string };
      const lat = Number(ipJson.lat);
      const lon = Number(ipJson.lon);
      if (!ipRes.ok || !Number.isFinite(lat) || !Number.isFinite(lon)) {
        throw new Error(ipJson.error ?? "위치를 확인하지 못했습니다.");
      }
      const items = await fetchNearby(lat, lon);
      const label = ipJson.label ?? "";
      setState((s) => ({
        ...s,
        status: label ? `${label} 기준 교차로를 불러왔습니다.` : "대략 위치 기준 교차로를 불러왔습니다.",
        error: "",
      }));
      return { items, label };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setState((s) => ({ ...s, error: msg, status: "" }));
      return { items: [] };
    } finally {
      setState((s) => ({ ...s, loading: false }));
    }
  }, [fetchNearby]);

  const bootstrapByGps = useCallback(async (): Promise<BootstrapResult> => {
    if (!navigator?.geolocation) {
      setState((s) => ({ ...s, error: "현재 위치를 지원하지 않는 브라우저입니다." }));
      return { items: [] };
    }
    setState((s) => ({ ...s, gpsLoading: true, error: "", status: "현재 위치 확인 중..." }));
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, GEO_OPTIONS);
      });
      const items = await fetchNearby(pos.coords.latitude, pos.coords.longitude);
      setState((s) => ({ ...s, status: "현재 위치 기준 교차로를 불러왔습니다.", error: "" }));
      return { items };
    } catch (e: unknown) {
      const geErr = e as GeolocationPositionError;
      let msg = "현재 위치를 확인하지 못했습니다.";
      if (geErr?.code === geErr?.PERMISSION_DENIED) msg = "위치 권한을 허용해 주세요.";
      else if (geErr?.code === geErr?.TIMEOUT) msg = "위치 확인 시간이 초과되었습니다.";
      else if (e instanceof Error) msg = e.message;
      setState((s) => ({ ...s, error: msg, status: "" }));
      return { items: [] };
    } finally {
      setState((s) => ({ ...s, gpsLoading: false }));
    }
  }, [fetchNearby]);

  const clearError = useCallback(() => {
    setState((s) => ({ ...s, error: "" }));
  }, []);

  return {
    ...state,
    fetchNearby,
    bootstrapByIp,
    bootstrapByGps,
    clearError,
  };
}
