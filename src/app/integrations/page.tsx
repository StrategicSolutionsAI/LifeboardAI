export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

import IntegrationsPageClient from './page.client'

export default function IntegrationsPage() {
  return <IntegrationsPageClient />
}

