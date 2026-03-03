import { SidebarLayout } from "@/components/sidebar-layout"
import { QueryProvider } from "@/providers/query-provider"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <SidebarLayout>{children}</SidebarLayout>
    </QueryProvider>
  )
}
