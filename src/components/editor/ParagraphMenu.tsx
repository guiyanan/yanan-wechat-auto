"use client";

import { BubbleMenu, type Editor } from "@tiptap/react";
import {
  BarChart3,
  Expand,
  Loader2,
  MessageCircle,
  Minimize2,
  RefreshCw,
} from "lucide-react";

export interface HumanizeIntent {
  key: string;
  label: string;
  intent: string;
}

export const HUMANIZE_INTENTS: HumanizeIntent[] = [
  {
    key: "rewrite",
    label: "重写",
    intent: "保留原意,用更自然的中文重写这一段",
  },
  {
    key: "expand",
    label: "扩写",
    intent: "在保持语气不变的前提下,给这一段补充 1-2 句具体细节",
  },
  {
    key: "shorten",
    label: "缩写",
    intent: "压缩到原来的 60% 以内,保留核心信息",
  },
  {
    key: "casual",
    label: "更口语",
    intent: "用更口语、更接近微信公众号风格的中文改写",
  },
  {
    key: "data",
    label: "加数据",
    intent: "在不违反事实的前提下,为这一段补充一个具体数据或场景细节",
  },
];

interface ParagraphMenuProps {
  editor: Editor | null;
  disabled?: boolean;
  busyIntent: string | null;
  onAction: (intent: HumanizeIntent) => void;
}

export function ParagraphMenu({
  editor,
  disabled,
  busyIntent,
  onAction,
}: ParagraphMenuProps) {
  if (!editor) return null;

  const iconFor = (key: string) => {
    if (busyIntent === key)
      return <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />;
    switch (key) {
      case "rewrite":
        return <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />;
      case "expand":
        return <Expand className="h-3.5 w-3.5" aria-hidden="true" />;
      case "shorten":
        return <Minimize2 className="h-3.5 w-3.5" aria-hidden="true" />;
      case "casual":
        return <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />;
      case "data":
        return <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />;
      default:
        return null;
    }
  };

  return (
    <BubbleMenu
      editor={editor}
      updateDelay={50}
      shouldShow={({ editor, from, to }) => {
        if (disabled) return false;
        if (from === to) return false;
        // Only show for selections inside editable content
        if (!editor.isEditable) return false;
        const text = editor.state.doc.textBetween(from, to).trim();
        if (text.length < 2) return false;
        return true;
      }}
      className="z-30"
    >
      <div
        role="toolbar"
        aria-label="段落改写"
        className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-lg"
      >
        {HUMANIZE_INTENTS.map((i) => {
          const busy = busyIntent === i.key;
          const anyBusy = busyIntent !== null;
          return (
            <button
              key={i.key}
              type="button"
              onClick={() => !anyBusy && onAction(i)}
              disabled={anyBusy}
              className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
              aria-label={i.label}
              aria-pressed={busy}
            >
              {iconFor(i.key)}
              {i.label}
            </button>
          );
        })}
      </div>
    </BubbleMenu>
  );
}
