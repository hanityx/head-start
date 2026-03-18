import { useCallback, useEffect, useState } from "react";
import type { TourStep } from "@/components/OnboardingTour";
import { hasCompletedOnboarding, markOnboardingDone } from "@/lib/onboarding";

const TOUR_STEPS_DESKTOP: TourStep[] = [
  {
    selector: '[data-tour="sidebar-toggle"]',
    title: "교차로를 선택하세요",
    description: "클릭하면 주변 교차로 목록과 검색창이 열립니다.",
  },
];

const TOUR_STEPS_MOBILE: TourStep[] = [
  {
    selector: '[data-tour="sidebar-toggle"]',
    title: "교차로 선택",
    description: "탭하면 주변 교차로 목록이 열립니다.",
  },
];

type UseOnboardingResult = {
  isTourOpen: boolean;
  tourRestartKey: number;
  tourSteps: TourStep[];
  onCloseTour: () => void;
  onCompleteTour: () => void;
};

export function useOnboarding(): UseOnboardingResult {
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [isTourOpen, setIsTourOpen] = useState(false);
  const [tourRestartKey, setTourRestartKey] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(max-width: 640px)");
    const apply = () => setIsMobileViewport(mq.matches);
    apply();
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", apply);
    } else {
      (mq as MediaQueryList).addListener(apply);
    }
    return () => {
      if (typeof mq.removeEventListener === "function") {
        mq.removeEventListener("change", apply);
      } else {
        (mq as MediaQueryList).removeListener(apply);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (process.env.NODE_ENV === "test") return;
    if (hasCompletedOnboarding()) return;
    const timer = window.setTimeout(() => {
      setTourRestartKey((prev) => prev + 1);
      setIsTourOpen(true);
    }, 350);
    return () => window.clearTimeout(timer);
  }, []);

  const markDone = useCallback(() => markOnboardingDone(), []);

  const onCloseTour = useCallback(() => {
    setIsTourOpen(false);
    markDone();
  }, [markDone]);

  const onCompleteTour = useCallback(() => {
    setIsTourOpen(false);
    markDone();
  }, [markDone]);

  return {
    isTourOpen,
    tourRestartKey,
    tourSteps: isMobileViewport ? TOUR_STEPS_MOBILE : TOUR_STEPS_DESKTOP,
    onCloseTour,
    onCompleteTour,
  };
}
