"use client"

import { useState, useEffect, memo, useCallback } from "react"
import { getUserPreferencesClient } from "@/lib/user-preferences"
import { Plus } from "lucide-react"
import { BucketTabsSkeleton } from "./loading-skeletons"
import { useGlobalCache } from "@/hooks/use-data-cache"
import { cn } from "@/lib/utils"

// Default buckets in case user hasn't selected any
const DEFAULT_BUCKETS = ["Health"]

interface OptimizedBucketTabsProps {
  selectedBucket: string
  onSelectBucket: (bucket: string) => void
  children?: React.ReactNode
}

// Memoized tab button component
const TabButton = memo(({ 
  bucket, 
  isSelected, 
  onClick 
}: { 
  bucket: string
  isSelected: boolean
  onClick: () => void 
}) => (
  <button
    onClick={onClick}
    className={cn(
      "py-4 px-2 text-xs font-medium tracking-wide border-b-2 transition-all duration-200",
      isSelected
        ? "border-blue-600 text-blue-600"
        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
    )}
  >
    {bucket.toUpperCase()}
  </button>
))

TabButton.displayName = "TabButton"

export function OptimizedBucketTabs({ 
  selectedBucket, 
  onSelectBucket,
  children
}: OptimizedBucketTabsProps) {
  // Use global cache for user preferences
  const { 
    data: userPrefs, 
    loading,
    error,
    updateOptimistically 
  } = useGlobalCache(
    'user-preferences',
    getUserPreferencesClient,
    { 
      ttl: 10 * 60 * 1000, // 10 minutes cache
      prefetch: true 
    }
  )
  
  // Extract buckets from preferences
  const userBuckets = userPrefs?.life_buckets || DEFAULT_BUCKETS
  
  // Memoized click handler
  const handleBucketClick = useCallback((bucket: string) => {
    onSelectBucket(bucket)
  }, [onSelectBucket])
  
  // Effect to handle initial bucket selection
  useEffect(() => {
    if (!loading && userBuckets.length > 0 && !userBuckets.includes(selectedBucket)) {
      onSelectBucket(userBuckets[0])
    }
  }, [userBuckets, selectedBucket, onSelectBucket, loading])
  
  // Show skeleton while loading
  if (loading && !userPrefs) {
    return <BucketTabsSkeleton />
  }
  
  // Show error state
  if (error) {
    return (
      <div className="bg-white border-b border-gray-200 px-6">
        <div className="flex space-x-8 h-[41px] items-center">
          <span className="text-sm text-red-500">Failed to load buckets</span>
        </div>
      </div>
    )
  }
  
  return (
    <>
      {/* Tab Navigation with smooth transitions */}
      <div className="bg-white border-b border-gray-200 px-6">
        <div className="flex space-x-8 relative">
          {userBuckets.map((bucket) => (
            <TabButton
              key={bucket}
              bucket={bucket}
              isSelected={selectedBucket === bucket}
              onClick={() => handleBucketClick(bucket)}
            />
          ))}
        </div>
      </div>

      {/* Dashboard Content for Selected Bucket */}
      <div className="flex-1 p-6 transition-opacity duration-200">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Main Widgets Area */}
            <div className="lg:col-span-3">
              {children}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// Export memoized version
export default memo(OptimizedBucketTabs)
