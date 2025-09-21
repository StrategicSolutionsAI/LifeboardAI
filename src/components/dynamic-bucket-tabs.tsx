"use client"

import { useState, useEffect } from "react"
import { getUserPreferencesClient, UserPreferences } from "@/lib/user-preferences"
import { Plus, Cloud, Search } from "lucide-react"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { WidgetLibrary } from "./widget-library"
import { Button } from "./ui/button"
import { Card, CardContent } from "./ui/card"

// Default buckets in case user hasn't selected any
const DEFAULT_BUCKETS = ["Health"]

export function DynamicBucketTabs({ 
  selectedBucket, 
  onSelectBucket,
  children
}: {
  selectedBucket: string
  onSelectBucket: (bucket: string) => void
  children?: React.ReactNode
}) {
  const [userBuckets, setUserBuckets] = useState<string[]>(DEFAULT_BUCKETS)
  const [bucketColors, setBucketColors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [isWidgetLibraryOpen, setIsWidgetLibraryOpen] = useState(false)
  
  useEffect(() => {
    async function loadUserBuckets() {
      try {
        const userPrefs = await getUserPreferencesClient()
        
        if (userPrefs && userPrefs.life_buckets && userPrefs.life_buckets.length > 0) {
          setUserBuckets(userPrefs.life_buckets)
          setBucketColors(userPrefs.bucket_colors || {})

          // If the currently selected bucket isn't in the user's buckets,
          // select the first one of their buckets
          if (!userPrefs.life_buckets.includes(selectedBucket) && userPrefs.life_buckets.length > 0) {
            onSelectBucket(userPrefs.life_buckets[0])
          }
        }
      } catch (error) {
        console.error("Failed to load user buckets:", error)
      } finally {
        setLoading(false)
      }
    }
    
    loadUserBuckets()
  }, [selectedBucket, onSelectBucket])

  // Listen for bucket color changes
  useEffect(() => {
    const handleBucketColorsChanged = () => {
      // Reload bucket colors when they change
      getUserPreferencesClient()
        .then(userPrefs => {
          if (userPrefs?.bucket_colors) {
            setBucketColors(userPrefs.bucket_colors)
          }
        })
        .catch(error => {
          console.error("Failed to reload bucket colors:", error)
        })
    }

    window.addEventListener('bucketColorsChanged', handleBucketColorsChanged)
    return () => window.removeEventListener('bucketColorsChanged', handleBucketColorsChanged)
  }, [])
  
  if (loading) {
    return (
      <div className="bg-theme-surface-base border-b border-theme-neutral-200 px-4 sm:px-6">
        <div className="flex gap-4 sm:gap-8 h-[41px]">
          <div className="animate-pulse bg-theme-neutral-200 w-16 h-4 my-auto rounded"></div>
        </div>
      </div>
    )
  }
  
  // Format the bucket name to uppercase for display
  const formatBucketName = (name: string) => {
    return name.toUpperCase()
  }

  // Get bucket color with fallback to default theme color
  const getBucketColor = (bucket: string) => {
    return bucketColors[bucket] || '#8491FF'
  }

  // Convert hex to rgba for background colors
  const hexToRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }
  
  return (
    <>
      {/* Tab Navigation */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6">
        <div className="flex gap-1 sm:gap-2">
          {userBuckets.map((bucket) => {
            const bucketColor = getBucketColor(bucket)
            const isSelected = selectedBucket === bucket
            return (
              <button
                key={bucket}
                onClick={() => onSelectBucket(bucket)}
                className={`relative px-4 sm:px-6 py-3 text-xs font-medium tracking-wide transition-all duration-200 rounded-t-lg border-2 ${
                  isSelected
                    ? 'text-white shadow-lg transform scale-105'
                    : 'text-gray-700 hover:text-white border-gray-200 hover:border-opacity-50'
                }`}
                style={{
                  backgroundColor: isSelected ? bucketColor : hexToRgba(bucketColor, 0.1),
                  borderColor: isSelected ? bucketColor : hexToRgba(bucketColor, 0.3),
                  borderBottom: isSelected ? `3px solid ${bucketColor}` : `2px solid ${hexToRgba(bucketColor, 0.3)}`
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.backgroundColor = hexToRgba(bucketColor, 0.2)
                    e.currentTarget.style.borderColor = hexToRgba(bucketColor, 0.5)
                    e.currentTarget.style.color = 'white'
                    e.currentTarget.style.transform = 'scale(1.02)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.backgroundColor = hexToRgba(bucketColor, 0.1)
                    e.currentTarget.style.borderColor = hexToRgba(bucketColor, 0.3)
                    e.currentTarget.style.color = ''
                    e.currentTarget.style.transform = 'scale(1)'
                  }
                }}
              >
                {/* Color accent dot */}
                <div
                  className="absolute top-1 right-1 w-2 h-2 rounded-full"
                  style={{ backgroundColor: bucketColor, opacity: isSelected ? 1 : 0.7 }}
                />
                {formatBucketName(bucket)}
              </button>
            )
          })}
        </div>
      </div>

      {/* Dashboard Content for Selected Bucket */}
      <div className="flex-1 p-4 sm:p-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6">
            {/* Main Widgets Area */}
            <div className="lg:col-span-3">
              {children ? (
                children
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {/* Add Widget Card */}
                  <Sheet open={isWidgetLibraryOpen} onOpenChange={setIsWidgetLibraryOpen}>
                    <SheetTrigger asChild>
                      <Card className="border-2 border-dashed border-theme-neutral-300 hover:border-theme-primary-500 cursor-pointer transition-colors group">
                        <CardContent className="flex flex-col items-center justify-center p-6 sm:p-8 min-h-[200px]">
                          <div className="w-12 h-12 rounded-full bg-theme-neutral-100 group-hover:bg-theme-primary-50 flex items-center justify-center mb-4 transition-colors">
                            <Plus className="w-6 h-6 text-theme-neutral-400 group-hover:text-theme-primary-600 transition-colors" />
                          </div>
                          <h3 className="font-semibold text-theme-text-primary mb-2">Add a Widget</h3>
                          <p className="text-sm text-theme-text-tertiary text-center">
                            Choose from our library of widgets to track what matters most
                          </p>
                        </CardContent>
                      </Card>
                    </SheetTrigger>
                    <SheetContent className="w-full sm:w-[520px] md:w-[700px]">
                      <SheetHeader>
                        <SheetTitle>Widget Library</SheetTitle>
                        <SheetDescription>
                          Add widgets to track your goals and habits
                        </SheetDescription>
                      </SheetHeader>
                      <WidgetLibrary />
                    </SheetContent>
                  </Sheet>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
