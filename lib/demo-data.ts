import type { SpatItem, SpatResponse } from "@/lib/types";

export type DemoScenario = {
  label: string;        // 교차로명
  tag: string;          // 유형 태그
  response: SpatResponse;
  roadBearings: number[]; // OSM Overpass 실측 도로 각도
};

// ── 헬퍼 ──────────────────────────────────────────────────────
const go  = "protected-Movement-Allowed";
const stop = "stop-And-Remain";

function item(
  dirCode: string,
  title: string,
  status: string,
  sec: number,
  total: number
): SpatItem {
  return {
    title,
    kind: "보행",
    sec,
    secAtMsg: total,
    status,
    dirCode,
    movCode: "PdsgRmdrCs",
    key: `${dirCode}_pdsg`,
    phaseKey: `${dirCode}PdsgStatNm`,
  };
}

// ────────────────────────────────────────────────────────────
// 시나리오 1: 풍납사거리 (1029)
// OSM 실측: [34, 105, 146, 216, 285] — 5방향 (주변 진입로 포함)
// E/W 보행 중, N/S 대기 중
// ────────────────────────────────────────────────────────────
const PUNGNA: DemoScenario = {
  label: "풍납사거리",
  tag: "5방향 (OSM 실측)",
  roadBearings: [34, 105, 146, 216, 285],
  response: {
    itstId: "1029",
    itstNm: "풍납사거리",
    lat: 37.528011,
    lon: 127.119142,
    trsmKst: null,
    ageSec: 0.7,
    isStale: false,
    fetchedAtKst: "2026-02-26 23:01:00",
    items: [
      item("nt", "북측 보행", stop, 32, 45),
      item("et", "동측 보행", go,   18, 38),
      item("st", "남측 보행", stop, 32, 45),
      item("wt", "서측 보행", go,   18, 38),
    ],
  },
};

// ────────────────────────────────────────────────────────────
// 시나리오 2: 선사사거리 (1014)
// OSM 실측: [18, 94, 166, 195, 264, 320] — 6방향 (복잡한 사선 교차로)
// N/S 보행 중, E/W 대기 중
// ────────────────────────────────────────────────────────────
const SUNSA: DemoScenario = {
  label: "선사사거리",
  tag: "6방향 (OSM 실측)",
  roadBearings: [18, 94, 166, 195, 264, 320],
  response: {
    itstId: "1014",
    itstNm: "선사사거리",
    lat: 37.554767,
    lon: 127.129200,
    trsmKst: null,
    ageSec: 0.5,
    isStale: false,
    fetchedAtKst: "2026-02-26 23:01:00",
    items: [
      item("nt", "북측 보행", go,   12, 30),
      item("et", "동측 보행", stop, 45, 50),
      item("st", "남측 보행", go,   12, 30),
      item("wt", "서측 보행", stop, 45, 50),
    ],
  },
};

// ────────────────────────────────────────────────────────────
// 시나리오 3: 삼성아파트삼거리 (1057)
// OSM 실측: [7, 57, 259, 317] — Y자형 4방향 (북+북동+서+북서)
// 북측 보행 중, 동·서 대기 중
// ────────────────────────────────────────────────────────────
const SAMSUNG_T: DemoScenario = {
  label: "삼성아파트삼거리",
  tag: "Y자형 (OSM 실측)",
  roadBearings: [7, 57, 259, 317],
  response: {
    itstId: "1057",
    itstNm: "삼성아파트삼거리",
    lat: 37.543319,
    lon: 127.102367,
    trsmKst: null,
    ageSec: 0.9,
    isStale: false,
    fetchedAtKst: "2026-02-26 23:01:00",
    items: [
      item("nt", "북측 보행", go,    8, 28),
      item("ne", "북동측 보행", stop, 38, 45),
      item("wt", "서측 보행", stop, 38, 45),
      item("nw", "북서측 보행", stop, 38, 45),
    ],
  },
};

// ────────────────────────────────────────────────────────────
// 시나리오 4: 올림픽대교북단 (1058)
// OSM 실측: [5, 106, 177, 233, 284, 308, 339] — 7방향 (다리 진입부)
// 북·남 보행 중, 나머지 대기
// ────────────────────────────────────────────────────────────
const OLYMPIC_5WAY: DemoScenario = {
  label: "올림픽대교북단",
  tag: "7방향 (OSM 실측)",
  roadBearings: [5, 106, 177, 233, 284, 308, 339],
  response: {
    itstId: "1058",
    itstNm: "올림픽대교북단",
    lat: 37.541158,
    lon: 127.095843,
    trsmKst: null,
    ageSec: 0.6,
    isStale: false,
    fetchedAtKst: "2026-02-26 23:01:00",
    items: [
      item("nt", "북측 보행",   go,   22, 40),
      item("et", "동측 보행",   stop, 35, 45),
      item("st", "남측 보행",   go,   22, 40),
      item("sw", "남서측 보행", stop, 35, 45),
      item("wt", "서측 보행",   stop, 35, 45),
      item("nw", "북서측 보행", stop, 35, 45),
    ],
  },
};

// ────────────────────────────────────────────────────────────
// 시나리오 5: 면목아이파크102동 (1560)
// OSM 실측: [97, 275] — 동서 직선 횡단보도 (완벽 일치 ✅)
// 동·서 보행 신호만 존재 (DEV_PHASE_ALLOWLIST 검증됨)
// ────────────────────────────────────────────────────────────
const MYEONGMOK: DemoScenario = {
  label: "면목아이파크102동",
  tag: "직선 횡단보도 (OSM 실측 ✅)",
  roadBearings: [97, 275],
  response: {
    itstId: "1560",
    itstNm: "면목아이파크102동",
    lat: 37.5813116,
    lon: 127.0813421,
    trsmKst: null,
    ageSec: 0.4,
    isStale: false,
    fetchedAtKst: "2026-02-26 23:01:00",
    items: [
      item("et", "동측 보행", go,   22, 35),
      item("wt", "서측 보행", go,   22, 35),
    ],
  },
};

export const DEMO_SCENARIOS: DemoScenario[] = [
  PUNGNA,
  SUNSA,
  SAMSUNG_T,
  OLYMPIC_5WAY,
  MYEONGMOK,
];
