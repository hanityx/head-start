"use client";
import * as React from "react";
import dynamic from "next/dynamic";

// Leaflet은 SSR 불가 → dynamic import
const MapInner = dynamic(() => import("./BearingVerifyMapInner"), { ssr: false });

export type BearingVerifyMapProps = {
  lat: number;
  lon: number;
  bearings: number[];       // OSM 계산값
  loading?: boolean;
  label: string;
  userLat?: number;
  userLon?: number;
  onModeChange?: (mode: "satellite" | "street") => void;
};

export function BearingVerifyMap(props: BearingVerifyMapProps) {
  return <MapInner {...props} />;
}
