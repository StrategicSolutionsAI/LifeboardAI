"use client"

import { useState, useEffect } from "react"
import { getUserPreferencesClient } from "@/lib/user-preferences"
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
  const [loading, setLoading] = useState(true)
  const [isWidgetLibraryOpen, setIsWidgetLibraryOpen] = useState(false)
  
  useEffect(() => {
    async function loadUserBuckets() {
      try {
        const userPrefs = await getUserPreferencesClient()
        
        if (userPrefs && userPrefs.life_buckets && userPrefs.life_buckets.length > 0) {
          setUserBuckets(userPrefs.life_buckets)
          
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
  
  if (loading) {
    return (
      <div className="bg-white border-b border-gray-200 px-6">
        <div className="flex space-x-8 h-[41px]">
          <div className="animate-pulse bg-gray-200 w-16 h-4 my-auto rounded"></div>
        </div>
      </div>
    )
  }
  
  // Format the bucket name to uppercase for display
  const formatBucketName = (name: string) => {
    return name.toUpperCase()
  }
  
  return (
    <>
      {/* Tab Navigation */}
      <div className="bg-white border-b border-gray-200 px-6">
        <div className="flex space-x-8">
          {userBuckets.map((bucket) => (
            <button
              key={bucket}
              onClick={() => onSelectBucket(bucket)}
              className={`py-4 px-2 text-xs font-medium tracking-wide border-b-2 transition-colors ${
                selectedBucket === bucket
                  ? 'border-theme-primary text-theme-primary'
                  : 'border-transparent text-theme-secondary hover:text-theme-primary'
              }`}
            >
              {formatBucketName(bucket)}
            </button>
          ))}
        </div>
      </div>

      {/* Dashboard Content for Selected Bucket */}
      <div className="flex-1 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Main Widgets Area */}
            <div className="lg:col-span-3">
              {children ? (
                children
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {/* Add Widget Card */}
                  <Sheet open={isWidgetLibraryOpen} onOpenChange={setIsWidgetLibraryOpen}>
                    <SheetTrigger asChild>
                      <Card className="border-2 border-dashed border-gray-300 hover:border-theme-primary cursor-pointer transition-colors group">
                        <CardContent className="flex flex-col items-center justify-center p-8 min-h-[200px]">
                          <div className="w-12 h-12 rounded-full bg-gray-100 group-hover:bg-theme-primary group-hover:bg-opacity-10 flex items-center justify-center mb-4 transition-colors">
                            <Plus className="w-6 h-6 text-gray-400 group-hover:text-theme-primary transition-colors" />
                          </div>
                          <h3 className="font-semibold text-gray-900 mb-2">Add a Widget</h3>
                          <p className="text-sm text-gray-500 text-center">
                            Choose from our library of widgets to track what matters most
                          </p>
                        </CardContent>
                      </Card>
                    </SheetTrigger>
                    <SheetContent className="w-[520px] sm:w-[700px]">
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
