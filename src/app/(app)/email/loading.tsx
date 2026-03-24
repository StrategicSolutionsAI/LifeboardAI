export default function LoadingEmail() {
  return (
    <div className="flex h-[calc(100dvh-64px)] w-full animate-pulse">
      {/* Sidebar skeleton */}
      <div className="hidden md:flex w-[220px] lg:w-[256px] flex-shrink-0 flex-col border-r border-theme-neutral-300 bg-theme-surface-base px-3 pt-4">
        {/* Compose button skeleton */}
        <div className="h-14 w-full rounded-2xl bg-theme-brand-tint-light mb-4" />
        {/* Label skeletons */}
        <div className="space-y-1 px-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2">
              <div className="h-4 w-4 rounded bg-theme-brand-tint-subtle" />
              <div
                className="h-3.5 rounded bg-theme-brand-tint-subtle"
                style={{ width: `${50 + (i % 3) * 15}%` }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar skeleton */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-theme-neutral-300">
          <div className="h-[18px] w-[18px] rounded bg-theme-brand-tint-subtle" />
          <div className="h-8 w-8 rounded-full bg-theme-brand-tint-subtle" />
          <div className="flex-1 max-w-2xl mx-auto">
            <div className="h-9 rounded-full bg-theme-brand-tint-light" />
          </div>
          <div className="h-4 w-16 rounded bg-theme-brand-tint-subtle" />
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Email list skeleton (Gmail single-row style) */}
          <div className="w-full md:w-[420px] lg:w-[480px] xl:w-[520px] flex-shrink-0 border-r border-theme-neutral-300 flex flex-col">
            <div className="flex-1 space-y-0">
              {Array.from({ length: 15 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center h-10 px-2 gap-2 border-b border-theme-neutral-300/20"
                >
                  <div className="h-[18px] w-[18px] rounded bg-theme-brand-tint-subtle flex-shrink-0 ml-2" />
                  <div className="h-4 w-4 rounded bg-theme-brand-tint-subtle/50 flex-shrink-0" />
                  <div
                    className="h-3.5 rounded bg-theme-brand-tint-light flex-shrink-0"
                    style={{ width: '140px' }}
                  />
                  <div
                    className="h-3.5 rounded bg-theme-brand-tint-subtle flex-1"
                    style={{ maxWidth: `${50 + (i % 4) * 10}%` }}
                  />
                  <div className="h-3 w-10 rounded bg-theme-brand-tint-subtle/60 flex-shrink-0" />
                </div>
              ))}
            </div>
          </div>

          {/* Reading pane skeleton (desktop only) */}
          <div className="hidden md:flex flex-1 flex-col">
            <div className="px-6 py-4 border-b border-theme-neutral-300 space-y-3">
              <div className="h-6 w-3/5 rounded bg-theme-brand-tint-light" />
              <div className="h-4 w-2/5 rounded bg-theme-brand-tint-subtle" />
              <div className="h-4 w-1/4 rounded bg-theme-brand-tint-subtle" />
            </div>
            <div className="flex-1 px-6 py-4 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-4 rounded bg-theme-brand-tint-subtle/40"
                  style={{ width: `${70 + (i % 3) * 10}%` }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
