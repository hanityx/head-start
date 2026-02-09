import * as React from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/ui";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type SignalTone = "red" | "yellow" | "green" | "gray";
type SignalSize = "sm" | "md" | "lg";
type SignalEmphasis = "normal" | "critical";

export type SignalGuide = {
  icon: LucideIcon;
  label: string;
  directionLabel?: string;
  directionIcon?: LucideIcon;
};

export type SignalCountdownCardProps = {
  title: string;
  guide?: SignalGuide;
  statusLabel: string;
  statusDesc?: string;
  tone: SignalTone;
  timeLabel: string;
  emphasis?: SignalEmphasis;
  size?: SignalSize;
  footer?: React.ReactNode;
  isLoading?: boolean;
};

const sizeMap: Record<SignalSize, string> = {
  sm: "text-xl",
  md: "text-3xl",
  lg: "text-4xl",
};

const toneMap: Record<SignalTone, string> = {
  red: "border-signal-red/40 bg-signal-red/10 text-signal-red",
  yellow: "border-signal-yellow/40 bg-signal-yellow/10 text-signal-yellow",
  green: "border-signal-green/40 bg-signal-green/10 text-signal-green",
  gray: "border-muted/60 bg-muted/40 text-muted-foreground",
};

export function SignalCountdownCard({
  title,
  guide,
  statusLabel,
  statusDesc,
  tone,
  timeLabel,
  emphasis = "normal",
  size = "md",
  footer,
  isLoading = false,
}: SignalCountdownCardProps) {
  return (
    <Card className="border border-border/70">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-sm font-bold">{title}</CardTitle>
          <div className="flex items-center gap-2">
            {isLoading && (
              <span className="inline-flex animate-pulse items-center rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                갱신 중
              </span>
            )}
            <div
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold",
                toneMap[tone]
              )}
              title={statusDesc}
            >
              <span
                aria-hidden="true"
                className="h-2 w-2 rounded-full bg-current"
              />
              {statusLabel}
            </div>
          </div>
        </div>
        {guide && (
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-muted/40 px-2.5 py-1 text-xs font-semibold text-foreground/90">
              <guide.icon className="h-4 w-4" />
              {guide.label}
            </span>
            {guide.directionLabel && (
              <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background px-2.5 py-1 text-xs font-semibold text-foreground/90">
                {guide.directionIcon ? (
                  <guide.directionIcon className="h-4 w-4" />
                ) : null}
                {guide.directionLabel}
              </span>
            )}
          </div>
        )}
        {statusDesc && (
          <CardDescription className="text-xs text-muted-foreground">
            {statusDesc}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <div className="h-8 w-28 animate-pulse rounded-md bg-muted/60" />
            <div className="h-3 w-20 animate-pulse rounded bg-muted/50" />
          </div>
        ) : (
          <div
            className={cn(
              "font-semibold tracking-tight",
              sizeMap[size],
              emphasis === "critical" && "text-destructive"
            )}
          >
            {timeLabel}
          </div>
        )}
        {footer && <div className="mt-2 text-xs text-muted-foreground">{footer}</div>}
      </CardContent>
    </Card>
  );
}
