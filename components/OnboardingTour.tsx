import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export type TourStep = {
  selector: string;
  title: string;
  description: string;
};

const TOOLTIP_MAX_WIDTH = 360;
const TOOLTIP_MIN_HEIGHT = 170;
const MOBILE_BREAKPOINT = 640;
const MOBILE_TOOLTIP_MIN_HEIGHT = 160;
const MOBILE_TOOLTIP_MAX_HEIGHT = 210;
const VIEWPORT_PADDING = 12;
const HIGHLIGHT_PADDING = 10;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export function OnboardingTour({
  open,
  steps,
  restartKey = 0,
  onClose,
  onComplete,
}: {
  open: boolean;
  steps: TourStep[];
  restartKey?: number;
  onClose: () => void;
  onComplete: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    setStepIndex(0);
  }, [open, restartKey]);

  const currentStep = steps[stepIndex] ?? null;

  const getCurrentTarget = useCallback(() => {
    if (!open || !currentStep) return null;
    return document.querySelector<HTMLElement>(currentStep.selector);
  }, [currentStep, open]);

  const updateTargetRect = useCallback(() => {
    const target = getCurrentTarget();
    setTargetRect(target ? target.getBoundingClientRect() : null);
  }, [getCurrentTarget]);

  const scrollTargetIntoView = useCallback(() => {
    const target = getCurrentTarget();
    if (!target || typeof target.scrollIntoView !== "function") return;
    const isMobileViewport = window.innerWidth <= MOBILE_BREAKPOINT;
    target.scrollIntoView({
      block: isMobileViewport ? "start" : "center",
      inline: "nearest",
      behavior: "smooth",
    });
  }, [getCurrentTarget]);

  useEffect(() => {
    if (!open || !currentStep) {
      setTargetRect(null);
      return;
    }
    scrollTargetIntoView();
    updateTargetRect();
    const raf = window.requestAnimationFrame(updateTargetRect);
    const onViewportChanged = () => updateTargetRect();
    window.addEventListener("resize", onViewportChanged);
    window.addEventListener("scroll", onViewportChanged, true);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", onViewportChanged);
      window.removeEventListener("scroll", onViewportChanged, true);
    };
  }, [currentStep, open, scrollTargetIntoView, updateTargetRect]);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  const handlePrev = useCallback(() => {
    setStepIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const handleNext = useCallback(() => {
    if (stepIndex >= steps.length - 1) {
      onComplete();
      return;
    }
    setStepIndex((prev) => Math.min(steps.length - 1, prev + 1));
  }, [onComplete, stepIndex, steps.length]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        handlePrev();
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        handleNext();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [handleNext, handlePrev, onClose, open]);

  const geometry = useMemo(() => {
    if (!mounted || !open) return null;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const isMobile = vw <= MOBILE_BREAKPOINT;
    const tipWidth = isMobile
      ? vw - VIEWPORT_PADDING * 2
      : Math.min(TOOLTIP_MAX_WIDTH, vw - VIEWPORT_PADDING * 2);
    const tooltipMaxHeight = isMobile
      ? clamp(
          Math.floor(vh * 0.38),
          MOBILE_TOOLTIP_MIN_HEIGHT,
          MOBILE_TOOLTIP_MAX_HEIGHT,
        )
      : vh - VIEWPORT_PADDING * 2;
    const tooltipAnchorHeight = isMobile
      ? tooltipMaxHeight
      : Math.min(TOOLTIP_MIN_HEIGHT, tooltipMaxHeight);

    const highlight = targetRect
      ? {
          top: clamp(targetRect.top - HIGHLIGHT_PADDING, 6, vh - 24),
          left: clamp(targetRect.left - HIGHLIGHT_PADDING, 6, vw - 24),
          width: clamp(
            targetRect.width + HIGHLIGHT_PADDING * 2,
            24,
            vw - VIEWPORT_PADDING,
          ),
          height: clamp(
            targetRect.height + HIGHLIGHT_PADDING * 2,
            24,
            vh - VIEWPORT_PADDING,
          ),
        }
      : null;

    const anchor = highlight
      ? {
          x: highlight.left + highlight.width * 0.5,
          y: highlight.top + Math.min(28, highlight.height * 0.5),
        }
      : {
          x: vw * 0.5,
          y: vh * 0.45,
        };

    const tooltipLeft = isMobile
      ? VIEWPORT_PADDING
      : highlight
        ? clamp(
            highlight.left,
            VIEWPORT_PADDING,
            vw - tipWidth - VIEWPORT_PADDING,
          )
        : clamp(
            vw * 0.5 - tipWidth * 0.5,
            VIEWPORT_PADDING,
            vw - tipWidth - VIEWPORT_PADDING,
          );

    const tooltipTop = isMobile
      ? vh - tooltipMaxHeight - VIEWPORT_PADDING
      : (() => {
          const prefersBottom = !highlight || highlight.top < vh * 0.45;
          const tooltipTopRaw = highlight
            ? prefersBottom
              ? highlight.top + highlight.height + 16
              : highlight.top - (tooltipAnchorHeight + 16)
            : vh * 0.5 - tooltipAnchorHeight * 0.5;
          return clamp(
            tooltipTopRaw,
            VIEWPORT_PADDING,
            vh - tooltipAnchorHeight - VIEWPORT_PADDING,
          );
        })();

    return {
      highlight,
      isMobile,
      cursorX: clamp(anchor.x, 14, vw - 14),
      cursorY: clamp(anchor.y, 14, vh - 14),
      tooltipTop,
      tooltipLeft,
      tooltipWidth: tipWidth,
      tooltipMaxHeight,
    };
  }, [mounted, open, targetRect]);

  if (!mounted || !open || !currentStep || !geometry) return null;

  return createPortal(
    <div className="fixed inset-0 z-[120]">
      {!geometry.highlight && <div className="absolute inset-0 bg-slate-950/55" />}

      {geometry.highlight && (
        <div
          className="pointer-events-none fixed rounded-xl border border-cyan-300/90 transition-[top,left,width,height] duration-500 ease-out"
          style={{
            top: geometry.highlight.top,
            left: geometry.highlight.left,
            width: geometry.highlight.width,
            height: geometry.highlight.height,
            boxShadow:
              "0 0 0 9999px rgba(2, 6, 23, 0.5), 0 0 26px rgba(56, 189, 248, 0.42)",
          }}
        />
      )}

      <div
        className="pointer-events-none fixed z-[121] h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary transition-[top,left] duration-700 ease-out"
        style={{ top: geometry.cursorY, left: geometry.cursorX }}
      >
        <span className="absolute inset-0 rounded-full bg-primary/45 animate-ping" />
      </div>

      <section
        role="dialog"
        aria-modal="true"
        aria-label="사용 가이드 투어"
        className={`fixed z-[122] overflow-y-auto rounded-xl border border-border/80 bg-card text-card-foreground shadow-card ${
          geometry.isMobile ? "p-3" : "p-4"
        }`}
        style={{
          top: geometry.tooltipTop,
          left: geometry.tooltipLeft,
          width: geometry.tooltipWidth,
          maxHeight: geometry.tooltipMaxHeight,
        }}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <Badge variant="secondary" className="font-semibold">
            {stepIndex + 1} / {steps.length}
          </Badge>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border/70 px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
          >
            건너뛰기
          </button>
        </div>

        <h2 className={`font-semibold text-foreground ${geometry.isMobile ? "text-sm" : "text-base"}`}>
          {currentStep.title}
        </h2>
        <p
          className={`mt-2 text-muted-foreground ${
            geometry.isMobile ? "text-xs leading-5" : "text-sm leading-6"
          }`}
        >
          {currentStep.description}
        </p>
        <div className={`flex items-center gap-1.5 ${geometry.isMobile ? "mt-2" : "mt-3"}`}>
          {steps.map((_, index) => (
            <span
              key={index}
              className={`h-1.5 rounded-full transition-all ${
                index === stepIndex ? "w-6 bg-primary" : "w-2.5 bg-muted"
              }`}
            />
          ))}
        </div>
        <p className={`text-xs text-muted-foreground ${geometry.isMobile ? "mt-2" : "mt-3"}`}>
          {geometry.isMobile
            ? "아래 카드에서 단계별로 진행하세요."
            : "커서를 따라 진행하세요."}
        </p>

        <div className={`flex items-center justify-between gap-2 ${geometry.isMobile ? "mt-3" : "mt-4"}`}>
          <Button
            size="sm"
            variant="outline"
            onClick={handlePrev}
            disabled={stepIndex === 0}
          >
            이전
          </Button>
          <Button size="sm" onClick={handleNext}>
            {stepIndex === steps.length - 1 ? "완료" : "다음"}
          </Button>
        </div>
      </section>
    </div>,
    document.body,
  );
}
