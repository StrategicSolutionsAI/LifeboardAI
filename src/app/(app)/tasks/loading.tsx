export default function LoadingTasks() {
  return (
    <div className="flex h-[calc(100dvh-64px)] w-full flex-col gap-3 sm:gap-4 px-3 sm:px-6 md:px-8 py-3 sm:py-5 animate-pulse">
      {/* Header skeleton */}
      <div className="flex flex-col gap-5">
        {/* Title row */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 rounded bg-theme-brand-tint-light" />
            <div className="h-5 w-24 rounded bg-theme-brand-tint-light" />
            <div className="h-4 w-12 rounded bg-theme-brand-tint-subtle" />
          </div>
          <div className="h-9 w-48 rounded-lg bg-theme-brand-tint-subtle" />
        </div>

        {/* Quick-add bar skeleton */}
        <div className="flex items-center gap-2 rounded-xl border border-theme-neutral-300 bg-white p-2 shadow-[0px_1px_3px_rgba(163,133,96,0.06)]">
          <div className="h-8 flex-1 rounded bg-theme-brand-tint-subtle" />
          <div className="h-8 w-24 rounded-lg bg-theme-brand-tint-subtle" />
          <div className="h-8 w-16 rounded-lg bg-theme-brand-tint-light" />
        </div>

        {/* Tab bar skeleton */}
        <div className="flex items-center gap-3">
          <div className="h-8 w-16 rounded-lg bg-theme-brand-tint-light" />
          <div className="h-8 w-16 rounded-lg bg-theme-brand-tint-subtle" />
          <div className="ml-auto h-8 w-20 rounded-lg bg-theme-brand-tint-subtle" />
        </div>
      </div>

      {/* Task list skeleton */}
      <div className="flex-1 space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-xl border border-theme-neutral-300 bg-white px-4 py-3"
          >
            <div className="h-4 w-4 rounded border border-theme-primary/20" />
            <div
              className="h-4 rounded bg-theme-brand-tint-light"
              style={{ width: `${45 + (i % 4) * 12}%` }}
            />
            <div className="ml-auto h-5 w-16 rounded-full bg-theme-brand-tint-subtle" />
          </div>
        ))}
      </div>
    </div>
  )
}
