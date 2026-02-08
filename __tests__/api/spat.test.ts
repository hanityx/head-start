import { createMocks } from "node-mocks-http";
import handler from "@/pages/api/spat";
import { mockFetchOnce } from "../../test/testUtils";

jest.mock("@/lib/itstMeta", () => ({
  loadItstMeta: () =>
    new Map([["1560", { itstNm: "테스트교차로", lat: 37.5, lon: 126.9 }]]),
}));

describe("/api/spat", () => {
  beforeAll(() => {
    global.fetch = jest.fn();
  });

  beforeEach(() => {
    (global.fetch as jest.Mock).mockClear();
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

    mockFetchOnce({ ok: true, status: 200, json: timing });
    mockFetchOnce({ ok: true, status: 200, json: phase });

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

  it("includes debug fields when requested", async () => {
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

    mockFetchOnce({ ok: true, status: 200, json: timing });
    mockFetchOnce({ ok: true, status: 200, json: phase });

    const { req, res } = createMocks({
      method: "GET",
      query: { itstId: "1560", debug: "true" },
    });

    await handler(req, res);

    const data = JSON.parse(res._getData());
    expect(data.upstreamRaw).toBeDefined();
    expect(data.latestTiming).toBeDefined();
    expect(data.latestPhase).toBeDefined();
  });

  it("returns 502 when upstream is non-json", async () => {
    mockFetchOnce({ ok: true, status: 200, text: "<html>nope</html>" });
    mockFetchOnce({ ok: true, status: 200, text: "<html>nope</html>" });

    const { req, res } = createMocks({
      method: "GET",
      query: { itstId: "1560" },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(502);
  });
});
