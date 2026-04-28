# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# JOTO 内容工厂 · Claude 工作守则

本文件定义 Claude 在这个仓库里的核心工作原则。每次新会话都会自动加载，必须严格遵守。

---

## Core Principles

### 1. Fix from the root, not workarounds

每一次 bug 修复和新功能都必须**从根因入手**，给出**通用解**。

- ❌ 临时补丁、hack、特判、workaround **一律会被拒绝并重做**
- ❌ "只对这一个 case 生效,但覆盖不了其他场景"的修法**不算真修**
- ✅ 定位根因 → 设计普适解 → 验证覆盖了所有相关场景

如果不能在当前会话里做根因修复（比如受限于外部服务），必须**显式告知用户**并提出后续根治方案,不可以默默留一个补丁。

### 2. Browser-test everything after changes

任何新功能或 bug 修复后,**必须打开浏览器**(Playwright 或 Puppeteer MCP)做视觉验证,模拟真实用户操作。

- ❌ 只用 `curl` / API 测 —— 会漏掉渲染 bug、JS 错误、UX 问题
- ❌ 只跑 `npm run build` / 单测就宣布"完成"
- ✅ 打开浏览器 → 走一遍用户操作 → 截图为证 → 控制台无报错

浏览器 MCP 出问题时**自动切换**,**不要停下来汇报"浏览器坏了"**(详见下方 Fallback Order)。

### 3. All tests go into tomitest

开发或测试过程中发现的任何**新测试场景**,必须加到 `tomitest` skill 里(项目级):

```
.claude/skills/tomitest/SKILL.md
```

- 包含这个项目已知的所有关键测试路径、边界 case、回归场景
- 每次新会话自动读取,保证测试覆盖持续增长
- 不要依赖会话记忆——场景一旦发现必须落盘到 tomitest

---

## Browser MCP Fallback Order

按顺序尝试,任何一步失败自动进入下一步,**不要停下来问用户**:

1. `mcp__playwright__browser_navigate` — 首选
2. 若 Playwright 失败(closed / stuck PID / GPU error):切到 `mcp__puppeteer__puppeteer_navigate`
3. 若两者都失败:执行清理
   ```bash
   pkill -9 -f Chrome
   rm -rf /tmp/.com.google.Chrome.* /tmp/.org.chromium.* 2>/dev/null
   ```
   然后重试 step 1
4. 仅在所有尝试都失败后,向用户汇报具体错误信息

---

## Commands

| 命令 | 用途 |
|---|---|
| `npm run dev` | Turbopack 开发服务器 (默认 3000) |
| `npm run build` | 生产构建 |
| `npm run start` | 启动生产服务器 |
| `npm run lint` | ESLint (flat config, `eslint.config.mjs`) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Vitest 一次性跑完 |
| `npm run test:watch` | Vitest watch 模式 |
| `npm run ci` | typecheck + lint + test (phase 收尾必跑) |

**跑单个测试文件**:`npx vitest run src/__tests__/qwen.test.ts`
**按用例名过滤**:`npx vitest run -t "renderTemplate"`

环境配置:`cp .env.example .env.local`,填入 `DASHSCOPE_API_KEY`。代码中只读 `process.env.DASHSCOPE_API_KEY`。

---

## Architecture (big picture)

四屏 Wizard → 编辑器 → 审核三段流水线,数据流靠 **Zustand persist + Next.js Route Handlers (SSE)**。

### Layered structure

- `src/app/` — Next.js 15 App Router (React 19)
  - `wizard/{product,angle,style,generating}` — 四步生成流程
  - `editor/[id]/` — TipTap 富文本 + 副驾驶
  - `review/[id]/` — 合规检查 + HTML 导出
  - `api/{generate,humanize,titles,compliance,ai-score,spike}/route.ts` — Route Handlers,流式调用 Qwen
- `src/lib/` — **核心业务逻辑层 (UI 无关,可单测)**
  - `qwen.ts` — DashScope OpenAI-compatible 客户端封装,自定义错误类(`QwenAuthError` / `QwenRateLimitError` / `QwenTimeoutError`)
  - `prompts.ts` — 5 节点 pipeline 模板系统,每节点独立 model + temperature(`outline` qwen-plus/0.8 → `body` → `titles` qwen-plus/1.1 → `humanize` → `factcheck` qwen-max/0.3)
  - `limitWords.ts` — 47+ 极限词扫描(广告法合规)
  - `sensitiveTopics.ts` — 8 类敏感话题关键词扫描
  - `aigcMeta.ts` — AIGC 标识元数据生成
  - `wechatHtml.ts` — 微信公众号 HTML 导出(juice 内联样式)
  - `sseClient.ts` — 浏览器侧 SSE 解析
- `src/store/` — Zustand persist stores
  - `articleStore.ts` — 草稿/已发表文章 CRUD,含 `rollbackIfNotCompleted` 给生成中断使用
  - `wizardStore.ts` — wizard 四步选择(productId / angleId / customAngle / styleId)
- `src/data/` — 种子 JSON(产品库/角度库/风格库/账号库/历史文章)
- `src/__tests__/` — Vitest 单测,覆盖 lib 层所有纯函数和 store 行为

### Pipeline pattern (重要)

`prompts.ts` 把 LLM 调用拆成 5 个节点,每个节点的 model/temperature/maxTokens 写死在模板里。**不要在 Route Handler 里手搓 prompt**,所有 Qwen 调用都要走 `renderPrompt(node, vars)` → `qwenChat(...)` 这条链路。新增节点要先在 `prompts.ts` 注册并补 `prompts.test.ts`。

### SSR + Zustand 注意

两个 store 都开了 `persist + createJSONStorage`,文件头有 `"use client"`。SSR 阶段不能直接读 localStorage——所有调用方应该在 `useEffect` 或 client component 里使用,避免 hydration mismatch(参见 tomitest 的 Phase 0 场景)。

### Test scenario registry

所有已知测试场景集中在 `.claude/skills/tomitest/SKILL.md`,按 phase 分组,标 🔴 必测 / 🟡 应测 / 🟢 可测。**写新代码前先翻一遍对应 phase 的场景**。

---

## 项目上下文速查

- **PRD 源文档**:`/Users/tommy/Downloads/joto_prd_v1_2.md` (v1.2)
- **实施计划**:`/Users/tommy/.claude/plans/hello-vivid-puppy.md` (7 Phase,~14.5d)
- **技术栈**:Next.js 15 (Turbopack) · React 19 · TypeScript · Tailwind v4 · TipTap · Zustand · 通义千问 (DashScope, OpenAI 兼容)
- **API key**:写在 `.env.local` (gitignore),代码中仅 `process.env.DASHSCOPE_API_KEY`

---

## 工作节奏约定

- **按 phase 推进**:每个 phase 完成后先自测 (`npm run ci` + 浏览器),再给用户看截图,等用户 OK 再进下一个 phase
- **不要合并 phase**、不要"顺手再做一点"
- **每 phase 开头**:TodoWrite 列出该 phase 的子任务,每完成一个标 completed
- **每 phase 结尾**:浏览器截图 + 自测报告发给用户
