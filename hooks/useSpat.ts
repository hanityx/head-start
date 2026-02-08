import { useCallback, useState } from "react";
import type { SpatResponse } from "@/lib/types";

export function useSpat({
  itstId,
  timeoutMs,
}: {
  itstId: string;
  timeoutMs: string;
}) {
  const [spatData, setSpatData] = useState<SpatResponse | null>(null);
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  const fetchSpat = useCallback(async () => {
    setError("");
    setIsLoading(true);
    try {
      const res = await fetch(
        `/api/spat?itstId=${encodeURIComponent(
          itstId
        )}&timeoutMs=${encodeURIComponent(timeoutMs)}`
      );
      const json = (await res.json()) as SpatResponse;
      if (!res.ok) {
        throw new Error(
          `HTTP ${res.status} ${res.statusText}\n${JSON.stringify(
            json,
            null,
            2
          )}`
        );
      }
      setSpatData(json);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [itstId, timeoutMs]);

  return {
    spatData,
    error,
    isLoading,
    fetchSpat,
    setError,
  };
}
