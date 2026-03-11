import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import Home from "@/pages/index";
import { ensureFetchMock, resetFetchMock } from "@/test/testUtils";

jest.mock("next/router", () => ({
  useRouter: () => ({
    isReady: true,
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    query: {},
    pathname: "/",
    asPath: "/",
  }),
}));

const nearbyItem = {
  itstId: "1560",
  itstNm: "면목아이파크102동",
  lat: 37.58,
  lon: 127.08,
  distanceM: 120,
};

/** URL 패턴에 따라 mock 응답을 라우팅 — fetch 호출 순서에 무관하게 동작 */
const setupDefaultMocks = () => {
  ensureFetchMock().mockImplementation((url: string) => {
    if (url.includes("/api/itst-meta")) {
      return Promise.resolve({
        ok: true, status: 200,
        json: async () => ({ lat: null, lon: null, itstNm: null }),
        text: async () => "{}",
      });
    }
    if (url.includes("/api/ip-location")) {
      return Promise.resolve({
        ok: true, status: 200,
        json: async () => ({ lat: 37.57, lon: 127.04, label: "서울시" }),
        text: async () => "{}",
      });
    }
    if (url.includes("/api/nearby")) {
      return Promise.resolve({
        ok: true, status: 200,
        json: async () => ({ items: [nearbyItem] }),
        text: async () => "{}",
      });
    }
    // spat, osm-roads 등 — 테스트에서 검사하지 않는 엔드포인트
    return Promise.resolve({
      ok: false, status: 503,
      json: async () => ({ error: "no mock" }),
      text: async () => "{}",
    });
  });
};

describe("Home Page", () => {
  const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

  beforeAll(() => {
    ensureFetchMock();
  });

  beforeEach(() => {
    resetFetchMock();
    localStorage.clear();
    setupDefaultMocks();
  });

  const openSearchOverlay = (container: HTMLElement) => {
    const btn = container.querySelector('[data-tour="sidebar-toggle"]') as HTMLElement;
    fireEvent.click(btn);
  };

  // 오버레이 목록 항목이 로드될 때까지 기다리는 헬퍼 — "120m"은 목록 항목에만 존재
  const waitForNearbyItems = () => screen.findByText("120m");

  it("should render the main title", async () => {
    render(<Home />);
    expect(screen.getByText("신호 안내")).toBeInTheDocument();
  });

  it("should show sort buttons in search overlay", async () => {
    const { container } = render(<Home />);
    openSearchOverlay(container);
    expect(screen.getByRole("button", { name: "가까운 순" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "이름 순" })).toBeInTheDocument();
  });

  it("should load nearby intersections via ip-location on mount", async () => {
    const { container } = render(<Home />);
    openSearchOverlay(container);
    expect(await waitForNearbyItems()).toBeInTheDocument();
    expect(screen.getAllByText("면목아이파크102동").length).toBeGreaterThan(0);
    expect(global.fetch).toHaveBeenCalledWith("/api/ip-location");
  });

  it("should show intersection ID and distance in list", async () => {
    const { container } = render(<Home />);
    openSearchOverlay(container);
    await waitForNearbyItems();
    expect(screen.getByText(/ID 1560/)).toBeInTheDocument();
    expect(screen.getByText("120m")).toBeInTheDocument();
  });

  it("should select intersection and close overlay when clicked", async () => {
    const { container } = render(<Home />);
    openSearchOverlay(container);
    await waitForNearbyItems();

    // 거리가 표시된 버튼이 목록 항목 버튼 (헤더 버튼과 구분)
    const itemBtn = screen.getByRole("button", { name: /면목아이파크102동.*120m/ });
    fireEvent.click(itemBtn);

    // Overlay should close
    await waitFor(() => {
      expect(screen.queryByPlaceholderText("교차로 이름 또는 ID...")).not.toBeInTheDocument();
    });
    // itstId stored in localStorage
    await waitFor(() => {
      expect(localStorage.getItem("lastItstId")).toBe("1560");
    });
  });

  it("should search intersections by name with debounce", async () => {
    ensureFetchMock().mockImplementation((url: string) => {
      if (url.includes("/api/search-intersections")) {
        return Promise.resolve({
          ok: true, status: 200,
          json: async () => ({ items: [{ itstId: "9999", itstNm: "테스트사거리", lat: 37.5, lon: 127.0, distanceM: 500 }] }),
          text: async () => "{}",
        });
      }
      if (url.includes("/api/itst-meta")) return Promise.resolve({ ok: true, status: 200, json: async () => ({ lat: null, lon: null, itstNm: null }), text: async () => "{}" });
      if (url.includes("/api/ip-location")) return Promise.resolve({ ok: true, status: 200, json: async () => ({ lat: 37.57, lon: 127.04, label: "서울시" }), text: async () => "{}" });
      if (url.includes("/api/nearby")) return Promise.resolve({ ok: true, status: 200, json: async () => ({ items: [nearbyItem] }), text: async () => "{}" });
      return Promise.resolve({ ok: false, status: 503, json: async () => ({ error: "no mock" }), text: async () => "{}" });
    });

    const { container } = render(<Home />);
    openSearchOverlay(container);
    await waitForNearbyItems();

    const searchInput = screen.getByPlaceholderText("교차로 이름 또는 ID...");
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: "테스트" } });
      await new Promise((r) => setTimeout(r, 300));
      await flushPromises();
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/search-intersections?q=")
      );
    });
  });

  it("should fetch nearby intersections with GPS", async () => {
    ensureFetchMock().mockImplementation((url: string) => {
      if (url.includes("/api/nearby") && url.includes("lat=37.6548")) {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ items: [{ itstId: "2230", itstNm: "방학사거리", lat: 37.65, lon: 127.02, distanceM: 50 }] }), text: async () => "{}" });
      }
      if (url.includes("/api/itst-meta")) return Promise.resolve({ ok: true, status: 200, json: async () => ({ lat: null, lon: null, itstNm: null }), text: async () => "{}" });
      if (url.includes("/api/ip-location")) return Promise.resolve({ ok: true, status: 200, json: async () => ({ lat: 37.57, lon: 127.04, label: "서울시" }), text: async () => "{}" });
      if (url.includes("/api/nearby")) return Promise.resolve({ ok: true, status: 200, json: async () => ({ items: [nearbyItem] }), text: async () => "{}" });
      return Promise.resolve({ ok: false, status: 503, json: async () => ({ error: "no mock" }), text: async () => "{}" });
    });

    const getCurrentPosition = jest.fn(
      (success: (pos: { coords: { latitude: number; longitude: number } }) => void) =>
        success({ coords: { latitude: 37.6548, longitude: 127.0224 } })
    );
    Object.defineProperty(global.navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition },
    });

    const { container } = render(<Home />);
    openSearchOverlay(container);
    await waitForNearbyItems();

    const gpsButton = screen.getByRole("button", { name: /현재 위치/ });
    await act(async () => {
      fireEvent.click(gpsButton);
      await flushPromises();
    });

    await waitFor(() => {
      expect(getCurrentPosition).toHaveBeenCalled();
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/nearby?lat=37.6548&lon=127.0224")
      );
    });
  });

  it("should toggle sort between distance and name", async () => {
    const { container } = render(<Home />);
    openSearchOverlay(container);
    await waitForNearbyItems();

    const nameSort = screen.getByRole("button", { name: "이름 순" });
    fireEvent.click(nameSort);

    const distSort = screen.getByRole("button", { name: "가까운 순" });
    fireEvent.click(distSort);

    expect(screen.getByRole("button", { name: "가까운 순" })).toBeInTheDocument();
  });

  it("should preserve saved intersection instead of overwriting with nearest item", async () => {
    localStorage.setItem("lastItstId", "9999");
    ensureFetchMock().mockImplementation((url: string) => {
      if (url.includes("/api/itst-meta?itstId=9999")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ lat: 37.5, lon: 127.0, itstNm: "저장교차로" }),
          text: async () => "{}",
        });
      }
      if (url.includes("/api/ip-location")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ lat: 37.57, lon: 127.04, label: "서울시" }),
          text: async () => "{}",
        });
      }
      if (url.includes("/api/nearby")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ items: [nearbyItem] }),
          text: async () => "{}",
        });
      }
      return Promise.resolve({
        ok: false,
        status: 503,
        json: async () => ({ error: "no mock" }),
        text: async () => "{}",
      });
    });

    render(<Home />);

    await waitFor(() => {
      expect(screen.getByText("저장교차로")).toBeInTheDocument();
    });
    expect(localStorage.getItem("lastItstId")).toBe("9999");
  });

  it("should show empty state when search returns no results", async () => {
    ensureFetchMock().mockImplementation((url: string) => {
      if (url.includes("/api/search-intersections")) {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ items: [] }), text: async () => "{}" });
      }
      if (url.includes("/api/itst-meta")) return Promise.resolve({ ok: true, status: 200, json: async () => ({ lat: null, lon: null, itstNm: null }), text: async () => "{}" });
      if (url.includes("/api/ip-location")) return Promise.resolve({ ok: true, status: 200, json: async () => ({ lat: 37.57, lon: 127.04, label: "서울시" }), text: async () => "{}" });
      if (url.includes("/api/nearby")) return Promise.resolve({ ok: true, status: 200, json: async () => ({ items: [nearbyItem] }), text: async () => "{}" });
      return Promise.resolve({ ok: false, status: 503, json: async () => ({ error: "no mock" }), text: async () => "{}" });
    });

    const { container } = render(<Home />);
    openSearchOverlay(container);
    await waitForNearbyItems();

    const searchInput = screen.getByPlaceholderText("교차로 이름 또는 ID...");
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: "없는교차로abc" } });
      await new Promise((r) => setTimeout(r, 300));
      await flushPromises();
    });

    await waitFor(() => {
      expect(screen.getByText("검색 결과가 없습니다.")).toBeInTheDocument();
    });
  });
});
