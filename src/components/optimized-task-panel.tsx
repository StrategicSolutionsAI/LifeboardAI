"use client"

import React, { useState, memo, useCallback, useRef, useEffect } from "react"
import { format, addDays, isSameDay } from "date-fns"
import { ChevronRight, ChevronDown, Loader2 } from "lucide-react"
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd"
import { useTasks } from "@/hooks/use-tasks"
import { useVirtualScroll, useRAFThrottle } from "@/lib/performance-utils"
import { TaskListSkeleton } from "./loading-skeletons"
import { cn } from "@/lib/utils"

// Memoized calendar day button
const CalendarDay = memo(({ 
  day, 
  isSelected, 
  isToday, 
  onClick 
}: { 
  day: Date
  isSelected: boolean
  isToday: boolean
  onClick: () => void
}) => (
  <button
    onClick={onClick}
    className={cn(
      "text-xs py-1 rounded transition-all duration-150",
      isSelected && "bg-indigo-500 text-white",
      !isSelected && isToday && "ring-1 ring-indigo-500",
      !isSelected && !isToday && "text-gray-900 hover:bg-gray-100"
    )}
  >
    {format(day, 'd')}
  </button>
))

CalendarDay.displayName = "CalendarDay"

// Memoized task item with drag support
const TaskItemDraggable = memo(({ 
  task, 
  index,
  onToggle 
}: { 
  task: any
  index: number
  onToggle: () => void
}) => (
  <Draggable draggableId={task.id.toString()} index={index}>
    {(provided, snapshot) => (
      <li
        ref={provided.innerRef}
        {...provided.draggableProps}
        {...provided.dragHandleProps}
        className={cn(
          "flex items-center space-x-3 p-2 rounded-lg transition-all duration-150",
          snapshot.isDragging ? "bg-purple-50 shadow-lg" : "bg-white hover:bg-gray-50"
        )}
      >
        <button
          onClick={onToggle}
          className={cn(
            "w-4 h-4 rounded-full border-2 transition-colors duration-150",
            task.completed 
              ? "bg-purple-500 border-purple-500" 
              : "border-purple-300 hover:border-purple-500"
          )}
        />
        <span className={cn(
          "flex-1 text-sm",
          task.completed && "line-through text-gray-500"
        )}>
          {task.content}
        </span>
      </li>
    )}
  </Draggable>
))

TaskItemDraggable.displayName = "TaskItemDraggable"

// Virtual scrolling task list
const VirtualTaskList = memo(({ 
  tasks, 
  onToggle,
  loading
}: { 
  tasks: any[]
  onToggle: (taskId: string) => void
  loading: boolean
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [containerHeight, setContainerHeight] = useState(400)
  
  // Use RAF throttling for scroll updates
  const handleScroll = useRAFThrottle(() => {
    if (containerRef.current) {
      setScrollTop(containerRef.current.scrollTop)
    }
  }, [])
  
  // Update container height on resize
  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        setContainerHeight(containerRef.current.clientHeight)
      }
    }
    
    updateHeight()
    window.addEventListener('resize', updateHeight)
    return () => window.removeEventListener('resize', updateHeight)
  }, [])
  
  // Virtual scrolling calculations
  const { items: visibleTasks, totalHeight } = useVirtualScroll(
    tasks.length,
    48, // Approximate height of each task item
    containerHeight,
    scrollTop,
    5 // Overscan
  )
  
  if (loading) {
    return <TaskListSkeleton count={5} />
  }
  
  if (tasks.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 text-sm">
        No tasks for this day
      </div>
    )
  }
  
  return (
    <div 
      ref={containerRef}
      className="relative h-[400px] overflow-y-auto"
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight }}>
        {visibleTasks.map(({ index, start }) => {
          const task = tasks[index]
          return (
            <div
              key={task.id}
              style={{
                position: 'absolute',
                top: start,
                left: 0,
                right: 0,
                height: 48
              }}
            >
              <div className="flex items-center space-x-3 p-2 bg-white rounded-lg hover:bg-gray-50">
                <button
                  onClick={() => onToggle(task.id)}
                  className={cn(
                    "w-4 h-4 rounded-full border-2 transition-colors",
                    task.completed 
                      ? "bg-purple-500 border-purple-500" 
                      : "border-purple-300 hover:border-purple-500"
                  )}
                />
                <span className={cn(
                  "flex-1 text-sm",
                  task.completed && "line-through text-gray-500"
                )}>
                  {task.content}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
})

VirtualTaskList.displayName = "VirtualTaskList"

export function OptimizedTaskPanel() {
  const [date, setDate] = useState(() => new Date())
  const [selectedDate, setSelectedDate] = useState(() => new Date())
  const [newDailyTask, setNewDailyTask] = useState("")
  const [newOpenTask, setNewOpenTask] = useState("")
  const [hourlyViewOpen, setHourlyViewOpen] = useState(true)
  
  // Use optimized task hook
  const {
    dailyTasks,
    allTasks,
    loading,
    createTask,
    toggleTaskCompletion,
    batchUpdateTasks
  } = useTasks(selectedDate)
  
  // Filter visible tasks
  const dailyVisibleTasks = dailyTasks.filter(t => !t.completed)
  const openTasksToShow = allTasks.filter(t => !t.completed)
  
  // Get week days
  const getWeekDays = useCallback(() => {
    const start = new Date(date)
    start.setDate(start.getDate() - start.getDay())
    return Array.from({ length: 7 }, (_, i) => addDays(start, i))
  }, [date])
  
  const weekDays = getWeekDays()
  
  // Handle date change
  const handleDateChange = useCallback((newDate: Date) => {
    const d = new Date(newDate.getFullYear(), newDate.getMonth(), newDate.getDate())
    setDate(d)
    setSelectedDate(d)
  }, [])
  
  // Handle task creation
  const handleAddDailyTask = useCallback(async () => {
    if (newDailyTask.trim()) {
      await createTask(newDailyTask, selectedDate.toISOString().split('T')[0])
      setNewDailyTask("")
    }
  }, [newDailyTask, selectedDate, createTask])
  
  const handleAddOpenTask = useCallback(async () => {
    if (newOpenTask.trim()) {
      await createTask(newOpenTask, null)
      setNewOpenTask("")
    }
  }, [newOpenTask, createTask])
  
  // Handle drag and drop
  const handleDragEnd = useCallback((result: DropResult) => {
    if (!result.destination) return
    
    const { source, destination } = result
    
    if (source.droppableId === destination.droppableId && 
        source.index === destination.index) {
      return
    }
    
    // Reorder tasks logic here
    // For now, just log the action
    console.log('Task moved from', source, 'to', destination)
  }, [])
  
  return (
    <aside className="w-96 bg-white border-l border-gray-200 overflow-y-auto h-full">
      <div className="p-4 space-y-6">
        {/* Calendar */}
        <div>
          <h3 className="font-medium text-gray-900 mb-3">Calendar</h3>
          <div className="bg-white rounded-lg border border-gray-100 p-3">
            <div className="flex justify-between items-center mb-3">
              <span className="font-medium text-sm">{format(date, 'MMMM yyyy')}</span>
              <div className="flex gap-1">
                <button 
                  onClick={() => handleDateChange(addDays(date, -7))}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <ChevronRight className="w-4 h-4 rotate-180" />
                </button>
                <button 
                  onClick={() => handleDateChange(addDays(date, 7))}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-7 gap-1 mb-1 text-center text-xs text-gray-500">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                <div key={i}>{day}</div>
              ))}
            </div>
            
            <div className="grid grid-cols-7 gap-1 text-center">
              {weekDays.map((d) => (
                <CalendarDay
                  key={d.toISOString()}
                  day={d}
                  isSelected={isSameDay(d, selectedDate)}
                  isToday={isSameDay(d, new Date())}
                  onClick={() => setSelectedDate(d)}
                />
              ))}
            </div>
          </div>
        </div>
        
        {/* Daily Tasks */}
        <div>
          <h3 className="font-medium text-gray-900 mb-3">
            Tasks for {format(selectedDate, 'MMM d')}
          </h3>
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={newDailyTask}
                onChange={(e) => setNewDailyTask(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddDailyTask()}
                placeholder="Add a task..."
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
              />
              <button
                onClick={handleAddDailyTask}
                className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors text-sm"
              >
                Add
              </button>
            </div>
            
            <VirtualTaskList
              tasks={dailyVisibleTasks}
              onToggle={toggleTaskCompletion}
              loading={loading}
            />
          </div>
        </div>
        
        {/* Hourly View */}
        <div>
          <button
            onClick={() => setHourlyViewOpen(!hourlyViewOpen)}
            className="flex items-center gap-2 font-medium text-gray-900 mb-3"
          >
            {hourlyViewOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            Hourly View
          </button>
          
          {hourlyViewOpen && (
            <DragDropContext onDragEnd={handleDragEnd}>
              <div className="space-y-2">
                {['7 AM', '8 AM', '9 AM', '10 AM', '11 AM', '12 PM', '1 PM', '2 PM', '3 PM', '4 PM', '5 PM', '6 PM'].map(hour => (
                  <Droppable key={hour} droppableId={hour}>
                    {(provided) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className="bg-gray-50 rounded-lg p-2 min-h-[40px]"
                      >
                        <div className="text-xs text-gray-500 mb-1">{hour}</div>
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                ))}
              </div>
            </DragDropContext>
          )}
        </div>
      </div>
    </aside>
  )
}
