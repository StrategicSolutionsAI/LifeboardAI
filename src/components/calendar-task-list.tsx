"use client";

import React, { useState, useMemo, useCallback } from "react";
import { format, isToday, isTomorrow, isThisWeek, isWithinInterval, addDays, startOfWeek, endOfWeek, addWeeks, isBefore, startOfDay, differenceInDays } from "date-fns";
import { ChevronRight, ChevronDown, ChevronLeft, Clock, Star, Calendar, AlertCircle, ChevronUp, MoreHorizontal } from "lucide-react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { useTasksContext } from "@/contexts/tasks-context";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

interface CalendarTaskListProps {
  selectedDate: Date;
  onDateChange?: (date: Date) => void;
  availableBuckets?: string[];
  selectedBucket?: string;
  isDragging?: boolean;
  disableInternalDragDrop?: boolean;
}

// Enhanced task card component with priority-based styling and progressive disclosure
interface EnhancedTaskCardProps {
  task: any;
  index: number;
  isExpanded: boolean;
  onToggle: (taskId: string) => void;
  onExpand: (taskId: string) => void;
  onQuickAction?: (taskId: string, action: string) => void;
  availableBuckets?: string[];
  batchUpdateTasks?: any;
}

function EnhancedTaskCard({ 
  task, 
  index, 
  isExpanded, 
  onToggle, 
  onExpand, 
  onQuickAction, 
  availableBuckets = [],
  batchUpdateTasks 
}: EnhancedTaskCardProps) {
  const getPriorityStyles = (priority?: string | number) => {
    const priorityStr = priority?.toString().toLowerCase();
    switch (priorityStr) {
      case 'critical':
      case '4': return {
        border: 'border-l-red-500 border-red-200/50',
        bg: 'bg-gradient-to-r from-red-50/80 to-white',
        icon: 'text-red-600',
        badge: 'bg-red-100 text-red-700 border-red-200'
      };
      case 'high':
      case '3': return {
        border: 'border-l-orange-500 border-orange-200/50',
        bg: 'bg-gradient-to-r from-orange-50/80 to-white',
        icon: 'text-orange-600',
        badge: 'bg-orange-100 text-orange-700 border-orange-200'
      };
      case 'medium': 
      case '2': return {
        border: 'border-l-blue-500 border-blue-200/50',
        bg: 'bg-gradient-to-r from-blue-50/80 to-white',
        icon: 'text-blue-600',
        badge: 'bg-blue-100 text-blue-700 border-blue-200'
      };
      case 'low':
      case '1': return {
        border: 'border-l-gray-400 border-gray-200/50',
        bg: 'bg-gradient-to-r from-gray-50/80 to-white',
        icon: 'text-gray-600',
        badge: 'bg-gray-100 text-gray-700 border-gray-200'
      };
      default: return {
        border: 'border-l-gray-300 border-gray-200/50',
        bg: 'bg-white',
        icon: 'text-gray-400',
        badge: 'bg-gray-100 text-gray-600 border-gray-200'
      };
    }
  };

  const formatDueDate = (dueDate?: { date: string }) => {
    if (!dueDate?.date) return null;
    const date = new Date(dueDate.date);
    const today = new Date();
    const diffDays = differenceInDays(date, startOfDay(today));
    
    if (diffDays < 0) return { text: `${Math.abs(diffDays)} days overdue`, color: 'text-red-600', urgent: true };
    if (diffDays === 0) return { text: 'Today', color: 'text-blue-600', urgent: false };
    if (diffDays === 1) return { text: 'Tomorrow', color: 'text-green-600', urgent: false };
    if (diffDays <= 7) return { text: `${diffDays} days`, color: 'text-gray-600', urgent: false };
    return { text: format(date, 'MMM d'), color: 'text-gray-500', urgent: false };
  };

  const dueDateInfo = formatDueDate(task.due);
  const priorityStyles = getPriorityStyles(task.priority);
  
  return (
    <Draggable draggableId={task.id.toString()} index={index} key={task.id}>
      {(provided: any) => (
        <li
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          style={provided.draggableProps.style}
          className={`group relative ${priorityStyles.bg} ${priorityStyles.border} border-l-4 border-y border-r rounded-xl transition-all duration-300 hover:shadow-lg hover:scale-[1.02] ${
            isExpanded ? 'shadow-md scale-[1.01]' : ''
          } cursor-grab active:cursor-grabbing`}
        >
          {/* Premium Task Row */}
          <div className="flex items-start gap-4 px-5 py-4">
            <label className="flex items-center cursor-pointer group">
              <input
                type="checkbox"
                checked={task.completed ?? false}
                onChange={(e) => {
                  e.stopPropagation();
                  onToggle(task.id.toString());
                }}
                className="sr-only"
              />
              <div className={`w-5 h-5 rounded-lg border-2 transition-all duration-200 flex items-center justify-center ${
                task.completed 
                  ? 'bg-indigo-600 border-indigo-600 scale-110' 
                  : 'border-gray-300 hover:border-indigo-400 group-hover:border-indigo-500 group-hover:scale-110'
              }`}>
                {task.completed && (
                  <svg className="w-3 h-3 text-white animate-in fade-in duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            </label>
            
            <div 
              className="flex-1 min-w-0 cursor-pointer" 
              onClick={() => onExpand(task.id.toString())}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium leading-relaxed transition-all duration-200 ${
                    task.completed ? 'line-through text-gray-400' : 'text-gray-900'
                  }`}>
                    {task.content}
                  </p>
                  
                  {/* Metadata Row */}
                  <div className="flex items-center gap-2 mt-2">
                    {task.bucket && (
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${priorityStyles.badge}`}>
                        {task.bucket}
                      </span>
                    )}
                    
                    {task.priority && (
                      <div className="flex items-center gap-1">
                        <Star size={12} className={`transition-colors duration-200 ${priorityStyles.icon} fill-current`} />
                        <span className={`text-xs font-medium ${priorityStyles.icon}`}>
                          {task.priority?.toString().toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex flex-col items-end gap-2 text-right">
                  {dueDateInfo && (
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                      dueDateInfo.urgent 
                        ? 'bg-red-100 text-red-700 border border-red-200' 
                        : 'bg-gray-100 text-gray-600 border border-gray-200'
                    }`}>
                      {dueDateInfo.urgent && <AlertCircle size={11} />}
                      <span>{dueDateInfo.text}</span>
                    </div>
                  )}
                  
                  {/* Expand/Collapse Indicator */}
                  <div className={`w-6 h-6 rounded-lg bg-gray-100/80 flex items-center justify-center transition-all duration-200 ${
                    isExpanded ? 'bg-indigo-100 rotate-90' : 'group-hover:bg-gray-200/80'
                  }`}>
                    <ChevronRight size={12} className={`transition-colors duration-200 ${
                      isExpanded ? 'text-indigo-600' : 'text-gray-500 group-hover:text-gray-700'
                    }`} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Premium Expanded Content */}
          {isExpanded && (
            <div className="px-5 pb-4 border-t border-gray-200/60 bg-gradient-to-b from-gray-50/30 to-gray-50/60 animate-in slide-in-from-top-2 duration-300">
              {/* Task Details */}
              {task.description && (
                <div className="mt-4 mb-4 p-3 bg-white/80 rounded-lg border border-gray-200/60">
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {task.description}
                  </p>
                </div>
              )}
              
              {/* Premium Action Buttons */}
              <div className="flex items-center gap-2 mt-4 flex-wrap">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onQuickAction?.(task.id.toString(), 'reschedule');
                  }}
                  className="group flex items-center gap-2 px-3 py-2 text-xs font-medium text-gray-600 hover:text-indigo-600 bg-white/80 hover:bg-indigo-50 border border-gray-200/60 hover:border-indigo-200 rounded-lg transition-all duration-200 shadow-sm hover:shadow"
                >
                  <Calendar size={14} className="group-hover:scale-110 transition-transform duration-200" />
                  Reschedule
                </button>
                
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onQuickAction?.(task.id.toString(), 'priority');
                  }}
                  className="group flex items-center gap-2 px-3 py-2 text-xs font-medium text-gray-600 hover:text-orange-600 bg-white/80 hover:bg-orange-50 border border-gray-200/60 hover:border-orange-200 rounded-lg transition-all duration-200 shadow-sm hover:shadow"
                >
                  <Star size={14} className="group-hover:scale-110 transition-transform duration-200" />
                  Priority
                </button>
                
                {availableBuckets?.length > 0 && (
                  <select
                    value={task.bucket || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      batchUpdateTasks?.([
                        { taskId: task.id.toString(), updates: { bucket: val || undefined } }
                      ]).catch((err: any) => console.error('Failed to update bucket', err));
                    }}
                    className="px-3 py-2 text-xs font-medium bg-white/80 border border-gray-200/60 rounded-lg hover:bg-gray-50 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all duration-200 shadow-sm"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <option value="">No project</option>
                    {availableBuckets.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          )}
        </li>
      )}
    </Draggable>
  );
}

// Smart task grouping function
function useTaskGrouping(tasks: any[]) {
  return useMemo(() => {
    const now = new Date();
    const today = startOfDay(now);
    
    const groups = {
      overdue: [] as any[],
      today: [] as any[],
      tomorrow: [] as any[],
      thisWeek: [] as any[],
      nextWeek: [] as any[],
      later: [] as any[]
    };

    tasks.forEach(task => {
      if (!task.due?.date) {
        groups.later.push(task);
        return;
      }

      const taskDate = startOfDay(new Date(task.due.date));
      
      if (isBefore(taskDate, today)) {
        groups.overdue.push(task);
      } else if (isToday(taskDate)) {
        groups.today.push(task);
      } else if (isTomorrow(taskDate)) {
        groups.tomorrow.push(task);
      } else if (isThisWeek(taskDate)) {
        groups.thisWeek.push(task);
      } else if (isWithinInterval(taskDate, { 
        start: startOfWeek(addWeeks(now, 1)), 
        end: endOfWeek(addWeeks(now, 1)) 
      })) {
        groups.nextWeek.push(task);
      } else {
        groups.later.push(task);
      }
    });

    return groups;
  }, [tasks]);
}

export function CalendarTaskList({ availableBuckets = [], selectedBucket, disableInternalDragDrop = false }: CalendarTaskListProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDailyCollapsed, setIsDailyCollapsed] = useState(false);
  const [isOpenCollapsed, setIsOpenCollapsed] = useState(false);
  const [taskView, setTaskView] = useState<'Today' | 'Upcoming' | 'Master List'>('Today');

  // Use unified task context
  const {
    allTasks,
    upcomingTasks,
    loading,
    createTask,
    toggleTaskCompletion,
    batchUpdateTasks,
  } = useTasksContext();

  // Enhanced state management for upcoming tasks view
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [groupCollapsed, setGroupCollapsed] = useState<Record<string, boolean>>({
    overdue: false,
    today: true, 
    tomorrow: false,
    thisWeek: true,
    nextWeek: true,
    later: true
  });

  // Filter upcoming tasks by selected bucket if provided
  const filteredUpcomingTasks = useMemo(() => {
    if (selectedBucket) {
      return upcomingTasks.filter(t => t.bucket === selectedBucket);
    }
    return upcomingTasks;
  }, [upcomingTasks, selectedBucket]);

  // Group upcoming tasks intelligently
  const taskGroups = useTaskGrouping(filteredUpcomingTasks);

  // Handle task expansion
  const handleTaskExpand = useCallback((taskId: string) => {
    setExpandedTasks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  }, []);

  // Handle quick actions
  const handleQuickAction = useCallback((taskId: string, action: string) => {
    console.log(`Quick action: ${action} for task ${taskId}`);
    // TODO: Implement quick actions like reschedule, priority change, etc.
  }, []);

  // Toggle group collapse state
  const toggleGroupCollapse = useCallback((groupKey: string) => {
    setGroupCollapsed(prev => ({
      ...prev,
      [groupKey]: !prev[groupKey]
    }));
  }, []);

  // Today-only list (always use real today, independent of selectedDate)
  const todayStr = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);
  const todayTasks = useMemo(() => {
    let filtered = allTasks.filter(t => !t.completed && !t.hourSlot && t.due?.date === todayStr);
    
    // Filter by selectedBucket if provided
    if (selectedBucket) {
      filtered = filtered.filter(t => t.bucket === selectedBucket);
    }
    
    return filtered;
  }, [allTasks, todayStr, selectedBucket]);

  // Local order for today's tasks, persisted per-day in localStorage
  const todayOrderKey = `daily-order-${todayStr}`;
  
  // Force re-render trigger for today tasks
  const [todayTasksRenderKey, setTodayTasksRenderKey] = React.useState(0);
  
  const todayTasksOrdered = useMemo(() => {
    try {
      if (typeof window === 'undefined') return todayTasks;
      const raw = window.localStorage.getItem(todayOrderKey);
      const idOrder: string[] = raw ? JSON.parse(raw) : [];
      const map = new Map(todayTasks.map(t => [t.id.toString(), t]));
      const ordered: any[] = [];
      idOrder.forEach(id => { if (map.has(id)) { ordered.push(map.get(id)!); map.delete(id); } });
      // Append any new tasks not yet in the stored order
      ordered.push(...Array.from(map.values()));
      return ordered;
    } catch {
      return todayTasks;
    }
  }, [todayTasks, todayOrderKey, todayTasksRenderKey]);

  // Open tasks (only shown in Master List tab)
  const openTasksBase = useMemo(() => {
    let filtered = allTasks.filter(t => !t.completed && !t.hourSlot);
    
    // Filter by selectedBucket if provided
    if (selectedBucket) {
      filtered = filtered.filter(t => t.bucket === selectedBucket);
    }
    
    return filtered;
  }, [allTasks, selectedBucket]);

  // Maintain a local, immediately responsive list for open tasks
  const [openTasksLocal, setOpenTasksLocal] = useState<any[]>([]);

  // Track if we're currently reordering to prevent sync interference
  const [isReordering, setIsReordering] = React.useState(false);

  // Sync local list when membership changes (add/remove), but don't override order on mere metadata updates
  React.useEffect(() => {
    // Don't sync if we're in the middle of a reorder operation
    if (isReordering) {
      console.log('🚫 Skipping sync during reorder operation');
      return;
    }

    const baseMap = new Map(openTasksBase.map(t => [t.id.toString(), t]));
    const localIds = new Set(openTasksLocal.map(t => t.id.toString()));
    
    // Check if any tasks have position values - if so, use API order
    const hasPositions = openTasksBase.some(t => t.position !== undefined);
    console.log('🔍 Sync check - hasPositions:', hasPositions, 'openTasksBase length:', openTasksBase.length, 'openTasksLocal length:', openTasksLocal.length);
    
    if (hasPositions) {
      // Use API order when tasks have positions (they're already sorted by API)
      console.log('✅ Using API order with positions');
      setOpenTasksLocal(openTasksBase);
      return;
    }
    
    let changed = false;
    // Remove items no longer in base
    let next = openTasksLocal.filter(t => baseMap.has(t.id.toString()));
    if (next.length !== openTasksLocal.length) changed = true;
    // Append new items at the end preserving current local order
    openTasksBase.forEach(t => {
      const id = t.id.toString();
      if (!localIds.has(id)) { next.push(t); changed = true; }
    });
    if (changed || openTasksLocal.length === 0) setOpenTasksLocal(next);
  }, [openTasksBase, openTasksLocal, isReordering]);

  // Render from local list
  const openTasksToShow = openTasksLocal.length ? openTasksLocal : openTasksBase;

  // Listen for reorder events from parent DragDropContext
  React.useEffect(() => {
    const handleReorderOpenTasks = (event: CustomEvent) => {
      const { source, destination, draggableId } = event.detail;
      console.log('📨 Received reorder event for openTasks:', { source: source.index, destination: destination.index });
      
      // Set reordering flag to prevent sync interference
      setIsReordering(true);
      
      const list = [...openTasksToShow];
      const [moved] = list.splice(source.index, 1);
      list.splice(destination.index, 0, moved);
      console.log('📝 New task order:', list.map((t, idx) => `${idx}: ${t.content}`));
      
      // Update local state immediately for instant UI feedback
      setOpenTasksLocal(list);
      
      // Persist as positions for all visible tasks
      const updates = list.map((t, idx) => ({ taskId: t.id.toString(), updates: { position: idx } }));
      console.log('💾 Sending position updates:', updates);
      
      batchUpdateTasks(updates)
        .then(() => {
          console.log('✅ Position updates successful');
          // Clear reordering flag after successful API call
          setTimeout(() => setIsReordering(false), 1000);
        })
        .catch(err => {
          console.error('Failed to persist order', err);
          // Clear reordering flag even on error
          setIsReordering(false);
        });
    };

    const handleReorderDailyTasks = (event: CustomEvent) => {
      const { source, destination } = event.detail;
      console.log('📨 Received reorder event for dailyTasks:', { source: source.index, destination: destination.index });
      
      const list = [...todayTasksOrdered];
      const [moved] = list.splice(source.index, 1);
      list.splice(destination.index, 0, moved);
      console.log('📝 New daily task order:', list.map((t, idx) => `${idx}: ${t.content}`));
      
      // Force immediate re-render by updating the localStorage and triggering a state change
      if (typeof window !== 'undefined') {
        const newOrder = list.map(t => t.id.toString());
        try { 
          window.localStorage.setItem(todayOrderKey, JSON.stringify(newOrder)); 
          console.log('💾 Saved daily task order to localStorage');
          
          // Trigger a custom event to force re-render of today tasks
          window.dispatchEvent(new CustomEvent('todayTasksReordered'));
        } catch {}
      }
    };

    const handleReorderMasterTodayTasks = (event: CustomEvent) => {
      const { source, destination } = event.detail;
      console.log('📨 Received reorder event for masterTodayTasks:', { source: source.index, destination: destination.index });
      
      const list = [...todayTasksOrdered];
      const [moved] = list.splice(source.index, 1);
      list.splice(destination.index, 0, moved);
      console.log('📝 New master today task order:', list.map((t, idx) => `${idx}: ${t.content}`));
      
      // Force immediate re-render by updating the localStorage and triggering a state change
      if (typeof window !== 'undefined') {
        const newOrder = list.map(t => t.id.toString());
        try { 
          window.localStorage.setItem(todayOrderKey, JSON.stringify(newOrder)); 
          console.log('💾 Saved master today task order to localStorage');
          
          // Trigger a custom event to force re-render of today tasks
          window.dispatchEvent(new CustomEvent('todayTasksReordered'));
        } catch {}
      }
    };

    const handleReorderUpcomingTasks = (event: CustomEvent) => {
      const { source, destination, draggableId } = event.detail;
      console.log('📨 Received reorder event for upcomingTasks:', { source: source.droppableId, destination: destination.droppableId, draggableId });
      
      // For now, we'll just log this - the upcoming tasks don't have persistent ordering like today tasks
      // The UI should handle this automatically through the task groups reorganization
      console.log('📝 Upcoming task reorder - handled by automatic regrouping');
    };

    const handleTodayTasksReordered = () => {
      console.log('🔄 Forcing today tasks re-render');
      setTodayTasksRenderKey(prev => prev + 1);
    };

    window.addEventListener('reorderOpenTasks', handleReorderOpenTasks as EventListener);
    window.addEventListener('reorderDailyTasks', handleReorderDailyTasks as EventListener);
    window.addEventListener('reorderMasterTodayTasks', handleReorderMasterTodayTasks as EventListener);
    window.addEventListener('reorderUpcomingTasks', handleReorderUpcomingTasks as EventListener);
    window.addEventListener('todayTasksReordered', handleTodayTasksReordered);

    return () => {
      window.removeEventListener('reorderOpenTasks', handleReorderOpenTasks as EventListener);
      window.removeEventListener('reorderDailyTasks', handleReorderDailyTasks as EventListener);
      window.removeEventListener('reorderMasterTodayTasks', handleReorderMasterTodayTasks as EventListener);
      window.removeEventListener('reorderUpcomingTasks', handleReorderUpcomingTasks as EventListener);
      window.removeEventListener('todayTasksReordered', handleTodayTasksReordered);
    };
  }, [openTasksToShow, todayTasksOrdered, todayOrderKey, batchUpdateTasks]);

  // New task input state
  const [newDailyTask, setNewDailyTask] = useState("");
  const [newOpenTask, setNewOpenTask] = useState("");
  const [newUpcomingTask, setNewUpcomingTask] = useState("");
  const [newUpcomingTaskDate, setNewUpcomingTaskDate] = useState("");
  const [taskBucket, setTaskBucket] = useState(selectedBucket || (availableBuckets.length > 0 ? availableBuckets[0] : ''));

  const handleAddDailyTask = async () => {
    if (newDailyTask.trim()) {
      // Always add to today in this sidebar's Today section
      await createTask(newDailyTask, todayStr, undefined, taskBucket);
      setNewDailyTask("");
    }
  };

  const handleAddOpenTask = async () => {
    if (newOpenTask.trim()) {
      await createTask(newOpenTask, null, undefined, taskBucket);
      setNewOpenTask("");
    }
  };

  const handleAddUpcomingTask = async () => {
    if (newUpcomingTask.trim() && newUpcomingTaskDate) {
      await createTask(newUpcomingTask, newUpcomingTaskDate, undefined, taskBucket);
      setNewUpcomingTask("");
      setNewUpcomingTaskDate("");
    }
  };

  // Unified drag and drop handler
  function handleDragEnd(result: DropResult) {
    // Ignore drops if a resize operation is active in the planner
    if (typeof document !== 'undefined' && document.body.classList.contains('lb-resizing')) {
      return;
    }
    if (!result.destination) return;

    const { source, destination, draggableId } = result;

    // Helper functions
    const isHour = (id: string) => id.startsWith('hour-');
    const hourKey = (id: string) => id.replace('hour-', '');

    // Same list reorder - persist for specific lists
    if (source.droppableId === destination.droppableId && source.index !== destination.index) {
      // Reorder for today's list (persist to localStorage, no API call)
      if (destination.droppableId === 'dailyTasks') {
        const list = [...todayTasksOrdered];
        const [moved] = list.splice(source.index, 1);
        list.splice(destination.index, 0, moved);
        if (typeof window !== 'undefined') {
          const newOrder = list.map(t => t.id.toString());
          try { window.localStorage.setItem(todayOrderKey, JSON.stringify(newOrder)); } catch {}
        }
        return;
      }
      // Reorder for open tasks: update local order immediately and persist positions
      if (destination.droppableId === 'openTasks') {
        console.log('🔄 Reordering open tasks:', { source: source.index, destination: destination.index });
        const list = [...openTasksToShow];
        const [moved] = list.splice(source.index, 1);
        list.splice(destination.index, 0, moved);
        console.log('📝 New task order:', list.map((t, idx) => `${idx}: ${t.content}`));
        setOpenTasksLocal(list);
        // Persist as positions for all visible tasks
        const updates = list.map((t, idx) => ({ taskId: t.id.toString(), updates: { position: idx } }));
        console.log('💾 Sending position updates:', updates);
        batchUpdateTasks(updates).catch(err => console.error('Failed to persist order', err));
        return;
      }
    }

    // Handle moves to/from hourly planner (if calendar has hourly view)
    if (source.droppableId === 'dailyTasks' && isHour(destination.droppableId)) {
      // Daily task → Hour slot: Set the hourSlot to schedule the task
      const dstHour = hourKey(destination.droppableId);
      batchUpdateTasks([
        { taskId: draggableId, updates: { hourSlot: dstHour } }
      ]).catch(error => {
        console.error('Failed to update task hourSlot:', error);
      });
      return;
    }

    if (isHour(source.droppableId) && destination.droppableId === 'dailyTasks') {
      // Hour slot → Daily tasks: Remove hourSlot to unschedule
      batchUpdateTasks([
        { taskId: draggableId, updates: { hourSlot: undefined } }
      ]).catch(error => {
        console.error('Failed to remove task hourSlot:', error);
      });
      return;
    }

    if (isHour(source.droppableId) && isHour(destination.droppableId)) {
      // Hour slot → Different hour slot: Change hourSlot
      const dstHour = hourKey(destination.droppableId);
      batchUpdateTasks([
        { taskId: draggableId, updates: { hourSlot: dstHour } }
      ]).catch(error => {
        console.error('Failed to update task hourSlot:', error);
      });
      return;
    }

    // Handle moves between daily and open tasks
    if (source.droppableId === 'openTasks' && destination.droppableId === 'dailyTasks') {
      // Open task → Today list: Set due date to real today
      batchUpdateTasks([
        { taskId: draggableId, updates: { due: { date: todayStr } } }
      ]).catch(error => {
        console.error('Failed to update task due date:', error);
      });
      return;
    }

    if (source.droppableId === 'dailyTasks' && destination.droppableId === 'openTasks') {
      // Daily task → Open: Remove due date
      batchUpdateTasks([
        { taskId: draggableId, updates: { due: undefined } }
      ]).catch(error => {
        console.error('Failed to remove task due date:', error);
      });
      return;
    }

    // Handle moves between Master List today section and open tasks
    if (source.droppableId === 'openTasks' && destination.droppableId === 'masterTodayTasks') {
      // Open task → Master List Today: Set due date to real today
      batchUpdateTasks([
        { taskId: draggableId, updates: { due: { date: todayStr } } }
      ]).catch(error => {
        console.error('Failed to update task due date:', error);
      });
      return;
    }

    if (source.droppableId === 'masterTodayTasks' && destination.droppableId === 'openTasks') {
      // Master List Today → Open: Remove due date
      batchUpdateTasks([
        { taskId: draggableId, updates: { due: undefined } }
      ]).catch(error => {
        console.error('Failed to remove task due date:', error);
      });
      return;
    }

    // Handle reordering within Master List today section
    if (source.droppableId === destination.droppableId && destination.droppableId === 'masterTodayTasks') {
      const list = [...todayTasksOrdered];
      const [moved] = list.splice(source.index, 1);
      list.splice(destination.index, 0, moved);
      if (typeof window !== 'undefined') {
        const newOrder = list.map(t => t.id.toString());
        try { window.localStorage.setItem(todayOrderKey, JSON.stringify(newOrder)); } catch {}
      }
      return;
    }
  }

  if (isCollapsed) {
    return (
      <div className="w-14 bg-white/95 backdrop-blur-sm border border-gray-200/60 rounded-xl shadow-sm p-3">
        <button 
          onClick={() => setIsCollapsed(false)}
          className="w-8 h-8 hover:bg-gray-100/80 rounded-lg transition-all duration-200 flex items-center justify-center group"
          aria-label="Expand task list"
        >
          <ChevronLeft size={18} className="text-gray-500 group-hover:text-gray-700 transition-colors" />
        </button>
      </div>
    );
  }

  return (
    <div className="w-[420px] bg-white/95 backdrop-blur-sm border border-gray-200/60 rounded-xl shadow-sm overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-5 border-b border-gray-100/80 bg-gradient-to-r from-gray-50/30 to-transparent">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 tracking-tight">Tasks</h3>
            <p className="text-sm text-gray-500 mt-0.5">Organize your workflow</p>
          </div>
          <button 
            onClick={() => setIsCollapsed(true)}
            className="w-8 h-8 hover:bg-gray-100/80 rounded-lg transition-all duration-200 flex items-center justify-center group"
            aria-label="Collapse task list"
          >
            <ChevronRight size={18} className="text-gray-400 group-hover:text-gray-600 transition-colors" />
          </button>
        </div>
      </div>

      {/* Premium Task view toggle */}
      <div className="px-6 py-4 bg-gray-50/40">
        <div className="relative flex rounded-xl bg-white border border-gray-200/60 p-1 shadow-sm">
          {/* Background slider */}
          <div 
            className={`absolute top-1 h-8 bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-lg shadow-sm transition-all duration-300 ease-out`}
            style={{ 
              width: 'calc(33.333% - 4px)', 
              transform: `translateX(${taskView === 'Today' ? '2px' : taskView === 'Upcoming' ? 'calc(100% + 2px)' : 'calc(200% + 2px)'})`
            }}
          />
          {(['Today','Upcoming','Master List'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setTaskView(tab)}
              className={`relative z-10 flex-1 h-8 px-4 text-sm font-medium rounded-lg transition-all duration-300 ease-out ${
                taskView === tab
                  ? 'text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Task lists with drag & drop */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full px-6 py-2">
          {!disableInternalDragDrop ? (
            <DragDropContext onDragEnd={handleDragEnd}>
              {renderTaskContent()}
            </DragDropContext>
          ) : (
            renderTaskContent()
          )}
        </div>
      </div>
    </div>
  );

  function renderTaskContent() {
    return (
      <>
        {taskView === 'Today' && (
          <div className="space-y-6">
            {/* Daily tasks */}
            <Droppable droppableId="dailyTasks">
              {(provided: any) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className="space-y-4"
                >
                  <div
                    className="flex items-center justify-between group cursor-pointer select-none py-2"
                    onClick={() => setIsDailyCollapsed((c) => !c)}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center transition-transform duration-200 ${isDailyCollapsed ? 'rotate-0' : 'rotate-90'}`}>
                        <ChevronRight size={14} className="text-white" />
                      </div>
                      <div>
                        <h4 className="text-base font-semibold text-gray-900 tracking-tight">Today's Tasks</h4>
                        <p className="text-sm text-gray-500">{todayTasks.length} {todayTasks.length === 1 ? 'task' : 'tasks'}</p>
                      </div>
                    </div>
                  </div>

                  <div
                    className={`transition-all duration-300 ease-out overflow-hidden ${
                      isDailyCollapsed ? 'max-h-0 opacity-0' : 'max-h-[400px] opacity-100'
                    }`}
                  >
                    <div className="space-y-3">
                      {loading && todayTasks.length === 0 ? (
                        <div className="space-y-3">
                          {[1,2,3].map(i => (
                            <div key={i} className="animate-pulse">
                              <div className="bg-gray-100 h-16 rounded-xl"></div>
                            </div>
                          ))}
                        </div>
                      ) : !loading && todayTasks.length === 0 ? (
                        <div className="text-center py-8">
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-100 to-indigo-200 flex items-center justify-center mx-auto mb-3">
                            <Clock size={20} className="text-indigo-600" />
                          </div>
                          <h5 className="text-sm font-medium text-gray-900 mb-1">No tasks for today</h5>
                          <p className="text-xs text-gray-500">Add a task to get started</p>
                        </div>
                      ) : (
                        todayTasksOrdered.map((t: any, index: number) => (
                          <Draggable draggableId={t.id.toString()} index={index} key={t.id}>
                            {(provided: any) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                style={provided.draggableProps.style}
                                className="group relative bg-white border border-gray-200/60 hover:border-gray-300/80 rounded-xl p-4 transition-all duration-200 hover:shadow-md cursor-grab active:cursor-grabbing"
                              >
                                <div className="flex items-start gap-3">
                                  <label className="flex items-center cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={t.completed ?? false}
                                      onChange={() => toggleTaskCompletion(t.id.toString())}
                                      className="sr-only"
                                    />
                                    <div className={`w-5 h-5 rounded-lg border-2 transition-all duration-200 flex items-center justify-center ${
                                      t.completed 
                                        ? 'bg-indigo-600 border-indigo-600' 
                                        : 'border-gray-300 hover:border-indigo-400 group-hover:border-indigo-500'
                                    }`}>
                                      {t.completed && (
                                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                        </svg>
                                      )}
                                    </div>
                                  </label>
                                  <div className="flex-1 min-w-0">
                                    <p className={`text-sm font-medium leading-relaxed transition-all duration-200 ${
                                      t.completed ? 'line-through text-gray-400' : 'text-gray-900'
                                    }`}>
                                      {t.content}
                                    </p>
                                    {t.bucket && (
                                      <div className="mt-2">
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                                          {t.bucket}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))
                      )}
                      {provided.placeholder}
                    </div>
                  </div>
                </div>
              )}
            </Droppable>

            {/* Premium Add Task Form */}
            {!isDailyCollapsed && (
              <div className="p-4 bg-gradient-to-r from-gray-50/80 to-gray-50/40 rounded-xl border border-gray-200/60 space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <h5 className="text-sm font-medium text-gray-900">Add task for today</h5>
                </div>
                
                {availableBuckets.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-gray-700 block">Project</label>
                    <select
                      value={taskBucket}
                      onChange={(e) => setTaskBucket(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all duration-200"
                    >
                      {availableBuckets.map(bucket => (
                        <option key={bucket} value={bucket}>{bucket}</option>
                      ))}
                    </select>
                  </div>
                )}
                
                <div className="flex gap-3">
                  <input
                    type="text"
                    placeholder="What needs to be done today?"
                    value={newDailyTask}
                    onChange={(e) => setNewDailyTask(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && newDailyTask.trim()) handleAddDailyTask(); }}
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2.5 text-sm bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all duration-200 placeholder-gray-400"
                  />
                  <button
                    onClick={handleAddDailyTask}
                    disabled={!newDailyTask.trim()}
                    className="px-4 py-2.5 bg-theme-primary hover:bg-theme-primary/90 disabled:from-gray-300 disabled:to-gray-400 text-white text-sm font-medium rounded-lg transition-all duration-200 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
                  >
                    Add
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Enhanced Upcoming view */}
        {taskView === 'Upcoming' && (
          <div className="space-y-4">
            {/* Render task groups */}
            {Object.entries(taskGroups).map(([groupKey, tasks]) => {
              if (tasks.length === 0) return null;
              
              const groupConfig = {
                overdue: { title: 'Overdue', color: 'text-red-600', bgColor: 'bg-red-50', borderColor: 'border-red-200' },
                today: { title: 'Today', color: 'text-blue-600', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' },
                tomorrow: { title: 'Tomorrow', color: 'text-green-600', bgColor: 'bg-green-50', borderColor: 'border-green-200' },
                thisWeek: { title: 'This Week', color: 'text-purple-600', bgColor: 'bg-purple-50', borderColor: 'border-purple-200' },
                nextWeek: { title: 'Next Week', color: 'text-indigo-600', bgColor: 'bg-indigo-50', borderColor: 'border-indigo-200' },
                later: { title: 'Later', color: 'text-gray-600', bgColor: 'bg-gray-50', borderColor: 'border-gray-200' }
              }[groupKey] || { title: groupKey, color: 'text-gray-600', bgColor: 'bg-gray-50', borderColor: 'border-gray-200' };

              const isCollapsed = groupCollapsed[groupKey];
              
              return (
                <div key={groupKey} className="rounded-xl border border-gray-200/60 bg-white/80 shadow-sm overflow-hidden">
                  {/* Premium Group Header */}
                  <div
                    className={`flex items-center justify-between px-5 py-4 cursor-pointer select-none transition-all duration-200 hover:bg-gray-50/50`}
                    onClick={() => toggleGroupCollapse(groupKey)}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-lg ${groupConfig.bgColor} flex items-center justify-center transition-transform duration-200 ${isCollapsed ? 'rotate-0' : 'rotate-90'}`}>
                        <ChevronRight size={14} className={groupConfig.color} />
                      </div>
                      <div>
                        <h4 className={`font-semibold text-sm ${groupConfig.color}`}>
                          {groupConfig.title}
                        </h4>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
                          {groupKey === 'overdue' && tasks.length > 0 && (
                            <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">
                              <AlertCircle size={10} />
                              Urgent
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Premium Group Tasks */}
                  <div
                    className={`transition-all duration-300 ease-out overflow-hidden ${
                      isCollapsed ? 'max-h-0 opacity-0' : 'max-h-[600px] opacity-100'
                    }`}
                  >
                    <div className="px-4 pb-4">
                      <Droppable droppableId={`upcoming-${groupKey}`}>
                        {(provided) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className="space-y-3"
                          >
                            {tasks.map((task: any, index: number) => (
                              <EnhancedTaskCard
                                key={task.id}
                                task={task}
                                index={index}
                                isExpanded={expandedTasks.has(task.id.toString())}
                                onToggle={toggleTaskCompletion}
                                onExpand={handleTaskExpand}
                                onQuickAction={handleQuickAction}
                                availableBuckets={availableBuckets}
                                batchUpdateTasks={batchUpdateTasks}
                              />
                            ))}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Premium Empty State */}
            {Object.values(taskGroups).every(group => group.length === 0) && !loading && (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-100 to-indigo-200 flex items-center justify-center mx-auto mb-4">
                  <Clock size={28} className="text-indigo-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">All caught up!</h3>
                <p className="text-sm text-gray-500 mb-6 max-w-sm mx-auto">
                  You have no upcoming tasks. Take a moment to plan ahead or enjoy the calm.
                </p>
                <button
                  onClick={() => {
                    // Focus the add task input
                    const input = document.querySelector('[placeholder*="upcoming"]') as HTMLInputElement;
                    input?.focus();
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white text-sm font-medium rounded-lg transition-all duration-200 shadow-sm hover:shadow-md"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add your first upcoming task
                </button>
              </div>
            )}

            {/* Premium Add Upcoming Task Form */}
            <div className="mt-6 p-5 bg-gradient-to-r from-gray-50/80 to-gray-50/40 rounded-xl border border-gray-200/60 space-y-5">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h5 className="text-sm font-medium text-gray-900">Plan ahead</h5>
              </div>
              
              {availableBuckets.length > 0 && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-700 block">Project</label>
                  <select
                    value={taskBucket}
                    onChange={(e) => setTaskBucket(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all duration-200"
                  >
                    {availableBuckets.map(bucket => (
                      <option key={bucket} value={bucket}>{bucket}</option>
                    ))}
                  </select>
                </div>
              )}
              
              <div className="space-y-3">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-700 block">Task description</label>
                  <input
                    type="text"
                    placeholder="What do you need to do?"
                    value={newUpcomingTask}
                    onChange={(e) => setNewUpcomingTask(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && newUpcomingTask.trim() && newUpcomingTaskDate) handleAddUpcomingTask(); }}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all duration-200 placeholder-gray-400"
                  />
                </div>
                
                <div className="flex gap-3">
                  <div className="flex-1 space-y-2">
                    <label className="text-xs font-medium text-gray-700 block">Due date</label>
                    <input
                      type="date"
                      value={newUpcomingTaskDate}
                      onChange={(e) => setNewUpcomingTaskDate(e.target.value)}
                      min={format(addDays(new Date(), 1), 'yyyy-MM-dd')}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all duration-200"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={handleAddUpcomingTask}
                      disabled={!newUpcomingTask.trim() || !newUpcomingTaskDate}
                      className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 disabled:from-gray-300 disabled:to-gray-400 text-white text-sm font-medium rounded-lg transition-all duration-200 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
                    >
                      Add Task
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Master List tab: show today tasks first, then open tasks */}
        {taskView === 'Master List' && (
        <div className="space-y-6">
          {/* Today's Tasks Section in Master List */}
          <Droppable droppableId="masterTodayTasks">
            {(provided: any) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className="space-y-4"
              >
                <div
                  className="flex items-center justify-between group cursor-pointer select-none py-2"
                  onClick={() => setIsDailyCollapsed((c) => !c)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center transition-transform duration-200 ${isDailyCollapsed ? 'rotate-0' : 'rotate-90'}`}>
                      <ChevronRight size={14} className="text-white" />
                    </div>
                    <div>
                      <h4 className="text-base font-semibold text-gray-900 tracking-tight">Today's Tasks</h4>
                      <p className="text-sm text-gray-500">{todayTasks.length} {todayTasks.length === 1 ? 'task' : 'tasks'}</p>
                    </div>
                  </div>
                </div>

                <div
                  className={`transition-all duration-300 ease-out overflow-hidden ${
                    isDailyCollapsed ? 'max-h-0 opacity-0' : 'max-h-[400px] opacity-100'
                  }`}
                >
                  <div className="space-y-3">
                    {loading && todayTasks.length === 0 ? (
                      <div className="space-y-3">
                        {[1,2,3].map(i => (
                          <div key={i} className="animate-pulse">
                            <div className="bg-gray-100 h-16 rounded-xl"></div>
                          </div>
                        ))}
                      </div>
                    ) : !loading && todayTasks.length === 0 ? (
                      <div className="text-center py-8">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-100 to-indigo-200 flex items-center justify-center mx-auto mb-3">
                          <Clock size={20} className="text-indigo-600" />
                        </div>
                        <h5 className="text-sm font-medium text-gray-900 mb-1">No tasks for today</h5>
                        <p className="text-xs text-gray-500">Drag a task from "All Open Tasks" below to add it to today</p>
                      </div>
                    ) : (
                      todayTasksOrdered.map((t: any, index: number) => (
                        <Draggable draggableId={t.id.toString()} index={index} key={t.id}>
                          {(provided: any) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              style={provided.draggableProps.style}
                              className="group relative bg-white border border-gray-200/60 hover:border-gray-300/80 rounded-xl p-4 transition-all duration-200 hover:shadow-md cursor-grab active:cursor-grabbing"
                            >
                              <div className="flex items-start gap-3">
                                <label className="flex items-center cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={t.completed ?? false}
                                    onChange={() => toggleTaskCompletion(t.id.toString())}
                                    className="sr-only"
                                  />
                                  <div className={`w-5 h-5 rounded-lg border-2 transition-all duration-200 flex items-center justify-center ${
                                    t.completed 
                                      ? 'bg-indigo-600 border-indigo-600' 
                                      : 'border-gray-300 hover:border-indigo-400 group-hover:border-indigo-500'
                                  }`}>
                                    {t.completed && (
                                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                      </svg>
                                    )}
                                  </div>
                                </label>
                                <div className="flex-1 min-w-0">
                                  <p className={`text-sm font-medium leading-relaxed transition-all duration-200 ${
                                    t.completed ? 'line-through text-gray-400' : 'text-gray-900'
                                  }`}>
                                    {t.content}
                                  </p>
                                  {t.bucket && (
                                    <div className="mt-2">
                                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                                        {t.bucket}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))
                    )}
                    {provided.placeholder}
                  </div>
                </div>
              </div>
            )}
          </Droppable>

          {/* All Open Tasks Section */}
          <div className="space-y-4">
            <div
              className="flex items-center justify-between text-sm font-medium text-gray-900 mb-2 cursor-pointer select-none"
              onClick={() => setIsOpenCollapsed((c) => !c)}
            >
              <span>All Open Tasks</span>
              {isOpenCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
            </div>
          
          <Droppable droppableId="openTasks">
            {(provided: any) => (
              <ul
                ref={provided.innerRef}
                {...provided.droppableProps}
               className="space-y-2 text-sm text-gray-700 pr-1 transition-[max-height] duration-200 overflow-y-auto"
               style={{ maxHeight: isOpenCollapsed ? 0 : '60vh' }}
              >
                {loading && openTasksToShow.length === 0 ? (
                  <li className="text-gray-500">Loading…</li>
                ) : null}

                {!loading && openTasksToShow.length === 0 ? (
                  <li className="text-gray-500">No open tasks</li>
                ) : null}

                    {openTasksToShow.map((t: any, index: number) => (
                      <Draggable draggableId={t.id.toString()} index={index} key={t.id}>
                        {(provided: any) => (
                          <li
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            style={provided.draggableProps.style}
                            className="group relative bg-white border border-gray-200/60 hover:border-gray-300/80 rounded-xl p-4 transition-all duration-200 hover:shadow-md cursor-grab active:cursor-grabbing"
                          >
                            <div className="flex items-start gap-3">
                              <label className="flex items-center cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={t.completed ?? false}
                                  onChange={() => toggleTaskCompletion(t.id.toString())}
                                  className="sr-only"
                                />
                                <div className={`w-5 h-5 rounded-lg border-2 transition-all duration-200 flex items-center justify-center ${
                                  t.completed 
                                    ? 'bg-indigo-600 border-indigo-600' 
                                    : 'border-gray-300 hover:border-indigo-400 group-hover:border-indigo-500'
                                }`}>
                                  {t.completed && (
                                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                </div>
                              </label>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex-1 min-w-0">
                                    <p className={`text-sm font-medium leading-relaxed transition-all duration-200 ${
                                      t.completed ? 'line-through text-gray-400' : 'text-gray-900'
                                    }`}>
                                      {t.content}
                                    </p>
                                    {t.bucket && (
                                      <div className="mt-2">
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                                          {t.bucket}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                              {/* Hover bucket selector */}
                              {availableBuckets?.length > 0 && (
                                <select
                                  aria-label="Change bucket"
                                  title="Change bucket"
                                  value={t.bucket || ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    batchUpdateTasks([
                                      { taskId: t.id.toString(), updates: { bucket: val || undefined } }
                                    ]).catch(err => console.error('Failed to update bucket', err));
                                  }}
                                  className="absolute right-3 top-3 text-xs rounded-md border border-gray-300 px-2 py-1 bg-white focus:border-indigo-500 focus:outline-none opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity"
                                >
                                  <option value="">No bucket</option>
                                  {availableBuckets.map((b) => (
                                    <option key={b} value={b}>{b}</option>
                                  ))}
                                </select>
                              )}
                            </div>
                          </li>
                        )}
                      </Draggable>
                    ))}
                {provided.placeholder}
              </ul>
            )}
          </Droppable>

          {/* Add open task */}
          {!isOpenCollapsed && (
            <div className="mt-2 space-y-2">
              {availableBuckets.length > 0 && (
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-600 font-medium">Bucket:</label>
                  <select
                    value={taskBucket}
                    onChange={(e) => setTaskBucket(e.target.value)}
                    className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none bg-white"
                  >
                    {availableBuckets.map(bucket => (
                      <option key={bucket} value={bucket}>{bucket}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Add open task…"
                  value={newOpenTask}
                  onChange={(e) => setNewOpenTask(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddOpenTask(); }}
                  className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none"
                />
                <button
                  onClick={handleAddOpenTask}
                  disabled={!newOpenTask.trim()}
                  className="px-4 py-2.5 bg-theme-primary hover:bg-theme-primary/90 disabled:from-gray-300 disabled:to-gray-400 text-white text-sm font-medium rounded-lg transition-all duration-200 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
                >
                  Add
                </button>
              </div>
            </div>
          )}
          </div>
        </div>
        )}
      </>
    );
  }
}
