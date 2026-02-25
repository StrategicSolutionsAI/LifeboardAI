"use client"

import { Suspense } from 'react'
import dynamic from 'next/dynamic'
import { SidebarLayout } from "@/components/sidebar-layout"
import { Loader2 } from 'lucide-react'
import SectionLoadTimer from '@/components/section-load-timer'

const TaskBoardDashboard = dynamic(
  () => import('@/components/taskboard-dashboard').then((mod) => mod.TaskBoardDashboard),
  {
    ssr: false,
    loading: () => (
      <div className="h-screen flex items-center justify-center bg-[#faf8f5]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-warm-500 mx-auto mb-4" />
          <p className="text-[#8e99a8]">Loading your dashboard...</p>
        </div>
      </div>
    ),
  }
)

function DashboardContent() {
  return (
    <SidebarLayout>
      <TaskBoardDashboard />
    </SidebarLayout>
  )
}

function LoadingDashboard() {
  return (
    <div className="h-screen flex items-center justify-center bg-theme-surface-sunken">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-warm-500 mx-auto mb-4" />
        <p className="text-[#8e99a8]">Loading your dashboard...</p>
      </div>
    </div>
  )
}

export default function DashboardPageClient() {
  return (
    <>
      <SectionLoadTimer name="/dashboard" />
      <Suspense fallback={<LoadingDashboard />}>
        <DashboardContent />
      </Suspense>
    </>
  )
}
