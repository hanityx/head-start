import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import Home from "@/pages/index";
import { makeSpatResponse } from "@/test/fixtures";
import { DEFAULT_ITST_ID } from "@/lib/defaults";
import {
  ensureFetchMock,
  mockFetchJsonOnce,
  resetFetchMock,
} from "@/test/testUtils";

const TEST_NEARBY_ITST_ID = "900001";

describe("Home Page", () => {
  const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));
  beforeAll(() => {
    ensureFetchMock();
  });

  beforeEach(() => {
    resetFetchMock();
    localStorage.clear();
  });

  it("should render the main title", () => {
    render(<Home />);
    expect(
      screen.getByText("횡단보도/차량 신호 잔여시간 확인")
    ).toBeInTheDocument();
  });

  it("should have default values for inputs", () => {
    render(<Home />);
    const itstIdInput = screen.getByDisplayValue(DEFAULT_ITST_ID);
    const timeoutInput = screen.getByDisplayValue("25");
    const intervalInput = screen.getByDisplayValue("3");

    expect(itstIdInput).toBeInTheDocument();
    expect(timeoutInput).toBeInTheDocument();
    expect(intervalInput).toBeInTheDocument();
    expect(screen.getByPlaceholderText(`예: ${DEFAULT_ITST_ID}`)).toBeInTheDocument();
  });

  it("should update input values on change", () => {
    render(<Home />);
    const itstIdInput = screen.getByDisplayValue(
      DEFAULT_ITST_ID
    ) as HTMLInputElement;

    fireEvent.change(itstIdInput, { target: { value: "1234" } });
    expect(itstIdInput.value).toBe("1234");
  });

  it("should call API when 조회 button is clicked", async () => {
    mockFetchJsonOnce(makeSpatResponse());

    render(<Home />);
    const fetchButton = screen.getByText("조회");

    await act(async () => {
      fireEvent.click(fetchButton);
      await flushPromises();
    });

    await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(`/api/spat?itstId=${DEFAULT_ITST_ID}`)
      );
    });
  });

  it("should display error message on API failure", async () => {
    ensureFetchMock().mockRejectedValueOnce(new Error("Network error"));

    render(<Home />);
    const fetchButton = screen.getByText("조회");

    await act(async () => {
      fireEvent.click(fetchButton);
      await flushPromises();
    });

    await waitFor(() => {
      expect(screen.getByText(/Network error/i)).toBeInTheDocument();
    });
  });

  it("should render nearby search inputs", () => {
    render(<Home />);
    expect(screen.getByLabelText("주소/역 이름으로 찾기")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "주소 검색" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "현재 위치" })).toBeInTheDocument();
    expect(screen.queryByText("위도")).not.toBeInTheDocument();
    expect(screen.queryByText("경도")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "가까운 교차로 찾기" })
    ).not.toBeInTheDocument();
  });

  it("should toggle auto refresh", () => {
    render(<Home />);
    const autoButton = screen.getByText("자동 갱신 켜기");

    fireEvent.click(autoButton);
    expect(screen.getByText("자동 갱신 끄기")).toBeInTheDocument();

    fireEvent.click(autoButton);
    expect(screen.getByText("자동 갱신 켜기")).toBeInTheDocument();
  });

  it("should search nearby intersections with geocoded coordinates", async () => {
    mockFetchJsonOnce({
      lat: "37.5701",
      lon: "126.9768",
      displayName: "테스트 위치",
    });
    mockFetchJsonOnce({ items: [] });

    render(<Home />);
    const addressInput = screen.getByLabelText("주소/역 이름으로 찾기");
    fireEvent.change(addressInput, { target: { value: "테스트 주소" } });

    const addressButton = screen.getByRole("button", { name: "주소 검색" });
    await act(async () => {
      fireEvent.click(addressButton);
      await flushPromises();
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/geocode?q=")
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/nearby?lat=37.5701&lon=126.9768&k=5")
      );
    });
  });

  it("should search nearby intersections with current geolocation", async () => {
    mockFetchJsonOnce({ items: [] });

    const getCurrentPosition = jest.fn(
      (success: (position: { coords: { latitude: number; longitude: number } }) => void) =>
        success({ coords: { latitude: 37.5665, longitude: 126.978 } })
    );

    Object.defineProperty(global.navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition },
    });

    render(<Home />);

    const currentLocationButton = screen.getByRole("button", { name: "현재 위치" });
    await act(async () => {
      fireEvent.click(currentLocationButton);
      await flushPromises();
    });

    await waitFor(() => {
      expect(getCurrentPosition).toHaveBeenCalled();
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/nearby?lat=37.5665&lon=126.978&k=5")
      );
    });
  });

  it("should set id and fetch spat when selecting nearby intersection", async () => {
    mockFetchJsonOnce({
      items: [
        {
          itstId: TEST_NEARBY_ITST_ID,
          itstNm: "테스트교차로A",
          lat: 37.5,
          lon: 127.0,
          distanceM: 120.5,
        },
      ],
    });
    mockFetchJsonOnce(makeSpatResponse({ itstId: TEST_NEARBY_ITST_ID }));

    const getCurrentPosition = jest.fn(
      (
        success: (position: { coords: { latitude: number; longitude: number } }) => void
      ) => success({ coords: { latitude: 37.5665, longitude: 126.978 } })
    );

    Object.defineProperty(global.navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition },
    });

    render(<Home />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "현재 위치" }));
      await flushPromises();
    });

    const selectButton = await screen.findByRole("button", { name: "이 ID로 조회" });
    await act(async () => {
      fireEvent.click(selectButton);
      await flushPromises();
    });

    await waitFor(() => {
      expect(screen.getByDisplayValue(TEST_NEARBY_ITST_ID)).toBeInTheDocument();
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(`/api/spat?itstId=${TEST_NEARBY_ITST_ID}`)
      );
    });
  });

  it("should show and hide map preview when 지도보기 is clicked", async () => {
    mockFetchJsonOnce({
      items: [
        {
          itstId: TEST_NEARBY_ITST_ID,
          itstNm: "테스트교차로A",
          lat: 37.5,
          lon: 127.0,
          distanceM: 120.5,
        },
      ],
    });

    const getCurrentPosition = jest.fn(
      (
        success: (position: { coords: { latitude: number; longitude: number } }) => void
      ) => success({ coords: { latitude: 37.5665, longitude: 126.978 } })
    );

    Object.defineProperty(global.navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition },
    });

    render(<Home />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "현재 위치" }));
      await flushPromises();
    });

    const mapButton = await screen.findByRole("button", { name: "지도보기" });
    await act(async () => {
      fireEvent.click(mapButton);
      await flushPromises();
    });

    expect(
      screen.getByTitle(`교차로 위치 지도-nearby-${TEST_NEARBY_ITST_ID}`)
    ).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "지도 닫기" }));
      await flushPromises();
    });

    await waitFor(() => {
      expect(
        screen.queryByTitle(`교차로 위치 지도-nearby-${TEST_NEARBY_ITST_ID}`)
      ).not.toBeInTheDocument();
    });
  });

  it("should display spat data when available", async () => {
    mockFetchJsonOnce(makeSpatResponse());

    render(<Home />);
    const fetchButton = screen.getByText("조회");

    await act(async () => {
      fireEvent.click(fetchButton);
      await flushPromises();
    });

    await waitFor(() => {
      expect(screen.getByText("테스트교차로")).toBeInTheDocument();
      expect(screen.getByText("북측 보행")).toBeInTheDocument();
    });
  });
});
