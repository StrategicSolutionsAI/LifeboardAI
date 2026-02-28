export default function LoadingShoppingList() {
  return (
    <div className="flex w-full flex-col gap-3 sm:gap-4 px-3 sm:px-6 md:px-8 py-3 sm:py-5 animate-pulse">
      {/* Header row */}
      <div className="flex items-center gap-5">
        <div className="flex flex-col gap-1.5 min-w-0">
          <div className="h-6 w-28 rounded-lg bg-theme-brand-tint-light" />
          <div className="h-3 w-20 rounded bg-theme-brand-tint-subtle" />
        </div>
        <div className="ml-auto h-9 w-24 rounded-lg bg-theme-brand-tint-light" />
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 px-3.5 py-3 rounded-xl border border-theme-neutral-300/80 bg-white"
          >
            <div className="h-9 w-9 rounded-lg bg-theme-brand-tint-subtle shrink-0" />
            <div className="flex flex-col gap-1 min-w-0">
              <div className="h-5 w-8 rounded bg-theme-brand-tint-light" />
              <div className="h-3 w-14 rounded bg-theme-brand-tint-subtle" />
            </div>
          </div>
        ))}
      </div>

      {/* Quick add row */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="h-9 flex-1 rounded-lg bg-theme-brand-tint-subtle" />
        <div className="flex gap-2.5">
          <div className="h-9 w-24 rounded-lg bg-theme-brand-tint-subtle" />
          <div className="h-9 w-16 rounded-lg bg-theme-brand-tint-subtle" />
          <div className="h-9 w-16 rounded-lg bg-theme-brand-tint-light" />
        </div>
      </div>

      {/* Bucket filter chips */}
      <div className="flex gap-2">
        {[60, 48, 56, 44, 52].map((w, i) => (
          <div
            key={i}
            className="h-8 rounded-full bg-theme-brand-tint-subtle"
            style={{ width: `${w}px` }}
          />
        ))}
      </div>

      {/* Items list */}
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex items-start gap-3 rounded-xl border border-theme-neutral-300/80 bg-white p-3.5"
          >
            <div className="mt-0.5 h-4 w-4 rounded border border-theme-neutral-300 shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <div
                  className="h-4 rounded bg-theme-brand-tint-light"
                  style={{ width: `${30 + (i % 4) * 12}%` }}
                />
                <div className="h-5 w-14 rounded-md bg-theme-brand-tint-subtle" />
              </div>
              <div className="flex gap-2">
                <div className="h-3 w-16 rounded bg-theme-brand-tint-subtle" />
                <div className="h-3 w-20 rounded bg-theme-brand-tint-subtle" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
