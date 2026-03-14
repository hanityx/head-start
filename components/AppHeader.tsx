import { Search, RefreshCw, Zap, Satellite, Radio } from "lucide-react";

type AppHeaderProps = {
  itstNm: string | null;
  isConnected: boolean;
  isAuto: boolean;
  verifyMode: boolean;
  hasGeo: boolean;
  spatLoading: boolean;
  onSearchOpen: () => void;
  onVerifyToggle: () => void;
  onAutoToggle: () => void;
  onFetch: () => void;
};

export function AppHeader({
  itstNm,
  isConnected,
  isAuto,
  verifyMode,
  hasGeo,
  spatLoading,
  onSearchOpen,
  onVerifyToggle,
  onAutoToggle,
  onFetch,
}: AppHeaderProps) {
  return (
    <header className="absolute inset-x-0 top-3 z-30 flex justify-center px-3">
      <div
        className="glass-panel rounded-2xl flex items-center pl-4 pr-2 gap-2 w-full max-w-3xl"
        style={{
          minHeight: 52,
          ...(verifyMode && {
            background: "rgba(2,6,23,0.45)",
            backdropFilter: "blur(8px)",
          }),
        }}
      >
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest shrink-0">
          신호 안내
        </span>
        <div className="w-px h-5 bg-white/10 shrink-0" />
        <button
          data-tour="sidebar-toggle"
          className="flex-1 min-w-0 flex items-center gap-2 text-left group"
          onClick={onSearchOpen}
        >
          {isConnected && (
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0 animate-pulse" />
          )}
          <span className="text-sm font-semibold text-white truncate group-hover:text-slate-300 transition-colors">
            {itstNm ?? "교차로 선택…"}
          </span>
          {isAuto && <Radio className="h-3 w-3 text-sky-400 shrink-0" />}
          <Search className="h-3.5 w-3.5 text-slate-500 group-hover:text-slate-400 transition-colors shrink-0 ml-auto" />
        </button>
        <div className="flex items-center gap-1 shrink-0">
          {hasGeo && (
            <button
              onClick={onVerifyToggle}
              className={`glass-panel flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold transition-all border ${
                verifyMode
                  ? "border-sky-400/40 text-sky-200 bg-sky-400/10"
                  : "border-white/10 text-slate-300 hover:text-white"
              }`}
            >
              <Satellite className="h-3.5 w-3.5" />
              <span className="hidden md:inline">
                {verifyMode ? "지도 OFF" : "지도 보기"}
              </span>
            </button>
          )}
          <button
            onClick={onAutoToggle}
            className={`glass-panel flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold transition-all border ${
              isAuto
                ? "border-sky-400/40 text-sky-400 bg-sky-400/10"
                : "border-white/10 text-slate-300 hover:text-white"
            }`}
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isAuto ? "animate-spin" : ""}`}
            />
            <span className="hidden md:inline">
              {isAuto ? "자동 ON" : "자동 OFF"}
            </span>
          </button>
          <button
            onClick={onFetch}
            disabled={spatLoading}
            className="glass-panel flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:text-white border border-white/10 transition-all disabled:opacity-40"
          >
            <Zap className="h-3.5 w-3.5" />
            <span className="hidden md:inline">조회</span>
          </button>
        </div>
      </div>
    </header>
  );
}
