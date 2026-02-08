import { createMocks } from "node-mocks-http";
import handler from "@/pages/api/ip-location";
import {
  ensureFetchMock,
  mockFetchJsonOnce,
  resetFetchMock,
} from "@/test/testUtils";

describe("/api/ip-location", () => {
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

  it("returns 200 with location payload", async () => {
    mockFetchJsonOnce({
      latitude: 37.5665,
      longitude: 126.978,
      city: "테스트시",
      region: "테스트구",
      country_name: "KR",
    });

    const { req, res } = createMocks({ method: "GET" });
    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    const data = JSON.parse(res._getData());
    expect(data.lat).toBe(37.5665);
    expect(data.lon).toBe(126.978);
  });

  it("returns 502 on invalid upstream payload", async () => {
    mockFetchJsonOnce({
      latitude: "invalid",
      longitude: 126.978,
    });

    const { req, res } = createMocks({ method: "GET" });
    await handler(req, res);

    expect(res._getStatusCode()).toBe(502);
  });

  it("returns 504 on timeout abort", async () => {
    ensureFetchMock().mockRejectedValueOnce(
      Object.assign(new Error("aborted"), { name: "AbortError" })
    );

    const { req, res } = createMocks({ method: "GET" });
    await handler(req, res);

    expect(res._getStatusCode()).toBe(504);
  });
});
