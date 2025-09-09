export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

import TrendsPageClient from './page.client'

export default function TrendsPage({ params }: { params: { instanceId: string } }) {
  return <TrendsPageClient params={params} />
}
