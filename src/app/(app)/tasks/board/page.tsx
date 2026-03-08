import dynamic from "next/dynamic"

const TasksBoardPageClient = dynamic(() => import("./page.client"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[calc(100dvh-64px)] w-full flex-col px-4 py-4 gap-3">
      <div className="flex items-center justify-between">
        <div className="h-5 w-24 animate-pulse rounded bg-theme-skeleton" />
        <div className="h-8 w-32 animate-pulse rounded bg-theme-skeleton" />
      </div>
      <div className="flex-1 rounded-xl border border-theme-neutral-300 bg-white p-4">
        <div className="h-full animate-pulse rounded-lg bg-theme-brand-tint-subtle" />
      </div>
    </div>
  ),
})

export default function TasksBoardPage() {
  return <TasksBoardPageClient />
}
