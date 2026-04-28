# JOTO 内容工厂 · 后续工作清单

本文档记录本次会话(Phase 0-7)**没有实施**但已在 PRD v1.2 中承诺的功能。推进顺序按业务价值 + 技术依赖排列。

---

## P0 · 上线前 blocker(必须补)

### 1. Qwen API key per-tenant
- **现状:** 单一 `DASHSCOPE_API_KEY` 写在 `.env.local`,所有租户共享
- **做法:** `accounts/organizations` 表加密存 key;Route Handler 从 JWT 取 org_id → 查库 → 用对应 client;加 `lib/qwen-registry.ts` 做缓存
- **风险:** 没做这步就给客户 = 客户 A 的调用计入客户 B 的配额

### 2. 指数退避 / 配额监控
- **现状:** `QwenRateLimitError` 只是向 UI 报错
- **做法:** lib/qwen.ts 里实现 429 retry(最多 3 次,100ms × 2^n jitter);给每个 key 记每日用量,超 80% 告警
- **依赖:** P0 #1(per-tenant key)

### 3. 图片上传到公众号 CDN
- **现状:** 封面 / 文中图走 data-URL 或 mock URL,微信公众号后台会把外链剥掉
- **做法:** 提供"一键上传图片到公众号素材库"按钮 → 调微信 `uploadimg` API 换回微信域 URL → 替换 HTML 里的 src
- **阻塞项:** 需要企业微信号绑定 + OAuth(产品和客户谈)

### 4. 密钥泄露复盘
- 本次会话早期用户贴出的 `sk-00ab...` Qwen key **已视为泄露**
- 上线前必须在 DashScope 控制台 revoke + 签发新 key
- 新 key 只写 `.env.local`(gitignore 已屏蔽),代码中只通过 `process.env.DASHSCOPE_API_KEY` 读

---

## P1 · 真实服务接入(替换 mock)

### 5. 朱雀 AI 检测真实接入
- **现状:** `/api/ai-score` 是 articleId seeded 的确定性 mock(28-45)
- **做法:** 替换为朱雀真实 API;先加 feature flag `AI_SCORE_PROVIDER=mock|zhuque` 灰度
- **验收:** 真 API 分布落在 28-95,相同文本 5 分钟内一致(朱雀实际有 cache)

### 6. 豆包即梦 / DALL-E 封面图
- **现状:** `mockCovers.ts` 返回 4 张 SVG data URL
- **做法:** `/api/cover-gen` 调文生图 API,4 张 16:9 候选,超时 30s
- **留意:** 即梦国内合规,DALL-E 海外走 OpenAI — 按租户地域选

### 7. RAG (RAGFlow / Milvus + BGE-M3)
- **现状:** 产品知识库只有 `products.json` 里的 `description` 字段
- **做法:**
  - 文档 ingest pipeline(PDF/docx/Notion export → 切片 → BGE-M3 嵌入 → Milvus)
  - `/api/generate` 的 outline 阶段:先 retrieve top-5 段落 → 拼入 prompt
  - 每篇生成记录 citation,Editor 里可点出处
- **依赖:** 需要 Python 后端(`api-python/` 新建)

---

## P1 · 编辑器 / 审核能力扩展

### 8. 用户级"我的角度"(PRD 6.1.3)
- **现状:** 10 个预置角度 + 自定义一次性角度,没持久化
- **做法:** 自定义角度 → 勾选"保存到我的角度库" → 写 user_angles 表;Wizard Step 2 多一列"我的"

### 9. 审核状态机持久化
- **现状:** 状态只在 localStorage,没有 pending_review → in_review → approved/rejected 流程
- **做法:**
  - 后端加 audit_logs 表(article_id, from_status, to_status, actor, comment, at)
  - `/review` 发布后若开启"需审核",先进 pending_review
  - 管理员后台给审核员"通过/打回"操作

### 10. 多租户 RBAC + 席位计费
- **现状:** 所有用户看同样的文章 seed
- **做法:**
  - organizations / users / memberships 表
  - JWT 携带 org_id + role(owner/admin/editor/reviewer)
  - 每月出账:按 seats × 单价 + Qwen 实际 token 用量

---

## P2 · 管理员后台(PRD 6.2 九个模块)

11. 产品库管理 — CRUD + 知识库文件上传
12. 角度库管理 — 全局预置 + 租户私有
13. 风格库管理 — 示例段落编辑 + 范文训练触发
14. 账号绑定 — 公众号 OAuth + token 刷新
15. 成员 / 权限
16. 用量报表 — Qwen token / 生成次数 / 发布次数
17. 模板 / 系统提示词 — 让租户按行业调优 outline prompt
18. 审核队列 — 待审 / 已处理 / 我创建的
19. 审计日志 — 所有关键动作可导出 CSV

---

## P2 · 工程 / 运维

### 20. 单元测试覆盖率提升到 80% 整体
- **现状:** lib 层 94%,整体 ~60%(UI 未测)
- **做法:** 用 @testing-library/react + jsdom 测关键 UI(Dashboard / Wizard / Editor 交互路径)
- **原则:** 不测样式,只测状态机和回调

### 21. E2E suite
- **现状:** Puppeteer 手动跑一遍,无 CI
- **做法:** Playwright test + GitHub Actions(headless chromium,每 PR 跑一次)
- **必测:** Dashboard → Wizard → Generating(mock Qwen)→ Editor → Review → Publish → Dashboard

### 22. Lighthouse CI + bundle analyzer
- **PRD 7.3 要求:** Dashboard ≤ 2s
- **做法:** `next build` 后跑 `lighthouse-ci` autorun,阈值失败阻塞合并
- **当前估算:** First Load JS ~280-350KB(TipTap + shadcn 已比 plan 里的 200KB 目标高)

### 23. 错误监控
- Sentry 或 Plausible,至少跑生产的 JS error + 关键 API 错误
- Qwen auth / rate-limit 错误要能报警(避免客户敲边鼓)

### 24. SSR / Edge Runtime 审查
- 所有 Route Handler 现在都 `runtime = "nodejs"`(OpenAI SDK 要求)
- 静态页要不要搬 Edge 需实测 TTFB 收益

---

## P3 · 已知 tech debt

### 25. 子字符串极限词匹配 false positive
- "第一季度" → 命中"第一"
- **做法:** 词典加 variant_boundaries 字段,"第一" 要求左右非中文数字;改完补回归测试

### 26. 中文 IME 端到端验证
- 当前只有单元逻辑(composition 期间跳过 save/scan),没真人打字测试
- 上线前在 macOS + Windows 各一次手动拼音打字 → 无乱保存、无乱扫描

### 27. 封面上传 / 自定义封面
- UI 已经有"+ 再生成"位置,但没自选图片上传入口
- 加 `<input type="file">` → Blob → FileReader → 直接走覆盖候选

### 28. 文章多版本 / Diff 视图
- 每次 humanize / 编辑后存一个 snapshot(articleId + version + HTML + at)
- Editor 顶部按钮"查看修改历史"弹出左右 diff
- 存储上需加 article_versions 表,不塞 localStorage

---

## 非目标(MVP 内明确不做)

- 多语言 UI(目前只 zh-CN,i18n key 已抽但未接 runtime)
- 私有部署版(Docker compose / K8s helm)
- 手机端 responsive(只保证 1280+ 桌面)
- WYSIWYG 所见即所得的微信预览(当前是 iframe srcDoc 近似)
- 团队协作实时光标
