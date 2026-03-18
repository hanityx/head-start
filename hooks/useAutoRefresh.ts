/**
 * hooks/useAutoRefresh.ts
 *
 * enabled가 true인 동안 fetchFn을 intervalMs마다 순차 실행합니다.
 * fetchFn 완료 후 다음 타이머를 등록하는 방식이라 중복 호출 없음.
 */

import { useEffect, useRef } from "react";

type UseAutoRefreshParams = {
  enabled: boolean;
  fetchFn: () => Promise<void>;
  intervalMs: number;
};

export function useAutoRefresh({
  enabled,
  fetchFn,
  intervalMs,
}: UseAutoRefreshParams): void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    let cancelled = false;
    const runLoop = async () => {
      if (cancelled) return;
      await fetchFn();
      if (!cancelled) timerRef.current = setTimeout(runLoop, intervalMs);
    };

    void runLoop();

    return () => {
      cancelled = true;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [enabled, fetchFn, intervalMs]);
}
