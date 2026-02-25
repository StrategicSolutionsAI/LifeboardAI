export default function LoadingTasks() {
  return (
    <div className="flex h-[calc(100vh-64px)] w-full flex-col gap-5 px-8 py-6 animate-pulse">
      {/* Header skeleton */}
      <div className="flex flex-col gap-5">
        {/* Title row */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 rounded bg-[rgba(177,145,106,0.1)]" />
            <div className="h-5 w-24 rounded bg-[rgba(177,145,106,0.1)]" />
            <div className="h-4 w-12 rounded bg-[rgba(177,145,106,0.06)]" />
          </div>
          <div className="h-9 w-48 rounded-lg bg-[rgba(177,145,106,0.06)]" />
        </div>

        {/* Quick-add bar skeleton */}
        <div className="flex items-center gap-2 rounded-xl border border-[#dbd6cf] bg-white p-2 shadow-[0px_1px_3px_rgba(163,133,96,0.06)]">
          <div className="h-8 flex-1 rounded bg-[rgba(177,145,106,0.06)]" />
          <div className="h-8 w-24 rounded-lg bg-[rgba(177,145,106,0.06)]" />
          <div className="h-8 w-16 rounded-lg bg-[rgba(177,145,106,0.1)]" />
        </div>

        {/* Tab bar skeleton */}
        <div className="flex items-center gap-3">
          <div className="h-8 w-16 rounded-lg bg-[rgba(177,145,106,0.1)]" />
          <div className="h-8 w-16 rounded-lg bg-[rgba(177,145,106,0.06)]" />
          <div className="ml-auto h-8 w-20 rounded-lg bg-[rgba(177,145,106,0.06)]" />
        </div>
      </div>

      {/* Task list skeleton */}
      <div className="flex-1 space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-xl border border-[#dbd6cf] bg-white px-4 py-3"
          >
            <div className="h-4 w-4 rounded border border-[rgba(177,145,106,0.2)]" />
            <div
              className="h-4 rounded bg-[rgba(177,145,106,0.08)]"
              style={{ width: `${45 + (i % 4) * 12}%` }}
            />
            <div className="ml-auto h-5 w-16 rounded-full bg-[rgba(177,145,106,0.06)]" />
          </div>
        ))}
      </div>
    </div>
  )
}
