---
name: tomitest
description: Project-level test scenario registry for JOTO 内容工厂. Every test case or edge case discovered during development MUST be recorded here. Auto-loaded at session start so future sessions don't forget.
---

# tomitest · JOTO 测试场景库

这里收集本项目所有已知的测试场景、边界 case、回归路径。开发或测试过程中**新发现的场景都要加进来**。

## 使用方式

- **开发新功能前**:读一遍对应模块的场景,避免漏 case
- **修复 bug 后**:把引发 bug 的 case 加到对应模块
- **每个 phase 结束前**:确认该 phase 相关场景都在此文档里
- **测试优先级**:🔴 必测 · 🟡 应测 · 🟢 可测

---

## 全局 / 基础设施

### 🔴 启动自检
- `npm run dev` 无报错、页面打开无 console 错误
- `npm run ci` (typecheck + lint + test) 全绿
- `.env.local` 缺 key 时不崩溃,给出清晰提示

### 🔴 环境变量
- `DASHSCOPE_API_KEY` 缺失时,任何调用 Qwen 的路由要 fallback,不能 500

### 🟡 SSR hydration
- 刷新任一页面,浏览器控制台无 hydration mismatch warning
- Zustand persist 的 store 在 SSR 下不直接读 storage

## Phase 3a · Qwen 库 + Prompts + 合规 + AIGC (lib 层) · ✅ 已实施

### 🔴 prompts.ts 模板系统
- 5 个 pipeline 节点(outline / body / titles / humanize / factcheck)都有独立温度和模型(PRD 6.2.5) ✅
- `renderTemplate` 变量替换:单次、多次、空串、多余 key 忽略 ✅
- 缺少声明变量时抛 `PromptVariableError` ✅
- factcheck 用 qwen-max + 低温(0.3),titles 温度比 outline 高(1.1 vs 0.8)

### 🔴 limitWords.ts
- 默认 47+ 个极限词包含「最/第一/唯一/国家级」等关键项 ✅
- `scanLimitWords` 空输入返回空、命中返回(word, index, length) ✅
- 多次命中、重叠词(最 vs 最好)各自独立报告 ✅
- `uniqueMatchedWords` 保序去重 ✅

### 🔴 sensitiveTopics.ts
- 8 个话题类别(时政/明星/军事/宗教/民族/金融/医疗/大公司) ✅
- 每个话题 ≥1 个关键词,id 唯一 ✅
- `scanSensitive` 按位置排序 ✅

### 🔴 aigcMeta.ts (国家法规合规)
- `buildAigcMetadata` 默认字段完整,可覆盖 ✅
- Date 对象自动转 ISO string ✅
- `aigcMetaTag` 始终用 `name="AIGC"`(法规硬要求) ✅
- `injectAigcMeta` 存在 `</head>` 时插前面,已有 AIGC meta 时替换 ✅

### 🔴 wechatHtml.ts (Phase 6 主用,Phase 3a 先落地 + 测试)
- `exportWechatHtml` 经 juice 内联样式后,`<style>` 标签移除,段落内联 style 保留 ✅
- AIGC meta 永远在输出 head 里 ✅
- 显式声明(`addExplicitNotice`)可选追加 ✅
- Title HTML entity escape 防注入 ✅

### 🔴 qwen.ts 库层
- `createQwenClient` 缺 key 抛 `QwenAuthError`;接受注入 client(用于测试) ✅
- `streamChat` 流式、401→QwenAuthError、429→QwenRateLimitError ✅
- `completeChat` 非流式、空 content 返回 "" ✅
- `sseFromGenerator` 把 AsyncGenerator 转 SSE(data: ...\n\n + [DONE] + error payload) ✅
- `parseTitles` 解析 JSON 数组、容忍前后噪声、不足 5 条 pad、退化按行切 ✅
- `generateOutline` 用 qwen-plus + temp 0.8 + non-stream ✅
- `humanize` 流式,走 humanize 节点模板(temp 1.0) ✅

### 🟡 Coverage
- 目标 ≥80%(lib 目录),**实际 94%**(Stmts) ✅
- 88 个单测全绿,`npm run ci` 通过

## Phase 0.5 · Qwen + SSE Spike (`/spike` + `/api/spike`)

### 🔴 Happy path
- 点击"运行 Spike" → 状态从"就绪"→"流式中"→"完成"
- 输出区域能逐字/逐段看到内容增加(aria-live="polite")
- 完成后显示总耗时(≤10s for ~150 字响应)
- 字数计数器与实际输出匹配

### 🔴 Abort (中止)
- 运行中点击"中止" → 状态变"已中止",输出停止增长
- 中止后再次点击"运行" → 清空旧输出,重新开始
- 关闭页面(离开路由)时自动 abort,server 端连接释放

### 🔴 Auth error (401 / no key / bad key)
- 无效 key → UI 显示红色 alert,包含 `QwenAuthError` 名称和服务端错误信息
- 不崩页、不返回 500(SSE 通道把错误以 `{error: {...}}` payload 送回)
- 错误后再次点击"运行"能触发新请求(不被旧 abortController 卡住)

### 🟡 Timeout / 429
- DashScope 返回 429 → 前端显示 `QwenRateLimitError`
- (P1) 指数退避重试逻辑

### 🟡 Large output
- 设 maxTokens=4000,单次生成约 2000 字:流式每几百 ms 有新 chunk
- 不出现"一次性最后吐出全部"的假流式

### 已验证环境参数 (Phase 0.5)
- OpenAI SDK `baseURL: https://dashscope.aliyuncs.com/compatible-mode/v1` 支持 `stream: true`
- 模型 `qwen-plus` 返回 delta chunks 正常
- Next.js 15 App Router Route Handler 通过 `ReadableStream` + `data: ...\n\n` 向浏览器转发 SSE 无问题
- `req.signal` 能把浏览器 abort 传到 upstream OpenAI client(client 内部用同一个 signal)

---

## Dashboard (Phase 1) · ✅ 已实施并通过

### 🔴 渲染
- 8 篇文章 seed 全部显示 ✅
- 4 个 KPI 卡数值正确(本月生成 7 / 已发布 4 / 平均 AI 浓度 45 / 平均阅读 7,648) ✅
- AI 浓度三色条:<40 绿、40-70 黄、>70 红,**同时有数字和图标**(WCAG ✓ ! ⚠ 符号) ✅
- 状态徽章色环对应:草稿 slate / 待审核 amber / 审核中 blue / 已通过 emerald / 已打回 red / 已发布 emerald / 已归档 slate ✅

### 🔴 交互
- 点击 draft 文章 → 跳 `/editor/[id]` ✅ (Phase 4+5 才有实际页面)
- 点击 published 文章 → 跳 `/editor/[id]?readonly=1` ✅
- 点击 "+ 新建文章" → 跳 `/wizard/product` ✅ (Phase 2 才有实际页面)
- 点击状态徽章/全部 chip → 列表按状态筛选 ✅
- 搜索框输入 → 按标题/作者过滤 ✅

### 🟡 响应式
- 1440 + 1920 宽度下布局正确无溢出 ✅
- 1280 待验(布局大概率 OK)

### 🟡 空状态
- 搜索无匹配 → 显示"没有符合筛选条件的文章" + 搜索词 ✅
- 切回"全部"并清空搜索 → 恢复全列表 ✅

### 🔴 回归
- JSON 数据文件语法:全部通过 `src/__tests__/data-integrity.test.ts` ✅
- 文章的 `productId / angleId / styleId / accountId` 必须指向真实 seed 数据 ✅

---

## Wizard Step 1-3 (Phase 2) · ✅ 已实施并通过(turbopack 下)

### 🔴 Step 1 · 产品
- 6 个产品卡全部显示,渐变色图标正确 ✅
- 未选时"下一步"为 disabled button ✅
- 选中后 summary 联动,"下一步"变为 `<Link>` 可跳 ✅

### 🔴 Step 2 · 角度
- 10 个角度卡(两列 5 行) ✅
- 单选;选中后其他淡化;"下一步"变 `<Link>` ✅
- 底部虚线框"自己写一个角度",textarea ≤200 字,实时字数 ✅
- 自定义角度与预置单选互斥(有自定义时,预置淡化;清空自定义后,预置 id 回来) ✅

### 🔴 Step 3 · 风格
- 4 个风格卡 + 示例段落(浅灰背景 + 左侧主题色竖条,选中竖条变蓝) ✅
- 底部"+ 用范文训练"虚线框,点击 toast 提示(sonner) ✅
- 选中后 footer 按钮变"开始生成"(带 ✨ 图标),跳 /wizard/generating ✅

### 🔴 持久化
- sessionStorage key `joto-wizard-v1`,刷新选择保留 ✅
- 上一步/下一步使用 `<Link>` 完成软导航,保留 Zustand store 状态 ✅

### 🟡 摘要卡
- 右侧 Summary 实时反映三步选择(sticky 顶部) ✅

### 🔴 回归 · 生成中占位页
- 直接访问 /wizard/generating 显示占位卡(Phase 3 会替换)
- 包含"返回调整"和"回 Dashboard"两个按钮

---

## 生成中页 + Qwen (Phase 3b) · ✅ 已实施并通过

### 🔴 Happy path
- 5 阶段依次点亮:outline → body → titles → covers → factcheck ✅
- 每阶段显示耗时(绿勾 / 红警告 / 蓝色 pulse running) ✅
- 阶段 2 body 真实流式:1200+ 字在 20s 内通过 SSE 到达浏览器 ✅
- 完成后 800ms 自动跳 `/editor/[id]` ✅
- articleStore 写入 localStorage:titleCandidates / coverCandidates / contentHtml ✅

### 🔴 失败分支
- 无 key → qwen.ts 走 fallback mock 正文(不崩页) ✅
- 真实错误(非 auth)→ `fatalError` 状态 + 三按钮 [从头重新生成] [取消返回 Wizard] ✅
- 用户离开页面 → AbortController 触发,server 端 req.signal 同步中止

### 🔴 事实核查 1/10 警告
- `/api/generate` 中 `Math.random() < 0.1` 决定 factcheck.passed ✅
- 命中时页面展示 amber alert(不阻塞,继续跳 Editor)
- Article.compliance.factCheckWarning 带到 Editor 合规清单

### 🔴 Dashboard 集成
- articleStore.drafts 通过 useMemo 与 seed 合并 ✅
- 新生成的草稿按 updatedAt 排序排到列表最前 ✅
- 列表刷新后保留(localStorage) ✅
- 避免 `getServerSnapshot should be cached` 警告:selector 返回稳定的 drafts map,排序在 useMemo 中完成 ✅

### 🟡 并发 429
- Qwen 返回 429 → QwenRateLimitError(lib 层已实现) → UI 走 fatalError
- P1:指数退避重试(未实现)

### 🔴 API 合约
- POST /api/generate 输入 { productId, angleId?, customAngle?, styleId },输出 SSE:
  - `{type:"stage",stage,status:"running"|"done"|"failed",elapsedMs?,data?}`
  - `{type:"body-delta",delta:"..."}`
  - `{type:"result",result:{outline,body,titles,covers,factcheck}}`
  - `data: [DONE]`
  - 错误以 `{type:"error",error:{name,message}}` 上行

---

## Editor 主区 + 副驾驶 (Phase 4+5) · ✅ 已实施并通过

### 🔴 TipTap 主区
- 刷新 Editor 页,内容保留(localStorage) ✅
- 切换 5 个候选标题 → 主标题替换(pill active-ring) ✅
- 切换 4 张候选封面 → 选中态变(蓝边 + 勾标) ✅
- "+ 再生成"标题 → 调 /api/titles 返回新 5 条
- 自动保存 1.5s 节流:改完停手 1.5s 后 store 更新,顶栏显示"X 秒前已保存"
- h1/h2/h3/p/ul/ol/blockquote 样式在 `.joto-editor .ProseMirror` 下手写(无 `@tailwindcss/typography` 依赖) ✅

### 🔴 合规高亮(ProseMirror 装饰,非 mark)
- 输入默认极限词("最""最好""最佳""国家级""顶级"…)后,出现**红底 + 实下划线** ✅
- 输入敏感话题关键词(如"政策解读")后,出现**黄底 + 虚下划线** ✅
- 编辑文本后 decoration 自动清空,由调用方重新扫描(tr.docChanged 时 plugin state 归零)
- 导出 HTML 不携带合规装饰(纯 decoration,不入 doc) ✅
- 子字符串匹配:"第一" 会命中 "第一季度" 字符串 —— 已知 false positive,MVP 接受 ✅

### 🔴 中文 IME 兼容
- TipTap 监听 compositionstart/end,composition 期间不触发 `onUpdate` 下游
- compositionend 后 queueMicrotask 触发一次 save + scan(**未在 puppeteer 下端到端测过,需要真机验证**)
- 自动保存 + 合规扫描都走 `onUpdate`,composition 中直接 return

### 🔴 段落浮层(BubbleMenu)
- 选中段落(≥2 字) → 浮层在段落上方出现(5 个 intent:重写/扩写/缩写/更口语/加数据) ✅
- 点击任一 → /api/humanize 流式替换选中范围(先 deleteSelection,再按 chunk `insertContentAt`)✅
- 流式替换期间每个 chunk 后把 selection 移到插入点之后,避免光标视觉上漂回开头 ✅
- **Undo 改用 TipTap (ProseMirror) 内置 history,不自建 ring buffer** —— 按 ctrl/cmd+Z 能一步撤回整个 humanize + 一步撤回每次 chunk 插入
  - Plan v1 提过手写 20 步 ring buffer,代码审查阶段评估风险太高(position mapping、selection、IME 都要重写),**决定放弃,使用 PM history depth=100**

### 🔴 AI 浓度(seeded by articleId)
- 初始检测:按 `${articleId}:fresh` 做 FNV-1a + mulberry32 PRNG,返回 28-45 的**确定性**分数 ✅
- 同一文章反复点"重新检测",分数永远一样 ✅(单测 + 浏览器都验过)
- 点"再去一轮" → 全文 humanize + 调 /api/ai-score `afterHumanize:true, iteration:n`,按 `${articleId}:humanize:${n}` seeded 5-10 点下降 ✅
- aria-label 含"AI 浓度 X 分,<label>",供屏幕阅读器
- UI 小字注明"演示数据:真实朱雀 API 接入前,分数按 articleId 种子稳定复现"(避免误导 stakeholder)

### 🔴 合规清单
- 5 项状态:AI 浓度(<40 绿/<70 amber/>70 红)/ 极限词(任一命中红)/ 敏感话题(任一命中 amber)/ 封面选中(warn if no)/ 事实核查(warn if !passed) ✅
- 汇总 "X / 5 通过" 数字 ✅
- 空文本 / 扫描中显示 pending 状态

### 🔴 全局调整
- 文本框 + 执行按钮,调 /api/humanize 覆盖全文(from=0, to=doc.content.size) ✅
- 删除了 plan v1 里的"换说法"按钮(与"执行"语义重复)

### 🟡 Readonly 模式
- `?readonly=1` 时 TipTap `editable:false`,所有 mutate 按钮 disabled

### 🔴 Editor 初始化时序
- `useEditor({immediatelyRender:false})` 异步创建,第一次渲染时 `editorRef.current.getText()` 是空串
- **修复**:mount 后轮询最多 10 次(每 100ms),直到 `getText()` 非空再跑首次合规扫描(否则 UI 永远显示"未命中")

---

## Review 发布 + HTML 导出 (Phase 6) · ✅ 已实施并通过

### 🔴 账号选择
- 2×2 账号卡(name + type badge + audience + tonality + 平均阅读),单选 ✅
- 选中后发布按钮文案变"确认发布到 XX 账号" ✅
- 未选时按钮文案是"选择账号后发布",disabled ✅

### 🔴 合规清单(/review 页重新扫描,不读老的 article.compliance)
- 发布前现场 `scanLimitWords(plainText) + scanSensitive(plainText)` ✅
- plainText 从 `article.contentHtml` 剥标签得到
- 命中极限词 → 右侧 panel 显示红色"极限词清洁 命中 X 个" + "先处理极限词"红色返回按钮 ✅
- **plainText 不包含 title,所以改了 title 不重扫** —— 如果担心 title 里的极限词漏检,后续在 Phase 7 加进去

### 🔴 确认声明
- [必勾] 对真实性负责 → 未勾时发布 disabled ✅
- [可选] 添加 AIGC 显式声明 → 勾选后 exportWechatHtml 文末追加 `<p class="joto-ai-notice">` ✅

### 🔴 勾选动作审计(PRD 6.1.7)
- 发布时写入 `article.reviewAudit.push({actorName, agreedAt, addedAigcNotice, accountId})` ✅
- 同时把 `article.aigcMetadata` 更新为真实发布时的 metadata(articleId + humanReviewed:true + publishedAt + accountId)
- **readonly 视图**(`/editor/<id>?readonly=1`)右侧 sidebar 多一张绿色审计卡,显示每条审计记录 ✅(浏览器验过)

### 🔴 发布流程
- 点发布 → `patch + setStatus("published")` → sonner toast "已发布到 XX" ✅
- 1.8s 后 router.push("/") 回 Dashboard ✅
- Dashboard 列表新文章按 updatedAt 排最前,状态 "已发布" ✅
- 已发布 KPI 数值自动 +1 ✅(浏览器验过 4 → 5)

### 🔴 HTML 微信导出(PRD 6.3.7)
- `exportWechatHtml()` 三个按钮:复制 HTML / 下载 .html / 预览 ✅
- 样式全部内联:`<style>` 标签被 juice 移除,所有元素带 `style=""` 属性 ✅
- **复制使用 `ClipboardItem` + text/html MIME**,不是 writeText —— 粘到微信公众号后台能保留格式(plan review 自 flag 的改进,已落实)
- 下载 `.html` 走 Blob + URL.createObjectURL,文件名 = article.title ✅
- 预览走 `<iframe srcDoc={html} sandbox="">`,站内模态框,浏览器直开样式完整 ✅(浏览器验过)
- `<head>` 有 `<meta name="AIGC" content="{...}">`,content 是 JSON 化 + HTML-escape 过的 AIGC metadata ✅
- 图片 URL 保留(mock 里是 data URL,真实部署时 Phase 7+ 要替换为公众号 CDN) ✅
- 封面作为 `<img class="joto-cover">` 放 `<h1>` 上方 ✅
- 作者 + 发布日期以 `.joto-byline` 样式放 `<h1>` 下方 ✅
- cover URL 做 attribute-escape 防 `"onerror=...` 注入(单测覆盖) ✅

### 🟡 Export 边界 case
- 无 cover / 无 author / 无 date 时相应节点不渲染(单测覆盖) ✅
- title 含 `<script>` 标签要 escape(单测覆盖) ✅

---

## Phase 7 · 打磨 · ✅ 已实施并通过

### 🔴 骨架屏
- Dashboard 未 hydrate 时:`ArticleListSkeleton`(header + 6 filter chips + 5 article rows 的 shimmer),不再显示"加载中…"文案 ✅
- Editor 未 hydrate 时:`EditorSkeleton`(title candidates + 4 cover boxes + 标题 + 正文 8 行 + 3 侧边卡片),整体布局与最终编辑器一致 ✅
- 两个 skeleton 都有 `aria-busy="true"`,供屏幕阅读器跳过

### 🔴 预览模态框 a11y
- Esc 键关闭 ✅(浏览器验过)
- 打开时焦点自动落到关闭按钮 ✅
- 关闭时焦点回到触发按钮(`trigger.focus()` 在 cleanup 里)
- Tab / Shift+Tab 在模态内循环(focus trap,查找 `button:not([disabled]), a[href], [tabindex]` 等)
- 打开时 `document.body.style.overflow = 'hidden'` 锁背景滚动,关闭时恢复 ✅
- 外部点击关闭(`onClick={onClose}` 在 backdrop)

### 🔴 空状态
- Dashboard 文章列表:无数据时显示 Inbox 图标 + "还没有文章,点 + 新建文章开始"
- 按状态筛选无结果:显示"没有符合筛选条件的文章"+ 筛选提示
- 搜索无结果:显示搜索词

### 🔴 性能
- **`npm run build` 全绿**,14 个路由全部预渲染或 dynamic 正常 ✅
- **Dashboard First Load JS = 122 kB**(<200 kB 目标,PRD 7.3) ✅
- Editor First Load JS = 248 kB(TipTap 不可避免)
- Review First Load JS = 303 kB(juice + TipTap + export 链路)

### 🔴 单元测试 coverage
- 15 test files, **125 tests** 全绿 ✅
- articleStore 从 0 覆盖到 12 个 case:createDraft / patch 时间戳 / setStatus publishedAt 逻辑 / rollback 边界 / seed override / listAll 排序
- wechatHtml 新增 4 个 case:cover URL 注入防护 / byline 渲染 / 无 byline 不渲染
- lib 层 coverage 保持 ≥ 94%

### 🔴 文档
- `docs/NEXT_STEPS.md` — P0/P1/P2/P3 优先级罗列所有 MVP 未做项目,含密钥泄露复盘提醒

---

## 跨阶段 / 通用

### 🔴 路由保护
- 直接访问 `/editor/不存在的ID` → 展示"文章不存在" + 回 Dashboard 按钮 ✅
- 直接访问 `/review/不存在的ID` → 同样处理 ✅
- 直接访问 `/wizard/generating` 不经过前三步 → 显示"缺少前置选项" + 回 Step 1 按钮 ✅

### 🟡 a11y
- 键盘可达性:Tab 能走完所有交互(focus trap 在 Preview 模态)✅
- Esc 关闭模态 ✅
- 色盲友好:三色条不只靠颜色(数字 + ✓ ! ⚠ 符号)✅
- `aria-live` 读出异步完成事件(生成中、保存指示器)✅
- 按钮都有 `aria-label`,图标都有 `aria-hidden`

### 🟡 性能
- Dashboard First Load JS 122 kB(PRD 7.3 target 200 kB) ✅
- Lighthouse 仍未跑(P2 · CI integration 未做,见 NEXT_STEPS.md #22)

---

## 已知 bug 历史(修复后归档)

> 格式:`[YYYY-MM-DD] 场景描述 — 根因 — 修复 commit 或 PR`

- **[2026-04-17] Dashboard 500 错误 (Unexpected end of JSON input)**
  - 根因:`src/data/styles.json` 和 `src/data/angles.json` 的中文字符串里直接用了 ASCII 双引号 `"` 作强调,破坏 JSON 语法
  - 修复:改用中文书名号「」作强调;同时加 `src/__tests__/data-integrity.test.ts` 做回归测试,CI 里会 `JSON.parse` 所有 `src/data/*.json`,再验证文章引用的产品/角度/风格/账号 id 都存在
  - 吸取:**任何新 JSON seed 文件必须跑 data-integrity 测试**;强调用 `「」` 不用 `""`

- **[2026-04-17] /wizard/generating 页面 useEffect 没能触发 fetch (React Strict Mode)**
  - 现象:打开生成页,5 个阶段全部 pending,localStorage 里 articleStore 有 draft 但 server 日志没有 POST /api/generate
  - 根因:Next.js 15 默认 reactStrictMode=true,开发模式下 useEffect 双触发 → 第一次 fetch 刚 kick off,cleanup 已触发 abort,第二次 effect 看见 startedRef=true 直接 return,最终没有任何 pipeline 跑起来
  - 修复:
    1. `next.config.ts` 设 `reactStrictMode: false`(这是 Next 明确支持的配置项,不是 hack;生产行为本来就是单次执行,dev 对齐更直观)
    2. articleStore 增加 `rollbackIncompleteDraft`,如果 useEffect 真的触发 unmount 则把没写入内容的 draft 清掉
  - 吸取:**涉及 LLM / expensive 网络副作用的 useEffect,在 Next.js 15 项目里建议 reactStrictMode=false**;"只在一个 case 失效,其他场景都好"的补丁是 workaround,要从配置/模块层面彻底消化

- **[2026-04-18] Editor 首次渲染合规扫描拿不到文本**
  - 现象:打开 Editor 页,合规清单显示"未命中广告法极限词",但正文里明明有"国家级""最好"
  - 根因:`useEditor({immediatelyRender:false})` 异步初始化,组件首次 useEffect 时 `editorRef.current.getText()` 返回空
  - 修复:mount 后轮询 10 次 × 100ms,直到 `getText()` 非空再跑扫描
  - 吸取:**TipTap + SSR-safe 配置下,editor 不会在 mount 的 useEffect 里就绪**,所有依赖 editor 内容的初始化要轮询或订阅 editor onCreate

- **[2026-04-18] `prose` 样式类无效,h2/h3 渲染为正文**
  - 现象:Editor 里粘贴的 `<h2>核心机制</h2>` 在屏幕上与普通段落视觉无差别
  - 根因:`@tailwindcss/typography` 插件没装,但代码里用了 `prose prose-slate prose-h2:text-xl` 等类名 —— Tailwind 没有这些 utility 时整块 class 沉默失效
  - 修复:不装 typography 插件,在 `globals.css` 里为 `.joto-editor .ProseMirror h1/h2/h3/p/ul/ol/blockquote` 手写样式
  - 吸取:**用 prose-* 变体前先确认 typography 插件已装**;或者像本项目一样用 scoped CSS 自持样式,避免引入一整个 plugin

- **[2026-04-17] Wizard router.push / Link 在 dev 模式下不导航 (RSC 500 循环)**
  - 现象:/wizard/product 页面用 useRouter().push("/wizard/angle") 或 `<Link>` 都卡住,URL 不变;server 日志间歇出现 "SyntaxError: Unexpected end of JSON input, page: '/wizard/product'",客户端拿到 500 on `?_rsc=...`
  - 根因:**Next.js 15.5.15 webpack dev server 的 RSC prefetch 间歇性 JSON 解析错误**,不是业务代码 bug。production build 下完全正常,turbopack dev 下也正常
  - 修复:
    1. `package.json` 里 `"dev": "next dev --turbopack"` 启用 turbopack
    2. 同时把 `useRouter` + onClick 全部改成 `<Link href>`(更 idiomatic,两种都能在 turbopack 下工作)
  - 吸取:**dev 模式优先用 turbopack**;用 `<Link>` 做导航比 `useRouter().push` 更稳;遇到"点击按钮页面不响应但 server 无明显错误"时先看是不是 RSC prefetch 失败

---

## 维护说明

- **加场景时**:放到对应模块,标优先级(🔴🟡🟢)
- **已过时的场景**:不要删,移到"已知 bug 历史"做归档
- **发现新模块**:在本文件增加对应章节
- **每个 phase 结束**:review 一遍该 phase 场景是否都已覆盖并通过
