import { useState } from "react";
import { BearingVerifyMap } from "@/components/BearingVerifyMap";
import { haversineMeters, computeBearing } from "@/lib/geo";

type GpsPosition = { lat: number; lon: number };

type VerifyMapPanelProps = {
  lat: number;
  lon: number;
  itstLabel: string;
  roadBearings: number[];
  geoLoading: boolean;
  userGps: GpsPosition | null;
  onClose: () => void;
};

// 방위각(°) → 방향 화살표
function bearingToArrow(deg: number): string {
  const arrows = ["↑", "↗", "→", "↘", "↓", "↙", "←", "↖"];
  return arrows[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
}

// 지도 모드에 따른 안내 문구
function getMapStatusMessage(
  geoLoading: boolean,
  mode: "satellite" | "street",
  roadBearings: number[],
): string {
  if (geoLoading) {
    return mode === "satellite"
      ? "위성사진에서 교차로 방향을 확인하는 중..."
      : "지도에서 교차로 방향을 확인하는 중...";
  }
  if (roadBearings.length > 0) {
    return mode === "satellite"
      ? "위성사진과 교차로 방향선을 보여주고 있어요"
      : "지도와 교차로 방향선을 보여주고 있어요";
  }
  return mode === "satellite"
    ? "위성사진에서 교차로 방향 정보를 찾지 못했어요"
    : "지도에서 교차로 방향 정보를 찾지 못했어요";
}

export function VerifyMapPanel({
  lat,
  lon,
  itstLabel,
  roadBearings,
  geoLoading,
  userGps,
  onClose,
}: VerifyMapPanelProps) {
  const [mapMode, setMapMode] = useState<"satellite" | "street">("satellite");

  const distM =
    userGps
      ? haversineMeters(userGps.lat, userGps.lon, lat, lon)
      : null;
  const distArrow =
    distM != null && userGps
      ? bearingToArrow(computeBearing(userGps.lat, userGps.lon, lat, lon))
      : null;
  const distLabel =
    distM != null
      ? distM < 1000
        ? `${Math.round(distM)}m`
        : `${(distM / 1000).toFixed(1)}km`
      : null;

  return (
    <div className="absolute inset-y-0 right-0 w-full md:w-1/2 md:border-l-2 md:border-sky-400/30 z-[15]">
      {/* 모바일 닫기 버튼 (헤더 아래) */}
      <button
        onClick={onClose}
        className="md:hidden absolute top-[68px] left-4 flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold text-sky-100 transition-all"
        style={{
          zIndex: 1002,
          background: "rgba(2,6,23,0.85)",
          backdropFilter: "blur(8px)",
          border: "1px solid rgba(56,189,248,0.35)",
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
          close
        </span>
        닫기
      </button>

      {/* 데스크탑 상단 레이블 */}
      <div
        className="hidden md:block"
        style={{
          position: "absolute",
          top: 76,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 1001,
          background: "rgba(2,6,23,0.85)",
          backdropFilter: "blur(8px)",
          borderRadius: 8,
          padding: "5px 12px",
          border: "1px solid rgba(56,189,248,0.35)",
          fontSize: 11,
          fontWeight: 700,
          color: "#bae6fd",
          maxWidth: "min(70vw, 360px)",
          whiteSpace: "normal",
          textAlign: "center",
          lineHeight: 1.4,
        }}
      >
        {getMapStatusMessage(geoLoading, mapMode, roadBearings)}
      </div>

      {/* 내 위치 거리 배지 */}
      <div
        style={{
          position: "absolute",
          bottom: 8,
          right: 8,
          zIndex: 1001,
          background: "rgba(2,6,23,0.85)",
          backdropFilter: "blur(8px)",
          borderRadius: 8,
          padding: "8px 12px",
          border: `1px solid ${userGps ? "rgba(56,189,248,0.35)" : "rgba(255,255,255,0.08)"}`,
          display: "flex",
          flexDirection: "column",
          gap: 2,
          minWidth: 92,
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: "#7dd3fc",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          내 위치
        </div>
        {distLabel ? (
          <div
            style={{
              fontSize: 18,
              fontWeight: 800,
              color: "#e0f2fe",
              fontFamily: "monospace",
              lineHeight: 1.2,
            }}
          >
            {distLabel} {distArrow}
          </div>
        ) : (
          <div style={{ fontSize: 11, color: "#94a3b8" }}>위치 확인 중...</div>
        )}
      </div>

      <BearingVerifyMap
        lat={lat}
        lon={lon}
        bearings={roadBearings}
        loading={geoLoading}
        label={itstLabel}
        userLat={userGps?.lat}
        userLon={userGps?.lon}
        onModeChange={setMapMode}
      />
    </div>
  );
}
