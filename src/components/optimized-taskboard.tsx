"use client"

import React, { useState, memo, useCallback, Suspense } from "react"
import { useProgressBar } from "@/hooks/use-progress-bar"
import Image from "next/image"
import Link from "next/link"
import { supabase } from "@/utils/supabase/client"
import { format, addDays, isSameDay } from 'date-fns'
import { 
  Plus, MessageSquare, LogOut, X, Loader2,
  LayoutDashboard, Settings as SettingsIcon, ListChecks 
} from "lucide-react"
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import OptimizedBucketTabs from "./optimized-bucket-tabs"
import { WidgetLibrary } from "./widget-library"
import { ChatBar } from "./chat-bar"
import { TaskListSkeleton, WidgetGridSkeleton } from "./loading-skeletons"
import { useWidgets } from "@/hooks/use-widgets"
import { useTasks } from "@/hooks/use-tasks"
import type { WidgetInstance, WidgetTemplate } from "@/types/widgets"

// Lazy load components that aren't immediately visible
const TrendsPanel = React.lazy(() => import("./trends-panel"))
const WidgetEditorSheet = React.lazy(() => import("@/components/widget-editor"))

// Memoized widget component
const WidgetCard = memo(({ 
  widget, 
  onRemove,
  onIncrement,
  onEdit,
  progress
}: { 
  widget: WidgetInstance
  onRemove: () => void
  onIncrement: () => void
  onEdit: () => void
  progress: { value: number; streak: number; isToday: boolean }
}) => {
  return (
    <div 
      className="bg-white rounded-lg border border-gray-100 shadow-sm p-4 transition-all duration-200 hover:shadow-md cursor-pointer"
      onClick={onEdit}
    >
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="font-semibold text-gray-900">{widget.name}</h3>
          <p className="text-sm text-gray-500">
            {progress.isToday ? `${progress.value} / ${widget.target}` : '0 / ' + widget.target}
          </p>
        </div>
        <Button
          size="icon"
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className="h-8 w-8"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      
      <div className="flex justify-center items-center h-24">
        <Button
          onClick={(e) => {
            e.stopPropagation()
            onIncrement()
          }}
          className="h-16 w-16 rounded-full"
          variant="outline"
        >
          <Plus className="h-6 w-6" />
        </Button>
      </div>
      
      {progress.streak > 0 && (
        <div className="mt-4 text-center text-sm text-gray-500">
          {progress.streak} day streak
        </div>
      )}
    </div>
  )
})

WidgetCard.displayName = "WidgetCard"

// Memoized task item
const TaskItem = memo(({ 
  task, 
  onToggle 
}: { 
  task: any
  onToggle: () => void 
}) => (
  <div className="flex items-center space-x-3 p-3 bg-white rounded-lg border border-gray-100 hover:shadow-sm transition-shadow">
    <button
      onClick={onToggle}
      className={`w-4 h-4 rounded-full border-2 transition-colors ${
        task.completed 
          ? 'bg-blue-500 border-blue-500' 
          : 'border-gray-300 hover:border-blue-500'
      }`}
    />
    <span className={`flex-1 ${task.completed ? 'line-through text-gray-500' : 'text-gray-900'}`}>
      {task.content}
    </span>
  </div>
))

TaskItem.displayName = "TaskItem"

export function OptimizedTaskboard() {
  const [activeBucket, setActiveBucket] = useState("Health")
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [isWidgetSheetOpen, setIsWidgetSheetOpen] = useState(false)
  const [isEditingWidget, setIsEditingWidget] = useState<WidgetInstance | null>(null)
  const [newlyCreatedWidgetId, setNewlyCreatedWidgetId] = useState<string | null>(null)
  
  // Use optimized hooks
  const {
    widgetsByBucket,
    progressByWidget,
    loading: widgetsLoading,
    savingStatus,
    addWidget,
    removeWidget,
    updateWidget,
    updateProgress,
    getWidgetsForBucket,
    getProgressForWidget
  } = useWidgets()

  
  const {
    dailyTasks,
    allTasks,
    loading: tasksLoading,
    createTask,
    toggleTaskCompletion
  } = useTasks(selectedDate)

  // Show progress bar when any primary data is loading
  useProgressBar(widgetsLoading || tasksLoading)
  
  // Get widgets for current bucket
  const currentWidgets = getWidgetsForBucket(activeBucket)
  
  // Handle sign out
  const handleSignOut = useCallback(async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }, [])
  
  // Handle widget operations
  const handleAddWidget = useCallback((widgetOrTemplate: WidgetTemplate | WidgetInstance) => {
    const isInstance = 'instanceId' in widgetOrTemplate
    const newInstance: WidgetInstance = isInstance
      ? widgetOrTemplate
      : {
          ...widgetOrTemplate,
          instanceId: `${widgetOrTemplate.id}-${Date.now()}`,
          target: widgetOrTemplate.defaultTarget || 100,
          color: widgetOrTemplate.color || 'gray',
          dataSource: 'manual',
          createdAt: new Date().toISOString(),
          schedule: [true, true, true, true, true, true, true],
          // Initialize specialized data for specific widget types
          ...(widgetOrTemplate.id === 'birthdays' && { birthdayData: { friendName: '', birthDate: '' } }),
          ...(widgetOrTemplate.id === 'social_events' && { eventData: { eventName: '', eventDate: '', description: '' } }),
          ...(widgetOrTemplate.id === 'holidays' && { holidayData: { holidayName: '', holidayDate: '' } }),
          ...(widgetOrTemplate.id === 'mood' && { moodData: { currentMood: undefined, moodNote: '', lastUpdated: '' } }),
          ...(widgetOrTemplate.id === 'journal' && { journalData: { todaysEntry: '', lastEntryDate: '', entryCount: 0 } }),
          ...(widgetOrTemplate.id === 'gratitude' && { gratitudeData: { gratitudeItems: [''], lastEntryDate: '', entryCount: 0 } }),
        }
    
    addWidget(activeBucket, newInstance)
    setIsWidgetSheetOpen(false)
    // Automatically open editor for new widgets
    setNewlyCreatedWidgetId(newInstance.instanceId)
    setIsEditingWidget(newInstance)
  }, [activeBucket, addWidget])
  
  const handleRemoveWidget = useCallback((widgetId: string) => {
    removeWidget(activeBucket, widgetId)
  }, [activeBucket, removeWidget])
  
  const handleIncrementProgress = useCallback((widget: WidgetInstance) => {
    // Use increment if available in widget data, otherwise default to 1
    const incrementValue = (widget as any).increment || 1
    updateProgress(widget.instanceId, incrementValue)
  }, [updateProgress])
  
  // Calendar helpers
  const today = new Date()
  const weekDays = Array.from({ length: 7 }).map((_, i) => addDays(today, i))
  
  return (
    <>
      <main className="max-w-7xl mx-auto w-full">
        <div className="bg-white rounded-lg border border-gray-100 shadow-sm">
          <div className="flex flex-col lg:flex-row gap-6 px-6 pt-6 pb-0">
            <div className="flex-1">
              <OptimizedBucketTabs
                selectedBucket={activeBucket}
                onSelectBucket={setActiveBucket}
              />
            </div>
          </div>
          <div className="flex flex-col lg:flex-row gap-6 px-6 pb-6 pt-0">
            {/* Main content area - widgets */}
            <div className="flex-1">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-semibold text-gray-900">{activeBucket} Widgets</h2>
                <Button onClick={() => setIsWidgetSheetOpen(true)}>
                  <Plus className="-ml-1 mr-2 h-5 w-5" />
                  Add Widget
                </Button>
              </div>
              
              {widgetsLoading ? (
                <WidgetGridSkeleton count={3} />
              ) : currentWidgets.length === 0 ? (
                <div className="bg-gray-50 rounded-lg border-2 border-dashed border-gray-200 p-12 text-center">
                  <div className="mx-auto w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center mb-4">
                    <Plus className="h-6 w-6 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No widgets yet</h3>
                  <p className="text-gray-500 mb-4">Add your first widget to start tracking</p>
                  <Button onClick={() => setIsWidgetSheetOpen(true)}>
                    Add Widget
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {currentWidgets.map((widget) => (
                    <WidgetCard
                      key={widget.instanceId}
                      widget={widget}
                      onRemove={() => handleRemoveWidget(widget.instanceId)}
                      onIncrement={() => handleIncrementProgress(widget)}
                      onEdit={() => {
                        setNewlyCreatedWidgetId(null)
                        setIsEditingWidget(widget)
                      }}
                      progress={getProgressForWidget(widget.instanceId)}
                    />
                  ))}
                </div>
              )}
            </div>
            
            {/* Right Sidebar */}
            <div className="space-y-6 w-full lg:w-[300px] xl:w-[350px] shrink-0">
              {/* Calendar Widget */}
              <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-4">
                <h3 className="font-semibold text-gray-900 mb-4">Calendar</h3>
                <div className="grid grid-cols-7 gap-1 text-center">
                  {weekDays.map((day) => (
                    <button
                      key={day.toISOString()}
                      onClick={() => setSelectedDate(day)}
                      className={`
                        p-2 rounded text-sm transition-colors
                        ${isSameDay(day, selectedDate) 
                          ? 'bg-indigo-500 text-white' 
                          : 'hover:bg-gray-100'
                        }
                        ${isSameDay(day, today) && !isSameDay(day, selectedDate)
                          ? 'ring-2 ring-indigo-500'
                          : ''
                        }
                      `}
                    >
                      <div className="text-xs">{format(day, 'EEE')}</div>
                      <div>{format(day, 'd')}</div>
                    </button>
                  ))}
                </div>

                {/* Trends Panel */}
                <Suspense fallback={
                  <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-4 h-32 flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                  </div>
                }>
                  <TrendsPanel widgets={currentWidgets} />
                </Suspense>
              </div>
              
              {/* Tasks */}
              <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-4">
                <h3 className="font-semibold text-gray-900 mb-4">
                  Tasks for {format(selectedDate, 'MMM d')}
                </h3>
                
                {tasksLoading ? (
                  <TaskListSkeleton count={3} />
                ) : dailyTasks.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-8">No tasks for this day</p>
                ) : (
                <div className="space-y-2">
                  {dailyTasks.filter(t => !t.completed).map((task) => (
                    <TaskItem
                      key={task.id}
                      task={task}
                      onToggle={() => toggleTaskCompletion(task.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
      
      {/* Widget Library Sheet */}
      <Sheet open={isWidgetSheetOpen} onOpenChange={setIsWidgetSheetOpen}>
        <SheetContent side="right" className="w-[800px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Add a Widget</SheetTitle>
          </SheetHeader>
          <WidgetLibrary
            bucket={activeBucket}
            onAdd={handleAddWidget}
          />
        </SheetContent>
      </Sheet>
      
      {/* Widget Editor Sheet */}
      {isEditingWidget && (
        <Suspense fallback={null}>
          <WidgetEditorSheet
            open={!!isEditingWidget}
            onClose={() => {
              setIsEditingWidget(null)
              setNewlyCreatedWidgetId(null)
            }}
            widget={isEditingWidget}
            isNewWidget={isEditingWidget.instanceId === newlyCreatedWidgetId}
            onSave={(updates) => {
              if (isEditingWidget) {
                updateWidget(activeBucket, isEditingWidget.instanceId, updates)
              }
              setIsEditingWidget(null)
              setNewlyCreatedWidgetId(null)
            }}
          />
        </Suspense>
      )}
      
      {/* Chat Bar */}
      <ChatBar />
    </>
  )
}
