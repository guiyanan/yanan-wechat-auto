import { describe, it, expect } from "vitest";
import {
  getThemeCss,
  getThemePalette,
  isThemeSafe,
  defaultThemeForArticleType,
  WECHAT_THEME_LABELS,
  THEME_PALETTES,
  type WechatTheme,
} from "@/lib/wechatThemes";

const ALL_THEMES: WechatTheme[] = ["minimal", "polished", "vibrant", "joto"];

describe("wechatThemes", () => {
  describe("getThemeCss", () => {
    it.each(ALL_THEMES)("returns non-empty CSS for theme %s", (theme) => {
      const css = getThemeCss(theme);
      expect(css.length).toBeGreaterThan(100);
    });

    it("minimal theme uses neutral gray accents", () => {
      const css = getThemeCss("minimal");
      expect(css).toContain("color: #333");
      expect(css).toContain("border-left: 4px solid #555");
    });

    it("polished theme uses blue accent with gradient hr", () => {
      const css = getThemeCss("polished");
      expect(css).toContain("#456BB0");
      expect(css).toContain("linear-gradient");
    });

    it("vibrant theme uses orange accent with gradient hr", () => {
      const css = getThemeCss("vibrant");
      expect(css).toContain("#DE7356");
      expect(css).toContain("linear-gradient");
    });

    it("joto theme uses white official-account styling with blue accents", () => {
      const css = getThemeCss("joto");
      expect(css).toContain("background-color: #FFFFFF");
      expect(css).toContain("#1268FF");
      expect(css).toContain(".joto-article-shell");
      expect(css).toContain(".joto-past-articles");
    });
  });

  describe("getThemePalette", () => {
    it.each(ALL_THEMES)("returns complete palette for theme %s", (theme) => {
      const p = getThemePalette(theme);
      expect(p.accent).toBeTruthy();
      expect(p.accentEnd).toBeTruthy();
      expect(p.text).toBeTruthy();
      expect(p.highlightBg).toBeTruthy();
      expect(p.highlightText).toBeTruthy();
      expect(p.quoteBg).toBeTruthy();
    });

    it("polished palette is blue-family", () => {
      const p = getThemePalette("polished");
      expect(p.accent).toBe("#456BB0");
    });

    it("vibrant palette is orange-family", () => {
      const p = getThemePalette("vibrant");
      expect(p.accent).toBe("#DE7356");
      expect(p.highlightBg).toContain("linear-gradient");
    });

    it("joto palette is blue on white", () => {
      const p = getThemePalette("joto");
      expect(p.accent).toBe("#1268FF");
      expect(p.text).toBe("#5F5F5F");
      expect(p.quoteBg).toBe("#F6F9FF");
    });
  });

  describe("isThemeSafe", () => {
    it.each(ALL_THEMES)(
      "theme %s contains no WeChat-forbidden CSS tokens",
      (theme) => {
        expect(isThemeSafe(theme)).toBe(true);
      }
    );

    it.each(ALL_THEMES)(
      "theme %s does not contain pseudo-elements",
      (theme) => {
        const css = getThemeCss(theme);
        expect(css).not.toContain("::before");
        expect(css).not.toContain("::after");
      }
    );

    it.each(ALL_THEMES)(
      "theme %s does not contain animation/transition",
      (theme) => {
        const css = getThemeCss(theme);
        expect(css).not.toMatch(/animation:/);
        expect(css).not.toMatch(/transition:/);
      }
    );
  });

  describe("WECHAT_THEME_LABELS", () => {
    it("has labels for all themes", () => {
      expect(Object.keys(WECHAT_THEME_LABELS)).toHaveLength(4);
      expect(WECHAT_THEME_LABELS.minimal).toBe("简约白");
      expect(WECHAT_THEME_LABELS.polished).toBe("商务蓝");
      expect(WECHAT_THEME_LABELS.vibrant).toBe("活力橙");
      expect(WECHAT_THEME_LABELS.joto).toBe("JOTO 公众号");
    });
  });

  describe("THEME_PALETTES", () => {
    it("has palette for all themes", () => {
      expect(Object.keys(THEME_PALETTES)).toHaveLength(4);
    });
  });

  describe("defaultThemeForArticleType", () => {
    it("returns joto for JOTO content angles", () => {
      expect(defaultThemeForArticleType("产品介绍")).toBe("joto");
      expect(defaultThemeForArticleType("产品差异")).toBe("joto");
      expect(defaultThemeForArticleType("竞品对比")).toBe("joto");
      expect(defaultThemeForArticleType("时事热点")).toBe("minimal");
    });

    it("returns joto for undefined so review defaults to the公众号模板", () => {
      expect(defaultThemeForArticleType(undefined)).toBe("joto");
    });
  });

  describe("shared base CSS", () => {
    it.each(ALL_THEMES)(
      "theme %s includes shared base properties",
      (theme) => {
        const css = getThemeCss(theme);
        expect(css).toContain("PingFang SC");
        expect(css).toContain("line-height: 1.8");
        expect(css).toContain(".joto-cover");
        expect(css).toContain(".joto-img-placeholder");
      }
    );
  });
});
