export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

import SettingsPageClient from './page.client'

export default function SettingsPage() {
  return <SettingsPageClient />
}

