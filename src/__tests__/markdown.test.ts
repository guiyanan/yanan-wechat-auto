import { describe, it, expect } from "vitest";
import {
  markdownToHtml,
  htmlToMarkdown,
  parseMarkdownBlocks,
  joinMarkdownBlocks,
} from "@/lib/markdown";

describe("markdownToHtml · headings", () => {
  it("converts ## to <h2>", () => {
    expect(markdownToHtml("## 钩子")).toContain("<h2>钩子</h2>");
  });
  it("converts ### to <h3>", () => {
    expect(markdownToHtml("### 子段")).toContain("<h3>子段</h3>");
  });
  it("converts # to <h1>", () => {
    expect(markdownToHtml("# 主标题")).toContain("<h1>主标题</h1>");
  });
});

describe("markdownToHtml · paragraphs", () => {
  it("wraps a single line in <p>", () => {
    expect(markdownToHtml("这是一段正文。")).toBe("<p>这是一段正文。</p>");
  });
  it("splits blocks on blank lines", () => {
    const html = markdownToHtml("第一段。\n\n第二段。");
    expect(html).toContain("<p>第一段。</p>");
    expect(html).toContain("<p>第二段。</p>");
  });
  it("preserves trailing-2-space hard line breaks as <br>", () => {
    const html = markdownToHtml("第一行  \n第二行");
    expect(html).toContain("第一行<br>第二行");
  });
});

describe("markdownToHtml · inline emphasis", () => {
  it("converts **bold** to <strong>", () => {
    expect(markdownToHtml("**加粗**字")).toContain("<strong>加粗</strong>");
  });
  it("handles multiple bold spans in one paragraph", () => {
    const out = markdownToHtml("**A** 和 **B** 都加粗");
    expect(out).toContain("<strong>A</strong>");
    expect(out).toContain("<strong>B</strong>");
  });
  it("does NOT cross paragraph boundaries", () => {
    // Unclosed ** in one block stays literal (no greedy match swallowing next block)
    const out = markdownToHtml("第一段 **没闭合\n\n第二段");
    expect(out).not.toContain("<strong>没闭合\n\n第二段</strong>");
  });
  it("strips dangling double-star markers so raw markdown does not leak", () => {
    const out = markdownToHtml("**3分钟，从灵感到可交付文件。\n\n不用再输一遍 15cm”。 **");
    expect(out).not.toContain("**");
    expect(out).toContain("3分钟");
    expect(out).toContain("15cm");
  });
});

describe("markdownToHtml · unordered lists", () => {
  it("converts consecutive - lines to <ul><li>", () => {
    const out = markdownToHtml("- 一\n- 二\n- 三");
    expect(out).toContain("<ul>");
    expect(out).toContain("<li>一</li>");
    expect(out).toContain("<li>二</li>");
    expect(out).toContain("<li>三</li>");
    expect(out).toContain("</ul>");
  });
  it("supports inline bold inside <li>", () => {
    const out = markdownToHtml("- 项 **加粗** 内容");
    expect(out).toContain("<li>项 <strong>加粗</strong> 内容</li>");
  });
});

describe("markdownToHtml · ordered lists", () => {
  it("converts consecutive 1. 2. 3. to <ol><li>", () => {
    const out = markdownToHtml("1. 一\n2. 二\n3. 三");
    expect(out).toContain("<ol>");
    expect(out).toContain("<li>一</li>");
    expect(out).toContain("<li>二</li>");
    expect(out).toContain("</ol>");
  });
});

describe("markdownToHtml · blockquote", () => {
  it("converts > lines to <blockquote>", () => {
    const out = markdownToHtml("> 一段引用");
    expect(out).toContain("<blockquote>");
    expect(out).toContain("一段引用");
    expect(out).toContain("</blockquote>");
  });
  it("merges consecutive > lines into one blockquote", () => {
    const out = markdownToHtml("> 第一行\n> 第二行");
    expect((out.match(/<blockquote>/g) ?? []).length).toBe(1);
  });
});

describe("markdownToHtml · horizontal rule", () => {
  it("converts --- to <hr>", () => {
    expect(markdownToHtml("---")).toContain("<hr");
  });
});

describe("markdownToHtml · escaping", () => {
  it("escapes < > & inside paragraph text", () => {
    const out = markdownToHtml("a < b & c > d");
    expect(out).toContain("&lt;");
    expect(out).toContain("&gt;");
    expect(out).toContain("&amp;");
  });
  it("escapes inside headings", () => {
    expect(markdownToHtml("## a > b")).toContain("a &gt; b");
  });
});

describe("markdownToHtml · realistic full body", () => {
  it("processes a typical Qwen body with headings + bold + list", () => {
    const md = [
      "## 钩子",
      "",
      "**平均权限审批周期从 5.6 天压缩至 1.8 天**，节省运维工单量 44%。",
      "",
      "### 业务收益",
      "",
      "- 京东物流权限变更耗时从 42 分钟压至 90 秒",
      "- 比亚迪 MES 上线 3 周，运维工单量下降 44%",
      "- 淘宝商家后台 API 网关延迟 < 1.7 秒",
      "",
      "## 如何使用",
      "",
      "1. 部署 Vault 控制平面",
      "2. 接入华为云 IAM / 钉钉 / 飞书",
      "3. 启用 RBAC + ABAC 混合策略",
      "",
      "> 30 分钟 POC 验证覆盖三大核心场景。",
    ].join("\n");
    const out = markdownToHtml(md);
    expect(out).toContain("<h2>钩子</h2>");
    expect(out).toContain("<h3>业务收益</h3>");
    expect(out).toContain("<strong>平均权限审批周期");
    expect(out).toContain("<ul>");
    expect(out).toContain("<li>京东物流权限变更耗时");
    expect(out).toContain("<ol>");
    expect(out).toContain("<li>部署 Vault 控制平面</li>");
    expect(out).toContain("<blockquote>");
    expect(out).toContain("30 分钟 POC 验证");
    // No leftover raw markdown markers
    expect(out).not.toMatch(/\*\*[^*]+\*\*/);
    expect(out).not.toMatch(/^- /m);
  });
});

// ─── htmlToMarkdown (reverse direction) ─────────────────────────────

describe("htmlToMarkdown · headings", () => {
  it("converts <h2> back to ##", () => {
    expect(htmlToMarkdown("<h2>钩子</h2>")).toContain("## 钩子");
  });
  it("converts <h3> back to ###", () => {
    expect(htmlToMarkdown("<h3>子段</h3>")).toContain("### 子段");
  });
});

describe("htmlToMarkdown · inline", () => {
  it("converts <strong> back to **bold**", () => {
    expect(htmlToMarkdown("<p>这是 <strong>加粗</strong> 字</p>")).toContain(
      "**加粗**"
    );
  });
  it("converts <b> back to **bold**", () => {
    expect(htmlToMarkdown("<p>这是 <b>加粗</b> 字</p>")).toContain("**加粗**");
  });
});

describe("htmlToMarkdown · lists", () => {
  it("converts <ul><li> back to - lines", () => {
    const md = htmlToMarkdown("<ul><li>一</li><li>二</li></ul>");
    expect(md).toMatch(/- 一/);
    expect(md).toMatch(/- 二/);
  });
  it("converts <ol><li> back to numbered lines", () => {
    const md = htmlToMarkdown("<ol><li>一</li><li>二</li></ol>");
    expect(md).toMatch(/1\. 一/);
    expect(md).toMatch(/2\. 二/);
  });
});

describe("htmlToMarkdown · blockquote", () => {
  it("converts <blockquote> back to >", () => {
    expect(
      htmlToMarkdown("<blockquote><p>一段引用</p></blockquote>")
    ).toMatch(/> 一段引用/);
  });
});

describe("markdownToHtml · real Qwen humanize output (regression)", () => {
  it("promotes inline ## and ### embedded in a multi-paragraph block", () => {
    // Real-world fragment captured from a humanize pipeline output —
    // section 2's body ended up containing what should have been section
    // 3's heading plus a subsection heading, all on one line.
    const md = [
      "这是上一段。",
      "",
      "淘宝千牛、拼多多商家后台、微信服务商平台……这些页面互相不认对方的 cookie。某医疗器械经销商用它同步 6 个平台库存，凌晨 2 点自动抓取、推送至企业微信。 ## 为什么选 Loop RPA：范式迁移 ### 传统 RPA 为啥总卡在落地？三个免先拆雷",
      "",
      "后续段落。",
    ].join("\n");
    const out = markdownToHtml(md);
    expect(out).toContain("<h2>为什么选 Loop RPA：范式迁移</h2>");
    expect(out).toContain("<h3>传统 RPA 为啥总卡在落地？三个免先拆雷</h3>");
    // The text before ## must NOT contain the heading markup as plain text
    expect(out).not.toMatch(/<p>[^<]*##\s/);
    expect(out).not.toMatch(/<p>[^<]*###\s/);
  });
});

describe("markdownToHtml · inline-heading promotion (Qwen quirk)", () => {
  // Qwen sometimes emits headings glued to the end of the previous paragraph
  // with just a space, e.g. "前一段。 ## 下一标题"  — without normalisation
  // those headings would render as plain text inside the previous <p>.
  it("promotes mid-string ## heading to block-level", () => {
    const out = markdownToHtml("前面一段内容。 ## 如何使用");
    expect(out).toContain("<h2>如何使用</h2>");
    expect(out).not.toContain("## 如何使用");
  });
  it("promotes mid-string ### heading to block-level", () => {
    const out = markdownToHtml("一句话。 ### 子标题");
    expect(out).toContain("<h3>子标题</h3>");
  });
  it("does NOT touch # appearing inside a word (e.g. C#)", () => {
    const out = markdownToHtml("我们用 C# 写代码");
    expect(out).toContain("C# 写代码");
    expect(out).not.toContain("<h1");
  });
});

describe("parseMarkdownBlocks", () => {
  it("returns a heading block for ## lines", () => {
    const blocks = parseMarkdownBlocks("## 钩子\n\n## 如何使用");
    expect(blocks).toHaveLength(2);
    expect(blocks[0].type).toBe("heading");
    expect(blocks[1].type).toBe("heading");
  });
  it("returns a paragraph block for plain text", () => {
    const blocks = parseMarkdownBlocks("第一段正文。\n\n第二段正文。");
    expect(blocks.map((b) => b.type)).toEqual(["paragraph", "paragraph"]);
  });
  it("recognises list, blockquote, hr, heading vs paragraph", () => {
    const md = [
      "## 标题",
      "",
      "段落内容。",
      "",
      "- 列表 1",
      "- 列表 2",
      "",
      "> 引用",
      "",
      "---",
      "",
      "1. 编号一",
      "2. 编号二",
    ].join("\n");
    const types = parseMarkdownBlocks(md).map((b) => b.type);
    expect(types).toEqual([
      "heading",
      "paragraph",
      "list",
      "blockquote",
      "hr",
      "list",
    ]);
  });
  it("skips empty blocks", () => {
    const blocks = parseMarkdownBlocks("a\n\n\n\nb");
    expect(blocks).toHaveLength(2);
    expect(blocks.every((b) => b.type === "paragraph")).toBe(true);
  });
  it("promotes inline ## to its own heading block (Qwen quirk)", () => {
    const blocks = parseMarkdownBlocks("段落 ## 强行接的标题");
    expect(blocks).toHaveLength(2);
    expect(blocks[0].type).toBe("paragraph");
    expect(blocks[1].type).toBe("heading");
  });
  it("preserves raw markdown content per block (lossless)", () => {
    const blocks = parseMarkdownBlocks("## 标题");
    expect(blocks[0].raw).toBe("## 标题");
  });
});

describe("joinMarkdownBlocks", () => {
  it("is the inverse of parseMarkdownBlocks for valid input", () => {
    const md = "## 钩子\n\n第一段。\n\n- 列表 1\n- 列表 2";
    const round = joinMarkdownBlocks(parseMarkdownBlocks(md));
    expect(round).toContain("## 钩子");
    expect(round).toContain("第一段。");
    expect(round).toContain("- 列表 1");
  });
  it("separates blocks with blank lines", () => {
    const joined = joinMarkdownBlocks([
      { type: "heading", raw: "## A" },
      { type: "paragraph", raw: "正文" },
    ]);
    expect(joined).toBe("## A\n\n正文");
  });
});

describe("markdownToHtml ↔ htmlToMarkdown round-trip", () => {
  it("preserves structure for h2 + bold + list + blockquote", () => {
    const original = [
      "## 钩子",
      "",
      "**加粗内容** 普通文字。",
      "",
      "- 列表一",
      "- 列表二",
      "",
      "> 引用一行",
    ].join("\n");
    const html = markdownToHtml(original);
    const md = htmlToMarkdown(html);
    expect(md).toContain("## 钩子");
    expect(md).toContain("**加粗内容**");
    expect(md).toContain("- 列表一");
    expect(md).toContain("- 列表二");
    expect(md).toContain("> 引用一行");
  });
});
