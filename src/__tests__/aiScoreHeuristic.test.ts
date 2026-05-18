import { describe, expect, it } from "vitest";
import { scoreText, type HeuristicBreakdown } from "@/lib/aiScoreHeuristic";

// Synthetic samples designed to exercise specific dimensions cleanly.
// These are not real articles — they're calibration probes.

const AI_LIKE_SAMPLE = `
在当今数字化时代,赋能企业转型已成为毋庸置疑的关键抓手。首先,我们必须明确,提效与降本是核心闭环。其次,综上所述,生态建设无疑是必由之路。再次,链路打通是基础。

随着技术不断演进,落地实践显得尤为重要。因此,引领行业是我们的使命。此外,驱动创新是永恒主题。综上,助力客户成功是终极目标。

不仅如此,与此同时,数据闭环也在不断完善。归根结底,这是一个系统性工程。总而言之,长期主义是唯一答案。
`.trim();

const HUMAN_LIKE_SAMPLE = `
说真的,这玩意儿我用了三周才适应。第一天打开它就懵了 —— 界面太密,按钮跟弹窗叠了三层。我们团队 5 个人,周二下午挤在会议室,试到 6 点才把流程跑通。

后来发现,核心其实就两步:点"新建"、把 47 个客户名单粘进去。剩下的让它自己跑。

凌晨 3 点钟的时候我看了下后台 —— 12 万条数据已经处理完。这种感觉,挺久没体验过了。
`.trim();

const SUMMIT_LIKE_SAMPLE = `
2026 年 4 月 28 日下午,第三届智能办公峰会在上海中心 28 楼会议厅举行,共 240 位嘉宾出席。会议为期一天,围绕 RPA、Agent、流程自动化三大主题展开。

阿里云首席架构师陈思在主旨演讲中表示,AI Agent 将在未来 18 个月内重塑企业内部流程。她引用了一组数据:目前已有 67% 的 500 强企业开始评估 Agent 方案。

下午圆桌环节,3 位嘉宾围绕"自动化的边界"展开讨论。会场后排有人小声讨论:"这个比去年的更聚焦了。"
`.trim();

describe("aiScoreHeuristic · scoreText", () => {
  it("returns 0 score for empty text", () => {
    const r = scoreText("");
    expect(r.score).toBe(0);
    expect(r.charCount).toBe(0);
  });

  it("returns 0 score for very short text (< 20 chars)", () => {
    const r = scoreText("我用了它。还行。");
    expect(r.score).toBe(0);
  });

  it("AI-cliché-heavy sample scores high (>= 55)", () => {
    const r = scoreText(AI_LIKE_SAMPLE);
    expect(r.score).toBeGreaterThanOrEqual(55);
    expect(r.dimensions.cliche).toBeGreaterThan(0.5);
    expect(r.dimensions.transitionWords).toBeGreaterThan(0.5);
  });

  it("first-person concrete human sample scores low (<= 35)", () => {
    const r = scoreText(HUMAN_LIKE_SAMPLE);
    expect(r.score).toBeLessThanOrEqual(35);
    // First-person dimension should be near 0 (i.e. very human)
    expect(r.dimensions.firstPerson).toBeLessThan(0.5);
    // Concrete dimension should also be near 0 (lots of numbers)
    expect(r.dimensions.concreteness).toBeLessThan(0.5);
  });

  it("summit/news report sample scores in middle range (third-person + facts)", () => {
    const r = scoreText(SUMMIT_LIKE_SAMPLE);
    // Third-person factual reporting: low cliche, decent concreteness,
    // but no first-person. Should land in safe-to-caution range.
    expect(r.score).toBeGreaterThan(15);
    expect(r.score).toBeLessThan(60);
  });

  it("score is deterministic for identical input", () => {
    const a = scoreText(AI_LIKE_SAMPLE);
    const b = scoreText(AI_LIKE_SAMPLE);
    expect(a.score).toBe(b.score);
    expect(a.dimensions).toEqual(b.dimensions);
  });

  it("dimensions are all in [0, 1]", () => {
    const samples = [AI_LIKE_SAMPLE, HUMAN_LIKE_SAMPLE, SUMMIT_LIKE_SAMPLE];
    for (const s of samples) {
      const r = scoreText(s);
      for (const v of Object.values(r.dimensions)) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  it("AI sample scores strictly higher than human sample", () => {
    const ai = scoreText(AI_LIKE_SAMPLE);
    const human = scoreText(HUMAN_LIKE_SAMPLE);
    expect(ai.score).toBeGreaterThan(human.score);
  });

  it("score is in [0, 100]", () => {
    const samples = [AI_LIKE_SAMPLE, HUMAN_LIKE_SAMPLE, SUMMIT_LIKE_SAMPLE];
    for (const s of samples) {
      const r = scoreText(s);
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(100);
    }
  });

  it("breakdown weights sum to ~1.0", () => {
    const r: HeuristicBreakdown = scoreText(HUMAN_LIKE_SAMPLE);
    const total = Object.values(r.weights).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1.0, 5);
  });

  it("adding cliché phrases raises the score (single-dimension shift)", () => {
    const baseline = "我们团队周三晚上把流程跑了一遍,发现 23 个 bug。";
    const polluted =
      baseline +
      "在当今数字化时代,赋能闭环是抓手。综上所述,毋庸置疑这是必由之路。" +
      "首先,其次,再次,然后,最后,综上,因此,所以。";
    const a = scoreText(baseline);
    const b = scoreText(polluted);
    expect(b.score).toBeGreaterThan(a.score);
    expect(b.dimensions.cliche).toBeGreaterThan(a.dimensions.cliche);
  });
});
