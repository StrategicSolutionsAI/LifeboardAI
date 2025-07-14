"use client"

import React, { useState, memo, useCallback, useEffect, useRef, Suspense } from "react"
import { useProgressBar } from "@/hooks/use-progress-bar"
import Image from "next/image"
import Link from "next/link"
import { supabase } from "@/utils/supabase/client"
import { getUserPreferencesClient, saveUserPreferences } from "@/lib/user-preferences"
import { useGlobalCache } from "@/hooks/use-data-cache"
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
      className="bg-white rounded-lg border border-gray-100 shadow-sm p-4 transition-all duration-200 hover:shadow-md cursor-pointer min-h-[180px] flex flex-col"
      onClick={onEdit}
    >
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 mb-1">{widget.name}</h3>
          <div className="flex items-center gap-2">
            <p className="text-sm text-gray-500">
              {progress.isToday ? `${progress.value} / ${widget.target}` : '0 / ' + widget.target}
            </p>
            {progress.isToday && progress.value >= widget.target && (
              <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full font-medium">
                ✓ Complete
              </span>
            )}
          </div>
          {/* Progress Bar - only for numeric target widgets */}
          {!['birthdays', 'social_events', 'holidays', 'mood', 'journal', 'gratitude', 'quit_habit'].includes(widget.id) && (
            <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all duration-300 ${
                  progress.isToday && progress.value >= widget.target 
                    ? 'bg-green-500' 
                    : 'bg-blue-500'
                }`}
                style={{ 
                  width: `${Math.min((progress.isToday ? progress.value : 0) / widget.target * 100, 100)}%` 
                }}
              />
            </div>
          )}
        </div>
        <div className="flex gap-1">
          {!['birthdays', 'social_events', 'holidays', 'mood', 'journal', 'gratitude'].includes(widget.id) && (
            <Button
              size="icon"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation()
                onIncrement()
              }}
              className={widget.id === 'quit_habit' 
                ? "h-8 w-8 hover:bg-green-50 hover:text-green-600 border border-green-200"
                : "h-8 w-8 hover:bg-green-50 hover:text-green-600"
              }
              title={widget.id === 'quit_habit' ? "Check in - I'm still clean!" : "Quick increment"}
            >
              {widget.id === 'quit_habit' ? (
                <div className="text-sm font-bold text-green-600">✓</div>
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </Button>
          )}
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
      </div>
      
      {/* Specialized widget content */}
      {widget.id === 'birthdays' && widget.birthdayData ? (
        <div className="flex-1 flex items-center justify-center py-4">
          {widget.birthdayData.friendName && widget.birthdayData.birthDate ? (
            <div className="text-center">
              <div className="text-lg font-bold text-purple-600 mb-1">🎂</div>
              <div className="text-sm font-medium text-gray-900">{widget.birthdayData.friendName}</div>
              <div className="text-xs text-gray-500">{new Date(widget.birthdayData.birthDate).toLocaleDateString()}</div>
            </div>
          ) : (
            <div className="text-center text-xs text-gray-500">
              Click to add birthday
            </div>
          )}
        </div>
      ) : widget.id === 'mood' && widget.moodData ? (
        <div className="flex-1 flex items-center justify-center py-4">
          {widget.moodData.currentMood ? (
            <div className="text-center">
              <div className="text-2xl mb-1">
                {['😢', '😕', '😐', '😊', '😁'][widget.moodData.currentMood - 1]}
              </div>
              <div className="text-xs text-gray-600">
                {['Very Poor', 'Poor', 'Neutral', 'Good', 'Excellent'][widget.moodData.currentMood - 1]}
              </div>
            </div>
          ) : (
            <div className="text-center text-xs text-gray-500">
              Tap to log mood
            </div>
          )}
        </div>
      ) : widget.id === 'journal' && widget.journalData ? (
        <div className="flex-1 flex items-center justify-center py-4">
          {widget.journalData.todaysEntry ? (
            <div className="text-center px-2">
              <div className="text-lg mb-1">📝</div>
              <div className="text-xs text-gray-700 truncate mb-1">
                {widget.journalData.todaysEntry.slice(0, 40)}...
              </div>
              <div className="text-xs text-gray-500">
                {widget.journalData.todaysEntry.split(' ').length} words
              </div>
            </div>
          ) : (
            <div className="text-center text-xs text-gray-500">
              No entry today
            </div>
          )}
        </div>
      ) : widget.id === 'gratitude' && widget.gratitudeData ? (
        <div className="flex-1 flex items-center justify-center py-4">
          {widget.gratitudeData.gratitudeItems && widget.gratitudeData.gratitudeItems.length > 0 && widget.gratitudeData.gratitudeItems[0] ? (
            <div className="text-center px-2">
              <div className="text-lg mb-1">✨</div>
              <div className="text-xs text-gray-700 truncate mb-1">
                {widget.gratitudeData.gratitudeItems[0].slice(0, 30)}...
              </div>
              <div className="text-xs text-gray-500">
                {widget.gratitudeData.gratitudeItems.filter(item => item.trim()).length} items
              </div>
            </div>
          ) : (
            <div className="text-center text-xs text-gray-500">
              What are you grateful for?
            </div>
          )}
        </div>
      ) : widget.id === 'quit_habit' && widget.quitHabitData ? (
        <div className="flex-1 flex flex-col justify-center p-3">
          {widget.quitHabitData.habitName && widget.quitHabitData.quitDate ? (
            <div className="space-y-3">
              {/* Header with icon and habit */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-sm">🚫</span>
                <span className="font-medium text-gray-700">
                  Quitting {widget.quitHabitData.habitName}
                </span>
              </div>
              
              {/* Since date */}
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <span className="text-sm">📅</span>
                <span>Since {new Date(widget.quitHabitData.quitDate).toLocaleDateString()}</span>
              </div>

              {/* Days clean - main counter */}
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-green-600">
                  {(() => {
                    const quitDate = new Date(widget.quitHabitData.quitDate);
                    const today = new Date();
                    const daysSince = Math.floor((today.getTime() - quitDate.getTime()) / (1000 * 60 * 60 * 24));
                    return daysSince;
                  })()}
                </span>
                <span className="text-sm text-green-600 font-medium">days clean</span>
                {progress.isToday && progress.value >= widget.target ? (
                  <span className="text-green-500 text-sm ml-1" title="Checked in today">✓</span>
                ) : null}
              </div>

              {/* Daily savings */}
              {widget.quitHabitData.costPerDay && widget.quitHabitData.costPerDay > 0 && (
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <span className="text-sm">💰</span>
                  <span>
                    Daily savings: {widget.quitHabitData.currency || '$'}{widget.quitHabitData.costPerDay.toFixed(2)}
                  </span>
                </div>
              )}

              {/* Milestone achievement (only if achieved) */}
              {(() => {
                const quitDate = new Date(widget.quitHabitData.quitDate);
                const today = new Date();
                const daysSince = Math.floor((today.getTime() - quitDate.getTime()) / (1000 * 60 * 60 * 24));
                
                const milestones = [
                  { days: 1, emoji: '🌟', label: 'First Day!' },
                  { days: 3, emoji: '💪', label: '3 Days!' },
                  { days: 7, emoji: '🎉', label: 'One Week!' },
                  { days: 14, emoji: '⭐', label: 'Two Weeks!' },
                  { days: 30, emoji: '🏆', label: 'One Month!' },
                  { days: 90, emoji: '🎊', label: '3 Months!' },
                  { days: 365, emoji: '👑', label: 'One Year!' }
                ];
                
                const achieved = milestones.filter(m => daysSince >= m.days);
                
                if (achieved.length > 0) {
                  const latest = achieved[achieved.length - 1];
                  return (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-sm">{latest.emoji}</span>
                      <span className="text-amber-600 font-medium">{latest.label}</span>
                    </div>
                  );
                }
                return null;
              })()}
            </div>
          ) : (
            <div className="text-center text-xs text-gray-500">
              Click to set up habit tracking
            </div>
          )}
        </div>
      ) : (
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
      )}
      
      {progress.streak > 0 && (
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <span className="text-orange-500">🔥</span>
            <span className="text-sm text-gray-600">{progress.streak} day streak</span>
          </div>
          {progress.streak >= 7 && (
            <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded-full font-medium">
              {progress.streak >= 30 ? '🏆 Champion' : progress.streak >= 14 ? '⭐ Strong' : '🌟 Weekly'}
            </span>
          )}
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
  // Track tab switching to show transitions
  const [isTabSwitching, setIsTabSwitching] = useState(false)
  // Use global cache for user preferences
  const { 
    data: userPrefs, 
    loading: prefsLoading,
    error: prefsError,
    refetch: refetchPrefs
  } = useGlobalCache(
    'user-preferences',
    getUserPreferencesClient,
    { 
      ttl: 10 * 60 * 1000, // 10 minutes cache
      prefetch: true 
    }
  )
  
  // Initialize activeBucket from localStorage only
  // We'll sync with user preferences after loading
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
  } = useWidgets();

  const [activeBucket, setActiveBucket] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("active_bucket");
      console.log(`[DEBUG] Initializing state from localStorage. Found: ${saved}`);
      if (saved) return saved;
    }
    console.log('[DEBUG] No value in localStorage. Initializing state to "Health".');
    return "Health";
  });
  
  // Custom setter that persists to localStorage and Supabase
  // This is the main function that handles tab switching and ensures persistence
  const updateActiveBucket = useCallback((bucket: string) => {
    console.log(`[DEBUG] updateActiveBucket called. Attempting to switch to: ${bucket}`);
    if (bucket === activeBucket) {
      console.log('[DEBUG] Bucket is already active. No change.');
      return;
    }

    setIsTabSwitching(true);
    setActiveBucket(bucket);
    console.log(`[DEBUG] Set activeBucket state to: ${bucket}`);

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('active_bucket', bucket);
        console.log(`[DEBUG] Wrote to localStorage: ${bucket}`);
      } catch (error) {
        console.error('[DEBUG] Error writing to localStorage:', error);
      }
    }

    getUserPreferencesClient().then(freshPrefs => {
      if (!freshPrefs) {
        console.error('[DEBUG] Cannot save to Supabase: no fresh preferences found.');
        return;
      }
      const updatedPrefs = { ...freshPrefs, active_bucket: bucket };
      console.log(`[DEBUG] Preparing to save to Supabase:`, updatedPrefs);
      saveUserPreferences(updatedPrefs)
        .then(success => {
          console.log(`[DEBUG] Supabase save ${success ? 'succeeded' : 'failed'}.`);
          if (success) {
            refetchPrefs();
            console.log('[DEBUG] Refetched preferences after successful save.');
          }
        })
        .catch(err => console.error('[DEBUG] Error saving to Supabase:', err));
    });
    
    // 3. Document title update for better UX
    if (typeof window !== 'undefined') {
      document.title = `${bucket} - LifeboardAI Dashboard`;
    }
    
    // End transition after a short delay for smooth UI
    setTimeout(() => {
      setIsTabSwitching(false);
    }, 300); // Match this with CSS transition duration
  }, [activeBucket, refetchPrefs]);
  
  // Extra effect to ensure activeBucket is added as a dependency
  // This prevents stale closures in the activeBucket reference
  useEffect(() => {
    console.log('[Dashboard] Active bucket is now:', activeBucket);
  }, [activeBucket]);
  
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [isWidgetSheetOpen, setIsWidgetSheetOpen] = useState(false)
  const [isEditingWidget, setIsEditingWidget] = useState<WidgetInstance | null>(null)
  const [newlyCreatedWidgetId, setNewlyCreatedWidgetId] = useState<string | null>(null)
  
  // Effect to sync with Supabase preferences when they load.
  useEffect(() => {
    if (userPrefs && !prefsLoading) {
      console.log(`[DEBUG] Sync effect running. Prefs loaded. Current activeBucket: ${activeBucket}`);
      console.log(`[DEBUG] Supabase active_bucket: ${userPrefs.active_bucket}`);
      
      // If Supabase has a value and it's different from the current state, sync it.
      if (userPrefs.active_bucket && userPrefs.active_bucket !== activeBucket) {
        console.log(`[DEBUG] Syncing from Supabase: ${activeBucket} -> ${userPrefs.active_bucket}`);
        setActiveBucket(userPrefs.active_bucket);
        if (typeof window !== 'undefined') {
          localStorage.setItem('active_bucket', userPrefs.active_bucket);
          console.log(`[DEBUG] Updated localStorage with value from Supabase: ${userPrefs.active_bucket}`);
        }
      }
    }
  }, [userPrefs, prefsLoading]); // activeBucket is intentionally omitted to prevent state-loop
  


  
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
          ...(widgetOrTemplate.id === 'quit_habit' && { quitHabitData: { habitName: '', quitDate: '', costPerDay: 0, currency: '$', relapses: [], milestones: [
            { days: 1, label: '1 Day', achieved: false },
            { days: 7, label: '1 Week', achieved: false },
            { days: 30, label: '1 Month', achieved: false },
            { days: 90, label: '3 Months', achieved: false },
            { days: 365, label: '1 Year', achieved: false }
          ], motivationalNote: '' } }),
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
    if (widget.id === 'quit_habit') {
      // For quit habit widgets, the "check-in" just confirms they're still clean
      // We'll set progress to 1 to indicate they checked in today
      updateProgress(widget.instanceId, 1)
    } else {
      // Use increment if available in widget data, otherwise default to 1
      const incrementValue = (widget as any).increment || 1
      updateProgress(widget.instanceId, incrementValue)
    }
  }, [updateProgress])
  
  // Calendar helpers
  const today = new Date()
  const weekDays = Array.from({ length: 7 }).map((_, i) => addDays(today, i))
  
  return (
    <>
      <main className="max-w-7xl mx-auto w-full">
        <div className="bg-white rounded-lg border border-gray-100 shadow-sm">
          <div className="flex flex-col lg:flex-row gap-6 px-6 pt-6 pb-6">
            {/* Main content area - widgets */}
            <div className="flex-1 min-w-0">
              <div className="bg-white rounded-lg border border-gray-100 shadow-sm w-full">
                <div className="p-6">
                  <OptimizedBucketTabs
                    selectedBucket={activeBucket}
                    onSelectBucket={updateActiveBucket}
                  />
                  <div className="flex justify-between items-center mb-6 mt-6">
                    <h2 className="text-2xl font-semibold text-gray-900">{activeBucket} Widgets</h2>
                    <Button onClick={() => setIsWidgetSheetOpen(true)}>
                      <Plus className="-ml-1 mr-2 h-5 w-5" />
                      Add Widget
                    </Button>
                  </div>

                  {/* Summary Stats Row */}
                  {currentWidgets.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                      <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
                        <div className="flex items-center">
                          <div className="p-2 bg-green-100 rounded-lg">
                            <span className="text-green-600 text-lg">✅</span>
                          </div>
                          <div className="ml-3">
                            <p className="text-sm font-medium text-green-900">Completed Today</p>
                            <p className="text-lg font-bold text-green-600">
                              {(() => {
                                const completedToday = currentWidgets.filter(widget => {
                                  const progress = getProgressForWidget(widget.instanceId);
                                  return progress.isToday && progress.value >= widget.target;
                                }).length;
                                return `${completedToday}/${currentWidgets.length}`;
                              })()}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-center">
                          <div className="p-2 bg-blue-100 rounded-lg">
                            <span className="text-blue-600 text-lg">🔥</span>
                          </div>
                          <div className="ml-3">
                            <p className="text-sm font-medium text-blue-900">Best Streak</p>
                            <p className="text-lg font-bold text-blue-600">
                              {(() => {
                                const maxStreak = Math.max(...currentWidgets.map(widget => {
                                  const progress = getProgressForWidget(widget.instanceId);
                                  return progress.streak || 0;
                                }), 0);
                                return `${maxStreak} days`;
                              })()}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="bg-gradient-to-r from-purple-50 to-violet-50 border border-purple-200 rounded-lg p-4">
                        <div className="flex items-center">
                          <div className="p-2 bg-purple-100 rounded-lg">
                            <span className="text-purple-600 text-lg">⚡</span>
                          </div>
                          <div className="ml-3">
                            <p className="text-sm font-medium text-purple-900">Active Widgets</p>
                            <p className="text-lg font-bold text-purple-600">{currentWidgets.length}</p>
                          </div>
                        </div>
                      </div>

                      <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-lg p-4">
                        <div className="flex items-center">
                          <div className="p-2 bg-amber-100 rounded-lg">
                            <span className="text-amber-600 text-lg">🎯</span>
                          </div>
                          <div className="ml-3">
                            <p className="text-sm font-medium text-amber-900">Success Rate</p>
                            <p className="text-lg font-bold text-amber-600">
                              {(() => {
                                const completedToday = currentWidgets.filter(widget => {
                                  const progress = getProgressForWidget(widget.instanceId);
                                  return progress.isToday && progress.value >= widget.target;
                                }).length;
                                const rate = currentWidgets.length > 0 ? Math.round((completedToday / currentWidgets.length) * 100) : 0;
                                return `${rate}%`;
                              })()}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {(widgetsLoading || isTabSwitching) ? (
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
                      {currentWidgets
                        .sort((a, b) => {
                          // Smart sorting: incomplete goals first, then by streak, then by name
                          const progressA = getProgressForWidget(a.instanceId);
                          const progressB = getProgressForWidget(b.instanceId);
                          
                          const completedA = progressA.isToday && progressA.value >= a.target;
                          const completedB = progressB.isToday && progressB.value >= b.target;
                          
                          // Incomplete widgets first
                          if (completedA !== completedB) {
                            return completedA ? 1 : -1;
                          }
                          
                          // Then by streak (higher streaks first)
                          if (progressA.streak !== progressB.streak) {
                            return (progressB.streak || 0) - (progressA.streak || 0);
                          }
                          
                          // Finally by name
                          return a.name.localeCompare(b.name);
                        })
                        .map((widget) => (
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
              </div>
            </div>
            
            {/* Right Sidebar */}
            <div className="space-y-6 w-full lg:w-[300px] xl:w-[350px] flex-shrink-0 flex-grow-0">
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
