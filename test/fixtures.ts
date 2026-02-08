export const makeTimingPayload = (
  overrides: Record<string, unknown> = {}
) => {
  const now = Date.now();
  return {
    data: [
      {
        itstId: "1000",
        trsmUtcTime: now,
        ntPdsgRmdrCs: 120,
        ...overrides,
      },
    ],
  };
};

export const makePhasePayload = (overrides: Record<string, unknown> = {}) => {
  const now = Date.now();
  return {
    data: [
      {
        itstId: "1000",
        trsmUtcTime: now,
        ntPdsgStatNm: "protected-Movement-Allowed",
        ...overrides,
      },
    ],
  };
};

export const makeSpatResponse = (
  overrides: Record<string, unknown> = {}
) => ({
  itstId: "1000",
  itstNm: "테스트교차로",
  lat: 37.5698431,
  lon: 126.9713258,
  fetchedAtKst: "2024-01-19 12:00:00",
  trsmKst: "2024-01-19 11:59:55",
  ageSec: 5.0,
  isStale: false,
  items: [
    {
      title: "북측 보행",
      kind: "보행",
      sec: 10.5,
      secAtMsg: 12.0,
      status: "protected-Movement-Allowed",
    },
  ],
  ...overrides,
});
