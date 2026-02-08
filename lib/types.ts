export type SpatItem = {
  title: string;
  kind: string;
  sec: number | null;
  secAtMsg: number | null;
  status: string | null;
  dirCode?: string;
  movCode?: string;
  key?: string | null;
  phaseKey?: string | null;
};

export type SpatResponse = {
  itstId: string;
  itstNm: string | null;
  lat: number | null;
  lon: number | null;
  trsmKst: string | null;
  ageSec: number | null;
  isStale: boolean;
  items: SpatItem[];
  fetchedAtKst?: string;
  upstream?: {
    timing?: { status?: number };
    phase?: { status?: number };
  };
  note?: string;
};

export type NearbyItem = {
  itstId: string;
  itstNm: string;
  lat: number;
  lon: number;
  distanceM: number;
};

export type NearbyResponse = {
  items: NearbyItem[];
};

export type GeocodeResponse = {
  lat: string;
  lon: string;
  displayName?: string;
};
