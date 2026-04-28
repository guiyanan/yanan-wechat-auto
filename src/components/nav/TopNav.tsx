import Link from "next/link";
import { Bell, Search } from "lucide-react";

const NAV_ITEMS: Array<{ label: string; href: string; active?: boolean }> = [
  { label: "文章", href: "/", active: true },
  { label: "产品", href: "/admin/products" },
  { label: "账号", href: "/admin/accounts" },
];

export function TopNav() {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-6 px-6">
        <Link href="/" className="flex items-center gap-2">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg font-bold text-white shadow-sm"
            style={{
              background: "linear-gradient(135deg,#2563eb 0%,#ec4899 100%)",
            }}
          >
            J
          </div>
          <span className="text-sm font-semibold text-slate-900">
            JOTO 内容工厂
          </span>
        </Link>

        <nav className="flex items-center gap-1 text-sm">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={
                item.active
                  ? "rounded-md bg-slate-100 px-3 py-1.5 font-medium text-slate-900"
                  : "rounded-md px-3 py-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
              }
            >
              {item.label}
            </Link>
          ))}
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
              className="h-9 w-64 rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </label>

          <button
            type="button"
            aria-label="通知"
            className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            <Bell className="h-4 w-4" aria-hidden="true" />
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
          </button>

          <div
            className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium text-white shadow-sm"
            style={{
              background: "linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%)",
            }}
            aria-label="当前用户"
          >
            T
          </div>
        </div>
      </div>
    </header>
  );
}
