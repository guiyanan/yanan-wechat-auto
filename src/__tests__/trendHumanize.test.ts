import { describe, expect, it } from "vitest";
import {
  buildTrendHumanizeRequest,
  getTrendHumanizeIntent,
  getTrendHumanizeStyleProfile,
} from "@/lib/trendHumanize";

describe("trend humanize contract", () => {
  it("treats humanize as light copy editing instead of content strategy", () => {
    const intent = getTrendHumanizeIntent();
    const styleProfile = getTrendHumanizeStyleProfile("西瓜体");
    const combined = `${intent}\n${styleProfile}`;

    expect(combined).toContain("只做轻润色");
    expect(combined).toContain("保留产品名");
    expect(combined).toContain("保留 ##、###、引用块和列表");
    expect(combined).toContain("产品团队写给用户的完整公众号观察文");
    expect(combined).not.toContain("前 80%");
    expect(combined).not.toContain("产品只在结尾");
    expect(combined).not.toContain("只用自然段落分行");
    expect(combined).not.toContain("不写小标题");
    expect(combined).not.toContain("第三方测评");
  });

  it("builds pipeline requests that preserve hotspot article structure", () => {
    const request = buildTrendHumanizeRequest({
      markdown: "## 我们的回应\n\nFasium 可以把款式方案往交付文件上落。",
      styleName: "热点风格：西瓜体",
    });

    expect(request.articleType).toBe("时事热点");
    expect(request.preserveStructure).toBe(true);
    expect(request.text).toContain("Fasium");
    expect(request.intent).toContain("不得删除产品名");
    expect(request.styleProfile).toContain("风格只能影响表达方式");
  });
});
