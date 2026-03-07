import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import Home from "@/pages/index";
import {
  ensureFetchMock,
  mockFetchJsonOnce,
  resetFetchMock,
} from "@/test/testUtils";

jest.mock("next/router", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    query: {},
    pathname: "/",
    asPath: "/",
  }),
}));

const mockPush = jest.fn();
jest.mock("next/router", () => ({
  useRouter: () => ({
    push: mockPush,
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

describe("Home Page", () => {
  const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

  beforeAll(() => {
    ensureFetchMock();
  });

  beforeEach(() => {
    resetFetchMock();
    localStorage.clear();
    mockPush.mockClear();
    // ip-location + nearby fallback 기본 응답
    mockFetchJsonOnce({ lat: 37.57, lon: 127.04, label: "서울시" });
    mockFetchJsonOnce({ items: [nearbyItem] });
  });

  it("should render the main title", async () => {
    render(<Home />);
    expect(screen.getByText("지능형 보행 신호 안내")).toBeInTheDocument();
  });

  it("should show sort buttons", async () => {
    render(<Home />);
    expect(screen.getByRole("button", { name: "가까운 순" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "이름 순" })).toBeInTheDocument();
  });

  it("should load nearby intersections via ip-location on mount", async () => {
    render(<Home />);
    expect(await screen.findByText("면목아이파크102동")).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith("/api/ip-location");
  });

  it("should show intersection ID and distance in list", async () => {
    render(<Home />);
    await screen.findByText("면목아이파크102동");
    expect(screen.getByText(/ID 1560/)).toBeInTheDocument();
    expect(screen.getByText("120m")).toBeInTheDocument();
  });

  it("should navigate to view page when intersection is clicked", async () => {
    render(<Home />);
    const item = await screen.findByText("면목아이파크102동");
    fireEvent.click(item);
    expect(mockPush).toHaveBeenCalledWith("/view?itstId=1560&auto=1");
    expect(localStorage.getItem("lastItstId")).toBe("1560");
  });

  it("should search intersections by name with debounce", async () => {
    mockFetchJsonOnce({ items: [{ itstId: "9999", itstNm: "테스트사거리", lat: 37.5, lon: 127.0, distanceM: 500 }] });

    render(<Home />);
    await screen.findByText("면목아이파크102동");

    const searchInput = screen.getByPlaceholderText("교차로 이름 또는 ID로 검색...");
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
    // GPS fetch 응답 추가
    mockFetchJsonOnce({ items: [{ itstId: "2230", itstNm: "방학사거리", lat: 37.65, lon: 127.02, distanceM: 50 }] });

    const getCurrentPosition = jest.fn(
      (success: (pos: { coords: { latitude: number; longitude: number } }) => void) =>
        success({ coords: { latitude: 37.6548, longitude: 127.0224 } })
    );
    Object.defineProperty(global.navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition },
    });

    render(<Home />);
    await screen.findByText("면목아이파크102동");

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
    render(<Home />);
    await screen.findByText("면목아이파크102동");

    const nameSort = screen.getByRole("button", { name: "이름 순" });
    fireEvent.click(nameSort);

    const distSort = screen.getByRole("button", { name: "가까운 순" });
    fireEvent.click(distSort);

    expect(screen.getByRole("button", { name: "가까운 순" })).toBeInTheDocument();
  });

  it("should show error message when ip-location fails", async () => {
    resetFetchMock();
    ensureFetchMock()
      .mockRejectedValueOnce(new Error("network error"))
      .mockRejectedValueOnce(new Error("network error")); // Seoul fallback

    render(<Home />);

    await waitFor(() => {
      expect(screen.getByText(/network error/i)).toBeInTheDocument();
    });
  });

  it("should show empty state when search returns no results", async () => {
    // search empty
    mockFetchJsonOnce({ items: [] });

    render(<Home />);
    await screen.findByText("면목아이파크102동");

    const searchInput = screen.getByPlaceholderText("교차로 이름 또는 ID로 검색...");
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
