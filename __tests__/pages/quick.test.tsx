import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import QuickPage from "@/pages/quick";
import { useSpat } from "@/hooks/useSpat";

jest.mock("@/hooks/useSpat", () => ({
  useSpat: jest.fn(),
}));

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const mockedUseSpat = useSpat as jest.MockedFunction<typeof useSpat>;
const mockedFetch = jest.fn() as jest.MockedFunction<typeof fetch>;

const asJsonResponse = (ok: boolean, body: unknown) =>
  ({
    ok,
    json: async () => body,
  }) as Response;

const setUserAgent = (ua: string) => {
  Object.defineProperty(window.navigator, "userAgent", {
    configurable: true,
    value: ua,
  });
};

const setupMatchMedia = (matches = false) => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: jest.fn().mockImplementation(() => ({
      matches,
      media: "(display-mode: standalone)",
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
};

describe("Quick Page", () => {
  const fetchSpat = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    window.history.replaceState({}, "", "/quick");
    setupMatchMedia(false);
    setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36"
    );

    mockedUseSpat.mockReturnValue({
      spatData: null,
      error: "",
      isLoading: false,
      fetchSpat,
      setError: jest.fn(),
    });

    mockedFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const raw = typeof input === "string" ? input : input.toString();
      if (raw.startsWith("/api/ip-location")) {
        return asJsonResponse(false, { error: "skip bootstrap" });
      }
      if (raw.startsWith("/api/nearby")) {
        return asJsonResponse(true, { items: [] });
      }
      return asJsonResponse(false, { error: "unknown api" });
    });
    global.fetch = mockedFetch;
  });

  it("loads itstId from query and auto-fetches when auto=1", async () => {
    window.history.replaceState({}, "", "/quick?itstId=1560&auto=1");
    render(<QuickPage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("1560")).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(fetchSpat).toHaveBeenCalledTimes(1);
    });
    expect(localStorage.getItem("lastItstId")).toBe("1560");
  });

  it("bootstraps nearest itstId from ip location on first visit", async () => {
    mockedFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const raw = typeof input === "string" ? input : input.toString();
      if (raw.startsWith("/api/ip-location")) {
        return asJsonResponse(true, { lat: 37.57, lon: 127.04, label: "서울" });
      }
      if (raw.startsWith("/api/nearby")) {
        return asJsonResponse(true, {
          items: [
            { itstId: "1560", itstNm: "면목아이파크102동", lat: 37.58, lon: 127.08, distanceM: 120 },
          ],
        });
      }
      return asJsonResponse(false, { error: "unknown api" });
    });

    render(<QuickPage />);

    expect(await screen.findByDisplayValue("1560")).toBeInTheDocument();
    expect(localStorage.getItem("lastItstId")).toBe("1560");
    expect((await screen.findAllByText("면목아이파크102동")).length).toBeGreaterThan(0);
  });

  it("shows install button on Android beforeinstallprompt and calls prompt", async () => {
    setUserAgent(
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/122.0.0.0 Mobile Safari/537.36"
    );
    render(<QuickPage />);

    const prompt = jest.fn(async () => undefined);
    const installEvent = new Event("beforeinstallprompt") as InstallPromptEvent;
    Object.defineProperty(installEvent, "prompt", { value: prompt });
    Object.defineProperty(installEvent, "userChoice", {
      value: Promise.resolve({ outcome: "accepted", platform: "web" }),
    });
    window.dispatchEvent(installEvent);

    const installButton = await screen.findByRole("button", { name: "앱 설치" });
    fireEvent.click(installButton);

    await waitFor(() => {
      expect(prompt).toHaveBeenCalledTimes(1);
    });
  });

  it("shows iOS install guidance on Safari", async () => {
    setUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1"
    );
    render(<QuickPage />);

    expect(
      await screen.findByText("iPhone/iPad: Safari 공유 버튼 → 홈 화면에 추가")
    ).toBeInTheDocument();
  });
});
