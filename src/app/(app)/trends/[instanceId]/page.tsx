import dynamic from 'next/dynamic'
import { Skeleton } from "@/components/ui/skeleton"

const TrendsPageClient = dynamic(() => import('./page.client'), {
  ssr: false,
  loading: () => (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-6">
      <div className="space-y-2"><Skeleton className="h-8 w-56 bg-theme-skeleton" /><Skeleton className="h-4 w-80 bg-theme-skeleton" /></div>
      <div className="flex gap-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-9 w-16 rounded-full bg-theme-skeleton" />)}</div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[...Array(4)].map((_, i) => (
        <div key={i} className="rounded-xl border border-theme-neutral-300 bg-theme-surface-raised p-4 shadow-warm-sm">
          <Skeleton className="h-3 w-20 mb-3 bg-theme-skeleton" />
          <Skeleton className="h-7 w-16 mb-1 bg-theme-skeleton" />
          <Skeleton className="h-2.5 w-24 bg-theme-skeleton" />
        </div>
      ))}</div>
      <div className="rounded-xl border border-theme-neutral-300 bg-theme-surface-raised p-6 shadow-warm-sm">
        <Skeleton className="h-5 w-40 mb-2 bg-theme-skeleton" />
        <Skeleton className="h-3 w-60 mb-6 bg-theme-skeleton" />
        <Skeleton className="h-72 w-full rounded-lg bg-theme-skeleton" />
      </div>
    </div>
  ),
})

export default function TrendsPage({ params }: { params: { instanceId: string } }) {
  return <TrendsPageClient params={params} />
}
