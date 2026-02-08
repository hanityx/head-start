import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import Home from "@/pages/index";
import { makeSpatResponse } from "@/test/fixtures";
import {
  ensureFetchMock,
  mockFetchJsonOnce,
  resetFetchMock,
} from "@/test/testUtils";

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
    const itstIdInput = screen.getByDisplayValue("0000");
    const timeoutInput = screen.getByDisplayValue("25000");
    const intervalInput = screen.getByDisplayValue("3000");

    expect(itstIdInput).toBeInTheDocument();
    expect(timeoutInput).toBeInTheDocument();
    expect(intervalInput).toBeInTheDocument();
  });

  it("should update input values on change", () => {
    render(<Home />);
    const itstIdInput = screen.getByDisplayValue("0000") as HTMLInputElement;

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
        expect.stringContaining("/api/spat?itstId=0000")
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
    expect(screen.getByDisplayValue("37.5665")).toBeInTheDocument();
    expect(screen.getByDisplayValue("126.9780")).toBeInTheDocument();
    expect(screen.getByText("가까운 교차로 찾기")).toBeInTheDocument();
  });

  it("should toggle auto refresh", () => {
    render(<Home />);
    const autoButton = screen.getByText("자동 갱신 시작");

    fireEvent.click(autoButton);
    expect(screen.getByText("자동 갱신 중지")).toBeInTheDocument();

    fireEvent.click(autoButton);
    expect(screen.getByText("자동 갱신 시작")).toBeInTheDocument();
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
