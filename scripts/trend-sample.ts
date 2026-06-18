/**
 * 热点线单篇对照生成 — prompt 打磨的回归工具。
 *
 * 用法:
 *   npx tsx scripts/trend-sample.ts --product prod-local-mpc36ezi \
 *     --topic "AI 服装设计工具走红" --tag baseline
 *
 * 流程:博查搜话题 → buildTrendPrompt(outline→body) → 标题 →
 *       输出 output/trend/<时间戳>-<tag>.md
 *
 * 改 prompt 前用 --tag baseline 存底,改完同题 --tag after,人工对读。
 * 依赖 .env.local 的 DASHSCOPE_API_KEY、BOCHA_API_KEY。
 */
import { readFileSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

const envPath = path.join(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

import {
  buildTrendPrompt,
  buildTrendTitlePrompt,
} from "../src/lib/trendGenerationPrompt";
import { searchBochaTrends } from "../src/lib/trends/bocha";
import { completeChat, parseTitles } from "../src/lib/qwen";
import { readPersistedProducts } from "../src/lib/persistentLibrary";
import type { TrendSearchResult } from "../src/types/trend";

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const productId = argValue("--product");
const topic = argValue("--topic") ?? "";
const tag = argValue("--tag") ?? "sample";

function formatTrendSources(trends: TrendSearchResult[]): string {
  if (!trends.length) {
    return "未抓取到可用热点。可以围绕近期行业讨论做轻评论,但不得编造具体新闻、数据或来源。";
  }
  return trends
    .slice(0, 8)
    .map((t, i) => {
      const source = [t.source, t.publishedAt].filter(Boolean).join(" · ");
      return [`${i + 1}. ${t.title}`, t.snippet ? `摘要:${t.snippet}` : "", source ? `来源信息:${source}` : ""]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");
}

async function main() {
  const products = await readPersistedProducts();
  const product = productId ? products[productId] : undefined;
  if (!product || !topic) {
    console.error("用法: npx tsx scripts/trend-sample.ts --product <id> --topic <热点话题> [--tag baseline|after]");
    console.error(`可用产品: ${Object.keys(products).join(", ")}`);
    process.exit(1);
  }

  const apiKey = process.env.BOCHA_API_KEY ?? "";
  let trends: TrendSearchResult[] = [];
  if (apiKey) {
    console.log(`博查检索: ${topic}`);
    try {
      trends = await searchBochaTrends({ apiKey, query: topic, count: 10 });
      console.log(`拿到 ${trends.length} 条结果`);
    } catch (err) {
      console.warn(`博查失败,继续无素材生成: ${err}`);
    }
  }

  const sourcePack = `【近 30 天热点素材摘要】\n${formatTrendSources(trends)}`;
  const sharedVars = {
    product: product.name,
    productDesc: product.description,
    angle: `热点话题:${topic}`,
    angleInstruction: "围绕该话题做轻噱头引流,产品只在结尾轻点。",
    sourcePack,
    lengthInstruction: "水文短稿,全文 600-900 字。",
    styleName: "系统兜底",
    styleProfile: "",
    styleSample: "",
  };

  console.log("生成大纲…");
  const outlinePrompt = buildTrendPrompt("outline", sharedVars);
  const outline = await completeChat({
    model: outlinePrompt.model,
    temperature: outlinePrompt.temperature,
    maxTokens: outlinePrompt.maxTokens,
    messages: [
      { role: "system", content: outlinePrompt.system },
      { role: "user", content: outlinePrompt.user },
    ],
  });

  console.log("生成正文…");
  const bodyPrompt = buildTrendPrompt("body", { ...sharedVars, outline });
  const body = await completeChat({
    model: bodyPrompt.model,
    temperature: bodyPrompt.temperature,
    maxTokens: bodyPrompt.maxTokens,
    messages: [
      { role: "system", content: bodyPrompt.system },
      { role: "user", content: bodyPrompt.user },
    ],
  });

  console.log("生成标题…");
  const titlePrompt = buildTrendTitlePrompt({
    product: product.name,
    angle: `热点话题:${topic}`,
    styleName: "系统兜底",
    body,
    sourceSummary: trends
      .slice(0, 3)
      .map((t) => t.title)
      .join(";"),
  });
  const titlesRaw = await completeChat({
    model: titlePrompt.model,
    temperature: titlePrompt.temperature,
    maxTokens: titlePrompt.maxTokens,
    messages: [
      { role: "system", content: titlePrompt.system },
      { role: "user", content: titlePrompt.user },
    ],
  });
  const titles = parseTitles(titlesRaw);

  const outDir = path.join(process.cwd(), "output", "trend");
  mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outFile = path.join(outDir, `${stamp}-${tag}.md`);
  writeFileSync(
    outFile,
    [
      `# 热点稿对照 · ${tag}`,
      "",
      `- 产品: ${product.name}`,
      `- 话题: ${topic}`,
      `- 热点素材: ${trends.length} 条`,
      `- 时间: ${new Date().toLocaleString("zh-CN")}`,
      "",
      "## 候选标题",
      "",
      ...titles.map((t, i) => `${i + 1}. ${t}`),
      "",
      "## 大纲",
      "",
      outline,
      "",
      "## 正文",
      "",
      body,
      "",
    ].join("\n")
  );
  console.log(`\n已写入: ${outFile}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
