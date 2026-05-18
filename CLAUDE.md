# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Turbopack dev server (port 3000) |
| `npm run build` | Production build |
| `npm run lint` | ESLint (flat config, `eslint.config.mjs`) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Vitest single run |
| `npm run test:watch` | Vitest watch mode |
| `npm run ci` | **typecheck + lint + test** — run after every phase |

Single test file: `npx vitest run src/__tests__/qwen.test.ts`
Filter by name: `npx vitest run -t "renderTemplate"`

Environment setup: `cp .env.example .env.local` then fill in keys.

## Environment Variables

| Variable | Required | Purpose |
|---|---|---|
| `DASHSCOPE_API_KEY` | Yes | Qwen (通义千问) API key via DashScope |
| `WECHAT_APPID` | For push | WeChat Official Account app ID |
| `WECHAT_APPSECRET` | For push | WeChat Official Account secret |
| `AI_SCORE_PROVIDER` | No | `heuristic` (default) · `mock` · `zhuque` |

## Architecture

**Three-phase user flow**: Wizard (4 screens) → Editor (TipTap + AI copilot) → Review (compliance + WeChat export/push)

**Data flow**: Zustand persist stores (localStorage/sessionStorage) + Next.js Route Handlers with SSE streaming to Qwen.

### Layer Map

- **`src/app/`** — Next.js 15 App Router (React 19)
  - `wizard/{product,angle,style,generating}` — multi-select angles × styles → batch generation
  - `editor/[id]/` — TipTap rich text + humanize copilot sidebar
  - `review/[id]/` — compliance checklist + theme picker + HTML export + WeChat draft push
  - `api/` — Route Handlers (generate, humanize, humanize/once, titles, compliance, ai-score, wechat/push-draft, spike)
- **`src/lib/`** — Pure business logic (UI-free, unit-testable)
- **`src/store/`** — Zustand persist stores (`articleStore`, `wizardStore`)
- **`src/data/`** — Static seed JSON (products, angles, styles, accounts, articles)
- **`src/__tests__/`** — All Vitest tests (23 files, jsdom environment)

### Pipeline System (`src/lib/prompts.ts`)

LLM calls are organized as 5 pipeline nodes, each with hardcoded `model`, `temperature`, `maxTokens`, `system`, `user` templates:

```
outline (qwen-plus/0.8) → body (qwen-plus/0.9) → titles (qwen-plus/1.1) → covers (mock) → factcheck (qwen-max/0.3)
```

Plus a standalone `humanize` node used by the editor copilot.

**Critical rule**: All Qwen calls must go through `renderPrompt(node, vars)` → `completeChat()` / `streamChat()`. Never hand-craft prompts in route handlers. New nodes must be registered in `prompts.ts` and tested in `prompts.test.ts`.

The `humanize` node has per-articleType branch blocks (`HUMANIZE_BRANCH_BLOCKS`) injected via the `{articleTypeBlock}` placeholder. ArticleType is inferred from angle data, not user input (`inferArticleType()` in `articleType.ts`).

### Batch Generation (`/wizard/generating`)

The generating page computes the cartesian product of `angleIds × styleIds`, then runs up to 3 pipelines concurrently (semaphore pattern). Each pipeline calls `POST /api/generate` as an independent SSE stream. Failed jobs don't block others.

### WeChat Export Pipeline

```
wechatDecorate.ts (10 decoration passes) → wechatHtml.ts (build full HTML) → juice (inline all CSS) → output
```

The decoration system runs in this order: headings → subtitles → strong highlights → emojis → callouts → blockquotes → paragraphs → numbers → colon-prefixes → dividers → (optional) image placeholders.

Three themes: `minimal` (gray, CSS-only), `polished` (blue gradient banners), `vibrant` (orange gradient banners). Themes are defined in `wechatThemes.ts` with `ThemePalette` objects used by both CSS and inline-styled HTML generation.

**WeChat compatibility constraints**: WeChat strips `<style>` blocks (juice inlines everything), `::before/::after`, `@keyframes`, `animation`, `transition`, `position: fixed/sticky`. WeChat does support inline `linear-gradient`, `border-radius`, `table/table-cell` display. `isThemeSafe()` validates themes against a forbidden-tokens list.

### WeChat Draft Push

`wechatDraft.ts` handles `access_token` caching (90-min TTL) via the stable_token endpoint, then POSTs to `draft/add`. On token-expired errors (40001/42001), cache auto-clears for retry. The `/api/wechat/push-draft` route renders HTML with the selected theme, then pushes. Article appears in the MP backend 草稿箱 for manual publish (zero ban risk).

### SSE Streaming

Route handlers use `ReadableStream<Uint8Array>` + `TextEncoder` for SSE. Client-side parsing: `streamSseDeltas()` from `sseClient.ts` (editor copilot) or inline `getReader()` loop (generating page). All streaming routes must include four headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`, `X-Accel-Buffering: no`, and export `const runtime = "nodejs"`.

### Zustand + SSR

Both stores use `persist + createJSONStorage` with `"use client"`. **Never read stores during SSR** — access only inside `useEffect` or client components to avoid hydration mismatch. `articleStore.listAll()` merges static seed JSON with in-memory drafts (drafts shadow seeds by ID).

### Seeded Determinism

`src/lib/seed.ts` provides FNV-1a + Mulberry32 PRNG seeded by `articleId`. Used by mock AI-score and mock factcheck so demo data reproduces across reloads. Use `seededInt()` / `seededBool()` for any new mock data.

## Key Conventions

- `reactStrictMode: false` in `next.config.ts` — intentional, do not change. Strict mode double-invokes effects, which would burn LLM tokens and leak draft articles during generation.
- Seed JSON files (`src/data/*.json`) are static imports for demo baseline — never mutate at runtime.
- `wizardStore` uses schema versioning (currently v3) with `migrate` function for backward compat. Bump version and add migration when changing store shape.
- `articleStore` key is `joto-articles-v1` in localStorage; `wizardStore` key is `joto-wizard-v1` in sessionStorage.

## Work Rhythm

- **Work in phases**: complete one phase → run `npm run ci` + browser verify → show user screenshots → wait for OK before next phase.
- **Don't merge phases** or do extra unrequested work.
- **Each phase start**: use TodoWrite to list subtasks.
- **Each phase end**: browser screenshot + self-test report.
- Every bug fix must be a **root-cause fix with a general solution**, not a workaround. If a root fix isn't possible this session, explicitly tell the user and propose a follow-up plan.
- After any change, **browser-test** via Playwright or Puppeteer MCP (auto-fallback between them). Never declare "done" based on unit tests alone.

## Browser MCP Fallback

Try in order, auto-advance on failure — **don't stop to report "browser is broken"**:

1. `mcp__playwright__browser_navigate`
2. If Playwright fails → `mcp__puppeteer__puppeteer_navigate`
3. If both fail → kill Chrome processes, clear temp files, retry step 1
4. Only report to user after all attempts fail
