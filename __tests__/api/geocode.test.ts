import { createMocks } from "node-mocks-http";
import handler from "@/pages/api/geocode";
import {
  ensureFetchMock,
  mockFetchTextOnce,
  resetFetchMock,
} from "@/test/testUtils";

describe("/api/geocode", () => {
  beforeAll(() => {
    ensureFetchMock();
  });

  beforeEach(() => {
    resetFetchMock();
  });

  it("returns 405 for non-GET", async () => {
    const { req, res } = createMocks({ method: "POST" });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(405);
  });

  it("returns 400 for missing query", async () => {
    const { req, res } = createMocks({
      method: "GET",
      query: { q: "" },
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(400);
  });

  it("returns 200 with geocode payload", async () => {
    mockFetchTextOnce(
      JSON.stringify([
        {
          lat: "37.5665",
          lon: "126.9780",
          display_name: "테스트 위치",
          name: "테스트",
          class: "railway",
          type: "station",
        },
      ])
    );

    const { req, res } = createMocks({
      method: "GET",
      query: { q: "테스트" },
    });
    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    const data = JSON.parse(res._getData());
    expect(data.lat).toBe("37.5665");
    expect(data.lon).toBe("126.9780");
  });

  it("returns 502 when upstream fails", async () => {
    mockFetchTextOnce("upstream error", { ok: false, status: 500 });

    const { req, res } = createMocks({
      method: "GET",
      query: { q: "테스트-오류" },
    });
    await handler(req, res);

    expect(res._getStatusCode()).toBe(502);
  });

  it("returns 504 on timeout abort", async () => {
    ensureFetchMock().mockRejectedValueOnce(
      Object.assign(new Error("aborted"), { name: "AbortError" })
    );

    const { req, res } = createMocks({
      method: "GET",
      query: { q: "테스트-타임아웃" },
    });
    await handler(req, res);

    expect(res._getStatusCode()).toBe(504);
  });
});
