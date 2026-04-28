import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useArticleStore } from "@/store/articleStore";

/**
 * articleStore is a zustand store with persist middleware. In tests we
 * snapshot + reset state around each case so persistent drafts from one
 * test don't bleed into the next.
 */
describe("articleStore", () => {
  let snapshot: ReturnType<typeof useArticleStore.getState>;

  beforeEach(() => {
    snapshot = useArticleStore.getState();
    useArticleStore.setState({ drafts: {} }, false);
  });

  afterEach(() => {
    useArticleStore.setState({ drafts: snapshot.drafts }, false);
  });

  it("createDraft produces a new Article with stable shape", () => {
    const a = useArticleStore.getState().createDraft({
      productId: "prod-forge",
      angleId: "angle-feature",
      styleId: "style-kazik",
    });
    expect(a.id).toMatch(/^art-/);
    expect(a.status).toBe("draft");
    expect(a.title).toContain("草稿");
    expect(a.titleCandidates).toEqual([]);
    expect(a.coverCandidates).toEqual([]);
    expect(a.aiScore.value).toBe(0);
    expect(useArticleStore.getState().drafts[a.id]).toBeTruthy();
  });

  it("createDraft accepts custom id and customAngle", () => {
    const a = useArticleStore.getState().createDraft({
      id: "art-custom-1",
      productId: "prod-x",
      styleId: "style-kazik",
      customAngle: "自己定义一个角度",
    });
    expect(a.id).toBe("art-custom-1");
    expect(a.customAngle).toBe("自己定义一个角度");
  });

  it("patch merges changes and bumps updatedAt", async () => {
    const a = useArticleStore.getState().createDraft({
      productId: "p",
      styleId: "s",
    });
    const t0 = a.updatedAt;
    await new Promise((r) => setTimeout(r, 2));
    useArticleStore.getState().patch(a.id, { title: "new title" });
    const next = useArticleStore.getState().drafts[a.id];
    expect(next.title).toBe("new title");
    expect(new Date(next.updatedAt).getTime()).toBeGreaterThan(
      new Date(t0).getTime()
    );
  });

  it("setStatus('published') stamps publishedAt", () => {
    const a = useArticleStore.getState().createDraft({
      productId: "p",
      styleId: "s",
    });
    useArticleStore.getState().setStatus(a.id, "published");
    const next = useArticleStore.getState().drafts[a.id];
    expect(next.status).toBe("published");
    expect(next.publishedAt).toBeTruthy();
  });

  it("setStatus on non-published does NOT overwrite existing publishedAt", () => {
    const a = useArticleStore.getState().createDraft({
      productId: "p",
      styleId: "s",
    });
    useArticleStore.getState().setStatus(a.id, "published");
    const t = useArticleStore.getState().drafts[a.id].publishedAt;
    useArticleStore.getState().setStatus(a.id, "archived");
    expect(useArticleStore.getState().drafts[a.id].publishedAt).toBe(t);
  });

  it("remove deletes the draft", () => {
    const a = useArticleStore.getState().createDraft({
      productId: "p",
      styleId: "s",
    });
    useArticleStore.getState().remove(a.id);
    expect(useArticleStore.getState().drafts[a.id]).toBeUndefined();
  });

  it("rollbackIncompleteDraft removes an empty draft", () => {
    const a = useArticleStore.getState().createDraft({
      productId: "p",
      styleId: "s",
    });
    useArticleStore.getState().rollbackIncompleteDraft(a.id);
    expect(useArticleStore.getState().drafts[a.id]).toBeUndefined();
  });

  it("rollbackIncompleteDraft is a no-op once content landed", () => {
    const a = useArticleStore.getState().createDraft({
      productId: "p",
      styleId: "s",
    });
    useArticleStore.getState().patch(a.id, {
      contentHtml: "<p>real content</p>",
    });
    useArticleStore.getState().rollbackIncompleteDraft(a.id);
    expect(useArticleStore.getState().drafts[a.id]).toBeTruthy();
  });

  it("patch on a seed article id upserts to drafts (override pattern)", () => {
    // Seed articles (from data/articles.json) aren't in drafts initially,
    // but patch() falls back to SEED lookup to produce the override copy.
    useArticleStore.getState().patch("art-1", { title: "overridden" });
    const out = useArticleStore.getState().drafts["art-1"];
    expect(out).toBeTruthy();
    expect(out.title).toBe("overridden");
  });

  it("getById returns draft override before seed", () => {
    useArticleStore.getState().patch("art-1", { title: "overridden" });
    const got = useArticleStore.getState().getById("art-1");
    expect(got?.title).toBe("overridden");
  });

  it("getById returns seed when no draft exists", () => {
    // Without any draft, asking for a seed id still returns the seed
    const got = useArticleStore.getState().getById("art-1");
    expect(got).toBeTruthy();
    expect(got?.id).toBe("art-1");
  });

  it("listAll sorts by updatedAt desc, drafts override seed", async () => {
    const d = useArticleStore.getState().createDraft({
      productId: "prod-forge",
      styleId: "style-kazik",
    });
    await new Promise((r) => setTimeout(r, 2));
    useArticleStore.getState().patch(d.id, { title: "newest" });
    const list = useArticleStore.getState().listAll();
    expect(list[0].id).toBe(d.id);
    expect(list[0].title).toBe("newest");
  });
});
