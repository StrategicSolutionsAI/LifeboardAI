export default function LoadingEmail() {
  return (
    <div className="flex h-[calc(100dvh-64px)] w-full animate-pulse">
      {/* Email list skeleton */}
      <div className="w-full md:w-[380px] border-r border-theme-neutral-300 flex flex-col">
        {/* Toolbar skeleton */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-theme-neutral-300">
          <div className="h-8 w-24 rounded-lg bg-theme-brand-tint-light" />
          <div className="ml-auto h-4 w-20 rounded bg-theme-brand-tint-subtle" />
        </div>

        {/* Email list items */}
        <div className="flex-1 space-y-0">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="flex items-start gap-3 px-4 py-3 border-b border-theme-neutral-300/50"
            >
              <div className="h-9 w-9 rounded-full bg-theme-brand-tint-light flex-shrink-0" />
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div
                    className="h-3.5 rounded bg-theme-brand-tint-light"
                    style={{ width: `${40 + (i % 3) * 15}%` }}
                  />
                  <div className="h-3 w-10 rounded bg-theme-brand-tint-subtle flex-shrink-0" />
                </div>
                <div
                  className="h-3.5 rounded bg-theme-brand-tint-subtle"
                  style={{ width: `${60 + (i % 4) * 10}%` }}
                />
                <div className="h-3 w-4/5 rounded bg-theme-brand-tint-subtle/60" />
              </div>
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
  )
}
