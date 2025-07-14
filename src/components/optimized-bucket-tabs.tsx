"use client"

import { useState, useEffect, memo, useCallback, useRef } from "react"
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
  className?: string
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
        ? "border-theme-primary text-theme-primary"
        : "border-transparent text-theme-secondary hover:text-theme-primary hover:border-theme-accent"
    )}
  >
    {bucket.toUpperCase()}
  </button>
))

TabButton.displayName = "TabButton"

export function OptimizedBucketTabs({ 
  selectedBucket, 
  onSelectBucket,
  className
}: Omit<OptimizedBucketTabsProps, 'children'>) {
  // Use global cache for user preferences
  const { 
    data: userPrefs, 
    loading,
    error
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
  

  
  // Show skeleton while loading
  if (loading && !userPrefs) {
    return <BucketTabsSkeleton />
  }
  
  // Show error state
  if (error) {
    return (
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex space-x-8 h-[41px] items-center">
            <span className="text-sm text-red-500">Failed to load buckets</span>
          </div>
        </div>
      </div>
    )
  }
  
  return (
    <div className={cn("w-full flex space-x-8 relative border-b border-gray-200", className)}>
      {userBuckets.map((bucket: string) => (
        <TabButton
          key={bucket}
          bucket={bucket}
          isSelected={selectedBucket === bucket}
          onClick={() => handleBucketClick(bucket)}
        />
      ))}
    </div>
  )
}

// Export memoized version
export default memo(OptimizedBucketTabs)
