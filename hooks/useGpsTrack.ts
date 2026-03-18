/**
 * hooks/useGpsTrack.ts
 *
 * enabled가 true인 동안 GPS 위치를 실시간으로 추적합니다.
 * enabled가 false가 되면 watchPosition을 즉시 해제합니다.
 */

import { useEffect, useRef, useState } from "react";

type GpsPosition = { lat: number; lon: number };

export function useGpsTrack(enabled: boolean): { position: GpsPosition | null } {
  const [position, setPosition] = useState<GpsPosition | null>(null);
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setPosition(null);
      return;
    }

    if (!navigator.geolocation) return;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) =>
        setPosition({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => {
        /* GPS 거부/불가 시 무시 */
      },
      { enableHighAccuracy: true },
    );

    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [enabled]);

  return { position };
}
