"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  FileText,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { useArticleStore } from "@/store/articleStore";
import { getAllAccounts, getAllProducts } from "@/lib/articles";
import type { Article, ReviewAuditEntry, WechatAccount } from "@/types";
import { AccountPicker } from "@/components/review/AccountPicker";
import { PreviewCard } from "@/components/review/PreviewCard";
import { ComplianceChecklist } from "@/components/editor/ComplianceChecklist";
import { ExportHtmlButton } from "@/components/review/ExportHtmlButton";
import { exportWechatHtml } from "@/lib/wechatHtml";
import { buildAigcMetadata } from "@/lib/aigcMeta";
import { scanLimitWords, uniqueMatchedWords } from "@/lib/limitWords";
import { scanSensitive, uniqueTopics } from "@/lib/sensitiveTopics";

export default function ReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [hydrated, setHydrated] = useState(false);
  const article = useArticleStore((s) => s.getById(id));

  useEffect(() => {
    setHydrated(true);
  }, []);

  if (!hydrated) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-sm text-slate-500">加载中…</div>
      </main>
    );
  }

  if (!article) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900">文章不存在</h1>
          <Link
            href="/"
            className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            回 Dashboard
          </Link>
        </div>
      </main>
    );
  }

  return <ReviewView article={article} />;
}

function ReviewView({ article }: { article: Article }) {
  const router = useRouter();
  const accounts = getAllAccounts();
  const products = getAllProducts();
  const product = products.find((p) => p.id === article.productId);
  const patch = useArticleStore((s) => s.patch);
  const setStatus = useArticleStore((s) => s.setStatus);

  const [selectedAccountId, setSelectedAccountId] = useState<string | undefined>(
    article.accountId
  );
  const [agreedResponsibility, setAgreedResponsibility] = useState(false);
  const [addAigcNotice, setAddAigcNotice] = useState(true);
  const [publishing, setPublishing] = useState(false);

  const account = useMemo<WechatAccount | null>(
    () => accounts.find((a) => a.id === selectedAccountId) ?? null,
    [accounts, selectedAccountId]
  );

  // Re-scan current content so Review shows fresh compliance state
  const plainText = useMemo(
    () =>
      article.contentHtml
        .replace(/<[^>]+>/g, "")
        .replace(/\s+/g, " ")
        .trim(),
    [article.contentHtml]
  );
  const limitWords = useMemo(
    () => uniqueMatchedWords(scanLimitWords(plainText)),
    [plainText]
  );
  const sensitiveList = useMemo(
    () => uniqueTopics(scanSensitive(plainText)),
    [plainText]
  );
  const coverSelected =
    !!article.coverImageUrl || article.coverCandidates.length > 0;

  const hasLimitWords = limitWords.length > 0;
  const canPublish =
    !!selectedAccountId &&
    agreedResponsibility &&
    !hasLimitWords &&
    !publishing;

  const exportedHtml = useMemo(
    () =>
      exportWechatHtml({
        title: article.title,
        bodyHtml: article.contentHtml,
        coverUrl: article.coverImageUrl ?? article.coverCandidates[0],
        author: article.createdBy,
        publishedAt: article.publishedAt ?? new Date().toISOString(),
        addExplicitNotice: addAigcNotice,
        meta: buildAigcMetadata({
          articleId: article.id,
          humanReviewed: true,
          generatedAt: article.createdAt,
        }),
      }),
    [article, addAigcNotice]
  );

  async function handlePublish() {
    if (!canPublish || !account) return;
    setPublishing(true);

    const auditEntry: ReviewAuditEntry = {
      actorName: article.createdBy,
      agreedAt: new Date().toISOString(),
      addedAigcNotice: addAigcNotice,
      accountId: account.id,
    };

    patch(article.id, {
      accountId: account.id,
      reviewAudit: [...article.reviewAudit, auditEntry],
      aigcMetadata: {
        ...buildAigcMetadata({
          articleId: article.id,
          humanReviewed: true,
          generatedAt: article.createdAt,
        }),
        publishedAt: new Date().toISOString(),
        accountId: account.id,
        addedExplicitNotice: addAigcNotice,
      },
      compliance: {
        ...article.compliance,
        limitWords,
        sensitiveTopics: sensitiveList,
        coverSelected,
        aigcMetaEmbedded: true,
      },
    });
    setStatus(article.id, "published");

    toast.success(`已发布到 ${account.name}`);
    setTimeout(() => router.push("/"), 1800);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-4 px-6">
          <Link
            href={`/editor/${article.id}`}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            返回编辑
          </Link>
          <span className="text-slate-300">·</span>
          <span className="text-xs text-slate-400">审核发布 · {article.id}</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 py-8">
        <div className="mb-8">
          <p className="text-xs font-medium text-blue-600">JOTO 内容工厂 · 审核发布</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
            {article.title || "(未命名)"}
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" aria-hidden="true" />
              {product?.name ?? "未知产品"}
            </span>
            <span>· 草稿状态</span>
            <span>· 作者 {article.createdBy}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-8 min-w-0">
            <Section step={1} title="选择发布账号" subtitle="选定后进入后续步骤">
              <AccountPicker
                accounts={accounts}
                selectedId={selectedAccountId}
                onSelect={setSelectedAccountId}
              />
            </Section>

            <Section
              step={2}
              title="预览"
              subtitle="微信公众号后台粘贴后的呈现效果"
            >
              <PreviewCard article={article} account={account} />
            </Section>

            <Section
              step={3}
              title="合规清单"
              subtitle="发布前请确认全部通过"
            >
              <ComplianceChecklist
                aiScore={article.aiScore.value}
                limitWords={limitWords}
                sensitiveTopics={sensitiveList}
                coverSelected={coverSelected}
                factCheckPassed={article.compliance.factCheckPassed}
                factCheckWarning={article.compliance.factCheckWarning}
                scanning={false}
              />
            </Section>

            <Section
              step={4}
              title="确认声明"
              subtitle="勾选动作会写入审计记录(PRD 6.1.7)"
            >
              <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    checked={agreedResponsibility}
                    onChange={(e) =>
                      setAgreedResponsibility(e.target.checked)
                    }
                    aria-label="我已完整阅读并对真实性负责"
                  />
                  <span className="text-sm text-slate-700">
                    <span className="font-medium text-red-600">[必勾]</span> 我已完整阅读这篇文章,并对其真实性、合规性、版权负责。如因本文引发问题,我愿承担相应责任。
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    checked={addAigcNotice}
                    onChange={(e) => setAddAigcNotice(e.target.checked)}
                    aria-label="添加显式 AIGC 声明"
                  />
                  <span className="text-sm text-slate-700">
                    <span className="font-medium text-slate-500">[可选]</span> 在文末添加「本文由 AI 辅助创作」显式声明(即使不勾选,HTML head 里仍会隐式埋入 AIGC meta)
                  </span>
                </label>
              </div>
            </Section>

            <Section
              step={5}
              title="导出 HTML(微信公众号后台用)"
              subtitle="样式已内联,粘贴后格式不丢。图片 URL 保留,后续需在 WeChat 后台手动替换为公众号 CDN。"
            >
              <ExportHtmlButton
                html={exportedHtml}
                filename={`${article.title || "joto-article"}.html`}
              />
            </Section>
          </div>

          {/* Right-side publish panel */}
          <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                发布状态
              </h3>
              <ul className="mt-3 space-y-2.5 text-sm">
                <PanelRow ok={!!selectedAccountId} label="已选账号" hint={account?.name} />
                <PanelRow
                  ok={!hasLimitWords}
                  danger={hasLimitWords}
                  label="极限词清洁"
                  hint={hasLimitWords ? `命中 ${limitWords.length} 个` : undefined}
                />
                <PanelRow ok={agreedResponsibility} label="已勾选必勾声明" />
                <PanelRow ok={coverSelected} label="已选封面" warn={!coverSelected} />
              </ul>

              {hasLimitWords && (
                <Link
                  href={`/editor/${article.id}`}
                  className="mt-4 inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-red-300 bg-red-50 px-4 text-xs font-medium text-red-700 shadow-sm transition-colors hover:bg-red-100"
                >
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                  先处理极限词
                </Link>
              )}

              <button
                type="button"
                onClick={handlePublish}
                disabled={!canPublish}
                className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                <Send className="h-4 w-4" aria-hidden="true" />
                {account
                  ? `确认发布到 ${account.name}`
                  : "选择账号后发布"}
              </button>
              <p className="mt-3 text-[11px] leading-4 text-slate-400">
                发布后文章状态变为「已发布」,勾选动作 + 时间 + 账号会写入审计记录。
              </p>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

function Section({
  step,
  title,
  subtitle,
  children,
}: {
  step: number;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex items-start gap-3">
        <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
          {step}
        </span>
        <div>
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          {subtitle && (
            <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
          )}
        </div>
      </div>
      <div className="ml-10">{children}</div>
    </section>
  );
}

function PanelRow({
  ok,
  warn,
  danger,
  label,
  hint,
}: {
  ok: boolean;
  warn?: boolean;
  danger?: boolean;
  label: string;
  hint?: string;
}) {
  const color = danger
    ? "text-red-500"
    : ok
      ? "text-emerald-500"
      : warn
        ? "text-amber-500"
        : "text-slate-300";
  const textColor = danger
    ? "text-red-700"
    : ok
      ? "text-slate-700"
      : "text-slate-500";
  return (
    <li className="flex items-start gap-2">
      {danger ? (
        <AlertTriangle className={`mt-0.5 h-4 w-4 flex-shrink-0 ${color}`} aria-hidden="true" />
      ) : (
        <CheckCircle2 className={`mt-0.5 h-4 w-4 flex-shrink-0 ${color}`} aria-hidden="true" />
      )}
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-medium ${textColor}`}>{label}</p>
        {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
      </div>
    </li>
  );
}
