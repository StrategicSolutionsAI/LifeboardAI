"use client"

import { Suspense } from 'react'
import { TaskBoardDashboard } from "@/components/taskboard-dashboard"
import { Loader2 } from 'lucide-react'

function DashboardContent() {
  return <TaskBoardDashboard />
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
