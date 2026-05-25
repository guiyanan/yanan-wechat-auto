import { describe, it, expect } from "vitest";
import {
  injectListIcons,
  promoteCallouts,
  decorateHeadings,
  decorateSubtitles,
  highlightStrong,
  highlightNumbers,
  styleColonPrefixes,
  styleParagraphs,
  styleBlockquotes,
  insertSectionDividers,
  insertImagePlaceholders,
  decorateHtml,
} from "@/lib/wechatDecorate";

describe("wechatDecorate", () => {
  describe("injectListIcons", () => {
    it("formats JOTO list items without SVG icons or native bullets", () => {
      const html = "<ul><li>First</li><li>Second</li><li>Third</li></ul>";
      const result = injectListIcons(html, "joto");
      expect(result).toContain("list-style: none");
      expect(result).toContain("border-left: 2px solid #DDE8FF");
      expect(result).toContain("First");
      expect(result).not.toContain('class="joto-list-icon"');
      expect(result).not.toContain("<svg");
      expect(result).not.toContain("✅");
    });

    it("formats each JOTO list item", () => {
      const items = Array.from({ length: 7 }, (_, i) => `<li>Item ${i}</li>`);
      const html = `<ul>${items.join("")}</ul>`;
      const result = injectListIcons(html, "joto");
      expect(result.match(/border-left: 2px solid #DDE8FF/g)).toHaveLength(7);
      expect(result).toContain("Item 6");
    });

    it("removes simple emoji markers in JOTO lists", () => {
      const html = "<ul><li>✅ Already has emoji</li></ul>";
      const result = injectListIcons(html, "joto");
      expect(result).toContain("Already has emoji");
      expect(result).not.toContain('class="joto-list-icon"');
      expect(result).not.toContain("✅");
    });

    it("keeps SVG icons for non-JOTO decorative themes", () => {
      const html = "<ul><li>First</li><li>Second</li></ul>";
      const result = injectListIcons(html, "polished");
      expect(result).toContain('class="joto-list-icon"');
      expect(result).toContain("<svg");
    });

    it("handles empty list", () => {
      const html = "<ul></ul>";
      const result = injectListIcons(html, "joto");
      expect(result).toBe(html);
    });
  });

  describe("promoteCallouts", () => {
    it("converts callout paragraph to blockquote with theme styling", () => {
      const html = "<p>重点：这是重要内容</p>";
      const result = promoteCallouts(html, "polished");
      expect(result).toContain("<blockquote");
      expect(result).toContain("#456BB0");
      expect(result).toContain("重点：这是重要内容");
    });

    it("handles all callout keywords", () => {
      const keywords = ["重点", "核心", "关键", "注意", "提示", "总结", "亮点"];
      for (const kw of keywords) {
        const html = `<p>${kw}：测试内容</p>`;
        const result = promoteCallouts(html, "minimal");
        expect(result).toContain("<blockquote");
      }
    });

    it("does not promote paragraphs without callout prefix", () => {
      const html = "<p>普通段落不应被提升</p>";
      const result = promoteCallouts(html, "minimal");
      expect(result).toBe(html);
    });

    it("does not promote if keyword is in the middle", () => {
      const html = "<p>这个段落有重点但不在开头</p>";
      const result = promoteCallouts(html, "minimal");
      expect(result).toBe(html);
    });
  });

  describe("decorateHeadings", () => {
    it("transforms h2 into PART banner for polished theme", () => {
      const html = "<h2>第一节标题</h2>";
      const result = decorateHeadings(html, "polished");
      expect(result).toContain("PART");
      expect(result).toContain("01");
      expect(result).toContain("#456BB0");
      expect(result).toContain("第一节标题");
      expect(result).not.toContain("<h2>第一节标题</h2>");
    });

    it("transforms h2 into PART banner for vibrant theme", () => {
      const html = "<h2>标题</h2>";
      const result = decorateHeadings(html, "vibrant");
      expect(result).toContain("PART");
      expect(result).toContain("#DE7356");
    });

    it("does NOT transform h2 for minimal theme", () => {
      const html = "<h2>标题</h2>";
      const result = decorateHeadings(html, "minimal");
      expect(result).toBe(html);
    });

    it("numbers multiple h2 headings sequentially", () => {
      const html = "<h2>First</h2><p>body</p><h2>Second</h2><p>body</p><h2>Third</h2>";
      const result = decorateHeadings(html, "polished");
      expect(result).toContain("01");
      expect(result).toContain("02");
      expect(result).toContain("03");
    });

    it("uses table-cell layout for WeChat compatibility", () => {
      const html = "<h2>Test</h2>";
      const result = decorateHeadings(html, "polished");
      expect(result).toContain("display: table;");
      expect(result).toContain("display: table-cell;");
    });

    it("transforms h2 into JOTO numbered chapter plate without PART label", () => {
      const html = "<h2>产品概述：AI 接管对话</h2>";
      const result = decorateHeadings(html, "joto");
      expect(result).toContain("01");
      expect(result).toContain("#1268FF");
      expect(result).toContain("产品概述：AI 接管对话");
      expect(result).toContain("border-bottom: 1px solid #8A8A8A");
      expect(result).not.toContain("PART");
    });
  });

  describe("decorateSubtitles", () => {
    it("adds left border for polished theme", () => {
      const html = "<h3>子标题</h3>";
      const result = decorateSubtitles(html, "polished");
      expect(result).toContain("border-left: 3px solid #456BB0");
      expect(result).toContain("padding-left: 12px");
      expect(result).toContain("子标题");
    });

    it("adds colored dot for vibrant theme", () => {
      const html = "<h3>子标题</h3>";
      const result = decorateSubtitles(html, "vibrant");
      expect(result).toContain("border-radius: 50%");
      expect(result).toContain("background: #DE7356");
      expect(result).toContain("子标题");
    });

    it("does NOT transform h3 for minimal theme", () => {
      const html = "<h3>子标题</h3>";
      const result = decorateSubtitles(html, "minimal");
      expect(result).toBe(html);
    });

    it("handles multiple h3 elements", () => {
      const html = "<h3>First</h3><p>text</p><h3>Second</h3>";
      const result = decorateSubtitles(html, "polished");
      expect(result).toContain("First");
      expect(result).toContain("Second");
      expect(result.match(/border-left: 3px solid/g)?.length).toBe(2);
    });

    it("centers joto h3 subtitles between blue lines", () => {
      const html = "<h3>跨厂商资产秒级定位</h3>";
      const result = decorateSubtitles(html, "joto");
      expect(result).toContain("text-align: center");
      expect(result).toContain("#1268FF");
      expect(result).toContain("跨厂商资产秒级定位");
    });
  });

  describe("styleParagraphs", () => {
    it("adds inline styles to plain p tags for polished", () => {
      const html = "<p>普通段落内容</p>";
      const result = styleParagraphs(html, "polished");
      expect(result).toContain("line-height: 2");
      expect(result).toContain("letter-spacing: 0.5px");
      expect(result).toContain("color: #2c3e50");
    });

    it("does NOT style p tags for minimal theme", () => {
      const html = "<p>内容</p>";
      const result = styleParagraphs(html, "minimal");
      expect(result).toBe(html);
    });

    it("does NOT double-style p tags that already have inline styles", () => {
      const html = `<p style="margin: 0;">已有样式</p>`;
      const result = styleParagraphs(html, "polished");
      expect(result).toBe(html);
    });

    it("styles lead paragraph after h2 with accent border", () => {
      const html = "<h2>标题</h2><p>首段内容</p><p>后续段落</p>";
      const result = styleParagraphs(html, "polished");
      // Lead paragraph (first after h2) should have accent border
      expect(result).toContain("border-left: 3px solid");
      // Second paragraph should NOT have border
      const parts = result.split("</p>");
      const firstP = parts[0];
      const secondP = parts[1];
      expect(firstP).toContain("border-left");
      expect(secondP).not.toContain("border-left");
    });

    it("styles lead paragraph after decorated banner", () => {
      // Simulate a decorated banner + p
      const bannerHtml = decorateHeadings("<h2>Title</h2>", "polished");
      const html = bannerHtml + "<p>Lead text</p><p>Normal text</p>";
      const result = styleParagraphs(html, "polished");
      // First <p> after banner should be lead
      const pMatches = result.match(/<p style="[^"]*">/g) || [];
      expect(pMatches.length).toBe(2);
      expect(pMatches[0]).toContain("border-left");
      expect(pMatches[1]).not.toContain("border-left");
    });
  });

  describe("highlightNumbers", () => {
    it("highlights percentages in paragraph text", () => {
      const html = `<p style="color: #2c3e50;">效率提升了70%以上</p>`;
      const result = highlightNumbers(html, "polished");
      expect(result).toContain("font-weight: 700");
      expect(result).toContain("color: #456BB0");
      expect(result).toContain("70%");
    });

    it("highlights numbers with Chinese units", () => {
      const html = `<p style="color: #2c3e50;">节省120人日</p>`;
      const result = highlightNumbers(html, "polished");
      expect(result).toContain("font-weight: 700");
      expect(result).toContain("120人日");
    });

    it("highlights comma-separated numbers", () => {
      const html = `<p style="color: #2c3e50;">部署超1,400个任务</p>`;
      const result = highlightNumbers(html, "polished");
      expect(result).toContain("1,400个");
      expect(result).toContain("font-weight: 700");
    });

    it("highlights decimal numbers with units", () => {
      const html = `<p style="color: #2c3e50;">兼容率达98.2%</p>`;
      const result = highlightNumbers(html, "vibrant");
      expect(result).toContain("color: #DE7356");
      expect(result).toContain("98.2%");
    });

    it("does NOT highlight for minimal theme", () => {
      const html = `<p>节省120人日</p>`;
      const result = highlightNumbers(html, "minimal");
      expect(result).toBe(html);
    });

    it("does NOT highlight numbers inside HTML attributes", () => {
      const html = `<p style="margin: 16px 0;">Text with 50%</p>`;
      const result = highlightNumbers(html, "polished");
      // The "16" in style attribute should NOT be highlighted
      expect(result).toContain('style="margin: 16px 0;"');
      // But the "50%" in text should be highlighted
      expect(result).toContain("font-weight: 700");
    });
  });

  describe("styleColonPrefixes", () => {
    it("bolds and colors Chinese colon prefixes", () => {
      const html = `<p style="color: #2c3e50;">行前：整合机票酒店</p>`;
      const result = styleColonPrefixes(html, "polished");
      expect(result).toContain("font-weight: 700");
      expect(result).toContain("color: #456BB0");
      expect(result).toContain("行前：");
    });

    it("handles full-width colon", () => {
      const html = `<p style="color: #2c3e50;">机会：做一个旅程容器</p>`;
      const result = styleColonPrefixes(html, "vibrant");
      expect(result).toContain("color: #DE7356");
      expect(result).toContain("机会：");
    });

    it("handles comma-style prefix like 第一步，", () => {
      const html = `<p style="color: #2c3e50;">第一步，安装插件</p>`;
      const result = styleColonPrefixes(html, "polished");
      expect(result).toContain("font-weight: 700");
      expect(result).toContain("第一步，");
    });

    it("does not color ordinary sentence openings just because they have a comma", () => {
      const html = `<p style="color: #2c3e50;">业务卡了，赖网络。</p><p>网络工程师，可能最常背锅。</p>`;
      const result = styleColonPrefixes(html, "joto");
      expect(result).not.toContain("color: #1268FF");
      expect(result).toContain("业务卡了，赖网络。");
      expect(result).toContain("网络工程师，可能最常背锅。");
    });

    it("does NOT style for minimal theme", () => {
      const html = `<p>行前：整合信息</p>`;
      const result = styleColonPrefixes(html, "minimal");
      expect(result).toBe(html);
    });

    it("does NOT style very long prefixes (>8 chars)", () => {
      const html = `<p style="color: #2c3e50;">这是一个超级超级长的前缀词：后面的内容</p>`;
      const result = styleColonPrefixes(html, "polished");
      // Too long, should not match
      expect(result).not.toContain("font-weight: 700");
    });
  });

  describe("highlightStrong", () => {
    it("wraps strong text in highlight span for polished", () => {
      const html = "<p>This is <strong>important</strong> text</p>";
      const result = highlightStrong(html, "polished");
      expect(result).toContain("padding: 2px 8px");
      expect(result).toContain("border-radius: 4px");
      expect(result).toContain("font-weight: 700");
      expect(result).toContain("important");
      expect(result).not.toContain("<strong>");
    });

    it("uses vibrant highlight gradient background", () => {
      const html = "<p><strong>keyword</strong></p>";
      const result = highlightStrong(html, "vibrant");
      expect(result).toContain("linear-gradient");
      expect(result).toContain("#B54432");
    });

    it("does NOT transform strong for minimal theme", () => {
      const html = "<p><strong>bold</strong></p>";
      const result = highlightStrong(html, "minimal");
      expect(result).toBe(html);
    });

    it("turns strong text into JOTO blue emphasis", () => {
      const html = "<p><strong>AI 会说话，更会动手。</strong></p>";
      const result = highlightStrong(html, "joto");
      expect(result).toContain("color: #1268FF");
      expect(result).toContain("AI 会说话，更会动手。");
      expect(result).not.toContain("<strong>");
    });
  });

  describe("styleBlockquotes", () => {
    it("styles plain blockquotes for polished theme", () => {
      const html = "<blockquote>引用内容</blockquote>";
      const result = styleBlockquotes(html, "polished");
      expect(result).toContain("border-left: 4px solid #456BB0");
      expect(result).toContain("background-color: #f0f6fc");
    });

    it("does NOT style already-styled blockquotes", () => {
      const html = `<blockquote style="border-left: 4px solid red;">已有样式</blockquote>`;
      const result = styleBlockquotes(html, "polished");
      expect(result).toBe(html);
    });

    it("does NOT style blockquotes for minimal theme", () => {
      const html = "<blockquote>引用</blockquote>";
      const result = styleBlockquotes(html, "minimal");
      expect(result).toBe(html);
    });
  });

  describe("insertSectionDividers", () => {
    it("inserts hr before second h2 but not before first", () => {
      const html = "<h2>First</h2><p>body</p><h2>Second</h2>";
      const result = insertSectionDividers(html, "minimal");
      expect(result.indexOf("<hr")).toBeGreaterThan(result.indexOf("First"));
      expect(result).toContain("<hr");
    });

    it("uses gradient divider for polished/vibrant", () => {
      const html = "<h2>A</h2><p>x</p><h2>B</h2>";
      const result = insertSectionDividers(html, "polished");
      expect(result).toContain("linear-gradient");
    });

    it("does NOT insert hr inside decorated PART banner", () => {
      // Decorate headings first, then insert dividers — the inner <h2 style="..."> should be skipped
      let html = "<h2>First</h2><p>body</p><h2>Second</h2>";
      html = decorateHeadings(html, "polished");
      const result = insertSectionDividers(html, "polished");
      // Should have exactly 1 hr (before second section), not inside any banner
      const hrCount = (result.match(/<hr/g) || []).length;
      expect(hrCount).toBe(1);
      // The hr should be between banners (after </section> and before <section)
      expect(result).toMatch(/<\/section><p>body<\/p><hr[^>]*><section/);
    });
  });

  describe("decorateHtml (full pipeline)", () => {
    it("applies all transforms for polished theme", () => {
      const html = `<h2>Section One</h2><h3>Subtitle</h3><p>Hello <strong>world</strong></p><ul><li>Item</li></ul><p>重点：关键信息</p><h2>Section Two</h2><p>More content</p>`;
      const result = decorateHtml(html, { theme: "polished" });

      // Headings transformed
      expect(result).toContain("PART");
      expect(result).toContain("01");
      expect(result).toContain("02");

      // Subtitles styled
      expect(result).toContain("border-left: 3px solid #456BB0");

      // Strong highlighted
      expect(result).not.toContain("<strong>");

      // SVG list icon injected
      expect(result).toContain("joto-list-icon");

      // Callout promoted
      expect(result).toContain("<blockquote");

      // Paragraphs styled
      expect(result).toContain("line-height: 2");

      // Divider inserted
      expect(result).toContain("<hr");
    });

    it("applies minimal transforms for minimal theme", () => {
      const html = `<h2>Title</h2><p><strong>Bold</strong></p>`;
      const result = decorateHtml(html, { theme: "minimal" });

      expect(result).toContain("<h2>Title</h2>");
      expect(result).toContain("<strong>Bold</strong>");
    });

    it("respects individual option flags", () => {
      const html = `<h2>Title</h2><ul><li>Item</li></ul>`;
      const result = decorateHtml(html, {
        theme: "polished",
        headings: true,
        emojis: false,
      });

      expect(result).toContain("PART");
      expect(result).not.toContain("joto-list-icon");
    });

    it("handles flat h2+p article with number highlighting", () => {
      const html = `<h2>开篇</h2><p>效率提升70%,节省120人日。</p><p>第二段继续描述。</p><h2>方案</h2><p>兼容率98.2%。</p>`;
      const result = decorateHtml(html, { theme: "polished" });

      // PART banners
      expect(result).toContain("PART");
      expect(result).toContain("01");
      expect(result).toContain("02");

      // Numbers highlighted in accent color
      expect(result).toContain("70%");
      expect(result).toMatch(/color: #456BB0.*?font-weight: 700/);

      // Lead paragraph has accent border
      expect(result).toMatch(/border-left: 3px solid/);

      // Divider
      expect(result).toContain("<hr");
    });

    it("handles vibrant theme with all element types", () => {
      const html = `<h2>Title</h2><h3>Sub</h3><p><strong>Bold</strong></p><blockquote>Quote</blockquote>`;
      const result = decorateHtml(html, { theme: "vibrant" });

      expect(result).toContain("#DE7356");
      expect(result).toContain("border-radius: 50%");
      expect(result).toContain("linear-gradient");
      expect(result).toContain("background-color: #fef9f2");
      expect(result).toContain("line-height: 2");
    });

    it("applies full JOTO official-account article furniture without manual footer blocks", () => {
      const html = `<h2>产品概述：AI 接管对话</h2><h3>跨厂商资产秒级定位</h3><p>传统平台让团队在多个后台之间切换。</p><p><strong>AI 会说话，更会动手。</strong></p>`;
      const result = decorateHtml(html, { theme: "joto", imagePlaceholders: true });

      expect(result).toContain("01");
      expect(result).toContain("02");
      expect(result).toContain("#1268FF");
      expect(result).toContain("产品截图 / 视频封面占位");
      expect(result).not.toContain("往期回顾");
      expect(result).not.toContain("微信公众号");
      expect(result).not.toContain("JOTO AI");
      expect(result).not.toContain("PART");
    });

    it("promotes JOTO h3 sections to numbered chapters when only one h2 exists", () => {
      const html = `<h2>第一层能力</h2><p>开头</p><h3>第二层能力</h3><p>正文</p><h3>第三层能力</h3><p>正文</p>`;
      const result = decorateHtml(html, { theme: "joto" });

      expect(result).toContain("01");
      expect(result).toContain("02");
      expect(result).toContain("03");
      expect(result).toContain("第二层能力");
      expect(result).toContain("第三层能力");
    });

    it("does not inject SVG list icons into JOTO full pipeline", () => {
      const html = `<h2>清单</h2><ul><li>✅ 第一项</li><li>第二项</li></ul>`;
      const result = decorateHtml(html, { theme: "joto" });

      expect(result).toContain("第一项");
      expect(result).toContain("第二项");
      expect(result).toContain("list-style: none");
      expect(result).not.toContain("<svg");
      expect(result).not.toContain("joto-list-icon");
      expect(result).not.toContain("✅");
    });
  });

  describe("insertImagePlaceholders", () => {
    it("inserts placeholder after first paragraph following an h2", () => {
      const html = "<h2>Section</h2><p>First paragraph.</p><p>Second paragraph.</p>";
      const result = insertImagePlaceholders(html, "polished");
      expect(result).toContain("配图占位");
      // Placeholder should appear after the first </p>, before the second <p>
      const placeholderIdx = result.indexOf("配图占位");
      const firstPEnd = result.indexOf("</p>");
      const secondPStart = result.indexOf("<p>Second");
      expect(placeholderIdx).toBeGreaterThan(firstPEnd);
      expect(placeholderIdx).toBeLessThan(secondPStart);
    });

    it("inserts one placeholder per h2 section", () => {
      const html = "<h2>Section 1</h2><p>Body 1</p><h2>Section 2</h2><p>Body 2</p>";
      const result = insertImagePlaceholders(html, "polished");
      const matches = result.match(/配图占位/g);
      expect(matches).toHaveLength(2);
    });

    it("inserts placeholder after list following h2", () => {
      const html = "<h2>Section</h2><ul><li>Item 1</li><li>Item 2</li></ul><p>Next</p>";
      const result = insertImagePlaceholders(html, "polished");
      const placeholderIdx = result.indexOf("配图占位");
      const ulEnd = result.indexOf("</ul>");
      expect(placeholderIdx).toBeGreaterThan(ulEnd);
    });

    it("inserts placeholder after blockquote following h2", () => {
      const html = "<h2>Section</h2><blockquote>Quote text</blockquote><p>After</p>";
      const result = insertImagePlaceholders(html, "minimal");
      expect(result).toContain("配图占位");
      const placeholderIdx = result.indexOf("配图占位");
      const bqEnd = result.indexOf("</blockquote>");
      expect(placeholderIdx).toBeGreaterThan(bqEnd);
    });

    it("uses themed styling for polished theme", () => {
      const html = "<h2>Title</h2><p>Content</p>";
      const result = insertImagePlaceholders(html, "polished");
      expect(result).toContain("#eaf2f8"); // accentLight
      expect(result).toContain("linear-gradient");
    });

    it("uses simple dashed style for minimal theme", () => {
      const html = "<h2>Title</h2><p>Content</p>";
      const result = insertImagePlaceholders(html, "minimal");
      expect(result).toContain("border: 2px dashed #ddd");
      expect(result).toContain("#fafafa");
      expect(result).not.toContain("linear-gradient");
    });

    it("works with decorated PART banners", () => {
      const banner = `<section style="margin: 36px 0 18px; padding: 0; box-sizing: border-box;">
<section style="margin: 0; display: table; width: 100%;">
<section style="margin: 0; display: table-cell;">
<span>PART</span><span>01</span>
</section>
<section style="margin: 0; display: table-cell;">
<h2 style="margin: 0;">Title</h2>
</section>
</section>
</section>`;
      const html = `${banner}<p>First paragraph after banner.</p><p>Second.</p>`;
      const result = insertImagePlaceholders(html, "vibrant");
      expect(result).toContain("配图占位");
      expect(result).toContain("#fef5ec"); // vibrant accentLight
    });

    it("returns unchanged html when no h2 or banners present", () => {
      const html = "<p>Just a paragraph.</p><p>Another one.</p>";
      const result = insertImagePlaceholders(html, "polished");
      expect(result).toBe(html);
    });

    it("is opt-in via decorateHtml (default false)", () => {
      const html = "<h2>Title</h2><p>Content</p>";
      const withoutPlaceholders = decorateHtml(html, { theme: "polished" });
      expect(withoutPlaceholders).not.toContain("配图占位");

      const withPlaceholders = decorateHtml(html, { theme: "polished", imagePlaceholders: true });
      expect(withPlaceholders).toContain("配图占位");
    });
  });
});
