/**
 * lib/onboarding.ts
 *
 * 온보딩 완료 상태 관리 (localStorage + cookie 이중 동기화).
 * 쿠키를 사용하는 이유: 같은 기기에서 localStorage를 지워도 재표시 방지.
 */

import { readStorage, writeStorage } from "@/lib/storage";

const ONBOARDING_STORAGE_KEY = "onboarding:v1";
const ONBOARDING_COOKIE_KEY = "onboarding_v1";
const ONBOARDING_DONE_VALUE = "done";
const ONBOARDING_COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 365 * 2; // 2년

// ── Cookie helpers ──────────────────────────────────────────────────────────

export function readCookie(key: string): string | null {
  if (typeof document === "undefined") return null;
  const encodedKey = `${encodeURIComponent(key)}=`;
  const found = document.cookie
    .split("; ")
    .find((c) => c.startsWith(encodedKey));
  if (!found) return null;
  return decodeURIComponent(found.slice(encodedKey.length));
}

export function writeCookie(
  key: string,
  value: string,
  maxAgeSec: number,
): void {
  if (typeof document === "undefined") return;
  document.cookie = `${encodeURIComponent(key)}=${encodeURIComponent(
    value,
  )}; path=/; max-age=${maxAgeSec}; samesite=lax`;
}

// ── Onboarding state ────────────────────────────────────────────────────────

/** localStorage와 쿠키 중 하나라도 완료 기록이 있으면 true */
export function hasCompletedOnboarding(): boolean {
  if (typeof window === "undefined") return true;
  const localDone =
    localStorage.getItem(ONBOARDING_STORAGE_KEY) === ONBOARDING_DONE_VALUE;
  const cookieDone =
    readCookie(ONBOARDING_COOKIE_KEY) === ONBOARDING_DONE_VALUE;
  // 두 저장소 간 동기화
  if (!localDone && cookieDone)
    localStorage.setItem(ONBOARDING_STORAGE_KEY, ONBOARDING_DONE_VALUE);
  if (localDone && !cookieDone)
    writeCookie(
      ONBOARDING_COOKIE_KEY,
      ONBOARDING_DONE_VALUE,
      ONBOARDING_COOKIE_MAX_AGE_SEC,
    );
  return localDone || cookieDone;
}

/** 온보딩 완료 기록 — localStorage + cookie 양쪽에 저장 */
export function markOnboardingDone(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(ONBOARDING_STORAGE_KEY, ONBOARDING_DONE_VALUE);
  writeCookie(
    ONBOARDING_COOKIE_KEY,
    ONBOARDING_DONE_VALUE,
    ONBOARDING_COOKIE_MAX_AGE_SEC,
  );
}
