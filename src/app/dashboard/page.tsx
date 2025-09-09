export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

import DashboardPageClient from './page.client'

export default function Dashboard() {
  return <DashboardPageClient />
}
