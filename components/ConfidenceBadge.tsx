import * as React from "react";

import { cn } from "@/lib/ui";
import { Badge } from "@/components/ui/badge";

type ConfidenceLevel = "high" | "medium" | "low" | "stale";

const LEVEL_META: Record<
  ConfidenceLevel,
  { label: string; className: string }
> = {
  high: {
    label: "신뢰 높음",
    className: "border-success/40 bg-success/10 text-success",
  },
  medium: {
    label: "지연 가능",
    className: "border-warning/40 bg-warning/10 text-warning",
  },
  low: {
    label: "불확실",
    className: "border-destructive/40 bg-destructive/10 text-destructive",
  },
  stale: {
    label: "업데이트 필요",
    className: "border-muted/60 bg-muted/40 text-muted-foreground",
  },
};

export type ConfidenceBadgeProps = {
  level: ConfidenceLevel;
  className?: string;
};

export function ConfidenceBadge({ level, className }: ConfidenceBadgeProps) {
  const meta = LEVEL_META[level];

  return (
    <Badge
      className={cn("gap-2 text-xs font-semibold", meta.className, className)}
    >
      <span
        aria-hidden="true"
        className="h-2 w-2 rounded-full bg-current"
      />
      {meta.label}
    </Badge>
  );
}
