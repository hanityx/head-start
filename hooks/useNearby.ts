import { useState } from "react";
import type { NearbyResponse } from "@/lib/types";

export function useNearby({
  lat,
  lon,
}: {
  lat: string;
  lon: string;
}) {
  const [nearbyData, setNearbyData] = useState<NearbyResponse | null>(null);
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  const fetchNearby = async (override?: { lat: string; lon: string }) => {
    const targetLat = override?.lat ?? lat;
    const targetLon = override?.lon ?? lon;
    setNearbyData(null);
    setIsLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/nearby?lat=${encodeURIComponent(targetLat)}&lon=${encodeURIComponent(
          targetLon
        )}&k=5`
      );
      const json = (await res.json()) as NearbyResponse;
      if (!res.ok) throw new Error(JSON.stringify(json, null, 2));
      setNearbyData(json);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    nearbyData,
    error,
    isLoading,
    fetchNearby,
    setError,
  };
}
