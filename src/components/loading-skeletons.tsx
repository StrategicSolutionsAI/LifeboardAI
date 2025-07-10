"use client"

import { cn } from "@/lib/utils"

// Widget Skeleton component for loading states
export function WidgetSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse", className)}>
      <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-4 h-[200px]">
        <div className="flex justify-between items-start mb-4">
          <div>
            <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
            <div className="h-3 bg-gray-200 rounded w-16"></div>
          </div>
          <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
        </div>
        <div className="flex justify-center items-center h-24">
          <div className="h-12 w-12 bg-gray-200 rounded"></div>
        </div>
      </div>
    </div>
  )
}

// Bucket Tab Skeleton
export function BucketTabsSkeleton() {
  return (
    <div className="bg-white border-b border-gray-200 px-6">
      <div className="flex space-x-8 h-[41px]">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse bg-gray-200 w-20 h-4 my-auto rounded"></div>
        ))}
      </div>
    </div>
  )
}

// Task Skeleton
export function TaskSkeleton() {
  return (
    <div className="animate-pulse flex items-center space-x-3 p-3 bg-white rounded-lg border border-gray-100">
      <div className="w-4 h-4 bg-gray-200 rounded-full"></div>
      <div className="flex-1">
        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
      </div>
    </div>
  )
}

// Task List Skeleton
export function TaskListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <TaskSkeleton key={i} />
      ))}
    </div>
  )
}

// Widget Grid Skeleton
export function WidgetGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <WidgetSkeleton key={i} />
      ))}
    </div>
  )
}
