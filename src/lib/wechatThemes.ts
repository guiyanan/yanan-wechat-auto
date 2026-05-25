export type WechatTheme = "minimal" | "polished" | "vibrant" | "joto";

export const WECHAT_THEME_LABELS: Record<WechatTheme, string> = {
  minimal: "简约白",
  polished: "商务蓝",
  vibrant: "活力橙",
  joto: "JOTO 公众号",
};

/**
 * Theme color palettes — used by both CSS and structural decoration.
 * Exported so wechatDecorate.ts can build inline-styled HTML elements
 * using the same palette.
 */
export interface ThemePalette {
  /** Primary accent color */
  accent: string;
  /** Lighter accent for backgrounds */
  accentLight: string;
  /** Gradient end color (for banners) */
  accentEnd: string;
  /** Semi-transparent accent for keyword highlights */
  highlightBg: string;
  /** Text color on highlight background */
  highlightText: string;
  /** Body text color */
  text: string;
  /** Muted/secondary text */
  textMuted: string;
  /** H1 title color */
  titleColor: string;
  /** H3 subtitle color */
  subtitleColor: string;
  /** Blockquote background */
  quoteBg: string;
  /** Blockquote border */
  quoteBorder: string;
  /** Blockquote text */
  quoteText: string;
}

export const THEME_PALETTES: Record<WechatTheme, ThemePalette> = {
  minimal: {
    accent: "#555",
    accentLight: "#f5f5f5",
    accentEnd: "#888",
    highlightBg: "rgba(0,0,0,0.06)",
    highlightText: "#333",
    text: "#333",
    textMuted: "#999",
    titleColor: "#111",
    subtitleColor: "#333",
    quoteBg: "#f9f9f9",
    quoteBorder: "#e0e0e0",
    quoteText: "#666",
  },
  polished: {
    accent: "#456BB0",
    accentLight: "#eaf2f8",
    accentEnd: "#5A8FD4",
    highlightBg: "rgba(69,107,176,0.12)",
    highlightText: "#2c5282",
    text: "#2c3e50",
    textMuted: "#7f8c8d",
    titleColor: "#1a3a5c",
    subtitleColor: "#2c3e50",
    quoteBg: "#f0f6fc",
    quoteBorder: "#456BB0",
    quoteText: "#34495e",
  },
  vibrant: {
    accent: "#DE7356",
    accentLight: "#fef5ec",
    accentEnd: "#E8956D",
    highlightBg: "linear-gradient(135deg, rgba(222,115,86,0.13), rgba(232,149,109,0.2))",
    highlightText: "#B54432",
    text: "#374151",
    textMuted: "#9CA3AF",
    titleColor: "#DE7356",
    subtitleColor: "#DE7356",
    quoteBg: "#fef9f2",
    quoteBorder: "#DE7356",
    quoteText: "#7f4b1e",
  },
  joto: {
    accent: "#1268FF",
    accentLight: "#EAF2FF",
    accentEnd: "#5B8CFF",
    highlightBg: "rgba(18,104,255,0.12)",
    highlightText: "#1268FF",
    text: "#5F5F5F",
    textMuted: "#8A8A8A",
    titleColor: "#1F1F1F",
    subtitleColor: "#4A4A4A",
    quoteBg: "#F6F9FF",
    quoteBorder: "#1268FF",
    quoteText: "#4A4A4A",
  },
};

const SHARED_BASE = `
body { font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif; line-height: 1.8; margin: 0; padding: 24px; max-width: 720px; font-size: 15px; }
.joto-cover { width: 100%; height: auto; border-radius: 8px; margin-bottom: 18px; display: block; }
p { margin: 14px 0; font-size: 15px; }
ul, ol { margin: 14px 0; padding-left: 24px; }
li { margin-bottom: 8px; font-size: 15px; line-height: 1.8; }
img { max-width: 100%; height: auto; border-radius: 4px; }
.joto-img-placeholder { width: 100%; min-height: 120px; border: 2px dashed #ccc; border-radius: 8px; text-align: center; padding: 24px 16px; margin: 16px 0; color: #999; font-size: 13px; background-color: #fafafa; }
strong { font-weight: 700; }
`;

/**
 * CSS for each theme. The decoration system (wechatDecorate.ts) generates
 * inline-styled HTML using THEME_PALETTES, so the CSS here mainly covers
 * base typography and elements that are NOT structurally transformed.
 *
 * Note: WeChat supports inline linear-gradient, border-radius, etc.
 * What it strips is <style> blocks — juice inlines everything before export.
 */
const THEME_CSS: Record<WechatTheme, string> = {
  minimal: `
${SHARED_BASE}
body { color: #333; }
h1 { font-size: 22px; margin: 0 0 8px; line-height: 1.4; color: #111; }
.joto-byline { color: #999; font-size: 13px; margin: 0 0 24px; }
h2 { font-size: 18px; margin: 32px 0 14px; color: #222; padding: 10px 0 10px 16px; border-left: 4px solid #555; background-color: #f5f5f5; font-weight: 800; letter-spacing: -0.2px; }
h3 { font-size: 16px; margin: 22px 0 10px; color: #333; font-weight: 800; padding-bottom: 6px; border-bottom: 1.5px solid #e5e5e5; }
blockquote { border-left: 3px solid #e0e0e0; padding: 10px 14px; margin: 16px 0; color: #666; font-style: normal; background-color: #f9f9f9; border-radius: 0 6px 6px 0; }
hr { border: none; border-top: 1px solid #eee; margin: 28px 0; }
`,

  polished: `
${SHARED_BASE}
body { color: #2c3e50; }
h1 { font-size: 24px; margin: 0 0 6px; line-height: 1.3; color: #1a3a5c; font-weight: 900; letter-spacing: -0.5px; }
.joto-byline { color: #7f8c8d; font-size: 13px; margin: 0 0 24px; }
h2 { font-size: 18px; margin: 36px 0 14px; color: #fff; font-weight: 900; letter-spacing: -0.2px; }
h3 { font-size: 17px; margin: 22px 0 10px; color: #2c3e50; font-weight: 800; padding-bottom: 6px; border-bottom: 1.5px solid rgba(69,107,176,0.2); }
blockquote { border-left: 4px solid #456BB0; padding: 12px 16px; margin: 16px 0; color: #34495e; background-color: #f0f6fc; font-style: normal; border-radius: 0 8px 8px 0; }
hr { border: none; height: 3px; background: linear-gradient(to right, #456BB0, rgba(69,107,176,0.1)); margin: 32px 0; border-radius: 2px; }
`,

  vibrant: `
${SHARED_BASE}
body { color: #374151; }
h1 { font-size: 26px; margin: 0 0 6px; line-height: 1.2; color: #111827; font-weight: 900; letter-spacing: -1px; }
.joto-byline { color: #9CA3AF; font-size: 13px; margin: 0 0 24px; letter-spacing: 0.5px; }
h2 { font-size: 18px; margin: 36px 0 14px; color: #fff; font-weight: 900; letter-spacing: -0.2px; }
h3 { font-size: 17px; margin: 22px 0 10px; color: #DE7356; font-weight: 800; padding-bottom: 6px; border-bottom: 1.5px solid rgba(222,115,86,0.2); }
blockquote { border-left: 4px solid #DE7356; padding: 12px 16px; margin: 16px 0; color: #7f4b1e; background-color: #fef9f2; font-style: normal; border-radius: 0 8px 8px 0; }
hr { border: none; height: 3px; background: linear-gradient(to right, #DE7356, rgba(222,115,86,0.1)); margin: 32px 0; border-radius: 2px; }
`,

  joto: `
${SHARED_BASE}
body { background-color: #FFFFFF; color: #5F5F5F; max-width: 760px; padding: 34px 28px 42px; }
.joto-article-shell { background-color: #FFFFFF; color: #5F5F5F; }
h1 { font-size: 28px; margin: 0 0 16px; line-height: 1.35; color: #1F1F1F; font-weight: 900; letter-spacing: 0; }
.joto-byline { color: #8A8A8A; font-size: 14px; margin: 0 0 38px; }
h2 { font-size: 18px; margin: 38px 0 18px; color: #4A4A4A; font-weight: 900; letter-spacing: 0; }
h3 { font-size: 16px; margin: 30px 0 18px; color: #4A4A4A; font-weight: 900; text-align: center; letter-spacing: 0; }
p { color: #5F5F5F; font-size: 16px; line-height: 2.05; margin: 20px 0; letter-spacing: 0; }
ul, ol { color: #5F5F5F; margin: 18px 0 20px; padding-left: 26px; }
li { color: #5F5F5F; font-size: 16px; line-height: 1.95; margin-bottom: 10px; }
blockquote { border-left: 4px solid #1268FF; padding: 12px 18px; margin: 22px 0; color: #4A4A4A; background-color: #F6F9FF; font-style: normal; border-radius: 0 6px 6px 0; }
hr { border: none; border-top: 1px solid #E6EAF2; margin: 34px 0; }
a { color: #1268FF; }
.joto-cover { border-radius: 0; margin: 28px auto; background-color: #fff; }
.joto-img-placeholder { min-height: 180px; border: 1px solid #DDE8FF; border-radius: 4px; color: #8A8A8A; background-color: #F7FAFF; }
.joto-past-articles { margin: 50px 0 28px; color: #6D86B5; }
`,
};

/**
 * Tokens that WeChat strips even when inline-styled.
 * linear-gradient is SAFE (confirmed from real WeChat articles).
 */
const FORBIDDEN_TOKENS = [
  "::before",
  "::after",
  ":before",
  ":after",
  "@media",
  "@keyframes",
  "animation:",
  "transition:",
  "position: fixed",
  "position: sticky",
];

export function getThemeCss(theme: WechatTheme): string {
  return THEME_CSS[theme];
}

export function getThemePalette(theme: WechatTheme): ThemePalette {
  return THEME_PALETTES[theme];
}

export function isThemeSafe(theme: WechatTheme): boolean {
  const css = THEME_CSS[theme].toLowerCase();
  return FORBIDDEN_TOKENS.every((token) => !css.includes(token.toLowerCase()));
}

export function defaultThemeForArticleType(
  articleType?: string
): WechatTheme {
  switch (articleType) {
    case "产品介绍":
    case "产品差异":
    case "竞品对比":
    case "时事热点":
    case "产品推广":
    case "场景推广":
    case "峰会消息":
      return "joto";
    default:
      return "joto";
  }
}
