export default function LoadingBudget() {
  return (
    <div className="flex w-full flex-col gap-4 px-3 sm:px-6 md:px-8 py-3 sm:py-5 animate-pulse">
      {/* Header with month selector */}
      <div className="flex items-center justify-between">
        <div className="h-7 w-48 rounded-lg bg-theme-brand-tint-light" />
        <div className="flex gap-2">
          <div className="h-9 w-9 rounded-lg bg-theme-brand-tint-subtle" />
          <div className="h-9 w-28 rounded-lg bg-theme-brand-tint-light" />
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 px-4 py-3 rounded-xl border border-theme-neutral-300/80 bg-white"
          >
            <div className="h-9 w-9 rounded-lg bg-theme-brand-tint-subtle shrink-0" />
            <div className="flex flex-col gap-1 min-w-0">
              <div className="h-5 w-16 rounded bg-theme-brand-tint-light" />
              <div className="h-3 w-12 rounded bg-theme-brand-tint-subtle" />
            </div>
          </div>
        ))}
      </div>

      {/* Two column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Categories column */}
        <div className="lg:col-span-2 rounded-xl border border-theme-neutral-300/80 bg-white divide-y divide-theme-neutral-300/50">
          <div className="px-4 py-3">
            <div className="h-4 w-24 rounded bg-theme-brand-tint-light" />
          </div>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="px-4 py-3 flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-theme-brand-tint-subtle shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 w-24 rounded bg-theme-brand-tint-light" />
                <div className="h-1.5 w-full rounded-full bg-theme-brand-tint-subtle" />
              </div>
              <div className="h-4 w-14 rounded bg-theme-brand-tint-subtle" />
            </div>
          ))}
        </div>

        {/* Expenses column */}
        <div className="rounded-xl border border-theme-neutral-300/80 bg-white">
          <div className="px-4 py-3 border-b border-theme-neutral-300/50">
            <div className="h-4 w-20 rounded bg-theme-brand-tint-light" />
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="px-4 py-2.5 flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-theme-brand-tint-subtle" />
              <div className="flex-1 space-y-1">
                <div className="h-3.5 rounded bg-theme-brand-tint-light" style={{ width: `${40 + i * 8}%` }} />
                <div className="h-2.5 w-16 rounded bg-theme-brand-tint-subtle" />
              </div>
              <div className="h-3.5 w-12 rounded bg-theme-brand-tint-subtle" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
