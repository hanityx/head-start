import { useState } from "react";
import type { NearbyResponse } from "@/lib/types";

export function useNearby({
  lat,
  lon,
  k = 5,
}: {
  lat: string;
  lon: string;
  k?: number;
}) {
  const [nearbyData, setNearbyData] = useState<NearbyResponse | null>(null);
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  const fetchNearby = async (
    override?: { lat?: string; lon?: string; k?: number }
  ): Promise<NearbyResponse | null> => {
    const targetLat = override?.lat ?? lat;
    const targetLon = override?.lon ?? lon;
    const targetK = override?.k ?? k;
    setNearbyData(null);
    setIsLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/nearby?lat=${encodeURIComponent(targetLat)}&lon=${encodeURIComponent(
          targetLon
        )}&k=${encodeURIComponent(String(targetK))}`
      );
      const json = (await res.json()) as NearbyResponse;
      if (!res.ok) throw new Error(JSON.stringify(json, null, 2));
      setNearbyData(json);
      return json;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      return null;
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
