import { createMocks } from "node-mocks-http";
import handler from "@/pages/api/spat";
import {
  ensureFetchMock,
  mockFetchJsonOnce,
  mockFetchTextOnce,
  resetFetchMock,
} from "@/test/testUtils";

const TEST_ITST_ID = "900001";

jest.mock("@/lib/itstMeta", () => ({
  loadItstMeta: () =>
    new Map([["900001", { itstNm: "테스트교차로", lat: 37.5, lon: 126.9 }]]),
}));

describe("/api/spat", () => {
  beforeAll(() => {
    ensureFetchMock();
  });

  beforeEach(() => {
    resetFetchMock();
    process.env.TDATA_API_KEY = "test-key";
    process.env.TDATA_API_KEY_SUB = "";
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
          itstId: TEST_ITST_ID,
          trsmUtcTime: now,
          ntPdsgRmdrCs: 120,
        },
      ],
    };
    const phase = {
      data: [
        {
          itstId: TEST_ITST_ID,
          trsmUtcTime: now,
          ntPdsgStatNm: "protected-Movement-Allowed",
        },
      ],
    };

    mockFetchJsonOnce(timing, { ok: true, status: 200 });
    mockFetchJsonOnce(phase, { ok: true, status: 200 });

    const { req, res } = createMocks({
      method: "GET",
      query: { itstId: TEST_ITST_ID },
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
      data: [{ itstId: TEST_ITST_ID, trsmUtcTime: now, ntPdsgRmdrCs: 120 }],
    };
    const phase = {
      data: [
        {
          itstId: TEST_ITST_ID,
          trsmUtcTime: now,
          ntPdsgStatNm: "protected-Movement-Allowed",
        },
      ],
    };

    mockFetchJsonOnce(timing, { ok: true, status: 200 });
    mockFetchJsonOnce(phase, { ok: true, status: 200 });

    const { req, res } = createMocks({
      method: "GET",
      query: { itstId: TEST_ITST_ID, debug: "true" },
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
      query: { itstId: TEST_ITST_ID },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(502);
  });

  it("falls back to sub api key when primary key is rate-limited", async () => {
    process.env.TDATA_API_KEY = "primary-key";
    process.env.TDATA_API_KEY_SUB = "sub-key";

    const rateLimited = {
      type: "Other",
      responseCode: 429,
      failureCode: 10005,
      message: "Rate limit exceeded.",
    };
    const now = Date.now();
    const timing = {
      data: [{ itstId: TEST_ITST_ID, trsmUtcTime: now, ntPdsgRmdrCs: 120 }],
    };
    const phase = {
      data: [
        {
          itstId: TEST_ITST_ID,
          trsmUtcTime: now,
          ntPdsgStatNm: "protected-Movement-Allowed",
        },
      ],
    };

    mockFetchJsonOnce(rateLimited, { ok: true, status: 200 });
    mockFetchJsonOnce(rateLimited, { ok: true, status: 200 });
    mockFetchJsonOnce(timing, { ok: true, status: 200 });
    mockFetchJsonOnce(phase, { ok: true, status: 200 });

    const { req, res } = createMocks({
      method: "GET",
      query: { itstId: TEST_ITST_ID },
    });
    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);

    const fetchMock = ensureFetchMock();
    expect(fetchMock).toHaveBeenCalledTimes(4);
    const urls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(urls[0]).toContain("apikey=primary-key");
    expect(urls[1]).toContain("apikey=primary-key");
    expect(urls[2]).toContain("apikey=sub-key");
    expect(urls[3]).toContain("apikey=sub-key");

    const body = JSON.parse(res._getData());
    expect(body.upstream?.keySource).toBe("sub");
  });
});
