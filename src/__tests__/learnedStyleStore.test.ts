import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLearnedStyleStore } from "@/store/learnedStyleStore";
import type { LearnedWritingStyle } from "@/types";

function style(patch: Partial<LearnedWritingStyle> = {}): LearnedWritingStyle {
  return {
    id: "style-old",
    scope: "product",
    name: "旧风格",
    sourceUrls: [],
    toneProfile: "语气",
    titlePattern: "标题",
    openingPattern: "开头",
    paragraphPattern: "段落",
    keySentencePattern: "金句",
    sampleDigest: "摘要",
    createdAt: "2026-06-12T00:00:00.000Z",
    ...patch,
  };
}

describe("learnedStyleStore", () => {
  beforeEach(() => {
    localStorage.clear();
    useLearnedStyleStore.setState({
      styles: [],
      serverLoaded: false,
      serverError: undefined,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("treats an empty server library as authoritative and does not resurrect local cached styles", async () => {
    const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      if (String(url) === "/api/styles/library" && !init) {
        return Response.json({ ok: true, styles: [] });
      }
      return Response.json({ ok: true, styles: [] });
    });
    vi.stubGlobal("fetch", fetchMock);
    useLearnedStyleStore.setState({
      styles: [style()],
      serverLoaded: false,
    });

    await useLearnedStyleStore.getState().loadFromServer();

    expect(useLearnedStyleStore.getState().styles).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not update the local library when saving a prompt edit fails", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ ok: false, error: "保存风格失败" }, { status: 500 })
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      useLearnedStyleStore
        .getState()
        .upsertStyle(style({ promptProfile: "页面编辑后的固定提示词" }))
    ).rejects.toThrow("保存风格失败");

    expect(useLearnedStyleStore.getState().styles).toEqual([]);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/styles/library",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("页面编辑后的固定提示词"),
      })
    );
  });
});
