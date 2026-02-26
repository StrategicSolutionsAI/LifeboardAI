export default function LoadingShoppingList() {
  return (
    <div className="mx-auto max-w-3xl space-y-5 py-2 animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="h-6 w-36 rounded bg-[rgba(177,145,106,0.1)]" />
        <div className="h-9 w-24 rounded-lg bg-[rgba(177,145,106,0.08)]" />
      </div>

      {/* Add item bar */}
      <div className="flex items-center gap-2 rounded-xl border border-[#dbd6cf] bg-white p-2">
        <div className="h-9 flex-1 rounded bg-[rgba(177,145,106,0.06)]" />
        <div className="h-9 w-16 rounded-lg bg-[rgba(177,145,106,0.1)]" />
      </div>

      {/* List items */}
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-xl border border-[#dbd6cf] bg-white px-4 py-3"
          >
            <div className="h-4 w-4 rounded border border-[rgba(177,145,106,0.2)]" />
            <div
              className="h-4 rounded bg-[rgba(177,145,106,0.08)]"
              style={{ width: `${35 + (i % 5) * 10}%` }}
            />
            <div className="ml-auto h-4 w-4 rounded bg-[rgba(177,145,106,0.06)]" />
          </div>
        ))}
      </div>
    </div>
  )
}
