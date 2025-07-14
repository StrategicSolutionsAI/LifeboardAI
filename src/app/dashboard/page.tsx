"use client"

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { TaskBoardDashboard } from "@/components/taskboard-dashboard"
import { OptimizedTaskboard } from "@/components/optimized-taskboard"
import { SidebarLayout } from "@/components/sidebar-layout"
import { Loader2 } from 'lucide-react'

function DashboardContent() {
  const searchParams = useSearchParams()
  const useOptimized = searchParams.get('optimized') === 'true'
  
  // Keep optimized version behind feature flag
  const shouldUseOptimized = useOptimized
  
  if (shouldUseOptimized) {
    return (
      <SidebarLayout>
        <OptimizedTaskboard />
      </SidebarLayout>
    )
  }
  
  return (
    <SidebarLayout>
      <TaskBoardDashboard />
    </SidebarLayout>
  )
}

function LoadingDashboard() {
  return (
    <div className="h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-4" />
        <p className="text-gray-600">Loading your dashboard...</p>
      </div>
    </div>
  )
}

export default function Dashboard() {
  return (
    <Suspense fallback={<LoadingDashboard />}>
      <DashboardContent />
    </Suspense>
  )
}
