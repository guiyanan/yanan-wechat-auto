export function ArticleListSkeleton() {
  return (
    <section
      className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
      aria-label="文章列表加载中"
      aria-busy="true"
    >
      <header className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="h-4 w-20 animate-pulse rounded bg-slate-200" />
          <div className="h-3 w-36 animate-pulse rounded bg-slate-100" />
        </div>
        <div className="h-9 w-48 animate-pulse rounded-md bg-slate-100" />
      </header>

      <div className="flex gap-2 border-b border-slate-100 px-5 py-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-6 w-14 animate-pulse rounded-full bg-slate-100"
          />
        ))}
      </div>

      <ul className="divide-y divide-slate-100">
        {Array.from({ length: 5 }).map((_, i) => (
          <li
            key={i}
            className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto_auto] items-center gap-6 px-5 py-4"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 flex-shrink-0 animate-pulse rounded-lg bg-slate-200" />
              <div className="space-y-2">
                <div className="h-3.5 w-72 animate-pulse rounded bg-slate-200" />
                <div className="h-3 w-36 animate-pulse rounded bg-slate-100" />
              </div>
            </div>
            <div className="h-5 w-14 animate-pulse rounded-full bg-slate-100" />
            <div className="hidden h-3 w-16 animate-pulse rounded bg-slate-100 lg:inline-block" />
            <div className="hidden h-3 w-10 animate-pulse rounded bg-slate-100 sm:inline-block" />
            <div className="h-3 w-12 animate-pulse rounded bg-slate-100" />
          </li>
        ))}
      </ul>
    </section>
  );
}
