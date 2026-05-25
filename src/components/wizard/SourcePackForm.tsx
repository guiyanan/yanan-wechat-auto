"use client";

import { Image, Newspaper, Package, Swords } from "lucide-react";
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
    label: "产品素材",
    helper: "产品名称、简介、核心能力、目标用户。",
    placeholder: "例: Pharaoh Command 是面向企业网络运维的 AI 智问中枢,可接入 Meraki、Extreme、Aruba 等平台。",
    icon: Package,
  },
  {
    key: "competitorNotes",
    label: "竞品/传统方案素材",
    helper: "竞品名称、传统流程痛点、可确认的对比信息。",
    placeholder: "例: 传统方式需要登录多个 Dashboard,告警、日志、设备位置无法统一关联。",
    icon: Swords,
  },
  {
    key: "trendNotes",
    label: "热点/行业事件素材",
    helper: "热点标题、摘要、链接或粘贴正文。",
    placeholder: "例: 某行业文章讨论 AI Agent 进入企业运维,但落地仍卡在权限、数据源和流程编排。",
    icon: Newspaper,
  },
  {
    key: "imageRefs",
    label: "截图/视频素材",
    helper: "产品截图、视频封面、架构图或希望出现的画面说明。",
    placeholder: "例: 智问中枢聊天截图、网络洞察页面、日志分析页面、知识库页面。",
    icon: Image,
  },
];

export function SourcePackForm({ value, onChange }: SourcePackFormProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            半自动素材包
          </h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            生成会严格基于这些素材。竞品和热点缺事实时,系统会提示补充,不会替你编客户、数据或引用。
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
