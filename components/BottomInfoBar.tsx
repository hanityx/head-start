import type { SpatResponse } from "@/lib/types";

type BottomInfoBarProps = {
  activeSpat: SpatResponse;
  itstId: string;
  hasEmptySpat: boolean;
};

export function BottomInfoBar({
  activeSpat,
  itstId,
  hasEmptySpat,
}: BottomInfoBarProps) {
  const isStaleOrEmpty = activeSpat.isStale || hasEmptySpat;

  return (
    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 max-w-[90vw]">
      <div className="glass-panel rounded-full px-4 py-1.5 flex items-center gap-3 text-[11px] text-slate-400 min-w-0">
        <span className="font-semibold text-slate-300 truncate max-w-[120px] shrink-0">
          {activeSpat.itstNm ?? itstId}
        </span>
        {activeSpat.fetchedAtKst && (
          <span className="hidden sm:inline truncate">
            {activeSpat.fetchedAtKst}
          </span>
        )}
        {activeSpat.ageSec != null && (
          <span
            className={`shrink-0 ${isStaleOrEmpty ? "text-amber-300" : "text-emerald-400"}`}
          >
            {isStaleOrEmpty
              ? "신호 없음"
              : `${Math.round(activeSpat.ageSec)}초 전`}
          </span>
        )}
      </div>
    </div>
  );
}
