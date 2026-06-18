import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/products/parse-website/route";

function req(body: unknown): Request {
  return new Request("http://test/api/products/parse-website", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/products/parse-website", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("extracts title, description, and readable text into notes", async () => {
    const productCopy =
      "Fasium AI 是面向服装设计团队的 AI 设计平台，核心功能包括趋势观察、灵感筛选、花型生成、版型预览和 Tech Pack 输出。产品适用于设计主管、品牌设计团队和供应链协作角色，帮助他们减少人工找图、反复沟通和打样等待。";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        text: async () =>
          `<html><head><title>Fasium AI</title><meta name="description" content="AI 产品官网"></head><body><main><h1>Fasium AI</h1><p>${productCopy}</p></main></body></html>`,
      }))
    );

    const res = await POST(req({ url: "https://fasium.jotoai.com/" }) as never);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({
      ok: true,
      title: "Fasium AI",
      description: "AI 产品官网",
    });
    expect(json.quality).toBe("rich");
    expect(json.notes).toContain("页面解析质量");
    expect(json.notes).toContain("页面核心线索");
    expect(json.notes).toContain("面向服装设计团队的 AI 设计平台");
  });

  it("keeps enough landing page text for product understanding", async () => {
    const latePageSection =
      "后半段关键模块: 智能趋势洞察、灵感筛选、花型生成、Tech Pack 输出、虚拟试穿。";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        text: async () =>
          `<html><head><title>Fasium AI</title></head><body><main><p>${"前半段通用介绍。".repeat(
            1000
          )}</p><p>${latePageSection}</p></main></body></html>`,
      }))
    );

    const res = await POST(req({ url: "https://fasium.jotoai.com/" }) as never);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.notes).toContain(latePageSection);
  });

  it("returns an error when website fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network blocked");
      })
    );

    const res = await POST(req({ url: "https://fasium.jotoai.com/" }) as never);
    expect(res.status).toBe(502);
    const json = await res.json();
    expect(json).toMatchObject({ ok: false });
    expect(json.notes).toContain("请手动补充官网定位");
  });

  it("rejects pages without readable website text", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        text: async () => `<html><head></head><body><script>window.app={}</script></body></html>`,
      }))
    );

    const res = await POST(req({ url: "https://empty.example.com/" }) as never);
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json).toMatchObject({ ok: false });
    expect(json.notes).toContain("未解析出稳定文本");
  });

  it("does not treat navigation-only pages as successfully parsed product material", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        text: async () =>
          `<html><head><title>Fasium AI</title><meta name="description" content="AI fashion platform"></head><body><nav>首页 产品 定价 博客 登录 注册 联系我们 EN 中文</nav></body></html>`,
      }))
    );

    const res = await POST(req({ url: "https://fasium.jotoai.com/" }) as never);
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json).toMatchObject({ ok: false, quality: "shallow" });
    expect(json.notes).toContain("只解析到少量官网正文");
  });

  it("uses rich metadata from SPA landing pages when body text is only a JS shell", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        text: async () => `
          <html>
            <head>
              <title>Pharaoh Command - AI 驱动的 NetOps 网络运维平台 | JOTO.AI</title>
              <meta name="description" content="Pharaoh Command 是 JOTO.AI 旗下 AI 驱动的 NetOps 平台,通过自然语言对话完成网络设备配置、故障诊断、拓扑分析与运维自动化。面向企业 IT、网络工程师与 SRE 团队。">
              <meta name="keywords" content="AI网络运维,NetOps平台,网络自动化,AI运维,网络故障诊断,自然语言运维,IT运维工具,网络管理平台,Pharaoh Command,JOTO.AI">
              <script type="application/ld+json">
                {
                  "@context": "https://schema.org",
                  "@type": "SoftwareApplication",
                  "name": "Pharaoh Command",
                  "applicationCategory": "BusinessApplication",
                  "operatingSystem": "Web",
                  "description": "AI 驱动的 NetOps 网络运维平台,通过自然语言完成配置、诊断、拓扑分析与运维自动化。"
                }
              </script>
            </head>
            <body><div id="root"></div></body>
          </html>`,
      }))
    );

    const res = await POST(req({ url: "https://command.jotoai.com/" }) as never);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({
      ok: true,
      quality: "metadata",
      title: "Pharaoh Command - AI 驱动的 NetOps 网络运维平台 | JOTO.AI",
    });
    expect(json.notes).toContain("页面解析质量：正文少,但解析到较完整 metadata");
    expect(json.notes).toContain("自然语言对话完成网络设备配置");
    expect(json.notes).toContain("AI 驱动的 NetOps 网络运维平台");
  });
});
