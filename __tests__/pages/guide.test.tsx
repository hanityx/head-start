import { render, screen } from "@testing-library/react";

import GuidePage from "@/pages/guide";

describe("Guide Page", () => {
  it("renders quick start guidance", () => {
    render(<GuidePage />);

    expect(screen.getByRole("heading", { name: "사용자 가이드" })).toBeInTheDocument();
    expect(screen.getByText("처음 30초 사용법")).toBeInTheDocument();
    expect(screen.getByText(/교차로 ID 입력 또는 주변 교차로 선택/)).toBeInTheDocument();
    expect(screen.getByText(/조회 버튼으로 현재 상태 확인/)).toBeInTheDocument();
  });

  it("includes a link back to the main page", () => {
    render(<GuidePage />);

    const homeLink = screen.getByRole("link", { name: "메인으로 이동" });
    expect(homeLink).toHaveAttribute("href", "/");
  });
});
