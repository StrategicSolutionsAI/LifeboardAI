export default function LoadingNotes() {
  return (
    <div className="flex w-full h-[calc(100dvh-200px)] animate-pulse">
      {/* Left panel - note list */}
      <div className="hidden md:flex flex-col w-72 border-r border-theme-neutral-300/80">
        {/* Search bar */}
        <div className="p-3">
          <div className="h-9 w-full rounded-lg bg-theme-brand-tint-light" />
        </div>
        {/* Note list items */}
        <div className="flex-1 space-y-1 px-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-lg px-3 py-3 space-y-1.5">
              <div className="h-4 w-3/4 rounded bg-theme-brand-tint-light" />
              <div className="h-3 w-full rounded bg-theme-brand-tint-subtle" />
              <div className="h-2.5 w-16 rounded bg-theme-brand-tint-subtle" />
            </div>
          ))}
        </div>
      </div>

      {/* Right panel - editor */}
      <div className="flex-1 flex flex-col p-6 space-y-4">
        <div className="h-7 w-64 rounded-lg bg-theme-brand-tint-light" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-full rounded bg-theme-brand-tint-subtle" />
          <div className="h-4 w-5/6 rounded bg-theme-brand-tint-subtle" />
          <div className="h-4 w-4/6 rounded bg-theme-brand-tint-subtle" />
          <div className="h-4 w-3/4 rounded bg-theme-brand-tint-subtle" />
        </div>
      </div>
    </div>
  )
}
