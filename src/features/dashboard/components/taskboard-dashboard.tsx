"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { updateUserPreferenceFields, invalidatePreferencesCache } from "@/lib/user-preferences";
import { ensureCacheOwner } from "@/lib/auth-cleanup";
import { useWeather } from "@/features/dashboard/hooks/use-weather";
import { useAuth } from "@/features/dashboard/hooks/use-auth";
import { useDashboardBuckets } from "@/features/dashboard/hooks/use-dashboard-buckets";
import { useHourlyPlanner } from "@/features/dashboard/hooks/use-hourly-planner";
import { useDailyReset } from "@/features/dashboard/hooks/use-daily-reset";
import { useDashboardWidgets } from "@/features/dashboard/hooks/use-dashboard-widgets";
import { useIntegrations } from "@/features/dashboard/hooks/use-integrations";
import { useCollapseStates } from "@/features/dashboard/hooks/use-collapse-states";
import { useWidgetLogs } from "@/features/dashboard/hooks/use-widget-logs";
import { ConfirmDialog } from "./ConfirmDialog";
import { UndoToast } from "./UndoToast";
import { ManageTabsSheet } from "./ManageTabsSheet";
import {
  type DestructiveConfirmState,
  type UndoState,
  withRetry,
  getContrastText,
} from "@/lib/dashboard-utils";
import { card, text, surface, iconBox } from "@/lib/styles";
import {
  Plus,
  Target,
  Activity,
  Check,
  Loader2,
  RotateCw,
  LayoutDashboard,
  ListChecks,
} from "lucide-react";
import type { WidgetTemplate, WidgetInstance } from "@/types/widgets";
import type { Task } from "@/types/tasks";
import type { ProgressEntry } from "@/features/dashboard/types";
import { getSuggestedColorForBucket } from "@/features/dashboard/constants";
import dynamic from 'next/dynamic';

// Lazy-load these heavy components — only rendered when user opens a drawer/sheet
const WidgetEditorSheet = dynamic(
  () => import("@/features/widgets/components/widget-editor"),
  { ssr: false, loading: () => null }
);
const WidgetLibrary = dynamic(
  () => import("@/features/widgets/components/widget-library").then(m => m.WidgetLibrary),
  { ssr: false, loading: () => <Skeleton className="h-48 w-full" /> }
);
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
const DragDropContext = dynamic(() => import("@hello-pangea/dnd").then(m => m.DragDropContext), { ssr: false });
const Droppable = dynamic(() => import("@hello-pangea/dnd").then(m => m.Droppable), { ssr: false });
import { TasksProvider, useTaskData, useTaskActions } from '@/contexts/tasks-context';
import { Skeleton } from "@/components/ui/skeleton";
import TaskEditorModal, { type TaskEditorModalHandle } from "@/features/tasks/components/task-editor-modal";
import { useFamilyMembers } from "@/hooks/use-family-members";
const WidgetModalsContainer = dynamic(
  () => import("./WidgetModalsContainer").then(m => m.WidgetModalsContainer),
  { ssr: false, loading: () => null }
);
const WidgetLogsTab = dynamic(
  () => import("./WidgetLogsTab").then(m => m.WidgetLogsTab),
  { ssr: false, loading: () => <Skeleton className="h-48 w-full" /> }
);
const WidgetSettingsTab = dynamic(
  () => import("./WidgetSettingsTab").then(m => m.WidgetSettingsTab),
  { ssr: false, loading: () => <Skeleton className="h-48 w-full" /> }
);
const EnhancedTasksView = dynamic(
  () => import("@/features/tasks/components/enhanced-tasks-view").then(m => m.EnhancedTasksView),
  { ssr: false, loading: () => <Skeleton className="h-64 w-full" /> }
);

// Dynamic, on-demand heavy widgets and panels
const NutritionSummaryWidget = dynamic(
  () => withRetry(() => import("@/features/widgets/components/nutrition-summary-widget").then(m => m.NutritionSummaryWidget))(),
  { loading: () => <Skeleton className="h-24 w-full" /> }
);
const CalendarTaskList = dynamic(
  () => import("@/features/calendar/components/calendar-task-list").then(m => m.CalendarTaskList),
  { loading: () => <Skeleton className="h-40 w-full" /> }
);
const TrendsPanel = dynamic(
  () => import("@/features/widgets/components/trends-panel"),
  { loading: () => <Skeleton className="h-48 w-full" /> }
);
const ChatBarLazy = dynamic(
  () => import("@/components/chat-bar").then(m => m.ChatBar),
  { ssr: false, loading: () => null }
);
const DraggableWidgetCard = dynamic(
  () => import("@/features/widgets/components/draggable-widget-card").then(m => m.DraggableWidgetCard),
  { ssr: false }
);
const WidgetCardSkeleton = dynamic(
  () => import("@/features/widgets/components/draggable-widget-card").then(m => m.WidgetCardSkeleton),
  { ssr: false }
);


// Inner component that uses TasksContext
function TaskBoardDashboardInner({ selectedDate, setSelectedDate }: { selectedDate: Date; setSelectedDate: (date: Date) => void }) {
  // Access tasks context for all task operations
  const { scheduledTasks, dailyVisibleTasks: contextDailyTasks, allTasks } = useTaskData();
  const { batchUpdateTasks, deleteTask, createTask: contextCreateTask, toggleTaskCompletion: toggleTaskCompletionContext } = useTaskActions();

  // Auth: user, greeting, sign out — onBeforeSignOut flushes debounced saves
  const flushRef = useRef<(() => void) | null>(null);
  const { user, greetingName, authInitialized, isSigningOut, handleSignOut } = useAuth({
    onBeforeSignOut: () => flushRef.current?.(),
  });

  // Confirm/undo state — defined early so hooks can use them
  const [confirmState, setConfirmState] = useState<DestructiveConfirmState | null>(null);
  const [undoState, setUndoState] = useState<UndoState | null>(null);
  const undoTimeoutRef = useRef<number | null>(null);

  const clearUndoTimer = useCallback(() => {
    if (undoTimeoutRef.current !== null && typeof window !== "undefined") {
      window.clearTimeout(undoTimeoutRef.current);
      undoTimeoutRef.current = null;
    }
  }, []);

  const pushUndo = useCallback(
    (message: string, onUndo: () => Promise<void> | void) => {
      clearUndoTimer();
      const next: UndoState = {
        id: Date.now(),
        message,
        onUndo,
      };
      setUndoState(next);
      if (typeof window !== "undefined") {
        undoTimeoutRef.current = window.setTimeout(() => {
          setUndoState((current) => (current?.id === next.id ? null : current));
        }, 6000);
      }
    },
    [clearUndoTimer]
  );

  useEffect(() => {
    return () => {
      clearUndoTimer();
    };
  }, [clearUndoTimer]);

  // Shared refs — created before both bucket & widget hooks so bucket
  // callbacks can read/write widget data via refs.
  const widgetsByBucketRef = useRef<Record<string, WidgetInstance[]>>({});
  const progressByWidgetRef = useRef<Record<string, ProgressEntry>>({});
  // Ref-based setter so bucket callback can call setWidgetsByBucket
  // (which is returned by the widget hook below).
  const setWidgetsByBucketRef = useRef<React.Dispatch<React.SetStateAction<Record<string, WidgetInstance[]>>>>(() => {});

  // Buckets hook — bucket removal/rename delegates widget cleanup to orchestrator
  const bucketHook = useDashboardBuckets({
    user,
    authInitialized,
    pushUndo,
    setConfirmState,
    onBucketRemoved: async (bucket) => {
      const cleanedWidgets = { ...widgetsByBucketRef.current };
      const removedWidgets = cleanedWidgets[bucket] ?? [];
      delete cleanedWidgets[bucket];

      // Move widgets to first remaining bucket instead of destroying them
      const remainingBuckets = (bucketHook.bucketsRef.current ?? []).filter(
        (b: string) => b !== bucket
      );
      const targetBucket = remainingBuckets.length > 0 ? remainingBuckets[0] : null;

      if (removedWidgets.length > 0 && targetBucket) {
        const existing = cleanedWidgets[targetBucket] ?? [];
        cleanedWidgets[targetBucket] = [...existing, ...removedWidgets];
      }

      widgetsByBucketRef.current = cleanedWidgets;
      setWidgetsByBucketRef.current(cleanedWidgets);

      const cleanedColors = { ...bucketHook.bucketColors };
      delete cleanedColors[bucket];
      return { cleanedWidgets, cleanedColors };
    },
    getWidgetSnapshot: () => ({ ...widgetsByBucketRef.current }),
    restoreWidgets: (widgets) => {
      widgetsByBucketRef.current = widgets;
      setWidgetsByBucketRef.current(widgets);
    },
    onBucketRenamed: (oldName, newName) => {
      const wbb = widgetsByBucketRef.current;
      if (wbb[oldName]) {
        const moved = wbb[oldName];
        const updated = { ...wbb };
        delete updated[oldName];
        updated[newName] = moved;
        widgetsByBucketRef.current = updated;
        setWidgetsByBucketRef.current(updated);
      }
    },
  });
  const {
    buckets, setBuckets, activeBucket, setActiveBucket,
    bucketsInitialized, setBucketsInitialized,
    bucketColors, setBucketColors, bucketsRef,
    isEditorOpen, setIsEditorOpen, newBucket, setNewBucket,
    editingBucketName, setEditingBucketName, editingBucketNewName, setEditingBucketNewName,
    draggedBucketIndex, dragIndexRef, manageDragIndexRef,
    suggestedToShow, getBucketColor,
    handleAddBucket, handleAddBucketQuick, requestRemoveBucket,
    handleBucketColorChange, handleStartEditBucket, handleSaveEditBucket, handleCancelEditBucket,
    handleBucketDragStart, handleBucketDragOver, handleBucketDragEnd,
    loadBuckets, ensureUserOnboarded, debouncedSaveBucketsToSupabase,
  } = bucketHook;

  // Widgets hook — all widget state, persistence, CRUD, progress
  const widgetHook = useDashboardWidgets({
    user,
    activeBucket,
    buckets,
    bucketsRef,
    widgetsByBucketRef,
    progressByWidgetRef,
    selectedDate,
    pushUndo,
    setConfirmState,
    allTasks,
    deleteTask,
    contextCreateTask,
  });
  const {
    widgetsByBucket, setWidgetsByBucket,
    isWidgetLoadComplete, setIsWidgetLoadComplete,
    progressByWidget, setProgressByWidget,
    editingWidget, setEditingWidget,
    editingBucket, setEditingBucket,
    newlyCreatedWidgetId, setNewlyCreatedWidgetId,
    openWidgetModal, setOpenWidgetModal,
    activeModalWidget, setActiveModalWidget,
    isWidgetSheetOpen, setIsWidgetSheetOpen,
    activeWidgets, widgetProgressStats, activeWidgetMap,
    linkedTaskDataByWidgetId, linkedTaskMap,
    loadWidgets, saveWidgets, flushDebouncedSave,
    debouncedSaveToSupabase,
    incrementProgress, handleCardClick, handleEditSettings,
    handleWidgetDragEnd, handleWidgetModalUpdate,
    handleHabitToggle, handleSaveWidget,
    patchWidgetInActiveBucket, requestRemoveWidget, resetWidgetProgress,
    findWidgetForTask, handleToggleTaskWidget,
    resolveWidgetBucket, convertWidgetToTask,
  } = widgetHook;
  // Wire up the ref-based setter for bucket callbacks
  setWidgetsByBucketRef.current = setWidgetsByBucket;
  // Wire flushRef so useAuth's sign-out can flush debounced saves
  flushRef.current = flushDebouncedSave;

  // Memoize the active bucket's hex color so widget cards get a stable string prop
  const activeBucketHex = useMemo(() => getBucketColor(activeBucket), [getBucketColor, activeBucket]);

  // Family members from user preferences (shared hook, works on all pages)
  const familyMembers = useFamilyMembers();

  // Assignee filter for tasks — null means show all
  const [assigneeFilter, setAssigneeFilter] = useState<string | null>(null);

  const taskEditorRef = useRef<TaskEditorModalHandle | null>(null);
  const weather = useWeather();

  // Use matchMedia instead of resize listener — fires only at breakpoint crossing
  const [isMobileView, setIsMobileView] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );
  const [chatBarReady, setChatBarReady] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia('(max-width: 767px)');
    const handler = (e: MediaQueryListEvent) => setIsMobileView(e.matches);
    setIsMobileView(mql.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    if (chatBarReady || typeof window === 'undefined') return;
    let cancelled = false;
    const activate = () => {
      if (!cancelled) {
        setChatBarReady(true);
      }
    };

    if ((window as any).requestIdleCallback) {
      const handle = (window as any).requestIdleCallback(activate, { timeout: 1200 });
      return () => {
        cancelled = true;
        if ((window as any).cancelIdleCallback) {
          (window as any).cancelIdleCallback(handle);
        }
      };
    }

    const timeout = window.setTimeout(activate, 600);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [chatBarReady]);

  // Integrations hook — Fitbit, Google Fit, Withings, Todoist, drag-drop
  const integrationsHook = useIntegrations({
    user,
    selectedDate,
    isWidgetLoadComplete,
    widgetsByBucketRef,
    progressByWidgetRef,
    setWidgetsByBucket,
    setProgressByWidget,
    saveWidgets,
    batchUpdateTasks,
  });
  const {
    fitbitData, googleFitData, withingsData,
    isRefreshing,
    todoistTasks, allTodoistTasks,
    isCompletingTask, setIsCompletingTask,
    newDailyTask, setNewDailyTask,
    newOpenTask, setNewOpenTask,
    selectedDateStr, openTasksToShow, upcomingTaskGroups,
    fetchIntegrationsData, fetchAllTodoistTasks,
    updateTaskDueDate, updateTaskDuration,
    handleDragEnd,
  } = integrationsHook;
  const {
    isPlannerCollapsed, setIsPlannerCollapsed,
    isNext7DaysCollapsed, setIsNext7DaysCollapsed,
    isNext2WeeksCollapsed, setIsNext2WeeksCollapsed,
    isLaterCollapsed, setIsLaterCollapsed,
    isNoDueDateCollapsed, setIsNoDueDateCollapsed,
  } = useCollapseStates();

  // Dashboard inner subtabs (left panel)
  const [activeSubTab, setActiveSubTab] = useState<'Overview' | 'Trends' | 'Logs' | 'Tasks' | 'Settings'>('Overview');

  // Widget logs hook — log generation, filtering, history fetch
  const {
    selectedLogsWidget, setSelectedLogsWidget,
    selectedSettingsWidget, setSelectedSettingsWidget,
    isWidgetLogsLoading, widgetLogsError,
    filteredWidgetLogs, selectedSettingsWidgets,
    loadWidgetHistoryLogs,
  } = useWidgetLogs({
    user,
    activeSubTab,
    activeWidgets,
    activeWidgetMap,
    progressByWidget,
    fitbitData,
    googleFitData,
    linkedTaskDataByWidgetId,
  });

  const handleToggleTaskCompletion = useCallback((taskId: string) => {
    void toggleTaskCompletionContext(taskId);
  }, [toggleTaskCompletionContext]);

  // Effect for user state changes (login/logout)
  // loadBuckets + loadWidgets both call getUserPreferencesClient() which deduplicates
  // via the in-flight cache, so running them concurrently is safe and faster.
  useEffect(() => {
    if (!authInitialized) return;

    if (user) {
      // If a different user just signed in, purge all caches first so we
      // never show (or push) the previous user's data.
      const ownerChanged = ensureCacheOwner(user.id);
      if (ownerChanged) {
        // Block save effects FIRST — prevents the empty state below from
        // being written to Supabase before loadBuckets/loadWidgets finish.
        setIsWidgetLoadComplete(false);
        setBucketsInitialized(false);

        // Reset component state that was initialised from (now-stale) localStorage
        setBuckets([]);
        setActiveBucket('');
        setBucketColors({});
        setWidgetsByBucket({});
        setProgressByWidget({});
        bucketsRef.current = [];
      }

      // Load data — if user changed, check for corrupted Supabase data first
      void (async () => {
        if (ownerChanged) {
          // Check if this is a genuinely new user whose Supabase data was
          // corrupted by a previous user's stale caches being pushed.
          // A new user will have onboarded === false in their profile.
          try {
            const res = await fetch('/api/user/profile', { credentials: 'same-origin' });
            if (res.ok) {
              const { profile } = await res.json();
              if (profile && profile.onboarded === false) {
                await fetch('/api/user/preferences', {
                  method: 'DELETE',
                  credentials: 'same-origin',
                });
                invalidatePreferencesCache();
              }
            }
          } catch (err) {
            console.error('Failed to check/reset corrupted preferences:', err);
          }
        }

        // Now load fresh data (after any cleanup)
        await Promise.all([
          loadBuckets({ fetchFromSupabase: true }),
          loadWidgets(),
        ]);
        ensureUserOnboarded();
      })();
    } else {
      loadBuckets({ fetchFromSupabase: false });
    }
  }, [user, authInitialized]);

  // Tab row scroll fade state
  const tabsScrollRef = useRef<HTMLDivElement | null>(null);
  const [showLeftTabFade, setShowLeftTabFade] = useState(false);
  const [showRightTabFade, setShowRightTabFade] = useState(false);

  useEffect(() => {
    const el = tabsScrollRef.current;
    if (!el) return;
    let rafId = 0;
    const updateFades = () => {
      if (rafId) return; // already scheduled
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        const { scrollLeft, scrollWidth, clientWidth } = el;
        setShowLeftTabFade(scrollLeft > 0);
        setShowRightTabFade(scrollLeft + clientWidth < scrollWidth - 1);
      });
    };
    // Initial sync check (no RAF needed)
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setShowLeftTabFade(scrollLeft > 0);
    setShowRightTabFade(scrollLeft + clientWidth < scrollWidth - 1);

    el.addEventListener('scroll', updateFades, { passive: true });
    window.addEventListener('resize', updateFades);
    return () => {
      el.removeEventListener('scroll', updateFades);
      window.removeEventListener('resize', updateFades);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  // Hourly planner hook
  const {
    hourlyPlan, setHourlyPlan, hours, currentHourDisplay,
    plannerRef, resizingTask, startResize,
  } = useHourlyPlanner({ selectedDate, isPlannerCollapsed, updateTaskDuration });

  // Convenience: tasks in planner so we can hide them from the daily list
  const assignedTaskIds = useMemo(() => {
    return new Set(
      scheduledTasks.map((t) => t.id.toString())
    );
  }, [scheduledTasks]);
  // Use tasks from context instead of local state
  const dailyVisibleTasks = contextDailyTasks;

  // Daily reset — archive yesterday's progress and zero-out for the new day
  useDailyReset({
    selectedDate,
    progressByWidgetRef,
    widgetsByBucketRef,
    setProgressByWidget,
    saveWidgets,
    fetchIntegrationsData,
  });

  return (
    <div className="flex-1 relative min-h-screen overflow-hidden bg-theme-surface-warm-70">

      {/* Main wrapper */}
      <div className="relative z-10 flex flex-col">

        {/* Greeting + Completion Ring row */}
        <section className="flex items-center justify-between mb-6">
          <div>
            <h1 className=" text-[24px] text-theme-text-primary tracking-tight">
              Welcome back, {greetingName || 'there'}
            </h1>
            <p className=" text-sm text-theme-text-tertiary mt-1">You've got this! Let's make today productive.</p>
          </div>
        </section>
        {/* Bucket tabs row (scrollable) */}
        <div
          className="relative z-10 transition-all duration-300 ease-in-out"
          style={{ width: '100%' }}
        >
          <div className="flex items-start overflow-x-auto pt-1 no-scrollbar" ref={tabsScrollRef}>
            {bucketsInitialized && buckets.length === 0 && (
              <div className="flex h-[48px] items-center justify-between gap-3 rounded-t-[16px] border border-dashed border-theme-neutral-300 bg-white px-5 text-[13px] text-theme-text-tertiary ">
                <span>No tabs yet. Click + to add your first bucket.</span>
              </div>
            )}
            {bucketsInitialized && buckets.length > 0 && buckets.map((b, idx) => (
              <button
                key={b}
                draggable
                onDragStart={() => {
                  dragIndexRef.current = idx;
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  const currentDragIndex = dragIndexRef.current;
                  if (currentDragIndex === null || currentDragIndex === idx) return;

                  setBuckets((prev) => {
                    if (
                      currentDragIndex === null ||
                      currentDragIndex < 0 ||
                      currentDragIndex >= prev.length
                    ) {
                      return prev;
                    }
                    const updated = [...prev];
                    const [moved] = updated.splice(currentDragIndex, 1);
                    updated.splice(idx, 0, moved);
                    dragIndexRef.current = idx;
                    bucketsRef.current = updated;
                    return updated;
                  });
                }}
                onDragEnd={() => {
                  const dragOrigin = dragIndexRef.current;
                  dragIndexRef.current = null;
                  if (dragOrigin === null) {
                    return;
                  }
                  const latestBuckets = bucketsRef.current.length ? bucketsRef.current : buckets;
                  if (typeof window !== 'undefined') {
                    localStorage.setItem('life_buckets', JSON.stringify(latestBuckets));
                    localStorage.setItem('life_buckets_saved_at', String(Date.now()));
                    window.dispatchEvent(new CustomEvent('lifeBucketsChanged'));
                  }
                  debouncedSaveBucketsToSupabase(latestBuckets);
                }}
                onClick={() => setActiveBucket(b)}
                style={{
                  // Active tab always highest; otherwise cascade left-over-right without negative z-index
                  zIndex: b === activeBucket ? 50 : Math.max(buckets.length - idx, 1),
                  marginRight: '-10px',
                  backgroundColor: b === activeBucket ? getBucketColor(b) : 'var(--theme-surface-warm-90)',
                  borderColor: b === activeBucket ? getBucketColor(b) : 'var(--theme-border-subtle-60)',
                  borderBottomColor: b === activeBucket ? getBucketColor(b) : 'transparent',
                  color: b === activeBucket ? getContrastText(getBucketColor(b)) : '#314158',
                  marginBottom: '-1px',
                }}
                className={`relative flex h-[42px] sm:h-[48px] items-center justify-center whitespace-nowrap rounded-t-[14px] sm:rounded-t-[16px] px-3 sm:px-6  text-xs sm:text-[13px] font-medium capitalize transition-all duration-300 border ${b === activeBucket
                  ? 'shadow-warm-sm'
                  : 'shadow-none'
                  }`}
                onMouseEnter={(e) => {
                  if (b !== activeBucket) {
                    e.currentTarget.style.backgroundColor = 'var(--theme-surface-warm)'
                    e.currentTarget.style.borderColor = 'var(--theme-border-subtle-90)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (b !== activeBucket) {
                    e.currentTarget.style.backgroundColor = 'var(--theme-surface-warm-90)'
                    e.currentTarget.style.borderColor = 'var(--theme-border-subtle-60)'
                  }
                }}
              >
                {b}
              </button>
            ))}
            <button
              onClick={() => setIsEditorOpen(true)}
              style={{
                // "+" tab participates in the same stacking order (lowest, furthest right)
                zIndex: 0,
                marginRight: '-10px',
                marginBottom: '-1px',
                borderBottomColor: 'transparent',
              }}
              className="relative flex h-[42px] sm:h-[48px] items-center justify-center rounded-t-[14px] sm:rounded-t-[16px] bg-theme-surface-raised px-4 sm:px-8 text-[18px] font-medium transition-colors hover:bg-theme-surface-warm border border-theme-neutral-300 shadow-none"
            >
              <span className="text-theme-primary">
                +
              </span>
            </button>
          </div>
          {/* scroll container ends */}
          {/* left & right fades indicating additional scrollable tabs (sit above scroll container) */}
          <div
            className="pointer-events-none absolute inset-y-0 left-0 w-10 transition-opacity duration-300 ease-in-out"
            style={{
              zIndex: 70,
              opacity: showLeftTabFade ? 1 : 0,
              background: 'linear-gradient(to right, var(--theme-surface-warm-90) 0%, var(--theme-surface-warm-60) 50%, transparent 100%)',
            }}
          />
          <div
            className="pointer-events-none absolute inset-y-0 right-0 w-10 transition-opacity duration-300 ease-in-out"
            style={{
              zIndex: 70,
              opacity: showRightTabFade ? 1 : 0,
              background: 'linear-gradient(to left, var(--theme-surface-warm-90) 0%, var(--theme-surface-warm-60) 50%, transparent 100%)',
            }}
          />
        </div>
        {/* Main content container */}
        <div className="w-full flex-1 pb-24 md:pb-4">
          {/* Left section: tabs and widgets */}
          <div className="flex-1 w-full">
            {/* Content container: white widget box with subtle shadow */}
            <div className="relative z-10 -mt-px flex h-full flex-col overflow-hidden rounded-b-xl border border-theme-neutral-300 bg-theme-surface-raised shadow-warm-sm">
              {/* Inner nav */}
              <nav className="flex items-center border-b border-theme-border-subtle-70 px-3 sm:px-5 pt-6 sm:pt-7 text-sm font-semibold overflow-x-auto no-scrollbar">
                <div className="flex items-center gap-3 sm:gap-5">
                  {(['Overview', 'Trends', 'Logs', 'Tasks', 'Settings'] as const).map((item) => (
                    <button
                      key={item}
                      onClick={() => setActiveSubTab(item)}
                      className={`relative shrink-0 pb-3  text-xs tracking-[0.88px] uppercase transition-colors ${item === activeSubTab
                        ? 'text-theme-text-primary'
                        : 'text-theme-text-secondary hover:text-theme-text-primary'
                        }`}
                    >
                      {item}
                      {item === activeSubTab && (
                        <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-theme-primary rounded-full" />
                      )}
                    </button>
                  ))}
                </div>
                <button
                  onClick={isRefreshing ? undefined : fetchIntegrationsData}
                  className="ml-auto shrink-0 flex items-center gap-1.5 pb-3 text-xs tracking-[0.88px] uppercase text-theme-text-secondary hover:text-theme-text-primary transition-colors cursor-pointer"
                >
                  {isRefreshing ? (
                    <Loader2 className="h-4 w-4 animate-spin text-theme-primary" />
                  ) : (
                    <RotateCw className="h-4 w-4" />
                  )}
                  Refresh
                </button>
              </nav>

              {/* Content area */}
              <div className="flex-1 overflow-y-auto p-3 sm:p-5 pt-6 sm:pt-8 pb-6 sm:pb-8">
                {/* Overview Tab */}
                <div className={activeSubTab === 'Overview' ? '' : 'hidden'}>
                  {/* Stat summary row — Calidora pattern */}
                  {activeWidgets.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
                      <div className={card.stat}>
                        <div className={`${iconBox.md} bg-theme-brand-tint-strong mb-2`}>
                          <LayoutDashboard className="h-[18px] w-[18px] text-theme-primary" />
                        </div>
                        <p className={text.statValue}>{activeWidgets.length}</p>
                        <p className="text-xs text-theme-text-tertiary mt-1">Total Widgets</p>
                      </div>
                      <div className={card.stat}>
                        <div className={`${iconBox.md} ${surface.infoTint} mb-2`}>
                          <Activity className="h-[18px] w-[18px] text-theme-info" />
                        </div>
                        <p className={text.statValue}>{widgetProgressStats.inProgress}</p>
                        <p className="text-xs text-theme-text-tertiary mt-1">In Progress</p>
                      </div>
                      <div className={card.stat}>
                        <div className={`${iconBox.md} ${surface.successTint} mb-2`}>
                          <Check className="h-[18px] w-[18px] text-theme-success" />
                        </div>
                        <p className={text.statValue}>{widgetProgressStats.completed}</p>
                        <p className="text-xs text-theme-text-tertiary mt-1">Completed</p>
                      </div>
                      <div className={card.stat}>
                        <div className={`${iconBox.md} bg-[rgba(214,42,154,0.15)] mb-2`}>
                          <Target className="h-[18px] w-[18px] text-[#d62a9a]" />
                        </div>
                        <p className={text.statValue}>{widgetProgressStats.notStarted}</p>
                        <p className="text-xs text-theme-text-tertiary mt-1">Not Started</p>
                      </div>
                    </div>
                  )}

                  {/* Widget grid — flex-wrap for drag-and-drop reorder */}
                  {!isWidgetLoadComplete && activeWidgets.length === 0 ? (
                    <div className="flex flex-wrap gap-3 sm:gap-4">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <WidgetCardSkeleton key={i} index={i} />
                      ))}
                    </div>
                  ) : (
                  <DragDropContext onDragEnd={handleWidgetDragEnd}>
                  <Droppable droppableId={`widget-grid-${activeBucket}`} direction="horizontal">
                  {(droppableProvided) => (
                  <div ref={droppableProvided.innerRef} {...droppableProvided.droppableProps} className="flex flex-wrap gap-3 sm:gap-4">

                  {/* Widget cards — draggable */}
                  {activeWidgets.map((w, widgetIndex) => (
                    <DraggableWidgetCard
                      key={w.instanceId}
                      widget={w}
                      index={widgetIndex}
                      activeBucket={activeBucket}
                      bucketHex={activeBucketHex}
                      progressEntry={progressByWidget[w.instanceId]}
                      linkedTaskData={linkedTaskDataByWidgetId[w.linkedTaskId ?? ''] ?? null}
                      integrationValue={
                        (w.id === "water" || w.id === "steps") && w.dataSource === "fitbit" ? fitbitData[w.id]
                        : (w.id === "water" || w.id === "steps") && w.dataSource === "googlefit" ? googleFitData[w.id]
                        : undefined
                      }
                      onCardClick={handleCardClick}
                      onEditSettings={handleEditSettings}
                      onConvertToTask={convertWidgetToTask}
                      onRemove={requestRemoveWidget}
                      onIncrementProgress={incrementProgress}
                      onToggleTaskCompletion={handleToggleTaskCompletion}
                      onHabitToggle={handleHabitToggle}
                    />
                  ))}
                  {/* DnD placeholder */}
                  {droppableProvided.placeholder}
                  {/* Add Widget card */}
                  <button className="widget-card-size rounded-xl border border-dashed border-theme-neutral-300 bg-theme-surface-raised p-4 hover:bg-theme-surface-warm-50 transition-colors text-left cursor-pointer min-w-0 flex flex-col items-center justify-center gap-2" onClick={() => setIsWidgetSheetOpen(true)}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center border border-theme-neutral-300 bg-theme-brand-tint-subtle">
                      <Plus className="h-5 w-5 text-theme-primary" />
                    </div>
                    <p className=" text-[13px] font-medium text-theme-text-primary">Add Widget</p>
                    <p className=" text-[11px] text-theme-text-tertiary">Track your stats</p>
                  </button>
                  </div>
                  )}
                  </Droppable>
                  </DragDropContext>
                  )}
                </div>{/* close overview tab */}

                {activeSubTab === 'Trends' && (
                  <TrendsPanel
                    widgets={activeWidgets}
                    bucketName={activeBucket}
                  />
                )}

                {activeSubTab === 'Tasks' && (
                  <div>
                    {buckets.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 px-4 text-center border border-dashed border-theme-neutral-300 rounded-2xl bg-white/80">
                        <div className="w-16 h-16 bg-theme-brand-tint-light rounded-full flex items-center justify-center mb-4">
                          <ListChecks className="h-8 w-8 text-theme-primary" />
                        </div>
                        <h3 className="text-xl font-semibold text-theme-text-primary mb-2">
                          Set up your first bucket
                        </h3>
                        <p className="text-sm text-theme-text-tertiary max-w-md mb-6">
                          Buckets help you organise widgets and tasks together. Create one to unlock the full dashboard experience.
                        </p>
                        <button
                          onClick={() => setIsEditorOpen(true)}
                          className="px-6 py-3 bg-theme-primary text-white rounded-lg hover:bg-theme-primary-600 font-medium transition-colors"
                        >
                          Create Bucket
                        </button>
                      </div>
                    ) : (
                      <EnhancedTasksView
                        activeBucket={activeBucket}
                        buckets={buckets}
                        linkedTaskMap={linkedTaskMap}
                        onToggleTaskWidget={handleToggleTaskWidget}
                        onEditTask={(taskId: string) => taskEditorRef.current?.openByTaskId(taskId)}
                        familyMembers={familyMembers}
                        assigneeFilter={assigneeFilter}
                        onAssigneeFilterChange={setAssigneeFilter}
                      />
                    )}
                  </div>
                )}

                {activeSubTab === 'Logs' && (
                  <WidgetLogsTab
                    activeWidgets={activeWidgets}
                    filteredWidgetLogs={filteredWidgetLogs}
                    isLoading={isWidgetLogsLoading}
                    error={widgetLogsError}
                    selectedWidget={selectedLogsWidget}
                    onSelectedWidgetChange={setSelectedLogsWidget}
                    onRefresh={() => void loadWidgetHistoryLogs()}
                    onAddWidget={() => setIsWidgetSheetOpen(true)}
                  />
                )}

                {activeSubTab === 'Settings' && (
                  <WidgetSettingsTab
                    activeWidgets={activeWidgets}
                    selectedSettingsWidget={selectedSettingsWidget}
                    onSelectedSettingsWidgetChange={setSelectedSettingsWidget}
                    selectedSettingsWidgets={selectedSettingsWidgets}
                    activeBucket={activeBucket}
                    getBucketColor={getBucketColor}
                    onPatchWidget={patchWidgetInActiveBucket}
                    onRefreshIntegrations={() => void fetchIntegrationsData()}
                    onOpenEditor={(widget) => {
                      setEditingBucket(activeBucket);
                      setEditingWidget(widget);
                      setNewlyCreatedWidgetId(null);
                    }}
                    onResetProgress={(widget) => void resetWidgetProgress(widget)}
                    onRemoveWidget={requestRemoveWidget}
                    onAddWidget={() => setIsWidgetSheetOpen(true)}
                  />
                )}
              </div>
            </div>
          </div>

        </div>


        {/* Widget editor sheet */}
        {typeof window !== 'undefined' && (
          <WidgetEditorSheet
            widget={editingWidget}
            open={editingWidget !== null}
            onClose={() => {
              setEditingWidget(null)
              setNewlyCreatedWidgetId(null)
            }}
            isNewWidget={editingWidget?.instanceId === newlyCreatedWidgetId}
            onSave={handleSaveWidget}
            availableBuckets={buckets}
            defaultBucket={activeBucket}
            selectedDate={selectedDate}
            bucketColor={activeBucketHex}
          />
        )}

        {/* Widget library sheet — only mount WidgetLibrary when open to avoid unnecessary API calls */}
        {isWidgetSheetOpen && (
        <Sheet open={isWidgetSheetOpen} onOpenChange={setIsWidgetSheetOpen}>
          <SheetContent
            side={isMobileView ? 'bottom' : 'right'}
            className={`w-full sm:w-[800px] max-w-full p-0 sm:p-6 flex flex-col ${isMobileView ? 'max-h-[90vh]' : ''}`}
          >
            <SheetHeader
              className={`px-4 pt-6 pb-4 sm:px-0 sm:pt-0 sm:pb-6 border-b border-theme-neutral-300 sm:border-none ${isMobileView ? 'sticky top-0 z-10 bg-white/95 backdrop-blur' : ''}`}
            >
              <SheetTitle>Add a Widget</SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto px-4 pb-8 sm:px-0 sm:pb-0">
              <WidgetLibrary
                bucket={activeBucket}
                bucketColor={activeBucketHex}
                onAdd={(widgetOrTemplate: WidgetTemplate | WidgetInstance) => {
                  const isInstance = (widgetOrTemplate as any).instanceId !== undefined;
                  const newInstance: WidgetInstance = isInstance
                    ? (widgetOrTemplate as WidgetInstance)
                    : {
                      ...(widgetOrTemplate as WidgetTemplate),
                      instanceId: `${(widgetOrTemplate as WidgetTemplate).id}-${Date.now()}`,
                      target: (widgetOrTemplate as WidgetTemplate).defaultTarget || 100,
                      color: (widgetOrTemplate as WidgetTemplate).color || 'gray',
                      dataSource: 'manual',
                      createdAt: new Date().toISOString(),
                      schedule: [true, true, true, true, true, true, true],
                    };

                  let nextWidgets: Record<string, WidgetInstance[]> | undefined;
                  setWidgetsByBucket(prev => {
                    const updated = { ...prev };
                    updated[activeBucket] = [...(updated[activeBucket] ?? []), newInstance];
                    widgetsByBucketRef.current = updated;
                    nextWidgets = updated;
                    return updated;
                  });

                  // Persist to localStorage synchronously — must survive a refresh
                  if (nextWidgets && typeof window !== 'undefined') {
                    try {
                      const payload = JSON.stringify({
                        widgets: nextWidgets,
                        savedAt: new Date().toISOString(),
                      });
                      localStorage.setItem('widgets_by_bucket', payload);

                      // Verify the save was successful by reading back
                      const readBack = localStorage.getItem('widgets_by_bucket');
                      if (!readBack) {
                        console.error('[onAdd] localStorage verification FAILED — readBack is null');
                      }
                    } catch (lsErr) {
                      console.error('[onAdd] localStorage.setItem FAILED:', lsErr);
                    }
                  }

                  // Open editor for the newly added widget for quick tweaks
                  setEditingBucket(activeBucket);
                  setEditingWidget(newInstance);
                  setNewlyCreatedWidgetId(newInstance.instanceId);

                  // Persist to Supabase (async, but with error logging)
                  if (nextWidgets) {
                    updateUserPreferenceFields({ widgets_by_bucket: nextWidgets }).then(ok => {
                      if (!ok) {
                        console.error('[onAdd] Supabase save FAILED — updateUserPreferenceFields returned false');
                      }
                    }).catch(err => {
                      console.error('[onAdd] Supabase save exception:', err);
                    });
                  }
                  setIsWidgetSheetOpen(false);
                }}
              />
            </div>
          </SheetContent>
        </Sheet>
        )}

        <ManageTabsSheet
          isOpen={isEditorOpen}
          onOpenChange={setIsEditorOpen}
          newBucket={newBucket}
          onNewBucketChange={setNewBucket}
          onAddBucket={handleAddBucket}
          buckets={buckets}
          suggestedToShow={suggestedToShow}
          onAddBucketQuick={handleAddBucketQuick}
          activeBucket={activeBucket}
          editingBucketName={editingBucketName}
          editingBucketNewName={editingBucketNewName}
          onEditingBucketNewNameChange={setEditingBucketNewName}
          onSaveEditBucket={handleSaveEditBucket}
          onCancelEditBucket={handleCancelEditBucket}
          onStartEditBucket={handleStartEditBucket}
          onRemoveBucket={requestRemoveBucket}
          onBucketColorChange={handleBucketColorChange}
          bucketColors={bucketColors}
          getSuggestedColorForBucket={getSuggestedColorForBucket}
          getBucketColor={getBucketColor}
          draggedBucketIndex={draggedBucketIndex}
          onBucketDragStart={handleBucketDragStart}
          onBucketDragOver={handleBucketDragOver}
          onBucketDragEnd={handleBucketDragEnd}
        />

        {/* Widget modals — only mount when open to avoid loading chunk eagerly */}
        {openWidgetModal !== null && (
          <WidgetModalsContainer
            openModalId={openWidgetModal}
            onClose={() => setOpenWidgetModal(null)}
            activeWidget={activeModalWidget}
            setActiveWidget={setActiveModalWidget}
            onWidgetUpdate={handleWidgetModalUpdate}
            progressEntry={activeModalWidget ? progressByWidget[activeModalWidget.instanceId] : undefined}
            onIncrementProgress={incrementProgress}
            onRemoveWidget={requestRemoveWidget}
          />
        )}

      </div>

      {/* Confirm dialog & undo toast rendered outside the z-10 stacking context
          so they always appear above the sidebar / mobile bottom nav. */}
      {confirmState && (
        <ConfirmDialog
          state={confirmState}
          onCancel={() => setConfirmState(null)}
          onConfirm={() => {
            const pending = confirmState;
            setConfirmState(null);
            void Promise.resolve(pending.onConfirm());
          }}
        />
      )}

      {undoState && (
        <UndoToast
          state={undoState}
          onDismiss={() => {
            clearUndoTimer();
            setUndoState(null);
          }}
          onUndo={() => {
            const pending = undoState;
            clearUndoTimer();
            setUndoState(null);
            void Promise.resolve(pending.onUndo());
          }}
        />
      )}

      {chatBarReady && <ChatBarLazy />}

      <TaskEditorModal
        ref={taskEditorRef}
        availableBuckets={buckets}
        selectedBucket={activeBucket}
        bucketColors={bucketColors}
        familyMembers={familyMembers}
      />
    </div>
  );
}

// Main exported component that wraps with TasksProvider
export function TaskBoardDashboard() {
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), today.getDate());
  });

  return (
    <TasksProvider selectedDate={selectedDate}>
      <TaskBoardDashboardInner
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
      />
    </TasksProvider>
  );
}
