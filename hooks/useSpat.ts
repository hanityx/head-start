import { useCallback, useState } from "react";
import type { SpatResponse } from "@/lib/types";

export type SpatErrorDetail = {
  httpStatus: number;
  error: string;
  failedEndpoints?: string[];
  timingErr?: string | null;
  phaseErr?: string | null;
};

export function useSpat({
  itstId,
  timeoutMs,
}: {
  itstId: string;
  timeoutMs: string;
}) {
  const [spatData, setSpatData] = useState<SpatResponse | null>(null);
  const [error, setError] = useState<string>("");
  const [errorDetail, setErrorDetail] = useState<SpatErrorDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchSpat = useCallback(async () => {
    setError("");
    setErrorDetail(null);
    setIsLoading(true);
    try {
      const res = await fetch(
        `/api/spat?itstId=${encodeURIComponent(itstId)}&timeoutMs=${encodeURIComponent(timeoutMs)}`
      );
      const json = (await res.json()) as SpatResponse & {
        error?: string;
        failedEndpoints?: string[];
        detail?: { timingErr?: string | null; phaseErr?: string | null };
      };
      if (!res.ok) {
        setErrorDetail({
          httpStatus: res.status,
          error: json.error ?? res.statusText,
          failedEndpoints: json.failedEndpoints,
          timingErr: json.detail?.timingErr,
          phaseErr: json.detail?.phaseErr,
        });
        setError(`HTTP ${res.status}: ${json.error ?? res.statusText}`);
        return;
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
    errorDetail,
    isLoading,
    fetchSpat,
    setError,
  };
}
