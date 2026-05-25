import { describe, it, expect } from "vitest";
import { exportWechatHtml } from "@/lib/wechatHtml";
import { buildAigcMetadata } from "@/lib/aigcMeta";

describe("wechatHtml · exportWechatHtml", () => {
  it("inlines styles (juice removes external <style>)", () => {
    const html = exportWechatHtml({
      title: "测试标题",
      bodyHtml: "<p>hello</p>",
      meta: buildAigcMetadata({ articleId: "t1" }),
    });
    expect(html).not.toContain("<style>");
    expect(html).toMatch(/<p[^>]*style="[^"]*font-size/);
  });

  it("embeds AIGC meta tag in head", () => {
    const html = exportWechatHtml({
      title: "x",
      bodyHtml: "<p>y</p>",
    });
    expect(html).toContain('name="AIGC"');
  });

  it("appends explicit notice when opted in", () => {
    const html = exportWechatHtml({
      title: "x",
      bodyHtml: "<p>y</p>",
      addExplicitNotice: true,
    });
    expect(html).toContain("本文由 AI 辅助创作");
  });

  it("omits explicit notice by default", () => {
    const html = exportWechatHtml({
      title: "x",
      bodyHtml: "<p>y</p>",
    });
    expect(html).not.toContain("本文由 AI 辅助创作");
  });

  it("escapes title HTML entities", () => {
    const html = exportWechatHtml({
      title: "<script>x</script>",
      bodyHtml: "<p>y</p>",
    });
    expect(html).not.toContain("<script>x</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("embeds cover image when coverUrl provided", () => {
    const html = exportWechatHtml({
      title: "x",
      bodyHtml: "<p>y</p>",
      coverUrl: "https://cdn.example.com/cover.jpg",
    });
    expect(html).toMatch(/<img[^>]*class="joto-cover"[^>]*/);
    expect(html).toContain("https://cdn.example.com/cover.jpg");
  });

  it("escapes cover URL to prevent attribute injection", () => {
    const html = exportWechatHtml({
      title: "x",
      bodyHtml: "<p>y</p>",
      coverUrl: 'https://x.com/"onerror=alert(1)',
    });
    expect(html).not.toContain('"onerror=alert(1)');
    expect(html).toContain("&quot;onerror=alert(1)");
  });

  it("renders author + publishedAt in byline", () => {
    const html = exportWechatHtml({
      title: "x",
      bodyHtml: "<p>y</p>",
      author: "Tommy",
      publishedAt: "2026-04-18T10:00:00.000Z",
    });
    expect(html).toContain("Tommy");
    expect(html).toContain("2026-04-18");
    expect(html).toMatch(/joto-byline/);
  });

  it("byline omitted when neither author nor date provided", () => {
    const html = exportWechatHtml({
      title: "x",
      bodyHtml: "<p>y</p>",
    });
    expect(html).not.toMatch(/joto-byline/);
  });

  it("adds JOTO official-account follow and contact furniture for decorated JOTO exports", () => {
    const html = exportWechatHtml({
      title: "x",
      bodyHtml: "<p>正文</p>",
      theme: "joto",
      decorate: true,
    });

    expect(html).toContain("点击蓝字 关注我们");
    expect(html).toContain("fy");
    expect(html).toContain("JOTO");
    expect(html).toContain("企业微信");
    expect(html).toContain("JOTO AI");
    expect(html).toContain("官方网站");
    expect(html).toContain("jotoai.com");
    expect(html).toContain("jotoai@jototech.cn");
    expect(html).toContain("长按识别二维码 联系我们");
    expect(html).toContain("/joto-enterprise-wechat-qr.jpg");
    expect(html).toContain("<svg");
    expect(html).toContain("<animate");
    expect(html).not.toContain("往期回顾");
    expect(html).not.toContain("✅");
    expect(html).not.toContain("⭐");
  });

  it("does not add JOTO furniture for non-decorated or non-JOTO exports", () => {
    const jotoPlain = exportWechatHtml({
      title: "x",
      bodyHtml: "<p>正文</p>",
      theme: "joto",
      decorate: false,
    });
    const minimalDecorated = exportWechatHtml({
      title: "x",
      bodyHtml: "<p>正文</p>",
      theme: "minimal",
      decorate: true,
    });

    expect(jotoPlain).not.toContain("点击蓝字 关注我们");
    expect(jotoPlain).not.toContain("企业微信");
    expect(minimalDecorated).not.toContain("点击蓝字 关注我们");
    expect(minimalDecorated).not.toContain("企业微信");
  });

  it("uses captured JOTO furniture when provided", () => {
    const html = exportWechatHtml({
      title: "x",
      bodyHtml: "<p>正文</p>",
      theme: "joto",
      decorate: true,
      jotoFollowHeaderHtml: '<section data-captured="header">自定义头部</section>',
      jotoContactFooterHtml: '<section data-captured="footer">自定义尾部</section>',
    });

    expect(html).toContain("自定义头部");
    expect(html).toContain("自定义尾部");
    expect(html).not.toContain("点击蓝字 关注我们");
    expect(html).not.toContain("joto-enterprise-wechat-qr.jpg");
  });
});
