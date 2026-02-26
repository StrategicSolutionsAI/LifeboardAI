export default function LoadingHistory() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 py-2 animate-pulse">
      <div>
        <div className="h-7 w-28 rounded bg-[rgba(177,145,106,0.1)]" />
        <div className="mt-2 h-4 w-56 rounded bg-[rgba(177,145,106,0.06)]" />
      </div>
      <div className="rounded-xl border border-[#dbd6cf] bg-white p-6">
        <div className="h-5 w-32 rounded bg-[rgba(177,145,106,0.08)]" />
        <div className="mt-4 space-y-2">
          <div className="h-4 w-48 rounded bg-[rgba(177,145,106,0.06)]" />
          <div className="h-4 w-40 rounded bg-[rgba(177,145,106,0.06)]" />
          <div className="h-4 w-52 rounded bg-[rgba(177,145,106,0.06)]" />
        </div>
      </div>
    </div>
  )
}
