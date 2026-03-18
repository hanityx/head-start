"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import type { NearbyItem } from "@/lib/types";

type SearchOverlayProps = {
  onClose: () => void;
  onSelect: (item: NearbyItem) => void;
  nearbyItems: NearbyItem[];
  locationLabel: string;
  loading: boolean;
  gpsLoading: boolean;
  onUseGps: () => void;
};

export function SearchOverlay({
  onClose,
  onSelect,
  nearbyItems,
  locationLabel,
  loading,
  gpsLoading,
  onUseGps,
}: SearchOverlayProps) {
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<"distance" | "name">("distance");
  const [searchResults, setSearchResults] = useState<NearbyItem[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);

  // ESC 키로 닫기
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // 검색 debounce
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setSearchResults(null);
      return;
    }
    setSearchLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search-intersections?q=${encodeURIComponent(q)}`,
        );
        const json = (await res.json()) as { items?: NearbyItem[] };
        setSearchResults(Array.isArray(json.items) ? json.items : []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      setSearchLoading(false);
    };
  }, [query]);

  const displayItems = (() => {
    const items =
      searchResults !== null ? [...searchResults] : [...nearbyItems];
    if (sortBy === "name")
      items.sort((a, b) => a.itstNm.localeCompare(b.itstNm, "ko"));
    return items;
  })();

  return (
    <div
      className="fixed inset-0 z-50 overlay-slide-in"
      style={{
        background: "rgba(8,12,20,0.82)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
      }}
    >
      <div className="flex flex-col h-full max-w-2xl mx-auto px-4 pt-4 pb-6">
        {/* 검색 입력 */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="교차로 이름 또는 ID..."
              className="w-full pl-10 pr-4 py-3 rounded-xl text-sm text-slate-200 placeholder-slate-500 outline-none"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            />
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white px-2 py-2 text-sm shrink-0"
          >
            닫기
          </button>
        </div>

        {/* 정렬 + GPS */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex gap-1">
            <button
              onClick={() => setSortBy("distance")}
              className="px-3 py-1 text-xs font-bold rounded-lg transition-all"
              style={{
                background:
                  sortBy === "distance"
                    ? "rgba(255,255,255,0.1)"
                    : "transparent",
                color: sortBy === "distance" ? "#e2e8f0" : "#64748b",
              }}
            >
              가까운 순
            </button>
            <button
              onClick={() => setSortBy("name")}
              className="px-3 py-1 text-xs font-medium rounded-lg transition-all"
              style={{
                background:
                  sortBy === "name"
                    ? "rgba(255,255,255,0.1)"
                    : "transparent",
                color: sortBy === "name" ? "#e2e8f0" : "#64748b",
              }}
            >
              이름 순
            </button>
          </div>
          <button
            onClick={onUseGps}
            disabled={gpsLoading}
            className="flex items-center gap-1.5 text-xs text-slate-400 disabled:opacity-50"
          >
            <span
              className="material-symbols-outlined text-sm"
              style={{ color: "#38bdf8" }}
            >
              gps_fixed
            </span>
            {gpsLoading ? "확인 중..." : "현재 위치"}
          </button>
        </div>

        {/* 위치 레이블 */}
        {locationLabel && (
          <div className="flex items-center gap-1.5 mb-3 text-xs text-slate-500">
            <span className="material-symbols-outlined text-sm text-sky-400">
              my_location
            </span>
            <span>{locationLabel} 기준 교차로를 불러왔습니다.</span>
          </div>
        )}

        {/* 목록 */}
        <div className="flex-1 overflow-y-auto flex flex-col gap-2">
          {(loading && !nearbyItems.length) || searchLoading
            ? [...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="rounded-xl p-4 animate-pulse skeleton-shimmer"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    height: 72,
                  }}
                />
              ))
            : null}

          {displayItems.map((item) => (
            <button
              key={item.itstId}
              onClick={() => onSelect(item)}
              className="rounded-xl p-4 flex items-center justify-between text-left w-full transition-colors item-fade-in"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-white truncate">
                  {item.itstNm}
                </div>
                <div
                  className="text-xs mt-0.5 flex items-center gap-2"
                  style={{ color: "#475569" }}
                >
                  <span
                    className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium"
                    style={{
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    ID {item.itstId}
                  </span>
                </div>
              </div>
              <div className="text-right shrink-0 ml-4">
                <span className="block text-base font-bold text-white">
                  {item.distanceM >= 1000
                    ? `${(item.distanceM / 1000).toFixed(1)}km`
                    : `${Math.round(item.distanceM)}m`}
                </span>
                <span
                  className="text-[10px]"
                  style={{ color: "#475569" }}
                >
                  직선 거리
                </span>
              </div>
            </button>
          ))}

          {!loading && !displayItems.length && nearbyItems.length > 0 && (
            <div className="text-center py-10 text-slate-500 text-sm">
              검색 결과가 없습니다.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
