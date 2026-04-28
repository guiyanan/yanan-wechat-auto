# JOTO 内容工厂

企业级合规 AI 公众号内容生产平台的 MVP 前端原型。

## 技术栈

Next.js 15 · React 19 · TypeScript · Tailwind CSS v4 · TipTap · Zustand · 通义千问 (DashScope)

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.example .env.local
# 编辑 .env.local 填入你的 DashScope API Key

# 3. 启动开发服务器
npm run dev
```

打开 http://localhost:3000。

## 可用脚本

| 命令 | 说明 |
|---|---|
| `npm run dev` | 启动开发服务器（默认 3000 端口） |
| `npm run build` | 生产构建 |
| `npm run start` | 启动生产服务器 |
| `npm run lint` | ESLint 检查 |
| `npm run typecheck` | TypeScript 类型检查 |
| `npm run test` | 跑一次单测 |
| `npm run test:watch` | 监听模式单测 |
| `npm run ci` | 完整 CI 检查（typecheck + lint + test） |

## 目录结构

```
src/
├── app/               # Next.js App Router 页面
│   ├── api/           # Route Handlers（LLM 调用、合规扫描）
│   ├── wizard/        # 产品→角度→风格→生成 四屏
│   ├── editor/[id]/   # 编辑器（TipTap + 副驾驶）
│   └── review/[id]/   # 审核与发布
├── components/        # UI 组件
├── data/              # 种子 JSON（产品、角度、风格、账号、历史文章）
├── i18n/              # 文案
├── lib/               # Qwen 封装、极限词扫描、AIGC 元数据、HTML 导出
├── store/             # Zustand store
└── types/             # TypeScript 类型
```

## 环境变量

见 `.env.example`。

### ⚠️ API Key 安全提示

`.env.local` 已被 `.gitignore` 屏蔽，**绝不要把 key 提交到代码仓库**。

如果你的 key 曾通过聊天、截图等方式**泄露**，请立即到
[阿里云 DashScope 控制台](https://dashscope.console.aliyun.com/apiKey) 吊销并签发新 key。

## 开发进度

目前完成：
- ✅ **Phase 0** 脚手架 + 种子数据 + 基础布局 + CI 脚本

待办：
- ⏳ Phase 0.5 Qwen + SSE 连通 spike
- ⏳ Phase 1 Dashboard
- ⏳ Phase 2 Wizard Step 1-3
- ⏳ Phase 3 生成中页 + Qwen 接入
- ⏳ Phase 4+5 Editor 全栈
- ⏳ Phase 6 Review + HTML 导出
- ⏳ Phase 7 打磨 + e2e

详细计划见 `/Users/tommy/.claude/plans/hello-vivid-puppy.md`。

## 产品文档

见 `/Users/tommy/Downloads/joto_prd_v1_2.md`（PRD v1.2）。
