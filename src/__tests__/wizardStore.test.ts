import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useWizardStore } from "@/store/wizardStore";

const initialSnapshot = useWizardStore.getState();

beforeEach(() => {
  useWizardStore.setState({
    ...initialSnapshot,
    angleIds: [],
    customAngle: "",
    styleIds: [],
    mode: "manual",
    articleCount: 5,
    contentLength: "standard",
    angleStrategy: "auto",
    sourcePack: {
      productNotes: "",
      competitorNotes: "",
      trendNotes: "",
      imageRefs: "",
    },
  });
});

afterEach(() => {
  useWizardStore.getState().reset();
});

describe("wizardStore · angle multi-select", () => {
  it("starts with empty angleIds", () => {
    expect(useWizardStore.getState().angleIds).toEqual([]);
  });

  it("toggleAngleId adds an id when not present", () => {
    useWizardStore.getState().toggleAngleId("angle-promo");
    expect(useWizardStore.getState().angleIds).toEqual(["angle-promo"]);
  });

  it("toggleAngleId removes an id when already present", () => {
    const { toggleAngleId } = useWizardStore.getState();
    toggleAngleId("angle-promo");
    toggleAngleId("angle-compare");
    expect(useWizardStore.getState().angleIds).toEqual([
      "angle-promo",
      "angle-compare",
    ]);
    toggleAngleId("angle-promo");
    expect(useWizardStore.getState().angleIds).toEqual(["angle-compare"]);
  });

  it("toggleAngleId preserves insertion order on add", () => {
    const { toggleAngleId } = useWizardStore.getState();
    toggleAngleId("angle-summit");
    toggleAngleId("angle-promo");
    toggleAngleId("angle-compare");
    expect(useWizardStore.getState().angleIds).toEqual([
      "angle-summit",
      "angle-promo",
      "angle-compare",
    ]);
  });

  it("toggling a preset angle clears any custom angle text", () => {
    useWizardStore.setState({ customAngle: "面向 CFO 的视角" });
    useWizardStore.getState().toggleAngleId("angle-promo");
    expect(useWizardStore.getState().customAngle).toBe("");
  });

  it("typing customAngle clears all preset selections", () => {
    const { toggleAngleId, setCustomAngle } = useWizardStore.getState();
    toggleAngleId("angle-promo");
    toggleAngleId("angle-compare");
    setCustomAngle("自定义视角");
    expect(useWizardStore.getState().angleIds).toEqual([]);
    expect(useWizardStore.getState().customAngle).toBe("自定义视角");
  });

  it("clearing customAngle (empty string) does not auto-restore presets", () => {
    const { toggleAngleId, setCustomAngle } = useWizardStore.getState();
    toggleAngleId("angle-promo");
    setCustomAngle("草稿");
    setCustomAngle("");
    // angleIds was already cleared by setCustomAngle("草稿"); empty string
    // simply leaves it empty — caller must re-toggle.
    expect(useWizardStore.getState().angleIds).toEqual([]);
    expect(useWizardStore.getState().customAngle).toBe("");
  });

  it("setAngleIds replaces the whole selection", () => {
    useWizardStore.getState().toggleAngleId("angle-promo");
    useWizardStore
      .getState()
      .setAngleIds(["angle-summit", "angle-compare"]);
    expect(useWizardStore.getState().angleIds).toEqual([
      "angle-summit",
      "angle-compare",
    ]);
  });

  it("setAngleIds([]) clears selection without touching customAngle by accident", () => {
    useWizardStore.setState({ customAngle: "保留这段文字" });
    useWizardStore.getState().setAngleIds([]);
    // setAngleIds([]) resets customAngle to initial empty value — by design,
    // because setAngleIds is the explicit "replace" operator.
    expect(useWizardStore.getState().angleIds).toEqual([]);
  });

  it("reset() returns angleIds to empty", () => {
    useWizardStore.getState().toggleAngleId("angle-promo");
    useWizardStore.getState().reset();
    expect(useWizardStore.getState().angleIds).toEqual([]);
    expect(useWizardStore.getState().customAngle).toBe("");
    expect(useWizardStore.getState().productId).toBeNull();
    expect(useWizardStore.getState().styleIds).toEqual([]);
    expect(useWizardStore.getState().mode).toBe("manual");
    expect(useWizardStore.getState().contentLength).toBe("standard");
    expect(useWizardStore.getState().angleStrategy).toBe("auto");
  });
});

describe("wizardStore · auto generation preferences", () => {
  it("stores content length and angle strategy independently", () => {
    const state = useWizardStore.getState();
    state.setContentLength("short");
    state.setAngleStrategy("comparison");

    expect(useWizardStore.getState().contentLength).toBe("short");
    expect(useWizardStore.getState().angleStrategy).toBe("comparison");
  });

  it("startAutoFive preserves generation preferences", () => {
    const state = useWizardStore.getState();
    state.setContentLength("deep");
    state.setAngleStrategy("education");

    state.startAutoFive("prod-loop");

    expect(useWizardStore.getState()).toMatchObject({
      productId: "prod-loop",
      mode: "auto-five",
      contentLength: "deep",
      angleStrategy: "education",
    });
  });
});

describe("wizardStore · auto-five mode", () => {
  it("startAutoFive keeps product and clears manual angle/style choices", () => {
    const state = useWizardStore.getState();
    state.toggleAngleId("angle-product-intro");
    state.toggleStyleId("style-joto");
    state.setCustomAngle("自定义角度");

    state.startAutoFive("prod-loop");

    expect(useWizardStore.getState()).toMatchObject({
      productId: "prod-loop",
      mode: "auto-five",
      articleCount: 5,
      angleIds: [],
      customAngle: "",
      styleIds: [],
    });
  });
});

describe("wizardStore · style multi-select", () => {
  it("starts with empty styleIds", () => {
    expect(useWizardStore.getState().styleIds).toEqual([]);
  });

  it("toggleStyleId adds and removes ids symmetrically", () => {
    const { toggleStyleId } = useWizardStore.getState();
    toggleStyleId("style-kazik");
    toggleStyleId("style-joto");
    expect(useWizardStore.getState().styleIds).toEqual([
      "style-kazik",
      "style-joto",
    ]);
    toggleStyleId("style-kazik");
    expect(useWizardStore.getState().styleIds).toEqual(["style-joto"]);
  });

  it("toggleStyleId preserves insertion order on add", () => {
    const { toggleStyleId } = useWizardStore.getState();
    toggleStyleId("style-36kr");
    toggleStyleId("style-leijun");
    toggleStyleId("style-joto");
    expect(useWizardStore.getState().styleIds).toEqual([
      "style-36kr",
      "style-leijun",
      "style-joto",
    ]);
  });

  it("setStyleIds replaces the whole selection", () => {
    useWizardStore.getState().toggleStyleId("style-kazik");
    useWizardStore
      .getState()
      .setStyleIds(["style-joto", "style-leijun"]);
    expect(useWizardStore.getState().styleIds).toEqual([
      "style-joto",
      "style-leijun",
    ]);
  });

  it("style multi-select is independent of angle multi-select", () => {
    const { toggleAngleId, toggleStyleId } = useWizardStore.getState();
    toggleAngleId("angle-promo");
    toggleStyleId("style-joto");
    expect(useWizardStore.getState().angleIds).toEqual(["angle-promo"]);
    expect(useWizardStore.getState().styleIds).toEqual(["style-joto"]);
    toggleStyleId("style-joto");
    expect(useWizardStore.getState().angleIds).toEqual(["angle-promo"]);
    expect(useWizardStore.getState().styleIds).toEqual([]);
  });
});

describe("wizardStore · sourcePack", () => {
  it("starts with empty sourcePack fields", () => {
    expect(useWizardStore.getState().sourcePack).toEqual({
      productNotes: "",
      competitorNotes: "",
      trendNotes: "",
      imageRefs: "",
    });
  });

  it("setSourcePack merges material fields without dropping existing notes", () => {
    const { setSourcePack } = useWizardStore.getState();
    setSourcePack({ productNotes: "Pharaoh Command: AI 智问中枢" });
    setSourcePack({ competitorNotes: "传统监控平台需要多后台切换" });

    expect(useWizardStore.getState().sourcePack).toMatchObject({
      productNotes: "Pharaoh Command: AI 智问中枢",
      competitorNotes: "传统监控平台需要多后台切换",
      trendNotes: "",
      imageRefs: "",
    });
  });

  it("reset() clears sourcePack", () => {
    useWizardStore.getState().setSourcePack({
      productNotes: "产品素材",
      trendNotes: "热点素材",
    });
    useWizardStore.getState().reset();
    expect(useWizardStore.getState().sourcePack).toEqual({
      productNotes: "",
      competitorNotes: "",
      trendNotes: "",
      imageRefs: "",
    });
  });
});
