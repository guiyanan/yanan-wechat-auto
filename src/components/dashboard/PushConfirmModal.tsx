"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Send,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { Article, Product } from "@/types";
import { useArticleStore } from "@/store/articleStore";
import { useWechatTemplateStore } from "@/store/wechatTemplateStore";
import { WechatArticleFrame } from "@/components/wechat/WechatArticleFrame";
import { buildAigcMetadata } from "@/lib/aigcMeta";
import { getAllAccounts } from "@/lib/articles";
import {
  WECHAT_THEME_LABELS,
  type WechatTheme,
} from "@/lib/wechatThemes";

interface PushConfirmModalProps {
  article: Article | null;
  product?: Product;
  open: boolean;
  onClose: () => void;
}

type CheckState =
  | { status: "idle" }
  | { status: "running" }
  | { status: "passed"; message: string }
  | { status: "failed"; message: string };

/**
 * Dashboard push dialog.
 * Draft articles stay in Dashboard until the user explicitly chooses a WeChat
 * account, verifies the JOTO preview, then pushes to the public-account draft box.
 */
export function PushConfirmModal({
  article,
  product,
  open,
  onClose,
}: PushConfirmModalProps) {
  const setStatus = useArticleStore((s) => s.setStatus);
  const patch = useArticleStore((s) => s.patch);
  const followHeader = useWechatTemplateStore((s) => s.followHeader);
  const contactFooter = useWechatTemplateStore((s) => s.contactFooter);
  const [pushing, setPushing] = useState(false);
  const accounts = useMemo(() => getAllAccounts(), []);
  const singleAccount = accounts[0];
  const selectedAccountId = singleAccount?.id;
  const [checkState, setCheckState] = useState<CheckState>({ status: "idle" });

  // Reset internal state when the modal closes
  useEffect(() => {
    if (!open) {
      setPushing(false);
      setCheckState({ status: "idle" });
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !pushing) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, pushing, onClose]);

  if (!open || !article) return null;

  const theme = (article.exportTheme ??
    article.layoutTheme ??
    "joto") as WechatTheme;
  const selectedAccount = singleAccount;
  const digest = article.contentHtml
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, 120);

  async function handleCheck() {
    setCheckState({ status: "running" });
    try {
      const res = await fetch("/api/wechat/check");
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        setCheckState({
          status: "passed",
          message: data.message ?? "公众号 API 配置可用",
        });
        toast.success("公众号 API 检测通过");
      } else {
        const message = data.error ?? `HTTP ${res.status}`;
        setCheckState({ status: "failed", message });
        toast.error(`检测失败：${message}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "网络错误";
      setCheckState({ status: "failed", message });
      toast.error(`检测失败：${message}`);
    }
  }

  async function handleConfirm() {
    if (!article || !selectedAccountId) return;
    setPushing(true);
    try {
      const res = await fetch("/api/wechat/push-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: article.title,
          bodyHtml: article.contentHtml,
          author: article.createdBy,
          theme,
          decorate: true,
          addAigcNotice: true,
          articleId: article.id,
          productName: product?.name,
          coverStyleLabel: WECHAT_THEME_LABELS[theme],
          digest,
          accountId: selectedAccountId,
          jotoFollowHeaderHtml: followHeader?.html,
          jotoContactFooterHtml: contactFooter?.html,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        const publishedAt = new Date().toISOString();
        patch(article.id, {
          accountId: selectedAccountId,
          wechatDraftMediaId: data.mediaId,
          wechatPushedAt: publishedAt,
          reviewAudit: [
            ...article.reviewAudit,
            {
              actorName: article.createdBy,
              agreedAt: publishedAt,
              addedAigcNotice: true,
              accountId: selectedAccountId,
            },
          ],
          aigcMetadata: {
            ...buildAigcMetadata({
              articleId: article.id,
              humanReviewed: true,
              generatedAt: article.createdAt,
            }),
            publishedAt,
            accountId: selectedAccountId,
            addedExplicitNotice: true,
            wechatDraftMediaId: data.mediaId,
            wechatPushedAt: publishedAt,
          },
          compliance: {
            ...article.compliance,
            aigcMetaEmbedded: true,
          },
        });
        setStatus(article.id, "published");
        toast.success(
          `已推送到 ${selectedAccount?.name ?? "公众号"} 草稿箱，请到公众号后台发布`,
          {
            duration: 6000,
            action: {
              label: "打开公众号后台",
              onClick: () => window.open("https://mp.weixin.qq.com", "_blank"),
            },
          }
        );
        onClose();
      } else {
        const err = data.error ?? `HTTP ${res.status}`;
        toast.error(`推送失败：${err}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "网络错误";
      toast.error(`推送失败：${msg}`);
    } finally {
      setPushing(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="push-confirm-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !pushing) onClose();
      }}
    >
      <div className="flex max-h-[88vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-6 py-5">
          <div>
            <h2
              id="push-confirm-title"
              className="text-lg font-semibold text-slate-900"
            >
              选择公众号并预览排版
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              单账号接入：推送成功后会进入公众号草稿箱，Dashboard
              状态同步为已发布。
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={pushing}
            aria-label="关闭"
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 gap-0 overflow-hidden lg:grid-cols-[420px_minmax(0,1fr)]">
          <div className="min-h-0 space-y-5 overflow-y-auto border-r border-slate-200 p-6">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-medium text-slate-400">当前文章</p>
              <p className="mt-1 font-semibold text-slate-900">
                {article.title}
              </p>
              {product && (
                <p className="mt-1 text-xs text-slate-500">{product.name}</p>
              )}
              <dl className="mt-3 space-y-1 text-xs text-slate-500">
                <div className="flex justify-between gap-4">
                  <dt>排版主题</dt>
                  <dd className="font-medium text-slate-700">
                    {WECHAT_THEME_LABELS[theme]}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>AIGC 标注</dt>
                  <dd className="font-medium text-slate-700">启用</dd>
                </div>
              </dl>
            </div>

            <section>
              <h3 className="text-sm font-semibold text-slate-900">
                当前接入公众号
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                第一版只接一个真实公众号，密钥只保存在服务端环境变量。
              </p>
              {selectedAccount ? (
                <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white shadow-sm"
                      style={{
                        background: `linear-gradient(135deg, ${selectedAccount.avatarGradient[0]}, ${selectedAccount.avatarGradient[1]})`,
                      }}
                      aria-hidden="true"
                    >
                      {selectedAccount.name.slice(0, 1)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {selectedAccount.name}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {selectedAccount.type} · 使用 WECHAT_APPID /
                        WECHAT_APPSECRET
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  未找到公众号账号配置，请检查 accounts.json。
                </p>
              )}
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    公众号 API 检测
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    检查 AppID、AppSecret，并获取 access_token；不会创建草稿。
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCheck}
                  disabled={pushing || checkState.status === "running"}
                  className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {checkState.status === "running" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  检测
                </button>
              </div>
              {checkState.status === "passed" && (
                <p className="mt-3 flex items-start gap-2 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                  {checkState.message}
                </p>
              )}
              {checkState.status === "failed" && (
                <p className="mt-3 flex items-start gap-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                  {checkState.message}
                </p>
              )}
            </section>

            <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              推送时会按文章自动生成封面并上传到公众号素材库；如果微信 API 配置不可用，文章仍保留在 Dashboard 草稿箱。
            </p>
          </div>

          <div className="min-h-0 overflow-y-auto bg-slate-50 p-6">
            <div className="mb-3 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-blue-600">
                  JOTO 白底公众号预览
                </p>
                <p className="mt-0.5 text-sm text-slate-500">
                  {selectedAccount
                    ? `将推送到：${selectedAccount.name}`
                    : "请先选择公众号"}
                </p>
              </div>
            </div>
            <WechatArticleFrame
              title={article.title}
              contentHtml={article.contentHtml}
              coverUrl={article.coverImageUrl ?? article.coverCandidates[0]}
              author={article.createdBy}
              theme={theme}
              decorate
              minHeight={620}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={pushing}
            className="rounded-md border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={pushing || !selectedAccountId}
            className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pushing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                推送中…
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                {selectedAccount
                  ? "推送到公众号草稿箱"
                  : "选择公众号后推送"}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
