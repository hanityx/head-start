import { createMocks } from "node-mocks-http";
import handler from "@/pages/api/nearby";

// Mock fs module
jest.mock("fs", () => ({
  readFileSync: jest.fn(() =>
    JSON.stringify([
      {
        itstId: "1000",
        itstNm: "테스트교차로",
        mapCtptIntLat: 37.5698431,
        mapCtptIntLot: 126.9713258,
      },
      {
        itstId: "1001",
        itstNm: "테스트교차로2",
        mapCtptIntLat: 37.5798431,
        mapCtptIntLot: 126.9813258,
      },
    ])
  ),
}));

describe("/api/nearby", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return nearby intersections", async () => {
    const { req, res } = createMocks({
      method: "GET",
      query: {
        lat: "37.5698431",
        lon: "126.9713258",
        k: "5",
      },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    const data = JSON.parse(res._getData());
    expect(data.items).toBeDefined();
    expect(Array.isArray(data.items)).toBe(true);
  });

  it("should return 400 for invalid coordinates", async () => {
    const { req, res } = createMocks({
      method: "GET",
      query: {
        lat: "invalid",
        lon: "126.9713258",
      },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(400);
    const data = JSON.parse(res._getData());
    expect(data.error).toBe("invalid lat/lon");
  });

  it("should return 405 for non-GET methods", async () => {
    const { req, res } = createMocks({
      method: "POST",
      query: {
        lat: "37.5698431",
        lon: "126.9713258",
      },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(405);
  });

  it("should limit results by k parameter", async () => {
    const { req, res } = createMocks({
      method: "GET",
      query: {
        lat: "37.5698431",
        lon: "126.9713258",
        k: "1",
      },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    const data = JSON.parse(res._getData());
    expect(data.items.length).toBeLessThanOrEqual(1);
  });

  it("should sort results by distance", async () => {
    const { req, res } = createMocks({
      method: "GET",
      query: {
        lat: "37.5698431",
        lon: "126.9713258",
        k: "5",
      },
    });

    await handler(req, res);

    const data = JSON.parse(res._getData());
    const distances = data.items.map((item: any) => item.distanceM);

    for (let i = 1; i < distances.length; i++) {
      expect(distances[i]).toBeGreaterThanOrEqual(distances[i - 1]);
    }
  });
});
