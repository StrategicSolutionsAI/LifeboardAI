export default function LoadingIntegrations() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 py-2 animate-pulse">
      {/* Header skeleton */}
      <div>
        <div className="h-6 w-32 rounded bg-[rgba(177,145,106,0.1)]" />
        <div className="mt-2 h-4 w-64 rounded bg-[rgba(177,145,106,0.06)]" />
      </div>

      {/* Integration cards skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-[#dbd6cf] bg-white p-5 shadow-[0px_1px_3px_rgba(163,133,96,0.06)]"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-lg bg-[rgba(177,145,106,0.08)]" />
              <div className="h-4 w-24 rounded bg-[rgba(177,145,106,0.1)]" />
            </div>
            <div className="space-y-2">
              <div className="h-3 w-full rounded bg-[rgba(177,145,106,0.06)]" />
              <div className="h-3 w-2/3 rounded bg-[rgba(177,145,106,0.06)]" />
            </div>
            <div className="mt-4 h-8 w-20 rounded-lg bg-[rgba(177,145,106,0.08)]" />
          </div>
        ))}
      </div>
    </div>
  )
}
