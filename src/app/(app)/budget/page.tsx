import dynamic from 'next/dynamic'
import { Suspense } from 'react'
import LoadingBudget from './loading'
import SectionLoadTimer from '@/components/section-load-timer'

const budgetChunk = import('./page.client')

const BudgetPageClient = dynamic(
  () => budgetChunk,
  {
    ssr: false,
    loading: () => <LoadingBudget />,
  }
)

export default function BudgetPage() {
  return (
    <>
      <SectionLoadTimer name="/budget" />
      <Suspense fallback={<LoadingBudget />}>
        <BudgetPageClient />
      </Suspense>
    </>
  )
}
