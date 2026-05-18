# 批次预览页流程 + 排版保留 humanize + Dashboard 一键推送

## Context

**问题背景**：上一版流程是 选产品 → 选角度 → 选风格 → 生成 → 跳回 Dashboard（所有文章混进历史草稿）。用户必须自己找出刚生成的几篇 → 进 Editor → Review → 推送，每篇都要单独操作。同时 humanize 把丰富排版（h2/h3/`<strong>`/`<blockquote>`）压成纯文本一坨 `<p>`，用户多次反馈"排版有问题"。

**目标流程**：
```
选产品 → 选角度 → 选风格 → 生成
                            ↓
                  【新】批次预览页 /batch/[batchId]
                  N 篇文章（角度/风格 chip + 正文预览 + 单选 radio）
                            ↓ 单选一篇 → Humanize 所选
                  pipeline.runStructurePreservingPipeline
                  （仅改写 <p>，保留 h2/h3/list/blockquote 100%）
                            ↓
                  Dashboard（只显示成品，filtered stage="batch"）
                            ↓ 点行右侧「推送」按钮
                  PushConfirmModal → /api/wechat/push-draft
```

---

## 核心改动一览

| 模块 | 改动 |
|---|---|
| **数据模型** | `Article` 加 `batchId?` + `stage?: "batch" \| "main"` |
| **批次预览页** | `/batch/[batchId]` 新增（单选 + 卡片 + 底部固定操作条） |
| **Dashboard 过滤** | `filterDashboardVisible(articles)` — 隐藏 `stage === "batch"` |
| **Markdown 转换层** | 新建 `src/lib/markdown.ts`，含 `markdownToHtml` / `htmlToMarkdown` / `parseMarkdownBlocks` / `joinMarkdownBlocks` |
| **Humanize Pipeline** | `runStructurePreservingPipeline` — 按 markdown 块解析，**仅 paragraph 块送 LLM** |
| **/api/humanize/pipeline** | 接 `preserveStructure?: boolean` 开关；无 DASHSCOPE_API_KEY 时优雅降级（跳 L1 仅跑 L2+L3） |
| **AiScoreGauge** | 加 `l3Score?` prop + "一键降 AI" 升为主按钮 |
| **Dashboard 推送按钮** | `ArticleRow` 拆分 Link + 独立「推送」按钮；新建 `PushConfirmModal` 调 `/api/wechat/push-draft` |
| **中国本土化硬约束** | `prompts.ts` 加 `CHINA_LOCALIZATION_BLOCK`，注入 body + humanize 两个 prompt |
| **body prompt 强化** | 加正文段落硬性要求：每个 `###` 下面必须 2-3 段完整 `<p>` 正文 ≥ 80-180 字 + 中国企业案例 |
| **全局 Toaster** | `<Toaster>` 从 wizard/style 单页挂载移到 root layout |

---

## 数据模型

### `src/types/article.ts`

```ts
export type ArticleStage = "batch" | "main";

export interface Article {
  // …现有字段
  /** 一次生成的 N 篇共享，仅批次预览页用 */
  batchId?: string;
  /**
   * "batch" — 批次预览页里的原始稿，不进 Dashboard
   * "main"  — Dashboard 显示（humanize 完成 / seed / 历史）
   * undefined 视同 "main"（向后兼容）
   */
  stage?: ArticleStage;
}
```

### `src/store/articleStore.ts`

- `CreateDraftInput` 接受可选 `batchId` + `stage`
- 新增 selector: `listByBatch(batchId): Article[]`（按 createdAt 升序）
- `patch` 可把 `stage` 从 `"batch"` 升到 `"main"`，**`batchId` 保留**（这样原批次预览页可以看到「已入库」标记）

---

## 批次预览页 `/batch/[batchId]`

**布局**（参考 Dashboard 卡片风格）：
- **顶栏**：回 Dashboard 链接 + 「批次预览」标题 + 「共 N 篇 · 选一篇 humanize 后发布到 Dashboard · 已入库 X 篇」副标题 + 批次 ID 显示
- **卡片列表**（单列），每篇：
  - 左侧 radio（绿色，已 humanize 过的显示 `<CheckCircle2>` 灰色禁用）
  - 标题 + 产品名 + 角度 chip（紫色）+ 风格 chip（蓝色）
  - 正文 200 字预览
  - 右上「预览」按钮 → `/editor/[id]?readonly=1`
  - 已 humanize 过的额外显示「已入库」徽章
- **底部固定操作条**：
  - 「已选：{角度} × {风格}」
  - 主按钮「Humanize 所选 → 发布到 Dashboard」（绿色，运行时变 `Humanize 中… (L1 → L2 → L3)`）

**Zustand selector 注意点**：直接 `(s) => s.listByBatch(batchId)` 会触发无限循环（每次返回新数组）。正确写法：subscribe `s.drafts` + `useMemo` 派生。

---

## Markdown 转换层 `src/lib/markdown.ts`

旧的 `markdownToHtml` 只支持 `h1/h2/h3/p` → 导致 `**加粗**` 和 `- 列表` 在 HTML 里以纯文本残留。

**新转换器覆盖**：
- 块级：`# / ## / ###`、`- item` / `1. item`、`> blockquote`、`---`、paragraph
- 行级：`**bold**` → `<strong>`、`*italic*` → `<em>`、`  \n` → `<br>`
- 预处理：Qwen 输出常把 `## 下一标题` 直接接在前一段尾部（中间只一个空格），regex `/([^\n])[ \t]+(#{1,3}[ \t])/g` → `$1\n\n$2` 强制提升为块级。**不破坏 `C#` `#1` 等无空格 token**。

**反向 `htmlToMarkdown`**：覆盖 h1-h3、strong/b、em/i、ul/ol、blockquote、br、hr、p。剥未识别标签，解码常见实体。

**块级解析 `parseMarkdownBlocks(md): MdBlock[]`**：返回 `{type: "heading"|"paragraph"|"list"|"blockquote"|"hr", raw: string}[]`。原始 markdown 文本保留在 `raw`，供"结构保留 humanize"原样透传。

---

## Humanize Pipeline 升级

### 旧问题
原 `runHumanizePipeline` 按 `## ` 切 section，把整个 section body（含 `<h3>` `<strong>` `<blockquote>`）一起送给 LLM。LLM 改写时随意重组内容，结构丢失。

### 新方案 `runStructurePreservingPipeline`
```ts
async function runStructurePreservingPipeline(markdown, humanizeFn, options) {
  const blocks = parseMarkdownBlocks(markdown);
  // 仅取 type === "paragraph" 的索引
  const paragraphIndices = blocks
    .map((b, i) => b.type === "paragraph" ? i : -1)
    .filter(i => i !== -1);
  
  // 仅对 paragraph 块跑 humanizeFn（L1）+ postProcess（L2）
  const tasks = paragraphIndices.map(idx => () =>
    processSegment(blocks[idx].raw, humanizeFn, threshold, maxRounds, signal)
  );
  const results = await runWithConcurrency(tasks, concurrency); // 默认 3

  // heading/list/blockquote/hr 直接透传，paragraph 替换为改写后版本
  const finalBlocks = blocks.map((b, i) => {
    const k = paragraphIndices.indexOf(i);
    return k === -1 ? b : { type: "paragraph", raw: results[k].text.trim() };
  });
  
  const finalText = joinMarkdownBlocks(finalBlocks);
  const scoreBreakdown = detectScore(finalText); // L3 在全文上跑
  return { text: finalText, scoreBreakdown, totalRounds: sum(rounds) };
}
```

**保证**：原文里的 `<h2>` `<h3>` `<strong>`（在 heading 里）`<ul>` `<ol>` `<blockquote>` `<hr>` **数量在 humanize 前后完全一致**。

### `/api/humanize/pipeline` 接 `preserveStructure?: boolean`
- `true` → `runStructurePreservingPipeline`（批次预览页默认）
- `false`（默认）→ 原 `runHumanizePipeline`（按 `## ` 切 section，整 section 改）

### 无 API key 优雅降级
当 `DASHSCOPE_API_KEY` 未配置时 `buildQwenHumanizeFn` 抛 `QwenAuthError`。Route 内 catch → 仅返回原文（跳 L1）→ L2 postProcess + L3 detectScore 仍正常跑。这样 demo 环境完整链路可演示，不会因缺凭据全失败。

---

## Dashboard 一键推送

### `src/components/dashboard/ArticleRow.tsx` 重构
- 旧：整行 `<Link>` → editor
- 新：行容器 `<div>` 网格布局，**标题/产品/标签区域单独包成 `<Link>`**，行右侧加独立 `<button>`「推送」
- 推送按钮仅当 `status !== "published"` 且 `contentHtml` 非空时显示
- 点击 → 调用父级 `onPushClick(article)` 回调（**不**触发 Link 导航）

### `src/components/dashboard/PushConfirmModal.tsx`
- 模态框，标题「推送到微信公众号草稿箱」
- 显示文章标题 + 产品名 + 主题（`article.exportTheme ?? "polished"`）+ 装饰选项
- 黄色提示框「推送后会出现在公众号后台『草稿箱』，需要你手动点『发布』」
- 「取消」+「确认推送」按钮
- 确认 → `POST /api/wechat/push-draft`（参考 review 页 :197-239 参数）→ 成功 toast + `setStatus(article.id, "published")` → modal 关闭
- 失败 → 红色 toast 显示错误信息（如「Missing WECHAT_APPID or WECHAT_APPSECRET in environment」）

---

## 中国本土化硬约束

文章发布在微信公众号（中国本土平台），海外案例破坏语气。在 `prompts.ts` 抽出共享 `CHINA_LOCALIZATION_BLOCK`，**同时注入到 body 和 humanize 两个节点**：

- 禁用：Google / Apple / Amazon / Microsoft / Meta / Tesla / OpenAI / Netflix / Uber / Airbnb / Stripe / Notion / Slack / Salesforce / SAP / Oracle
- 必用：阿里巴巴/淘宝/天猫、腾讯/微信、字节跳动/抖音/飞书、美团、拼多多、京东、华为、小米、滴滴、百度、网易、B 站、小红书、快手、得物、SHEIN、蔚来/小鹏/理想、宁德时代、比亚迪、京东方、安克、海尔、海康威视
- 案例必用中国本土场景：三一/海尔/比亚迪车间、双 11/618/带货、钉钉/飞书/腾讯文档、网商银行/微众银行
- 货币单位用 ¥ / 元；长度用米/公里（不用英尺/英里）
- 地点用北京/上海/杭州/深圳/广州（不用纽约/旧金山/伦敦）

**实测效果**：humanize 输出全是 京东物流、比亚迪 MES、淘宝商家后台 API、华为云 IAM、钉钉组织架构、飞书 HR 系统、SCIM 协议、Spring Cloud Gateway 等中国本土技术细节，零海外引用。

---

## 文章排版 prompt 强化

旧 body prompt 没强制写正文段落 → Qwen 把所有要点压缩进 `<h3>` 标题里（"### 上线快 — **3 天完成 POC**"）→ humanize 时 paragraph 块为空，结构保留但无东西可改。

**新硬约束**：
- 禁止把内容压缩到标题里
- 每个 `###` 下面必须紧跟 2-3 段完整正文段落
- 每段 80-180 字，讲一个具体场景：**中国企业名 + 真实业务动作 + 量化数字**
- 标题只放观点提要（10-25 字），具体证据写到段落里
- 全文 `<p>` 段落数 ≥ 6

---

## 验证 / 测试

### 单元测试新增
- `articleStore.test.ts` — `batchId` / `stage` / `listByBatch` 5 cases（17 total）
- `articles.test.ts` — `filterDashboardVisible` 5 cases
- `prompts.test.ts` — 中国本土化 2 cases + 正文段落硬约束 1 case
- `postProcess.test.ts` — `varySentenceLength` 14 cases
- `detectScore.test.ts` — 4 维评分 21 cases
- `humanizePipeline.test.ts` — `splitSections` + `runHumanizePipeline` 20 cases + `runStructurePreservingPipeline` 6 cases
- `humanizePipelineRoute.test.ts` — route 验证 + 优雅降级 + mock pipeline 7 cases
- `markdown.test.ts` — 块级/inline/round-trip/inline-heading-promotion/realistic Qwen output 38 cases

**总计**：30 个测试文件，441 个 case 全绿；typecheck 0 错；ESLint 0 错。

### 浏览器实测路径
1. `npm run dev` → http://localhost:3003
2. 「新建文章」 → 选 Loop RPA + 角度 + 风格 → 生成（真 Qwen，30-40s）
3. 自动跳 `/batch/[batchId]`，看到文章卡片 + 单选
4. 点「Humanize 所选 → 发布到 Dashboard」 → 60-90s（每个 `<p>` 块独立改写）
5. Toast「Humanize 完成：L3 评分 X，已发布到 Dashboard」+ 自动跳 Dashboard
6. Dashboard 第一行就是 humanize 完的文章，**排版结构 100% 保留**（h2/h3/strong/blockquote 数量与生成时一致）
7. 行右侧「推送」按钮 → 弹 PushConfirmModal → 确认 → 调微信 API（无凭据时友好报错 toast）

---

## 关键文件清单

### 新建
- `src/lib/markdown.ts` — markdown ↔ HTML 转换（含块级解析）
- `src/lib/humanize/postProcess.ts` — L2 后处理（vocab + sentence-length）
- `src/lib/humanize/detectScore.ts` — L3 4 维 AI 痕迹评分
- `src/lib/humanize/pipeline.ts` — 三层 pipeline + 结构保留模式 + `buildQwenHumanizeFn`
- `src/app/batch/[batchId]/page.tsx` — 批次预览页
- `src/app/api/humanize/pipeline/route.ts` — pipeline route
- `src/components/dashboard/PushConfirmModal.tsx` — 推送确认对话框
- `src/__tests__/{markdown,postProcess,detectScore,humanizePipeline,humanizePipelineRoute}.test.ts`

### 修改（主）
- `src/types/article.ts` — 加 `batchId?` + `stage?`
- `src/store/articleStore.ts` — `createDraft` 签名 + `listByBatch`
- `src/app/wizard/generating/page.tsx` — 生成 `batchId`，传入 `createDraft`，跳 `/batch/[id]`；删除本地 markdownToHtml 改用 `@/lib/markdown`
- `src/app/page.tsx` — 用 `filterDashboardVisible` 过滤 `stage === "batch"`
- `src/app/layout.tsx` — 全局挂 `<Toaster>`
- `src/components/dashboard/{ArticleList,ArticleRow}.tsx` — 重构加推送按钮 + modal state
- `src/components/editor/AiScoreGauge.tsx` — l3Score prop + 主按钮升级
- `src/lib/prompts.ts` — body 正文段落硬约束 + `CHINA_LOCALIZATION_BLOCK`（body & humanize）
- `src/lib/articles.ts` — `filterDashboardVisible` 纯函数
- `src/app/api/generate/route.ts` — 加可选 `autoHumanize` 阶段（默认关）
- `src/lib/humanize/index.ts` — 重新导出新增 API

---

## 不在本次范围

- 批次列表/历史页（用户只通过生成完成的自动跳转 + URL 访问单个批次）
- 推送时高级配置（自定义封面 / 摘要编辑）→ 继续走 Review 页（行点击进 editor 后底部仍可去 review）
- 多账号推送选择（用 env 默认账号）
- 持续提升 Qwen 生成的 `<p>` 段落数（当前 3-6 段，目标 ≥ 6）
