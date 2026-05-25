"use client";

import { useMemo } from "react";
import { exportWechatHtml } from "@/lib/wechatHtml";
import type { WechatTheme } from "@/lib/wechatThemes";
import { useWechatTemplateStore } from "@/store/wechatTemplateStore";

interface WechatArticleFrameProps {
  title: string;
  contentHtml: string;
  coverUrl?: string;
  author?: string;
  theme?: WechatTheme;
  decorate?: boolean;
  minHeight?: number;
  fillHeight?: boolean;
  className?: string;
  iframeClassName?: string;
}

export function WechatArticleFrame({
  title,
  contentHtml,
  coverUrl,
  author,
  theme = "joto",
  decorate = true,
  minHeight = 720,
  fillHeight = false,
  className,
  iframeClassName,
}: WechatArticleFrameProps) {
  const followHeader = useWechatTemplateStore((s) => s.followHeader);
  const contactFooter = useWechatTemplateStore((s) => s.contactFooter);
  const srcDoc = useMemo(
    () =>
      exportWechatHtml({
        title: title || "JOTO 公众号预览",
        bodyHtml: contentHtml || "<p>正文生成后会在这里实时呈现。</p>",
        coverUrl,
        author,
        publishedAt: new Date().toISOString(),
        theme,
        decorate,
        addExplicitNotice: false,
        jotoFollowHeaderHtml: followHeader?.html,
        jotoContactFooterHtml: contactFooter?.html,
      }),
    [author, contactFooter?.html, contentHtml, coverUrl, decorate, followHeader?.html, theme, title]
  );
  const frameKey = useMemo(
    () =>
      [
        theme,
        decorate ? "decorated" : "plain",
        title,
        coverUrl ?? "",
        author ?? "",
        contentHtml.length,
        contentHtml.slice(0, 120),
        followHeader?.capturedAt ?? "",
        contactFooter?.capturedAt ?? "",
      ].join(":"),
    [author, contactFooter?.capturedAt, contentHtml, coverUrl, decorate, followHeader?.capturedAt, theme, title]
  );

  return (
    <div
      className={[
        "overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <iframe
        key={frameKey}
        title="JOTO WeChat article preview"
        srcDoc={srcDoc}
        className={["block w-full bg-white", iframeClassName]
          .filter(Boolean)
          .join(" ")}
        style={fillHeight ? { height: "100%", minHeight: 0 } : { minHeight }}
      />
    </div>
  );
}
