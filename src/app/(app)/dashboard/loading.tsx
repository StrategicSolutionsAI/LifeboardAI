export default function LoadingDashboard() {
  return (
    <div className="flex h-[calc(100vh-64px)] w-full flex-col gap-5 px-8 py-6 animate-pulse">
      {/* Bucket tabs skeleton */}
      <div className="flex items-center gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-9 rounded-lg bg-[rgba(177,145,106,0.08)]"
            style={{ width: `${60 + i * 10}px` }}
          />
        ))}
        <div className="ml-auto h-9 w-9 rounded-lg bg-[rgba(177,145,106,0.06)]" />
      </div>

      {/* Widget grid skeleton */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-[#dbd6cf] bg-white p-5 shadow-[0px_1px_3px_rgba(163,133,96,0.06)]"
          >
            {/* Widget header */}
            <div className="mb-4 flex items-center justify-between">
              <div className="h-4 w-28 rounded bg-[rgba(177,145,106,0.1)]" />
              <div className="h-4 w-4 rounded bg-[rgba(177,145,106,0.06)]" />
            </div>
            {/* Widget body */}
            <div className="space-y-3">
              <div className="h-3 w-full rounded bg-[rgba(177,145,106,0.06)]" />
              <div className="h-3 w-3/4 rounded bg-[rgba(177,145,106,0.06)]" />
              <div className="h-3 w-1/2 rounded bg-[rgba(177,145,106,0.06)]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
