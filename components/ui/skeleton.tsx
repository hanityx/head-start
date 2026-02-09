import { cn } from "@/lib/ui";

function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "skeleton-shimmer rounded-md bg-muted/50",
        className
      )}
    />
  );
}

export { Skeleton };
