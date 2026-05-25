"use client";

import type { Article, WechatAccount } from "@/types";
import { inferArticleType } from "@/lib/articleType";
import { defaultThemeForArticleType } from "@/lib/wechatThemes";
import { WechatArticleFrame } from "@/components/wechat/WechatArticleFrame";

interface PreviewCardProps {
  article: Article;
  account: WechatAccount | null;
}

export function PreviewCard({ article, account }: PreviewCardProps) {
  const cover = article.coverImageUrl ?? article.coverCandidates[0];
  const articleType = inferArticleType({
    angleId: article.angleId,
    customAngle: article.customAngle,
  });
  const theme =
    article.layoutTheme ?? defaultThemeForArticleType(articleType);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 bg-slate-50 px-4 py-2.5 text-xs text-slate-500">
        JOTO 公众号版式预览 · {account?.name ?? "未选账号"}
      </div>
      <div className="bg-slate-100 p-3">
        <WechatArticleFrame
          title={article.title}
          contentHtml={article.contentHtml}
          coverUrl={cover}
          author={article.createdBy}
          theme={theme}
          decorate
          minHeight={760}
        />
      </div>
    </div>
  );
}
