import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import StylesPage from "@/app/styles/page";
import { useLearnedStyleStore } from "@/store/learnedStyleStore";
import type { LearnedWritingStyle } from "@/types";

vi.mock("@/components/nav/TopNav", () => ({
  TopNav: () => <nav aria-label="top nav" />,
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  },
}));

function learnedStyle(
  patch: Partial<LearnedWritingStyle> = {}
): LearnedWritingStyle {
  return {
    id: "style-1",
    scope: "product",
    name: "学习风格",
    sourceUrls: [],
    toneProfile: "基于范文提炼:表达克制,段落清晰。",
    titlePattern: "标题偏向问题式或观点式。",
    openingPattern: "开头先写一个具体工作场景。",
    paragraphPattern: "段落中等长度。",
    keySentencePattern: "用短句做阶段性总结。",
    sampleDigest: "样本文摘",
    promptProfile: "固定风格提示词",
    createdAt: "2026-06-16T06:40:39.000Z",
    ...patch,
  };
}

describe("StylesPage", () => {
  beforeEach(() => {
    localStorage.clear();
    useLearnedStyleStore.setState({
      styles: [learnedStyle()],
      serverLoaded: true,
      serverError: undefined,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("saves a renamed learned style after clicking and editing its title", async () => {
    const renamed = learnedStyle({ name: "新的学习风格" });
    const fetchMock = vi.fn(async () =>
      Response.json({ ok: true, styles: [renamed] })
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<StylesPage />);

    fireEvent.click(screen.getByRole("button", { name: "编辑风格名称：学习风格" }));
    const input = screen.getByLabelText("风格名称");
    fireEvent.change(input, { target: { value: "新的学习风格" } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/styles/library",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"name":"新的学习风格"'),
        })
      );
    });
    expect(await screen.findByText("新的学习风格")).toBeInTheDocument();
  });

  it("cancels title editing without saving when pressing Escape", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<StylesPage />);

    fireEvent.click(screen.getByRole("button", { name: "编辑风格名称：学习风格" }));
    const input = screen.getByLabelText("风格名称");
    fireEvent.change(input, { target: { value: "不保存的名字" } });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText("学习风格")).toBeInTheDocument();
  });
});
