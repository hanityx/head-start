import { useCallback, useEffect, useState } from "react";
import Head from "next/head";
import { OnboardingTour, type TourStep } from "@/components/OnboardingTour";
import { SignalSection } from "@/components/sections/SignalSection";
import { NearbySection } from "@/components/sections/NearbySection";
import { DEFAULT_ITST_ID } from "@/lib/defaults";

const ONBOARDING_STORAGE_KEY = "onboarding:v1";
const ONBOARDING_COOKIE_KEY = "onboarding_v1";
const ONBOARDING_DONE_VALUE = "done";
const ONBOARDING_COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 365 * 2;

const readCookie = (key: string) => {
  if (typeof document === "undefined") return null;
  const encodedKey = `${encodeURIComponent(key)}=`;
  const found = document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith(encodedKey));
  if (!found) return null;
  return decodeURIComponent(found.slice(encodedKey.length));
};

const writeCookie = (key: string, value: string, maxAgeSec: number) => {
  if (typeof document === "undefined") return;
  document.cookie = `${encodeURIComponent(key)}=${encodeURIComponent(
    value,
  )}; path=/; max-age=${maxAgeSec}; samesite=lax`;
};

const hasCompletedOnboarding = () => {
  if (typeof window === "undefined") return true;
  const localDone =
    localStorage.getItem(ONBOARDING_STORAGE_KEY) === ONBOARDING_DONE_VALUE;
  const cookieDone = readCookie(ONBOARDING_COOKIE_KEY) === ONBOARDING_DONE_VALUE;

  if (!localDone && cookieDone) {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, ONBOARDING_DONE_VALUE);
  }
  if (localDone && !cookieDone) {
    writeCookie(
      ONBOARDING_COOKIE_KEY,
      ONBOARDING_DONE_VALUE,
      ONBOARDING_COOKIE_MAX_AGE_SEC,
    );
  }

  return localDone || cookieDone;
};

const HOME_TOUR_STEPS_DESKTOP: TourStep[] = [
  {
    selector: '[data-tour="signal-input"]',
    title: "교차로 ID를 먼저 확인하세요",
    description: "여기서 ID를 직접 입력하거나, 오른쪽 주변 교차로 목록 선택으로 자동 입력할 수 있습니다.",
  },
  {
    selector: '[data-tour="signal-fetch"]',
    title: "조회 버튼으로 즉시 확인",
    description: "조회 버튼을 누르면 현재 신호 상태와 잔여시간을 바로 가져옵니다.",
  },
  {
    selector: '[data-tour="signal-auto"]',
    title: "자동 갱신으로 계속 보기",
    description: "같은 교차로를 계속 볼 때 자동 갱신을 켜면 일정 주기마다 값을 다시 받아옵니다.",
  },
  {
    selector: '[data-tour="nearby-location"]',
    title: "주소/현재 위치로 탐색",
    description: "위치 정하기에서 주소 검색 또는 현재 위치 버튼으로 주변 교차로를 빠르게 찾을 수 있습니다.",
  },
  {
    selector: '[data-tour="nearby-select"]',
    title: "목록에서 바로 조회 연결",
    description: "교차로 선택 영역에서 이 ID로 조회를 누르면 입력창과 조회가 한 번에 연결됩니다.",
  },
];

const HOME_TOUR_STEPS_MOBILE: TourStep[] = [
  {
    selector: '[data-tour="signal-input"]',
    title: "교차로 ID",
    description: "왼쪽(모바일은 위) 입력창에 ID를 넣거나, 주변 목록 선택으로 자동 입력하세요.",
  },
  {
    selector: '[data-tour="signal-fetch"]',
    title: "조회",
    description: "조회 버튼으로 현재 신호 상태와 남은 시간을 바로 확인합니다.",
  },
  {
    selector: '[data-tour="signal-auto"]',
    title: "자동 갱신",
    description: "계속 볼 때 자동 갱신을 켜면 주기적으로 업데이트됩니다.",
  },
  {
    selector: '[data-tour="nearby-location"]',
    title: "위치 선택",
    description: "주소 검색 또는 현재 위치로 주변 교차로를 찾습니다.",
  },
  {
    selector: '[data-tour="nearby-select"]',
    title: "목록에서 조회 연결",
    description: "목록의 이 ID로 조회를 누르면 입력과 조회가 바로 연결됩니다.",
  },
];

export default function Home() {
  const [itstId, setItstId] = useState(DEFAULT_ITST_ID);
  const [externalFetchTrigger, setExternalFetchTrigger] = useState(0);
  const [allowAutoNearest, setAllowAutoNearest] = useState(true);
  const [isTourOpen, setIsTourOpen] = useState(false);
  const [tourRestartKey, setTourRestartKey] = useState(0);
  const [isMobileViewport, setIsMobileViewport] = useState(false);

  useEffect(() => {
    const saved =
      typeof window !== "undefined" ? localStorage.getItem("lastItstId") : null;
    if (!saved) return;
    const trimmed = saved.trim();
    if (!trimmed || trimmed === "0000") return;
    setItstId(trimmed);
    setAllowAutoNearest(false);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("lastItstId", itstId);
  }, [itstId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (typeof window.matchMedia !== "function") return;
    const mediaQuery = window.matchMedia("(max-width: 640px)");
    const apply = () => {
      setIsMobileViewport(mediaQuery.matches);
    };
    apply();
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", apply);
    } else {
      mediaQuery.addListener(apply);
    }
    return () => {
      if (typeof mediaQuery.removeEventListener === "function") {
        mediaQuery.removeEventListener("change", apply);
      } else {
        mediaQuery.removeListener(apply);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (process.env.NODE_ENV === "test") return;
    const completed = hasCompletedOnboarding();
    if (completed) return;
    const timer = window.setTimeout(() => {
      setTourRestartKey((prev) => prev + 1);
      setIsTourOpen(true);
    }, 350);
    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  const handleItstIdChange = (value: string) => {
    setItstId(value);
    setAllowAutoNearest(false);
  };

  const handleSelectItstIdAndFetch = (value: string) => {
    setItstId(value);
    setAllowAutoNearest(false);
    setExternalFetchTrigger((prev) => prev + 1);
  };

  const markTourCompleted = useCallback(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(ONBOARDING_STORAGE_KEY, ONBOARDING_DONE_VALUE);
    writeCookie(
      ONBOARDING_COOKIE_KEY,
      ONBOARDING_DONE_VALUE,
      ONBOARDING_COOKIE_MAX_AGE_SEC,
    );
  }, []);

  const handleOpenTour = () => {
    setTourRestartKey((prev) => prev + 1);
    setIsTourOpen(true);
  };

  const handleCloseTour = useCallback(() => {
    setIsTourOpen(false);
    markTourCompleted();
  }, [markTourCompleted]);

  const handleCompleteTour = useCallback(() => {
    setIsTourOpen(false);
    markTourCompleted();
  }, [markTourCompleted]);

  const tourSteps = isMobileViewport
    ? HOME_TOUR_STEPS_MOBILE
    : HOME_TOUR_STEPS_DESKTOP;

  return (
    <>
      <Head>
        <title>횡단보도/차량 신호 잔여시간 확인</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="mx-auto max-w-6xl px-4 pb-14 pt-8">
        <div className="rounded-2xl border border-border/60 bg-card/70 p-5 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                V2X SPaT Monitor
              </p>
              <h1 className="mt-2 text-2xl font-semibold text-foreground sm:text-3xl">
                횡단보도/차량 신호 잔여시간 확인
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleOpenTour}
                className="rounded-full border border-border/60 px-3 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted/40"
              >
                도움말 다시 보기
              </button>
              <div className="rounded-full border border-border/60 bg-muted/30 px-3 py-1 text-xs text-muted-foreground">
                실시간/지연 가능
              </div>
            </div>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            서울 T-Data V2X SPaT 기준입니다.
            <b> 통신 상태에 따라 몇 초 지연되거나 값이 잠시 멈춰 보일 수 있습니다.</b>
            <br />
            좌측(모바일은 위)에서 신호를 조회하고, 우측(모바일은 아래)에서 주변 교차로를
            골라 ID를 바로 입력할 수 있습니다.
          </p>
          {!isTourOpen && (
            <p
              data-testid="quick-start-hint"
              className="mt-3 rounded-md border border-border/60 bg-muted/25 px-3 py-2 text-xs text-foreground/90"
            >
              바로 사용: 오른쪽에서 교차로를 선택한 뒤, 왼쪽에서 <b>조회</b>를 누르세요.
            </p>
          )}
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <SignalSection
            itstId={itstId}
            onItstIdChange={handleItstIdChange}
            defaultItstId={DEFAULT_ITST_ID}
            externalFetchTrigger={externalFetchTrigger}
          />
          <NearbySection
            onSelectItstId={handleSelectItstIdAndFetch}
            autoSelectNearest={allowAutoNearest}
          />
        </div>
      </div>

      <OnboardingTour
        open={isTourOpen}
        steps={tourSteps}
        restartKey={tourRestartKey}
        onClose={handleCloseTour}
        onComplete={handleCompleteTour}
      />
    </>
  );
}
