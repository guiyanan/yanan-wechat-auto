import { describe, expect, it } from "vitest";
import {
  HOTSPOT_ARTICLE_CONTRACT,
  buildHotspotContractPrompt,
} from "@/lib/trendArticleContract";

describe("hotspot article contract", () => {
  it("defines the non-overridable product-team article identity", () => {
    expect(HOTSPOT_ARTICLE_CONTRACT.identity).toContain("产品团队");
    expect(HOTSPOT_ARTICLE_CONTRACT.identity).toContain("完整公众号观察文");
    expect(HOTSPOT_ARTICLE_CONTRACT.identity).not.toContain("第三方");
    expect(HOTSPOT_ARTICLE_CONTRACT.identity).not.toContain("短评");
  });

  it("keeps style below the article contract", () => {
    expect(HOTSPOT_ARTICLE_CONTRACT.styleAuthority).toContain("只能影响表达方式");
    expect(HOTSPOT_ARTICLE_CONTRACT.styleAuthority).toContain("不能改变文章身份");
    expect(HOTSPOT_ARTICLE_CONTRACT.styleAuthority).toContain("不能改变任务骨架");
    expect(HOTSPOT_ARTICLE_CONTRACT.styleAuthority).toContain("不能改变产品回应策略");
  });

  it("builds a prompt that preserves structure and product response boundaries", () => {
    const prompt = buildHotspotContractPrompt();

    expect(prompt).toContain("热点现象");
    expect(prompt).toContain("用户困惑");
    expect(prompt).toContain("真实工作问题");
    expect(prompt).toContain("产品团队视角");
    expect(prompt).toContain("我们的回应");
    expect(prompt).toContain("收束判断");
    expect(prompt).toContain("1200-1600");
    expect(prompt).toContain("不得写成功能清单");
    expect(prompt).toContain("不得装成第三方测评");
  });
});
