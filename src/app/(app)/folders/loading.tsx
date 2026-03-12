export default function LoadingFolders() {
  return (
    <div className="animate-pulse space-y-6">
      {/* Header area */}
      <div className="flex items-center justify-between">
        <div className="h-5 w-32 rounded-lg bg-theme-brand-tint-light" />
        <div className="h-9 w-28 rounded-lg bg-theme-brand-tint-light" />
      </div>

      {/* Folder grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col items-center gap-2 p-4 rounded-xl border border-theme-neutral-300/80 bg-white"
          >
            <div className="h-20 w-24 rounded-lg bg-theme-brand-tint-subtle" />
            <div className="h-4 w-16 rounded bg-theme-brand-tint-light" />
            <div className="h-3 w-10 rounded bg-theme-brand-tint-subtle" />
          </div>
        ))}
      </div>
    </div>
  )
}
