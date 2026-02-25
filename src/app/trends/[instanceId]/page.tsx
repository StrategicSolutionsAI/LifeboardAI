import TrendsPageClient from './page.client'

export default function TrendsPage({ params }: { params: { instanceId: string } }) {
  return <TrendsPageClient params={params} />
}
