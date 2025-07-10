"use client"

import React, { useState, useCallback, useMemo, lazy, Suspense, useEffect } from "react"
import { format, addDays, startOfWeek, isSameDay } from "date-fns"
import { Plus, Calendar, TrendingUp, Loader2, CheckCircle2, X } from "lucide-react"
import { OptimizedBucketTabs } from "./optimized-bucket-tabs"
import { useInstantPreferences, useInstantWidgets, useInstantIntegrations, preloadDashboardData } from "@/hooks/use-instant-data"
import { useTasks } from "@/hooks/use-tasks"
import { ProgressIndicator, SkeletonWithProgress, MicroProgress, LoadingDots } from "./progress-indicator"
import { WidgetSkeleton, TaskListSkeleton } from "./loading-skeletons"
import { cn } from "@/lib/utils"
import { WidgetInstance } from "@/types/widgets"
import { saveUserPreferences } from "@/lib/user-preferences"

// Lazy load heavy components
const WidgetLibrary = lazy(() => import("./widget-library").then(m => ({ default: m.WidgetLibrary })))
const WidgetEditorSheet = lazy(() => import("./widget-editor"))
const TrendsPanel = lazy(() => import("./trends-panel"))
const TaskSidePanel = lazy(() => import("./task-side-panel").then(m => ({ default: m.TaskSidePanel })))

// Preload data on component mount
if (typeof window !== 'undefined') {
  preloadDashboardData()
}

// Memoized widget card with instant loading
const InstantWidgetCard = React.memo(({ 
  widget, 
  progress,
  onIncrement,
  onEdit,
  onRemove,
  isStale
}: { 
  widget: WidgetInstance
  progress: any
  onIncrement: () => void
  onEdit: () => void
  onRemove: () => void
  isStale?: boolean
}) => {
  const [incrementing, setIncrementing] = useState(false)
  
  const handleIncrement = async () => {
    setIncrementing(true)
    onIncrement()
    // Simulate API delay for animation
    setTimeout(() => setIncrementing(false), 600)
  }
  
  return (
    <div className={cn(
      "bg-white rounded-lg border shadow-sm p-4 transition-all duration-200",
      "hover:shadow-md relative group",
      isStale && "opacity-90"
    )}>
      <MicroProgress loading={isStale || false} />
      
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="font-semibold text-gray-900">{widget.name}</h3>
          <p className="text-sm text-gray-500">
            {progress?.isToday ? `${progress.value} / ${widget.target}` : '0 / ' + widget.target}
            {' '}{widget.unit}
          </p>
        </div>
        
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onEdit}
            className="p-1 hover:bg-gray-100 rounded"
            title="Edit widget"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={onRemove}
            className="p-1 hover:bg-gray-100 rounded text-red-500"
            title="Remove widget"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
      
      <div className="space-y-3">
        <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
          <div 
            className={cn(
              "absolute inset-y-0 left-0 rounded-full transition-all duration-500",
              incrementing && "animate-pulse"
            )}
            style={{ 
              width: `${Math.min(100, ((progress?.value || 0) / widget.target) * 100)}%`,
              backgroundColor: widget.color || '#3B82F6'
            }}
          />
        </div>
        
        <button
          onClick={handleIncrement}
          disabled={incrementing}
          className={cn(
            "w-full py-2 px-4 rounded-lg font-medium transition-all duration-200",
            "bg-gray-100 hover:bg-gray-200 active:scale-95",
            incrementing && "bg-green-100"
          )}
        >
          {incrementing ? (
            <span className="flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-600 animate-in zoom-in duration-300" />
              <span className="text-green-600">Added!</span>
            </span>
          ) : (
            `Add ${widget.unit}`
          )}
        </button>
      </div>
    </div>
  )
})

InstantWidgetCard.displayName = "InstantWidgetCard"

export function InstantTaskboard() {
  const [activeBucket, setActiveBucket] = useState("")
  const [activeView, setActiveView] = useState<'overview' | 'trends'>('overview')
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [showWidgetLibrary, setShowWidgetLibrary] = useState(false)
  const [isEditingWidget, setIsEditingWidget] = useState<WidgetInstance | null>(null)
  const [overallProgress, setOverallProgress] = useState(0)
  
  // Use instant data hooks
  const { 
    data: preferences, 
    loading: prefsLoading, 
    isStale: prefsStale,
    refetch: refetchPrefs 
  } = useInstantPreferences() as {
    data: any | null
    loading: boolean
    isStale: boolean
    refetch: () => Promise<any>
  }
  
  const { 
    data: widgetsData, 
    loading: widgetsLoading, 
    isStale: widgetsStale,
    refetch: refetchWidgets 
  } = useInstantWidgets(activeBucket) as {
    data: any[] | null
    loading: boolean
    isStale: boolean
    refetch: () => Promise<any>
  }
  
  const {
    data: integrations,
    loading: integrationsLoading,
    isStale: integrationsStale
  } = useInstantIntegrations() as {
    data: any[] | null
    loading: boolean
    isStale: boolean
  }
  
  // Tasks with caching
  const {
    dailyTasks,
    loading: tasksLoading,
    toggleTaskCompletion
  } = useTasks(selectedDate)
  
  // Progress tracking
  useEffect(() => {
    const steps = [
      { done: !!preferences, weight: 30 },
      { done: !!widgetsData, weight: 30 },
      { done: !tasksLoading, weight: 20 },
      { done: !!integrations, weight: 20 }
    ]
    
    const progress = steps.reduce((acc, step) => 
      acc + (step.done ? step.weight : 0), 0
    )
    
    setOverallProgress(progress)
  }, [preferences, widgetsData, tasksLoading, integrations])
  
  // Set initial bucket
  useEffect(() => {
    if (preferences?.life_buckets?.length && !activeBucket) {
      setActiveBucket(preferences.life_buckets[0].id)
    }
  }, [preferences, activeBucket])
  
  // Get current widgets with progress
  const currentWidgets = useMemo(() => {
    if (!widgetsData) return []
    
    return widgetsData.map((widget: WidgetInstance) => ({
      ...widget,
      progress: preferences?.progress?.[widget.instanceId] || { value: 0, isToday: false }
    }))
  }, [widgetsData, preferences?.progress])
  
  // Widget operations
  const handleAddWidget = useCallback(async (widget: WidgetInstance) => {
    if (!preferences) return
    
    const updatedWidgets = {
      ...preferences.widgets,
      [activeBucket]: [...(preferences.widgets?.[activeBucket] || []), widget]
    }
    
    await saveUserPreferences({
      ...preferences,
      widgets: updatedWidgets
    })
    
    refetchWidgets()
    setShowWidgetLibrary(false)
  }, [preferences, activeBucket, refetchWidgets])
  
  const handleRemoveWidget = useCallback(async (instanceId: string) => {
    if (!preferences) return
    
    const updatedWidgets = {
      ...preferences.widgets,
      [activeBucket]: preferences.widgets?.[activeBucket]?.filter(
        (w: WidgetInstance) => w.instanceId !== instanceId
      ) || []
    }
    
    await saveUserPreferences({
      ...preferences,
      widgets: updatedWidgets
    })
    
    refetchWidgets()
  }, [preferences, activeBucket, refetchWidgets])
  
  const handleIncrementProgress = useCallback(async (widget: WidgetInstance) => {
    if (!preferences) return
    
    const today = new Date().toISOString().split('T')[0]
    const currentProgress = preferences.progress?.[widget.instanceId] || { value: 0 }
    
    const updatedProgress = {
      ...preferences.progress,
      [widget.instanceId]: {
        value: currentProgress.value + 1,
        lastUpdated: today,
        isToday: true
      }
    }
    
    await saveUserPreferences({
      ...preferences,
      progress: updatedProgress
    })
    
    refetchPrefs()
  }, [preferences, refetchPrefs])
  
  // Calendar navigation
  const weekDays = useMemo(() => {
    const start = startOfWeek(selectedDate)
    return Array.from({ length: 7 }, (_, i) => addDays(start, i))
  }, [selectedDate])
  
  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      <ProgressIndicator 
        loading={prefsLoading && !preferences} 
        progress={overallProgress}
      />
      
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">
            My Dashboard
            {(prefsStale || widgetsStale) && (
              <LoadingDots className="ml-2 text-gray-400 text-xs" />
            )}
          </h1>
          
          <div className="flex items-center gap-4">
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setActiveView('overview')}
                className={cn(
                  "px-4 py-2 rounded-md text-sm font-medium transition-all",
                  activeView === 'overview' 
                    ? "bg-white text-gray-900 shadow-sm" 
                    : "text-gray-600 hover:text-gray-900"
                )}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveView('trends')}
                className={cn(
                  "px-4 py-2 rounded-md text-sm font-medium transition-all",
                  activeView === 'trends' 
                    ? "bg-white text-gray-900 shadow-sm" 
                    : "text-gray-600 hover:text-gray-900"
                )}
              >
                <TrendingUp className="w-4 h-4 inline mr-1" />
                Trends
              </button>
            </div>
          </div>
        </div>
      </header>
      
      {/* Bucket Tabs */}
      <SkeletonWithProgress
        loading={prefsLoading && !preferences}
        skeleton={<div className="h-12 bg-gray-100 animate-pulse" />}
      >
        <OptimizedBucketTabs
          selectedBucket={activeBucket}
          onSelectBucket={setActiveBucket}
        />
      </SkeletonWithProgress>
      
      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto">
            {activeView === 'overview' ? (
              <>
                {/* Add Widget Card */}
                <div className="mb-6">
                  <button
                    onClick={() => setShowWidgetLibrary(true)}
                    className={cn(
                      "w-full max-w-sm p-6 border-2 border-dashed border-gray-300",
                      "rounded-lg hover:border-gray-400 hover:bg-gray-50",
                      "transition-all duration-200 group"
                    )}
                  >
                    <Plus className="w-8 h-8 text-gray-400 group-hover:text-gray-600 mx-auto mb-2" />
                    <p className="text-gray-600 font-medium">Add Widget</p>
                  </button>
                </div>
                
                {/* Widgets Grid */}
                <SkeletonWithProgress
                  loading={widgetsLoading && !widgetsData}
                  skeleton={
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {[1, 2, 3].map(i => <WidgetSkeleton key={i} />)}
                    </div>
                  }
                >
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {currentWidgets.map((widget) => (
                      <InstantWidgetCard
                        key={widget.instanceId}
                        widget={widget}
                        progress={widget.progress}
                        isStale={widgetsStale}
                        onIncrement={() => handleIncrementProgress(widget)}
                        onEdit={() => setIsEditingWidget(widget)}
                        onRemove={() => handleRemoveWidget(widget.instanceId)}
                      />
                    ))}
                  </div>
                </SkeletonWithProgress>
              </>
            ) : (
              <Suspense fallback={
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                </div>
              }>
                <TrendsPanel widgets={currentWidgets} />
              </Suspense>
            )}
          </div>
        </main>
        
        {/* Task Panel */}
        <Suspense fallback={
          <aside className="w-96 bg-white border-l border-gray-200 p-4">
            <TaskListSkeleton count={5} />
          </aside>
        }>
          <TaskSidePanel />
        </Suspense>
      </div>
      
      {/* Modals */}
      {showWidgetLibrary && (
        <Suspense fallback={null}>
          {showWidgetLibrary && (
            <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
              <div className="fixed right-0 top-0 h-full w-full max-w-2xl bg-background shadow-lg">
                <div className="flex items-center justify-between p-6 border-b">
                  <h2 className="text-lg font-semibold">Widget Library</h2>
                  <button
                    onClick={() => setShowWidgetLibrary(false)}
                    className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
                  >
                    <X className="h-4 w-4" />
                    <span className="sr-only">Close</span>
                  </button>
                </div>
                <div className="p-6 overflow-y-auto h-[calc(100vh-5rem)]">
                  <WidgetLibrary
                    onAdd={handleAddWidget}
                    bucket={activeBucket}
                  />
                </div>
              </div>
            </div>
          )}
        </Suspense>
      )}
      
      {isEditingWidget && (
        <Suspense fallback={null}>
          <WidgetEditorSheet
            open={!!isEditingWidget}
            onClose={() => setIsEditingWidget(null)}
            widget={isEditingWidget}
            onSave={async (updates) => {
              if (!preferences) return
              
              const updatedWidgets = {
                ...preferences.widgets,
                [activeBucket]: preferences.widgets?.[activeBucket]?.map((w: WidgetInstance) =>
                  w.instanceId === updates.instanceId ? updates : w
                ) || []
              }
              
              await saveUserPreferences({
                ...preferences,
                widgets: updatedWidgets
              })
              
              refetchWidgets()
              setIsEditingWidget(null)
            }}
          />
        </Suspense>
      )}
    </div>
  )
}
