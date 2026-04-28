export function EditorSkeleton() {
  return (
    <div
      className="min-h-screen bg-slate-50"
      aria-label="编辑器加载中"
      aria-busy="true"
    >
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-4 px-6">
          <div className="h-4 w-20 animate-pulse rounded bg-slate-200" />
          <span className="text-slate-300">·</span>
          <div className="h-3 w-28 animate-pulse rounded bg-slate-100" />
          <div className="ml-auto flex items-center gap-3">
            <div className="h-5 w-14 animate-pulse rounded-full bg-slate-100" />
            <div className="h-9 w-20 animate-pulse rounded-md bg-slate-200" />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-6 py-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-6">
            {/* Title candidates */}
            <section>
              <div className="mb-2 h-3 w-16 animate-pulse rounded bg-slate-100" />
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-8 w-48 animate-pulse rounded-full bg-slate-100"
                  />
                ))}
              </div>
            </section>

            {/* Covers */}
            <section>
              <div className="mb-2 h-3 w-16 animate-pulse rounded bg-slate-100" />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="aspect-video w-full animate-pulse rounded-lg bg-slate-200"
                  />
                ))}
              </div>
            </section>

            {/* Title */}
            <div className="h-8 w-2/3 animate-pulse rounded bg-slate-200" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-slate-100" />

            {/* Body */}
            <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className={`h-4 animate-pulse rounded bg-slate-100 ${
                    i % 3 === 0 ? "w-3/4" : i % 2 === 0 ? "w-5/6" : "w-full"
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Sidebar */}
          <aside className="space-y-4">
            <div className="h-44 animate-pulse rounded-xl bg-white shadow-sm" />
            <div className="h-56 animate-pulse rounded-xl bg-white shadow-sm" />
            <div className="h-40 animate-pulse rounded-xl bg-white shadow-sm" />
          </aside>
        </div>
      </main>
    </div>
  );
}
