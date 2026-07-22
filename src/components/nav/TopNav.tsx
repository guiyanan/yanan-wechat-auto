"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Search } from "lucide-react";
import { useLearnedStyleStore } from "@/store/learnedStyleStore";
import { useProductStore } from "@/store/productStore";

const NAV_ITEMS: Array<{ label: string; href: string }> = [
  { label: "文章", href: "/" },
  { label: "产品", href: "/admin/products" },
  { label: "账号", href: "/admin/accounts" },
  { label: "模板", href: "/templates" },
  { label: "风格库", href: "/styles" },
  { label: "邮箱", href: "/email" },
];

export function TopNav() {
  const pathname = usePathname();
  const loadProducts = useProductStore((s) => s.loadFromServer);
  const loadStyles = useLearnedStyleStore((s) => s.loadFromServer);

  useEffect(() => {
    void loadProducts();
    void loadStyles();
  }, [loadProducts, loadStyles]);

  return (
    <header className="sticky top-0 z-30 border-b border-[#d2d2d7]/70 bg-white/75 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-7 px-6">
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-lg px-1 py-1 transition-colors hover:bg-black/[0.03]"
        >
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#d2d2d7] bg-white text-sm font-semibold text-[#0071e3] shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
            aria-hidden="true"
          >
            J
          </div>
          <span className="text-sm font-semibold tracking-tight text-slate-950">
            JOTO小信
          </span>
        </Link>

        <nav className="hidden items-center gap-1 text-sm md:flex">
          {NAV_ITEMS.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={
                  active
                    ? "rounded-md bg-[#f5f5f7] px-3 py-1.5 font-medium text-slate-950 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)]"
                    : "rounded-md px-3 py-1.5 text-slate-500 transition-colors hover:bg-black/[0.03] hover:text-slate-900"
                }
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <label className="relative hidden sm:block">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            />
            <input
              type="search"
              placeholder="搜索文章、产品"
              aria-label="搜索"
              className="h-9 w-64 rounded-lg border border-[#d2d2d7] bg-white/80 pl-9 pr-3 text-sm text-slate-900 shadow-[0_1px_2px_rgba(0,0,0,0.03)] placeholder:text-slate-400 focus:border-[#0071e3] focus:outline-none focus:ring-2 focus:ring-[#0071e3]/15"
            />
          </label>

          <button
            type="button"
            aria-label="通知"
            className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-black/[0.04] hover:text-slate-900"
          >
            <Bell className="h-4 w-4" aria-hidden="true" />
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
          </button>

          <div
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0071e3] text-sm font-medium text-white shadow-[0_2px_8px_rgba(0,113,227,0.2)]"
            aria-label="当前用户"
          >
            T
          </div>
        </div>
      </div>
    </header>
  );
}
