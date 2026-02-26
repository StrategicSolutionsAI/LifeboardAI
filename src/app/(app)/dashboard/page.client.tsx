"use client"

import { Suspense } from 'react'
import dynamic from 'next/dynamic'
import { Loader2 } from 'lucide-react'
import SectionLoadTimer from '@/components/section-load-timer'
import { prefetchAllTasks } from '@/lib/prefetch-tasks'

// Start downloading the 214KB taskboard chunk immediately at module evaluation
// time, instead of waiting for React to render the dynamic component.
const taskboardChunk = import('@/components/taskboard-dashboard')

// Also start fetching task data in parallel — runs alongside the chunk download
// so when the component finally mounts, data is already cached.
prefetchAllTasks()

const TaskBoardDashboard = dynamic(
  () => taskboardChunk.then((mod) => mod.TaskBoardDashboard),
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
  return <TaskBoardDashboard />
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
