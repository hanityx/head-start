import * as React from "react";
import { MapContainer, TileLayer, Polyline, CircleMarker, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

type Props = {
  lat: number;
  lon: number;
  bearings: number[];
  label: string;
  userLat?: number;
  userLon?: number;
};

// bearing(°) + 중심좌표 → 60m 끝점 좌표
function destPoint(lat: number, lon: number, bearing: number, distM = 60): [number, number] {
  const R = 6371000;
  const d = distM / R;
  const br = (bearing * Math.PI) / 180;
  const lat1 = (lat * Math.PI) / 180;
  const lon1 = (lon * Math.PI) / 180;
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(br));
  const lon2 = lon1 + Math.atan2(Math.sin(br) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
  return [(lat2 * 180) / Math.PI, (lon2 * 180) / Math.PI];
}

const COLORS = ["#ef4444", "#f59e0b", "#10b981", "#38bdf8", "#a78bfa", "#f472b6", "#fb923c"];

function RecenterMap({ lat, lon }: { lat: number; lon: number }) {
  const map = useMap();
  React.useEffect(() => {
    map.setView([lat, lon], 18);
  }, [lat, lon, map]);
  return null;
}

export default function BearingVerifyMapInner({ lat, lon, bearings, label, userLat, userLon }: Props) {
  const [mapMode, setMapMode] = React.useState<"satellite" | "street">("satellite");

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <MapContainer
        center={[lat, lon]}
        zoom={18}
        style={{ width: "100%", height: "100%" }}
        zoomControl={true}
        scrollWheelZoom={true}
      >
        <RecenterMap lat={lat} lon={lon} />

        {/* 위성 타일 (위성 모드에서만) */}
        {mapMode === "satellite" && (
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            attribution="Tiles © Esri"
            maxZoom={19}
          />
        )}

        {/* OSM 지도 타일 — 위성 모드면 반투명 오버레이, 지도 모드면 단독 표시 */}
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="© OpenStreetMap"
          opacity={mapMode === "satellite" ? 0.35 : 1.0}
          maxZoom={19}
        />

        {/* 교차로 중심점 */}
        <CircleMarker
          center={[lat, lon]}
          radius={7}
          pathOptions={{ color: "#fff", fillColor: "#38bdf8", fillOpacity: 1, weight: 2 }}
        >
          <Tooltip permanent direction="top" offset={[0, -10]}>
            <span style={{ fontSize: 11, fontWeight: 700 }}>{label}</span>
          </Tooltip>
        </CircleMarker>

        {/* bearing 선 */}
        {bearings.map((b, i) => {
          const end = destPoint(lat, lon, b);
          const color = COLORS[i % COLORS.length];
          return (
            <React.Fragment key={b}>
              <Polyline
                positions={[[lat, lon], end]}
                pathOptions={{ color, weight: 4, opacity: 0.9 }}
              />
              <CircleMarker
                center={end}
                radius={5}
                pathOptions={{ color, fillColor: color, fillOpacity: 1, weight: 1 }}
              >
                <Tooltip direction="top" offset={[0, -6]}>
                  <span style={{ fontSize: 11, fontWeight: 700 }}>{b}°</span>
                </Tooltip>
              </CircleMarker>
            </React.Fragment>
          );
        })}

        {/* 내 위치 (GPS) */}
        {userLat != null && userLon != null && (
          <CircleMarker
            center={[userLat, userLon]}
            radius={9}
            pathOptions={{ color: "#fff", fillColor: "#22c55e", fillOpacity: 1, weight: 3 }}
          >
            <Tooltip permanent direction="bottom" offset={[0, 10]}>
              <span style={{ fontSize: 11, fontWeight: 700 }}>내 위치</span>
            </Tooltip>
          </CircleMarker>
        )}
      </MapContainer>

      {/* 위성 / 지도 토글 버튼 (우상단) */}
      <div style={{
        position: "absolute", top: 10, right: 10, zIndex: 1001,
        display: "flex", borderRadius: 8, overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.15)",
        background: "rgba(2,6,23,0.88)", backdropFilter: "blur(8px)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
      }}>
        <button
          onClick={() => setMapMode("satellite")}
          style={{
            fontSize: 11, fontWeight: 700, padding: "6px 12px",
            background: mapMode === "satellite" ? "rgba(56,189,248,0.2)" : "transparent",
            color: mapMode === "satellite" ? "#38bdf8" : "#64748b",
            border: "none", cursor: "pointer", letterSpacing: "0.04em",
            transition: "background 0.15s, color 0.15s",
          }}
        >
          위성
        </button>
        <div style={{ width: 1, background: "rgba(255,255,255,0.1)", margin: "4px 0" }} />
        <button
          onClick={() => setMapMode("street")}
          style={{
            fontSize: 11, fontWeight: 700, padding: "6px 12px",
            background: mapMode === "street" ? "rgba(56,189,248,0.2)" : "transparent",
            color: mapMode === "street" ? "#38bdf8" : "#64748b",
            border: "none", cursor: "pointer", letterSpacing: "0.04em",
            transition: "background 0.15s, color 0.15s",
          }}
        >
          지도
        </button>
      </div>

      {/* 하단 좌측 범례 */}
      <div style={{
        position: "absolute", bottom: 8, left: 8, zIndex: 1001,
        background: "rgba(2,6,23,0.88)", backdropFilter: "blur(8px)",
        borderRadius: 8, padding: "8px 12px",
        border: "1px solid rgba(255,255,255,0.1)",
        display: "flex", flexDirection: "column", gap: 4,
      }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 2 }}>
          OSM bearing
        </div>
        {bearings.length === 0 && (
          <div style={{ fontSize: 11, color: "#64748b" }}>로드 중...</div>
        )}
        {bearings.map((b, i) => (
          <div key={b} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 12, height: 3, borderRadius: 2, background: COLORS[i % COLORS.length] }} />
            <span style={{ fontSize: 11, color: "#e2e8f0", fontFamily: "monospace", fontWeight: 700 }}>
              {b}°
            </span>
          </div>
        ))}
        {userLat != null && userLon != null && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, borderTop: "1px solid rgba(255,255,255,0.08)", marginTop: 2, paddingTop: 4 }}>
            <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#22c55e", border: "2px solid #fff", flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: "#e2e8f0", fontWeight: 700 }}>내 위치</span>
          </div>
        )}
      </div>
    </div>
  );
}
