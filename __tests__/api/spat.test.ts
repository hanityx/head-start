import { createMocks } from "node-mocks-http";
import handler from "@/pages/api/spat";
import {
  ensureFetchMock,
  mockFetchJsonOnce,
  mockFetchTextOnce,
  resetFetchMock,
} from "@/test/testUtils";

jest.mock("@/lib/itstMeta", () => ({
  loadItstMeta: () =>
    new Map([["1560", { itstNm: "테스트교차로", lat: 37.5, lon: 126.9 }]]),
}));

describe("/api/spat", () => {
  beforeAll(() => {
    ensureFetchMock();
  });

  beforeEach(() => {
    resetFetchMock();
    process.env.TDATA_API_KEY = "test-key";
  });

  it("returns 405 for non-GET", async () => {
    const { req, res } = createMocks({ method: "POST" });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(405);
  });

  it("returns 400 for missing itstId", async () => {
    const { req, res } = createMocks({ method: "GET" });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(400);
  });

  it("returns 200 with items", async () => {
    const now = Date.now();
    const timing = {
      data: [
        {
          itstId: "1560",
          trsmUtcTime: now,
          ntPdsgRmdrCs: 120,
        },
      ],
    };
    const phase = {
      data: [
        {
          itstId: "1560",
          trsmUtcTime: now,
          ntPdsgStatNm: "protected-Movement-Allowed",
        },
      ],
    };

    mockFetchJsonOnce(timing, { ok: true, status: 200 });
    mockFetchJsonOnce(phase, { ok: true, status: 200 });

    const { req, res } = createMocks({
      method: "GET",
      query: { itstId: "1560" },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    const data = JSON.parse(res._getData());
    expect(data.items.length).toBeGreaterThan(0);
    expect(data.itstNm).toBe("테스트교차로");
  });

  it("does not include debug fields even when requested", async () => {
    const now = Date.now();
    const timing = {
      data: [{ itstId: "1560", trsmUtcTime: now, ntPdsgRmdrCs: 120 }],
    };
    const phase = {
      data: [
        {
          itstId: "1560",
          trsmUtcTime: now,
          ntPdsgStatNm: "protected-Movement-Allowed",
        },
      ],
    };

    mockFetchJsonOnce(timing, { ok: true, status: 200 });
    mockFetchJsonOnce(phase, { ok: true, status: 200 });

    const { req, res } = createMocks({
      method: "GET",
      query: { itstId: "1560", debug: "true" },
    });

    await handler(req, res);

    const data = JSON.parse(res._getData());
    expect(data.upstreamRaw).toBeUndefined();
    expect(data.latestTiming).toBeUndefined();
    expect(data.latestPhase).toBeUndefined();
  });

  it("returns 502 when upstream is non-json", async () => {
    mockFetchTextOnce("<html>nope</html>", { ok: true, status: 200 });
    mockFetchTextOnce("<html>nope</html>", { ok: true, status: 200 });

    const { req, res } = createMocks({
      method: "GET",
      query: { itstId: "1560" },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(502);
  });

  it("falls back to upstream itstNm when local meta is missing", async () => {
    const now = Date.now();
    const timing = {
      data: [
        {
          itstId: "9999",
          itstNm: "업스트림교차로",
          trsmUtcTime: now,
          ntPdsgRmdrCs: 80,
        },
      ],
    };
    const phase = {
      data: [
        {
          itstId: "9999",
          itstNm: "업스트림교차로",
          trsmUtcTime: now,
          ntPdsgStatNm: "stop-And-Remain",
        },
      ],
    };

    mockFetchJsonOnce(timing, { ok: true, status: 200 });
    mockFetchJsonOnce(phase, { ok: true, status: 200 });

    const { req, res } = createMocks({
      method: "GET",
      query: { itstId: "9999" },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    const data = JSON.parse(res._getData());
    expect(data.itstNm).toBe("업스트림교차로");
  });
});
