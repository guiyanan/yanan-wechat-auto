# 微信公众号自动化 — 批量生成 + 排版 + 推送

## Context

**为什么换方向**:之前在 humanize 三类型分支 + 自动收敛循环上花了过多精力(B1-B3 已交付),用户在 [wechat_automation_requirements.md](D:\JOTO需要工具以及文件\Claude Code\WeChatAuto\wechat_automation_requirements.md) 里明确指出:humanize 已经够用,不需要继续深挖,**当务之急是批量生成 + 排版 + 推送微信草稿箱**这条主线。

**新需求摘要**:
- **3 个新角度替换原 10 个**:产品推广文 / 深度对比文 / 活动峰会文
- **角度 + 风格都改为多选**(勾选框)
- **并行生成 N 篇独立文章**(每个"角度 × 风格"组合一篇)→ 全进草稿箱 → 用户挑一篇
- **固定文章骨架**(三段式):钩子 → 如何使用 → 为什么选我们
- **语气**:不口语化、不过度学术,业务决策层 + IT 都看得懂
- **排版**:点击"排版"自动生成微信公众号 HTML(含花体标题、配色、分割线、配图占位),复制即可用
- **配图**:AI 生图 或 免费图库关键词搜索(方案待定)
- **推送**:认证服务号官方 API → 草稿箱(零封号),用户在公众号后台手动点发布
- **humanize**:保留,但**不再循环迭代**,一次生成 < 40 即通过

## 已完成(保留,作为上下文)

- ✅ Phase A:走完基线流程 + 对齐方向
- ✅ Phase B1:启发式 AI 浓度打分 + provider 抽象
- ✅ Phase B2:humanize prompt 三类型分支(产品推广/场景推广/峰会消息)
- ✅ Phase B3:`/api/humanize/once` 非流式路由 + "自动改到安全区"按钮 + AbortController

旧 B4(公众号排版)合并进新 Phase D2;旧 humanize 三分支文案需要按新"不口语化"语气调整,放在新 Phase E。

---

## 推荐方案 — 分阶段交付清单

按需求文档"第一阶段"和"第二阶段"分。第一阶段共 3 个任务,完成后给你看一次;第二阶段 3 个任务 + humanize 微调。

### 第一阶段 · 批量生成

**C1. 角度数据替换 + 多选** ✅
- [x] `src/data/angles.json` 替换为 3 个新角度: `angle-promo` / `angle-compare` / `angle-summit`,带 sceneDesc / promptInstruction / category(对应 articleType)
- [x] `src/store/wizardStore.ts`:`angleId: string | null` → `angleIds: string[]`,`customAngle` 保留;新增 `toggleAngleId(id)` / `setAngleIds(ids)`;旧 v1 持久化数据通过 `migrate` 自动迁移到 v2
- [x] `src/components/wizard/AnglePicker.tsx`:单选改多选(checkbox + role/aria-checked),至少勾 1 个或写自定义才能进下一步
- [x] `src/app/wizard/angle/page.tsx`:校验从 angleId 改为 `angleIds.length > 0 || customAngle.trim()`
- [x] `src/components/wizard/SummaryCard.tsx`:多角度 chip 列表展示;`WizardFrame.tsx` 取 `angleIds` + 算 `selectedAngles[]`
- [x] `src/app/wizard/generating/page.tsx`:暂时取 `angleIds[0]` 作为单选 fallback(C3 才改为真正并行)
- [x] `src/lib/articleType.ts` 自动适配新 `angles.json`(动态读取 category)
- [x] `src/data/articles.json` 种子文章的旧 angleId 全部映射到新 3 角度(promo/compare/summit)
- [x] 单测:`articleType.test.ts` 替换 10 个旧 ID 为 3 个新 ID;新增 `wizardStore.test.ts`(10 cases)验 toggleAngleId 增删/插入序/customAngle 同步/reset
- [x] 浏览器验证:勾 2 角度 → 右侧 chip 显示 2 角度;Stepper 第 2 步绿色✓;"下一步"激活;0 console error

**C2. 风格多选**
- [ ] `src/store/wizardStore.ts`:`styleId: string | null` → `styleIds: string[]`,`setStyleId` → `toggleStyle(id)`
- [ ] `src/components/wizard/StylePicker.tsx`:单选改多选(checkbox),至少勾 1 个才能进下一步
- [ ] `src/app/wizard/style/page.tsx`:校验改为 styleIds.length > 0
- [ ] `src/components/wizard/SummaryCard.tsx`:右侧"当前选择"展示多角度多风格(用 chip 列表)
- [ ] 单测:`wizardStore.test.ts` 增加 toggleStyle case
- [ ] `WizardFrame.tsx` step 推进逻辑校验更新

**C3. 并行批量生成**
- [ ] **方案**:前端循环调用现有 `/api/generate`,后端不动(避免改流式 SSE 协议)
- [ ] `src/app/wizard/generating/page.tsx`:从单条 pipeline 变成 N 条并行(N = angleIds.length × styleIds.length)
- [ ] 新组件 `src/components/wizard/BatchGeneratingProgress.tsx`:N 篇文章每篇一行,显示 角度名/风格名 + 当前 stage(outline/body/titles/covers/factcheck)+ 进度条
- [ ] 并发上限:同时跑 3 篇(避免 Qwen rate limit),其余排队;若 Qwen 出错只标这一篇 failed,其他继续
- [ ] 每篇生成完立刻 `articleStore.createDraft + patch` 写入草稿箱(不等全部完成,用户可以提前回 Dashboard 看)
- [ ] 全部完成后跳 Dashboard,**不再自动跳 Editor**(因为有多篇,让用户挑选)
- [ ] Dashboard 顶部新加一行 banner:"刚生成 N 篇:产品推广×卡兹克 / 产品推广×JOTO / 深度对比×卡兹克 ..."(用户能快速找到本次批次)
- [ ] `src/lib/prompts.ts` 的 body 节点 system 加固定骨架要求:"全文必须分三段(可拆分子段),按顺序: 1. 钩子(开门见山说效益,抓注意力) 2. 如何使用(简洁步骤,让读者快速理解上手路径) 3. 为什么选我们(对比传统方式或主流竞品,突出差异化优势)"
- [ ] body 节点 prompt 加语气要求:"不口语化、不过度学术,业务决策层和 IT 都能读懂"
- [ ] 单测:`prompts.test.ts` 新增 body 节点固定骨架断言;新增 `batchGeneration.test.ts` 验前端并发控制(mock fetch,验证 angleIds×styleIds 笛卡尔积、并发上限 3、单篇失败不影响其他)
- [ ] 浏览器:勾 2 角度 × 2 风格 → 4 篇并行生成 → 全进草稿箱 → Dashboard 显示新 banner

**C3 完成 = 第一阶段交付**,跑 `npm run ci` + 浏览器 demo 给你看,你 OK 才进第二阶段。

---

### 第二阶段 · 排版 + 微信推送

**D1. 排版预览页 + 主题切换** ✅
- [x] `src/lib/wechatThemes.ts`:三主题 `minimal | polished | vibrant`,含 `ThemePalette` 12 色属性
- [x] `src/lib/wechatDecorate.ts`:10 pass 装饰 pipeline(headings → subtitles → strong → emojis → callouts → blockquotes → paragraphs → numbers → colonPrefixes → dividers + optional imagePlaceholders)
- [x] `src/lib/wechatHtml.ts`:`theme + decorate` 参数 + juice 内联
- [x] `src/app/review/[id]/page.tsx`:排版风格 dropdown + 实时刷新预览
- [x] `src/types/article.ts`:`Article.exportTheme?: WechatTheme`
- [x] 单测:`wechatThemes.test.ts`(29 tests) + `wechatDecorate.test.ts`(56 tests)

**D2. 配图占位** ✅
- [x] `insertImagePlaceholders()`:每个 h2 后第一个块元素后插入主题色占位框(opt-in via `imagePlaceholders: true`)
- [ ] 中期决定:接 fal.ai / DALL-E / Unsplash API → 拉一张配图(待用户决定方案)

**D3. 推送微信草稿箱** ✅
- [x] `src/lib/wechatDraft.ts`:access_token 缓存(90min TTL) + `pushDraft()` + 40001/42001 自动清缓存重试
- [x] `/api/wechat/push-draft/route.ts`:render HTML + 推送
- [x] `.env.example` + `.env.local` 加 `WECHAT_APPID` / `WECHAT_APPSECRET`
- [x] Review 页 Step 7"推送到微信草稿箱"按钮 + 成功后 toast 含"打开公众号后台"链接
- [x] `wechatDraft.test.ts`(11 tests)

**E. humanize 去口语化** ✅
- [x] `HUMANIZE_BRANCH_BLOCKS` 全部重写:产品推广→业务视角+效益数字、场景推广→场景驱动+量化对比、峰会消息→保持客观报道体
- [x] `prompts.test.ts` 断言更新:验证新关键词("业务视角开篇"、"禁止第一人称"、"场景驱动"、"传统方式 → 新方案")

---

### 第三阶段 · Humanize Pipeline 升级

**背景**:当前 humanize 仅靠单次 Qwen 改写 + 启发式评分,效果依赖 LLM 遵从度。调研了市面主流开源方案后,采用**三层 pipeline + 检测评分门控**架构,显著提升中文去 AI 痕迹效果。

**核心参考项目**:
| 项目 | Stars | 许可 | 取什么 |
|------|-------|------|--------|
| [StealthHumanizer](https://github.com/rudra496/StealthHumanizer) | 11 | MIT | TypeScript 后处理模块(同义词替换、AI 词汇移除、句长打散) |
| [说人话 shuorenhua](https://github.com/MrGeDiao/shuorenhua) | 342 | MIT | 210+ 中文 AI 腔反模式词典、19 种结构反模式 |
| [humanize-chinese](https://github.com/voidborne-d/humanize-chinese) | 317 | ⚠️ MIT Non-Commercial | 统计检测算法(N-gram 困惑度、句长方差、AI 短语密度);仅参考算法思路,不直接复制代码 |

**F1. L1 — Prompt 层增强(融入 Qwen humanize 节点)**
- [ ] 从 shuorenhua 提取 210+ 中文 AI 腔模式(如"值得注意的是"、"综上所述"、"在当今"等),整理为 `src/lib/humanize/chineseAntiPatterns.ts` 导出常量数组
- [ ] 将反模式列表注入 `prompts.ts` humanize 节点的 system prompt,作为黑名单指令:"以下短语必须替换或删除:..."
- [ ] 补充 shuorenhua 的 19 种结构反模式(如"三段排比"、"递进式总结"等)到 prompt 中作为结构约束
- [ ] `prompts.test.ts` 新增断言:humanize system prompt 包含反模式黑名单关键词
- [ ] 单测:`chineseAntiPatterns.test.ts` 验证模式列表非空、无重复、格式正确

**F2. L2 — TypeScript 后处理层**
- [ ] 从 StealthHumanizer 提取/改写核心后处理模块到 `src/lib/humanize/postProcess.ts`:
  - `removeAiVocabulary(text)` — 基于反模式词典替换 AI 高频词汇
  - `varySentenceLength(text)` — 打散连续等长句(短句 8-15 字与长句 30-50 字交替)
  - `applyCollocations(text)` — 中文搭配替换(如"进行分析"→"分析"、"实现了突破"→"突破了")
- [ ] 构建中文同义词/搭配词典 `src/lib/humanize/zhDictionary.ts`(从 shuorenhua 210+ 模式 + 自建补充)
- [ ] 后处理函数为**纯函数**(无 LLM 调用),可独立单测
- [ ] `postProcess.test.ts`:验证各函数对典型 AI 腔段落的改写效果

**F3. L3 — 检测评分门控(质量关卡)**
- [ ] 新增 `src/lib/humanize/detectScore.ts`,实现 4 维中文 AI 检测评分:
  - **AI 短语密度**:文本中命中反模式词典的次数 / 总字数
  - **句长方差**:计算所有句子字数的标准差(真人写作方差大,AI 方差小)
  - **重复结构比**:检测连续 N 句使用相同句式开头的比例
  - **被动/套话比**:检测"据了解"、"众所周知"等套话占比
- [ ] 输出 0-100 分(0 = 完全像人,100 = 明显 AI),与现有 `aiScoreHeuristic.ts` 互补
- [ ] 可配置阈值(默认 < 40 通过),作为 pipeline 自动循环的判定条件
- [ ] `detectScore.test.ts`:用已知 AI 文本和人写文本验证评分区分度

**F4. Pipeline 集成(自动 humanize 进生成流程)**
- [ ] 新增 `src/lib/humanize/pipeline.ts`:编排三层处理
  ```
  输入(body HTML) → L1 Qwen 逐段改写 → L2 后处理(纯函数) → L3 检测评分
  若评分 > 阈值 → 回 L1 再改一轮(最多 2 轮)
  ```
- [ ] humanize pipeline 集成到 `/api/generate` 的 body → titles 之间,作为可选步骤
- [ ] 新增 `DecorateOptions.autoHumanize?: boolean` 或 generate route 的请求参数控制开关
- [ ] 逐段改写策略:将 body 按 `<h2>` 分段,每段独立调用 humanize,避免全文改写导致风格漂移
- [ ] 并发控制:humanize 各段可并行(复用 semaphore 模式,上限 3)
- [ ] 单测:`humanizePipeline.test.ts` mock Qwen 调用,验证三层串联、循环退出、段落拆分

**F5. Editor 副驾驶升级**
- [ ] Editor 侧边栏"一键降 AI"按钮改为调用新 pipeline(L1+L2+L3)而非单次 Qwen
- [ ] 显示 L3 检测评分实时变化(改写前 → 改写后)
- [ ] "自动改到安全区"按钮恢复为主按钮(因为 pipeline 效果更可靠了)

---

**F 阶段新增文件**:
- `src/lib/humanize/chineseAntiPatterns.ts` — 210+ 中文 AI 腔反模式词典
- `src/lib/humanize/zhDictionary.ts` — 中文同义词/搭配替换词典
- `src/lib/humanize/postProcess.ts` — 纯函数后处理(词汇替换、句长打散、搭配优化)
- `src/lib/humanize/detectScore.ts` — 4 维中文 AI 检测评分
- `src/lib/humanize/pipeline.ts` — 三层 pipeline 编排
- `src/__tests__/chineseAntiPatterns.test.ts`
- `src/__tests__/postProcess.test.ts`
- `src/__tests__/detectScore.test.ts`
- `src/__tests__/humanizePipeline.test.ts`

**F 阶段修改文件**:
- `src/lib/prompts.ts` — humanize 节点 system prompt 注入反模式黑名单
- `src/app/api/generate/route.ts` — body 后插入 humanize pipeline 步骤
- `src/components/editor/AiScoreGauge.tsx` — 接入新 pipeline + 显示 L3 评分

---

**第三阶段验证路径**:
1. `npm run ci` 全绿
2. 准备 3 段典型 AI 腔中文段落,分别跑 L3 detectScore → 分数应 > 60
3. 同 3 段经过 pipeline(L1+L2)处理后 → 分数应 < 40
4. 浏览器:生成一篇文章(开启 autoHumanize)→ body 无明显 AI 套话 → AI Score 面板显示 < 40
5. Editor 点"一键降 AI" → 实时看到分数从高降到安全区

---

## 关键文件清单

**新增**:
- `src/components/wizard/BatchGeneratingProgress.tsx`(C3)
- `src/lib/wechatThemes.ts`(D1)
- `src/lib/wechatDecorate.ts`(D1)
- `src/lib/wechatDraft.ts`(D3)
- `src/app/api/wechat/push-draft/route.ts`(D3)
- `src/__tests__/wizardStore.test.ts`(C1/C2)
- `src/__tests__/wechatThemes.test.ts`(D1)
- `src/__tests__/wechatDecorate.test.ts`(D1)
- `src/__tests__/batchGeneration.test.ts`(C3)

**修改**(主):
- `src/data/angles.json` — 替换为 3 个新角度(C1)
- `src/store/wizardStore.ts` — 单值 → 数组(C1+C2)
- `src/components/wizard/{AnglePicker,StylePicker,SummaryCard}.tsx` — 多选 UI(C1+C2)
- `src/app/wizard/{angle,style,generating}/page.tsx` — 校验 + 批量生成(C1+C2+C3)
- `src/lib/prompts.ts` — body 节点固定骨架 + 不口语化 + humanize 三分支去口语化(C3+E)
- `src/lib/articleType.ts` — ANGLE_CATEGORY_INDEX 重生成(C1)
- `src/lib/wechatHtml.ts` — theme + decorate 参数(D1)
- `src/app/review/[id]/page.tsx` — 排版 dropdown + 推送按钮(D1+D3)
- `src/components/editor/AiScoreGauge.tsx` — "自动改到安全区"降级(E)
- `src/components/review/ExportHtmlButton.tsx` — clipboard MIME 修正(D1)
- `src/types/article.ts` — `exportTheme` 字段(D1)
- `src/__tests__/articleType.test.ts` — 旧 ID 替换(C1)
- `src/__tests__/prompts.test.ts` — 新 body 骨架断言 + humanize 新关键词(C3+E)

**复用不改**:
- `src/lib/qwen.ts`(callPromptStream + humanize)
- `src/lib/seed.ts`
- `src/store/articleStore.ts`(已支持多 article)
- `src/app/api/generate/route.ts`(单篇生成 — 前端循环调用做批量)

---

## 验证路径

**第一阶段(C1+C2+C3)完成后**:
1. `npm run ci` 全绿
2. 浏览器:Dashboard → "新建文章" → 选产品 → **勾 2 个角度**(产品推广文 + 深度对比文)→ **勾 2 个风格**(卡兹克 + JOTO 官宣体)→ 开始生成
3. 看到批量进度页:4 篇 × 5 stage 的进度条;并发上限生效(至多 3 篇同时 running)
4. 全部完成 → 跳 Dashboard,banner 显示 4 条新生成
5. 打开任意 1 篇,正文按"钩子→如何使用→为什么选我们"三段式,语气不口语化(无"我用了一周"等)

**第二阶段(D1+D2+D3+E)完成后**:
1. Review 页选"polished"主题,预览看到色块 H2 + emoji 列表 + 引用框
2. 点"复制 HTML",粘到微信公众号草稿编辑器,样式存活 ≥ 90%
3. 点"推送到微信草稿箱",约 3 秒后看到 toast,公众号后台真出现新草稿
4. AiScoreGauge "自动改到安全区"按钮已降级或隐藏;humanize 输出不再有"我用了一周"等口语
