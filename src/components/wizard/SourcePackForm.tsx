"use client";

import { Image, Package } from "lucide-react";
import type { ArticleSourceContext } from "@/types";

interface SourcePackFormProps {
  value: ArticleSourceContext;
  onChange: (patch: Partial<ArticleSourceContext>) => void;
}

const FIELDS: Array<{
  key: keyof ArticleSourceContext;
  label: string;
  helper: string;
  placeholder: string;
  icon: typeof Package;
}> = [
  {
    key: "productNotes",
    label: "统一产品素材包",
    helper: "来自 V2 产品卡整理后的可写事实、边界和资料缺口。",
    placeholder: "这里通常由产品库自动带入,不再手动拼竞品、热点或自由角度。",
    icon: Package,
  },
  {
    key: "mediaNotes",
    label: "截图理解摘要",
    helper: "只保留截图/页面理解摘要;视频文件只保存,不自动解析。",
    placeholder: "例: 智问中枢聊天截图展示用户用一句话查询网络告警。",
    icon: Image,
  },
];

export function SourcePackForm({ value, onChange }: SourcePackFormProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            产品素材包
          </h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            生成只读取 V2 产品卡整理后的素材包;旧的竞品、热点和截图自由字段不再参与正文生成。
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {FIELDS.map((field) => {
          const Icon = field.icon;
          return (
            <label key={field.key} className="block">
              <span className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                <Icon className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />
                {field.label}
              </span>
              <span className="mt-1 block text-[11px] leading-4 text-slate-400">
                {field.helper}
              </span>
              <textarea
                value={value[field.key] ?? ""}
                onChange={(e) => onChange({ [field.key]: e.target.value })}
                rows={4}
                placeholder={field.placeholder}
                className="mt-2 w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </label>
          );
        })}
      </div>
    </section>
  );
}
