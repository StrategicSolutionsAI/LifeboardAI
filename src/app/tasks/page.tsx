export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

import TasksPageClient from './page.client'

export default function TasksPage() {
  return <TasksPageClient />
}

