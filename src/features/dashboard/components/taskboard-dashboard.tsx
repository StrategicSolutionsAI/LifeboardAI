"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import type { User } from "@supabase/supabase-js";

import { supabase } from "@/utils/supabase/client";
import { getUserPreferencesClient, saveUserPreferences, updateUserPreferenceFields, getCachedUser, invalidateAuthCache } from "@/lib/user-preferences";
import { invalidateTaskCaches } from "@/hooks/use-data-cache";
import { getPrefetchedGreetingName } from "@/lib/prefetch-user-prefs";
import {
  type ProfileNameRow,
  type WidgetLogEntry,
  type DestructiveConfirmState,
  type UndoState,
  iconMap,
  LOG_KIND_DOT_CLASS,
  extractFirstWord,
  deriveGreetingName,
  getIconComponent,
  hexToRgb,
  getWidgetColorStyles,
  dateStr,
  todayStrGlobal,
  yesterdayStrGlobal,
  withRetry,
  debounce,
  migrateWidgetsToTemplates,
} from "@/lib/dashboard-utils";
import { format, addDays, isSameDay, parseISO, formatDistanceToNow } from 'date-fns';
import {
  type LucideIcon,
  Plus,
  X,
  Target,
  Activity,
  Check,
  Loader2,
  RotateCw,
  ClipboardList,
  Cloud,
  CloudSun,
  CloudRain,
  CloudSnow,
  CloudLightning,
  Sun,
  LayoutDashboard,
  Settings as SettingsIcon,
  Settings2,
  ListChecks,
  Pencil,
  GripVertical,
} from "lucide-react";
import type { WidgetTemplate, WidgetInstance } from "@/types/widgets";
import type { Task, RepeatOption } from "@/types/tasks";
import dynamic from 'next/dynamic';

// Lazy-load these heavy components — only rendered when user opens a drawer/sheet
const WidgetEditorSheet = dynamic(
  () => import("@/components/widget-editor"),
  { ssr: false, loading: () => null }
);
const WidgetLibrary = dynamic(
  () => import("@/components/widget-library").then(m => m.WidgetLibrary),
  { ssr: false, loading: () => <Skeleton className="h-48 w-full" /> }
);
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import type { DropResult } from "@hello-pangea/dnd";
const DragDropContext = dynamic(() => import("@hello-pangea/dnd").then(m => m.DragDropContext), { ssr: false });
const Droppable = dynamic(() => import("@hello-pangea/dnd").then(m => m.Droppable), { ssr: false });
import WidgetSelector from "./widget-selector";
import { TasksProvider, useTasksContext } from '@/contexts/tasks-context';
import { Skeleton } from "@/components/ui/skeleton";
import { TasksQuickActions } from "@/components/tasks-quick-actions";
import { TasksGroupedList } from "@/components/tasks-grouped-list";
import { TasksDailyProgress } from "@/components/tasks-daily-progress";
import TaskEditorModal, { type TaskEditorModalHandle } from "@/components/task-editor-modal";
const EnhancedTasksView = dynamic(
  () => import("@/components/enhanced-tasks-view").then(m => m.EnhancedTasksView),
  { ssr: false, loading: () => <Skeleton className="h-64 w-full" /> }
);

// Dynamic, on-demand heavy widgets and panels
const NutritionMealTracker = dynamic(
  () => import("./nutrition-meal-tracker").then(m => m.NutritionMealTracker),
  { loading: () => <Skeleton className="h-32 w-full" /> }
);
const NutritionSummaryWidget = dynamic(
  () => withRetry(() => import("./nutrition-summary-widget").then(m => m.NutritionSummaryWidget))(),
  { loading: () => <Skeleton className="h-24 w-full" /> }
);
const CalendarTaskList = dynamic(
  () => import("./calendar-task-list").then(m => m.CalendarTaskList),
  { loading: () => <Skeleton className="h-40 w-full" /> }
);
const MedicationTrackerWidget = dynamic(
  () => import("./medication-tracker-simple").then(m => m.MedicationTrackerWidget),
  { loading: () => <Skeleton className="h-24 w-full" /> }
);
const ExerciseWidget = dynamic(
  () => import("./exercise-widget-simple").then(m => m.ExerciseWidget),
  { loading: () => <Skeleton className="h-24 w-full" /> }
);
const HomeProjectsWidget = dynamic(
  () => import("./home-projects-widget").then(m => m.HomeProjectsWidget),
  { loading: () => <Skeleton className="h-24 w-full" /> }
);
const HabitTrackerWidget = dynamic(
  () => import("./habit-tracker-widget").then(m => m.HabitTrackerWidget),
  { ssr: false }
);
const SleepTrackerWidget = dynamic(
  () => import("./sleep-tracker-widget").then(m => m.SleepTrackerWidget),
  { ssr: false }
);
const MeditationTimerWidget = dynamic(
  () => import("./meditation-timer-widget").then(m => m.MeditationTimerWidget),
  { ssr: false }
);
const BreathworkWidget = dynamic(
  () => import("./breathwork-widget").then(m => m.BreathworkWidget),
  { ssr: false }
);
const WaterIntakeWidget = dynamic(
  () => import("./water-intake-widget").then(m => m.WaterIntakeWidget),
  { ssr: false }
);
const MoodTrackerWidget = dynamic(
  () => import("./mood-tracker-widget").then(m => m.MoodTrackerWidget),
  { ssr: false }
);
const StepsTrackerWidget = dynamic(
  () => import("./steps-tracker-widget").then(m => m.StepsTrackerWidget),
  { ssr: false }
);
const HeartRateWidget = dynamic(
  () => import("./heart-rate-widget").then(m => m.HeartRateWidget),
  { ssr: false }
);
const CaffeineTrackerWidget = dynamic(
  () => import("./caffeine-tracker-widget").then(m => m.CaffeineTrackerWidget),
  { ssr: false }
);
const TrendsPanel = dynamic(
  () => import("./trends-panel"),
  { loading: () => <Skeleton className="h-48 w-full" /> }
);
const ChatBarLazy = dynamic(
  () => import("./chat-bar").then(m => m.ChatBar),
  { ssr: false, loading: () => null }
);
const DraggableWidgetCard = dynamic(
  () => import("./draggable-widget-card").then(m => m.DraggableWidgetCard),
  { ssr: false }
);
const WidgetCardSkeleton = dynamic(
  () => import("./draggable-widget-card").then(m => m.WidgetCardSkeleton),
  { ssr: false }
);


// Inner component that uses TasksContext
function TaskBoardDashboardInner({ selectedDate, setSelectedDate }: { selectedDate: Date; setSelectedDate: (date: Date) => void }) {
  // Access tasks context for all task operations
  const { scheduledTasks, dailyVisibleTasks: contextDailyTasks, batchUpdateTasks, deleteTask, createTask: contextCreateTask, allTasks, toggleTaskCompletion: toggleTaskCompletionContext } = useTasksContext();
  // State for task management
  const [newOpenTask, setNewOpenTask] = useState('');
  const [isLoadingAllTasks, setIsLoadingAllTasks] = useState(false);

  // Lazy-initialize critical state from localStorage so the FIRST render
  // shows cached data instead of waiting for useEffect chains to populate it.
  const [buckets, setBuckets] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem('life_buckets');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length) return parsed;
      }
    } catch { /* fall through */ }
    return [];
  });
  const [activeBucket, setActiveBucket] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    try {
      const savedActive = localStorage.getItem('active_bucket');
      const stored = localStorage.getItem('life_buckets');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length) {
          return savedActive && parsed.includes(savedActive) ? savedActive : parsed[0];
        }
      }
    } catch { /* fall through */ }
    return '';
  });
  const [bucketsInitialized, setBucketsInitialized] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [newBucket, setNewBucket] = useState("");
  const [bucketColors, setBucketColors] = useState<Record<string, string>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      const stored = localStorage.getItem('bucket_colors');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch { /* fall through */ }
    return {};
  });
  const [editingBucketName, setEditingBucketName] = useState<string | null>(null);
  const [editingBucketNewName, setEditingBucketNewName] = useState("");
  const [draggedBucketIndex, setDraggedBucketIndex] = useState<number | null>(null);
  const [isWidgetSheetOpen, setIsWidgetSheetOpen] = useState(false);
  const [widgetsByBucket, setWidgetsByBucket] = useState<Record<string, WidgetInstance[]>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      const stored = localStorage.getItem('widgets_by_bucket');
      if (stored) {
        const parsed = JSON.parse(stored);
        const widgets = (parsed.widgets && parsed.savedAt) ? parsed.widgets : parsed;
        if (widgets && typeof widgets === 'object' && !Array.isArray(widgets)) {
          const count = Object.values(widgets).reduce((sum: number, arr: any) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
          if (count > 0) return widgets;
        }
      }
    } catch { /* fall through */ }
    return {};
  });
  const bucketsRef = useRef<string[]>(buckets);
  const taskEditorRef = useRef<TaskEditorModalHandle | null>(null);
  const dragIndexRef = useRef<number | null>(null);
  const manageDragIndexRef = useRef<number | null>(null);
  const fetchedYesterdayRef = useRef(false);
  const [weather, setWeather] = useState<{ icon: LucideIcon; temp: number } | null>(null);

  const [isWidgetLoadComplete, setIsWidgetLoadComplete] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [greetingName, setGreetingName] = useState<string>("");
  // Track when we've completed the initial auth check to avoid clearing
  // localStorage/state before Supabase auth resolves on first load
  const [authInitialized, setAuthInitialized] = useState(false);

  useEffect(() => {
    bucketsRef.current = buckets;
  }, [buckets]);

  // Bucket color utility functions
  const getBucketColor = (bucket: string) => {
    return bucketColors[bucket] || '#B1916A'
  }

  // Suggested bucket presets for quick adding in the Manage Tabs sheet
  const SUGGESTED_BUCKETS = [
    'Health',
    'Wellness',
    'Family',
    'Social',
    'Work',
    'Finance',
    'Personal',
    'Fitness',
    'Projects',
    'Home'
  ] as const

  // Recommended color per common bucket name (Calidora palette)
  const SUGGESTED_BUCKET_COLOR_MAP: Record<string, string> = {
    health: '#48B882',     // green (Calidora)
    wellness: '#5E9B8C',   // teal (Calidora)
    family: '#4AADE0',     // sky blue (Calidora)
    social: '#D07AA4',     // rose (Calidora)
    work: '#B1916A',       // warm brown (Calidora)
    personal: '#8B7FD4',   // plum (Calidora)
    projects: '#6B8AF7',   // blue (Calidora)
    home: '#5E9B8C',       // teal (Calidora)
    finance: '#C4A44E',    // golden (Calidora)
    fitness: '#E28A5D',    // orange (Calidora)
  }

  function getSuggestedColorForBucket(name: string): string {
    const key = name?.toLowerCase?.().trim() || ''
    return SUGGESTED_BUCKET_COLOR_MAP[key] || '#B1916A'
  }

  const suggestedToShow = useMemo(
    () => SUGGESTED_BUCKETS.filter((name) => !buckets.includes(name)),
    [buckets]
  )

  // Preset color palette (hex) for bucket color selection (Calidora palette)
  const BUCKET_COLOR_PALETTE = [
    '#B1916A', // warm brown (Calidora)
    '#6B8AF7', // blue (Calidora)
    '#48B882', // green (Calidora)
    '#D07AA4', // rose (Calidora)
    '#4AADE0', // sky blue (Calidora)
    '#C4A44E', // golden (Calidora)
    '#8B7FD4', // plum (Calidora)
    '#E28A5D', // orange (Calidora)
    '#5E9B8C', // teal (Calidora)
    '#bb9e7b', // sand (Calidora)
    '#314158', // dark slate (Calidora)
    '#8e99a8', // muted gray (Calidora)
  ] as const

  // Create lighter opaque colors by blending with white
  const getLighterColor = (hex: string, amount: number) => {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)

    // Blend with white (255, 255, 255)
    const newR = Math.round(r + (255 - r) * amount)
    const newG = Math.round(g + (255 - g) * amount)
    const newB = Math.round(b + (255 - b) * amount)

    return `rgb(${newR}, ${newG}, ${newB})`
  }

  // Listen for bucket color changes
  useEffect(() => {
    const handleBucketColorsChanged = () => {
      if (typeof window !== 'undefined') {
        const stored = window.localStorage.getItem('bucket_colors');
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            if (parsed && typeof parsed === 'object') {
              setBucketColors(parsed);
              return;
            }
          } catch (error) {
            console.warn('Failed to parse locally stored bucket_colors', error);
          }
        }
      }

      getUserPreferencesClient()
        .then(userPrefs => {
          if (userPrefs?.bucket_colors) {
            setBucketColors(userPrefs.bucket_colors);
          }
        })
        .catch(error => {
          console.error("Failed to reload bucket colors:", error);
        });
    }

    window.addEventListener('bucketColorsChanged', handleBucketColorsChanged)
    return () => window.removeEventListener('bucketColorsChanged', handleBucketColorsChanged)
  }, [])

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isMobileView, setIsMobileView] = useState(false);
  const widgetsByBucketRef = useRef(widgetsByBucket);
  widgetsByBucketRef.current = widgetsByBucket;

  // Editing widget state
  const [editingWidget, setEditingWidget] = useState<WidgetInstance | null>(null);
  const [editingBucket, setEditingBucket] = useState<string | null>(null);
  const [newlyCreatedWidgetId, setNewlyCreatedWidgetId] = useState<string | null>(null);
  const [nutritionWidgetOpen, setNutritionWidgetOpen] = useState(false);
  const [medicationWidgetOpen, setMedicationWidgetOpen] = useState(false);
  const [exerciseWidgetOpen, setExerciseWidgetOpen] = useState(false);
  const [homeProjectsWidgetOpen, setHomeProjectsWidgetOpen] = useState(false);
  const [habitTrackerWidgetOpen, setHabitTrackerWidgetOpen] = useState(false);
  const [activeHabitWidget, setActiveHabitWidget] = useState<WidgetInstance | null>(null);
  const [shouldLoadNutritionWidget, setShouldLoadNutritionWidget] = useState(false);
  const [shouldLoadMedicationWidget, setShouldLoadMedicationWidget] = useState(false);
  const [shouldLoadExerciseWidget, setShouldLoadExerciseWidget] = useState(false);
  const [shouldLoadHomeProjectsWidget, setShouldLoadHomeProjectsWidget] = useState(false);
  const [shouldLoadHabitTrackerWidget, setShouldLoadHabitTrackerWidget] = useState(false);
  const [sleepWidgetOpen, setSleepWidgetOpen] = useState(false);
  const [shouldLoadSleepWidget, setShouldLoadSleepWidget] = useState(false);
  const [activeSleepWidget, setActiveSleepWidget] = useState<WidgetInstance | null>(null);
  const [meditationWidgetOpen, setMeditationWidgetOpen] = useState(false);
  const [shouldLoadMeditationWidget, setShouldLoadMeditationWidget] = useState(false);
  const [activeMeditationWidget, setActiveMeditationWidget] = useState<WidgetInstance | null>(null);
  const [breathworkWidgetOpen, setBreathworkWidgetOpen] = useState(false);
  const [shouldLoadBreathworkWidget, setShouldLoadBreathworkWidget] = useState(false);
  const [activeBreathworkWidget, setActiveBreathworkWidget] = useState<WidgetInstance | null>(null);
  const [waterWidgetOpen, setWaterWidgetOpen] = useState(false);
  const [shouldLoadWaterWidget, setShouldLoadWaterWidget] = useState(false);
  const [activeWaterWidget, setActiveWaterWidget] = useState<WidgetInstance | null>(null);
  const [moodWidgetOpen, setMoodWidgetOpen] = useState(false);
  const [shouldLoadMoodWidget, setShouldLoadMoodWidget] = useState(false);
  const [activeMoodWidget, setActiveMoodWidget] = useState<WidgetInstance | null>(null);
  const [stepsWidgetOpen, setStepsWidgetOpen] = useState(false);
  const [shouldLoadStepsWidget, setShouldLoadStepsWidget] = useState(false);
  const [activeStepsWidget, setActiveStepsWidget] = useState<WidgetInstance | null>(null);
  const [heartRateWidgetOpen, setHeartRateWidgetOpen] = useState(false);
  const [shouldLoadHeartRateWidget, setShouldLoadHeartRateWidget] = useState(false);
  const [activeHeartRateWidget, setActiveHeartRateWidget] = useState<WidgetInstance | null>(null);
  const [caffeineWidgetOpen, setCaffeineWidgetOpen] = useState(false);
  const [shouldLoadCaffeineWidget, setShouldLoadCaffeineWidget] = useState(false);
  const [activeCaffeineWidget, setActiveCaffeineWidget] = useState<WidgetInstance | null>(null);
  const [chatBarReady, setChatBarReady] = useState(false);
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

  useEffect(() => {
    const updateMobileView = () => setIsMobileView(window.innerWidth < 768);
    updateMobileView();
    window.addEventListener('resize', updateMobileView);
    return () => window.removeEventListener('resize', updateMobileView);
  }, []);

  useEffect(() => {
    if (!nutritionWidgetOpen) return;
    setShouldLoadNutritionWidget(true);
  }, [nutritionWidgetOpen]);

  useEffect(() => {
    if (!medicationWidgetOpen) return;
    setShouldLoadMedicationWidget(true);
  }, [medicationWidgetOpen]);

  useEffect(() => {
    if (!exerciseWidgetOpen) return;
    setShouldLoadExerciseWidget(true);
  }, [exerciseWidgetOpen]);

  useEffect(() => {
    if (!homeProjectsWidgetOpen) return;
    setShouldLoadHomeProjectsWidget(true);
  }, [homeProjectsWidgetOpen]);

  useEffect(() => {
    if (!habitTrackerWidgetOpen) return;
    setShouldLoadHabitTrackerWidget(true);
  }, [habitTrackerWidgetOpen]);

  useEffect(() => {
    if (!sleepWidgetOpen) return;
    setShouldLoadSleepWidget(true);
  }, [sleepWidgetOpen]);

  useEffect(() => {
    if (!meditationWidgetOpen) return;
    setShouldLoadMeditationWidget(true);
  }, [meditationWidgetOpen]);

  useEffect(() => {
    if (!breathworkWidgetOpen) return;
    setShouldLoadBreathworkWidget(true);
  }, [breathworkWidgetOpen]);

  useEffect(() => {
    if (!waterWidgetOpen) return;
    setShouldLoadWaterWidget(true);
  }, [waterWidgetOpen]);

  useEffect(() => {
    if (!moodWidgetOpen) return;
    setShouldLoadMoodWidget(true);
  }, [moodWidgetOpen]);

  useEffect(() => {
    if (!stepsWidgetOpen) return;
    setShouldLoadStepsWidget(true);
  }, [stepsWidgetOpen]);

  useEffect(() => {
    if (!heartRateWidgetOpen) return;
    setShouldLoadHeartRateWidget(true);
  }, [heartRateWidgetOpen]);

  useEffect(() => {
    if (!caffeineWidgetOpen) return;
    setShouldLoadCaffeineWidget(true);
  }, [caffeineWidgetOpen]);

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

  // ----------------------------------------------------------------------
  // Progress tracking state  { [instanceId]: { value:number; streak:number; lastCompleted:string } }
  // ----------------------------------------------------------------------
  interface ProgressEntry { value: number; date: string; streak: number; lastCompleted: string; }
  const [progressByWidget, setProgressByWidget] = useState<Record<string, ProgressEntry>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      const raw = localStorage.getItem('widget_progress');
      if (raw) return JSON.parse(raw);
    } catch { /* fall through */ }
    return {};
  });

  // ----------------------------------------------------------------------
  // Persist active bucket selection
  // ----------------------------------------------------------------------
  useEffect(() => {
    // Do nothing until a bucket is selected
    if (!activeBucket) return;

    // Save active bucket to localStorage only
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('active_bucket', activeBucket);
      } catch (e) {
        console.error('Failed to save active bucket to localStorage', e);
      }
    }
  }, [activeBucket]);

  // Add a ref for progress too
  const progressByWidgetRef = useRef(progressByWidget);
  progressByWidgetRef.current = progressByWidget;

  // Fitbit data state
  const [fitbitData, setFitbitData] = useState<Record<string, number>>(() => {
    if (typeof window !== 'undefined') {
      try { const stored = localStorage.getItem('fitbit_metrics'); if (stored) return JSON.parse(stored); } catch (e) { }
    }
    return {};
  });

  // Google Fit data state
  const [googleFitData, setGoogleFitData] = useState<Record<string, number>>(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('googlefit_metrics') : null;
    return stored ? JSON.parse(stored) : {};
  });

  // Withings weight (kg)
  const [withingsData, setWithingsData] = useState<{ weightKg: number | null }>(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('withings_metrics') : null;
    return stored ? JSON.parse(stored) : { weightKg: null };
  });

  const [isLoadingFitbit, setIsLoadingFitbit] = useState(false);

  // Google Fit metrics are fetched inside fetchIntegrationsData() which runs
  // on mount (deferred) and every 30 minutes. No separate effect needed.
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Todoist task state
  const [todoistTasks, setTodoistTasks] = useState<any[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);

  // Master list of all open tasks
  const [allTodoistTasks, setAllTodoistTasks] = useState<any[]>([]);

  const [isCompletingTask, setIsCompletingTask] = useState<Record<string, boolean>>({});

  // New task input state
  const [newDailyTask, setNewDailyTask] = useState('');
  const [isPlannerCollapsed, setIsPlannerCollapsed] = useState(false);
  // Collapse state for upcoming task sections
  const [isNext7DaysCollapsed, setIsNext7DaysCollapsed] = useState(false);
  const [isNext2WeeksCollapsed, setIsNext2WeeksCollapsed] = useState(false);
  const [isLaterCollapsed, setIsLaterCollapsed] = useState(false);
  const [isNoDueDateCollapsed, setIsNoDueDateCollapsed] = useState(true);

  // Dashboard inner subtabs (left panel)
  const [activeSubTab, setActiveSubTab] = useState<'Overview' | 'Trends' | 'Logs' | 'Tasks' | 'Settings'>('Overview');

  // Widget selection for filtering
  const [selectedLogsWidget, setSelectedLogsWidget] = useState<string | 'all'>('all');
  const [selectedSettingsWidget, setSelectedSettingsWidget] = useState<string | 'all'>('all');
  const activeWidgets = useMemo(() => getDisplayWidgets(activeBucket), [widgetsByBucket, activeBucket]);
  const todayDateString = new Date().toISOString().slice(0, 10);
  const [widgetHistoryLogs, setWidgetHistoryLogs] = useState<WidgetLogEntry[]>([]);
  const [isWidgetLogsLoading, setIsWidgetLogsLoading] = useState(false);
  const [widgetLogsError, setWidgetLogsError] = useState<string | null>(null);

  const activeWidgetMap = useMemo(() => {
    return new Map(activeWidgets.map((widget) => [widget.instanceId, widget]));
  }, [activeWidgets]);

  const localWidgetLogs = useMemo<WidgetLogEntry[]>(() => {
    const logs: WidgetLogEntry[] = [];

    activeWidgets.forEach((widget) => {
      const progress = progressByWidget[widget.instanceId];
      if (progress?.date) {
        const reachedTarget = progress.value >= (widget.target || 1);
        logs.push({
          id: `local-progress-${widget.instanceId}-${progress.date}`,
          widgetInstanceId: widget.instanceId,
          widgetName: widget.name,
          message: reachedTarget ? "Goal reached" : "Progress updated",
          details: `${progress.value.toLocaleString()} / ${(widget.target || 1).toLocaleString()} ${widget.unit || ""}`.trim(),
          occurredAt: `${progress.date}T20:00:00`,
          kind: "progress",
        });
      }

      if (widget.dataSource === "fitbit" || widget.dataSource === "googlefit") {
        let syncedValue: number | null = null;
        if (widget.id === "water") {
          syncedValue = widget.dataSource === "fitbit" ? (fitbitData.water ?? null) : (googleFitData.water ?? null);
        } else if (widget.id === "steps") {
          syncedValue = widget.dataSource === "fitbit" ? (fitbitData.steps ?? null) : (googleFitData.steps ?? null);
        }

        if (typeof syncedValue === "number") {
          logs.push({
            id: `integration-${widget.instanceId}-${todayDateString}`,
            widgetInstanceId: widget.instanceId,
            widgetName: widget.name,
            message: `Synced from ${widget.dataSource === "fitbit" ? "Fitbit" : "Google Fit"}`,
            details: `${syncedValue.toLocaleString()} ${widget.unit || ""}`.trim(),
            occurredAt: `${todayDateString}T12:00:00`,
            kind: "integration",
          });
        }
      }

      if (widget.moodData?.lastUpdated) {
        logs.push({
          id: `mood-${widget.instanceId}-${widget.moodData.lastUpdated}`,
          widgetInstanceId: widget.instanceId,
          widgetName: widget.name,
          message: "Mood logged",
          details: widget.moodData.currentMood ? `Mood ${widget.moodData.currentMood}/5` : undefined,
          occurredAt: widget.moodData.lastUpdated,
          kind: "entry",
        });
      }

      if (widget.journalData?.lastEntryDate) {
        const words = widget.journalData.todaysEntry?.trim().split(/\s+/).filter(Boolean).length;
        logs.push({
          id: `journal-${widget.instanceId}-${widget.journalData.lastEntryDate}`,
          widgetInstanceId: widget.instanceId,
          widgetName: widget.name,
          message: "Journal entry saved",
          details: words ? `${words} words` : undefined,
          occurredAt: `${widget.journalData.lastEntryDate}T20:00:00`,
          kind: "entry",
        });
      }

      if (widget.gratitudeData?.lastEntryDate) {
        const count = widget.gratitudeData.gratitudeItems?.filter((item) => item.trim().length > 0).length;
        logs.push({
          id: `gratitude-${widget.instanceId}-${widget.gratitudeData.lastEntryDate}`,
          widgetInstanceId: widget.instanceId,
          widgetName: widget.name,
          message: "Gratitude entry updated",
          details: count ? `${count} items` : undefined,
          occurredAt: `${widget.gratitudeData.lastEntryDate}T20:00:00`,
          kind: "entry",
        });
      }

      if (widget.weightData?.lastEntryDate && typeof widget.weightData.currentWeight === "number") {
        logs.push({
          id: `weight-${widget.instanceId}-${widget.weightData.lastEntryDate}`,
          widgetInstanceId: widget.instanceId,
          widgetName: widget.name,
          message: "Weight logged",
          details: `${widget.weightData.currentWeight} ${widget.weightData.unit || widget.unit || "lbs"}`,
          occurredAt: `${widget.weightData.lastEntryDate}T20:00:00`,
          kind: "entry",
        });
      }

      if (widget.homeProjectsData?.lastUpdated) {
        logs.push({
          id: `home-projects-${widget.instanceId}-${widget.homeProjectsData.lastUpdated}`,
          widgetInstanceId: widget.instanceId,
          widgetName: widget.name,
          message: "Projects updated",
          details: widget.homeProjectsData.totalProjects
            ? `${widget.homeProjectsData.totalProjects} total projects`
            : undefined,
          occurredAt: widget.homeProjectsData.lastUpdated,
          kind: "entry",
        });
      }

      if (widget.linkedTaskId) {
        const linkedTask = allTasks.find((task) => task.id?.toString?.() === widget.linkedTaskId);
        logs.push({
          id: `task-link-${widget.instanceId}-${widget.linkedTaskId}`,
          widgetInstanceId: widget.instanceId,
          widgetName: widget.name,
          message: linkedTask?.completed ? "Linked task completed" : "Linked to Tasks tab",
          details: linkedTask?.content || widget.linkedTaskTitle,
          occurredAt: linkedTask?.due?.date ? `${linkedTask.due.date}T09:00:00` : widget.createdAt,
          kind: "task",
        });
      }

      logs.push({
        id: `widget-created-${widget.instanceId}`,
        widgetInstanceId: widget.instanceId,
        widgetName: widget.name,
        message: "Widget created",
        occurredAt: widget.createdAt,
        kind: "system",
      });
    });

    return logs;
  }, [activeWidgets, progressByWidget, fitbitData, googleFitData, allTasks, todayDateString]);

  const combinedWidgetLogs = useMemo(() => {
    const merged = [...widgetHistoryLogs, ...localWidgetLogs];
    const deduped = new Map<string, WidgetLogEntry>();

    merged.forEach((entry) => {
      const key = `${entry.widgetInstanceId}|${entry.message}|${entry.occurredAt.slice(0, 10)}|${entry.details ?? ""}`;
      if (!deduped.has(key)) {
        deduped.set(key, entry);
      }
    });

    return Array.from(deduped.values()).sort((a, b) => {
      const aTime = Date.parse(a.occurredAt);
      const bTime = Date.parse(b.occurredAt);
      if (Number.isNaN(aTime) || Number.isNaN(bTime)) {
        return b.occurredAt.localeCompare(a.occurredAt);
      }
      return bTime - aTime;
    });
  }, [widgetHistoryLogs, localWidgetLogs]);

  const filteredWidgetLogs = useMemo(() => {
    if (selectedLogsWidget === "all") return combinedWidgetLogs;
    return combinedWidgetLogs.filter((entry) => entry.widgetInstanceId === selectedLogsWidget);
  }, [combinedWidgetLogs, selectedLogsWidget]);

  const selectedSettingsWidgets = useMemo(() => {
    if (selectedSettingsWidget === "all") return activeWidgets;
    return activeWidgets.filter((widget) => widget.instanceId === selectedSettingsWidget);
  }, [activeWidgets, selectedSettingsWidget]);

  const formatLogTimestamp = (timestamp: string) => {
    const parsed = Date.parse(timestamp);
    if (Number.isNaN(parsed)) return "Unknown";
    return formatDistanceToNow(parsed, { addSuffix: true });
  };

  // ---------------------------------------------------------------------------
  // Bucket sync helpers: track whether local changes have been synced to
  // Supabase so that loadBuckets() can decide whether to prefer local
  // (unsynced edit) or server (may have newer data from another device).
  // ---------------------------------------------------------------------------
  const markBucketsSaved = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('life_buckets_saved_at', String(Date.now()));
    }
  };
  const markBucketsSynced = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('life_buckets_synced_at', String(Date.now()));
    }
  };
  const hasUnsyncedBucketChanges = (): boolean => {
    if (typeof window === 'undefined') return false;
    const savedAt = Number(localStorage.getItem('life_buckets_saved_at') || '0');
    const syncedAt = Number(localStorage.getItem('life_buckets_synced_at') || '0');
    return savedAt > syncedAt;
  };

  // Debounced persistence of bucket order to Supabase
  const debouncedSaveBucketsToSupabase = useRef(
    debounce(async (ordered: string[]) => {
      try {
        const ok = await updateUserPreferenceFields({ life_buckets: ordered });
        if (ok) markBucketsSynced();
      } catch (err) {
        console.error('Failed to save bucket order to Supabase', err);
      }
    }, 1500)
  ).current;

  const loadWidgetHistoryLogs = useCallback(async () => {
    if (!user || activeWidgets.length === 0) {
      setWidgetHistoryLogs([]);
      setWidgetLogsError(null);
      return;
    }

    setIsWidgetLogsLoading(true);
    setWidgetLogsError(null);

    try {
      const widgetIds = activeWidgets.map((widget) => widget.instanceId);
      const res = await fetch(`/api/widgets/progress?widgetIds=${widgetIds.join(',')}`, { credentials: 'same-origin' });
      if (!res.ok) throw new Error('Failed to load widget logs');
      const { logs: data } = await res.json();

      const historyLogs: WidgetLogEntry[] = (data ?? []).map((row: any) => {
        const widget = activeWidgetMap.get(row.widget_instance_id);
        const target = widget?.target && widget.target > 0 ? widget.target : 1;
        const value = Number(row.value ?? 0);

        return {
          id: `history-${row.widget_instance_id}-${row.date}`,
          widgetInstanceId: row.widget_instance_id,
          widgetName: widget?.name ?? "Widget",
          message: value >= target ? "Goal reached" : "Progress logged",
          details: `${value.toLocaleString()} / ${target.toLocaleString()} ${widget?.unit || ""}`.trim(),
          occurredAt: row.created_at ?? `${row.date}T12:00:00`,
          kind: "progress",
        };
      });

      setWidgetHistoryLogs(historyLogs);
    } catch (error: any) {
      setWidgetHistoryLogs([]);
      setWidgetLogsError(error?.message || "Unable to load widget logs");
    } finally {
      setIsWidgetLogsLoading(false);
    }
  }, [activeWidgetMap, activeWidgets, user]);

  useEffect(() => {
    if (selectedLogsWidget !== "all" && !activeWidgetMap.has(selectedLogsWidget)) {
      setSelectedLogsWidget("all");
    }
    if (selectedSettingsWidget !== "all" && !activeWidgetMap.has(selectedSettingsWidget)) {
      setSelectedSettingsWidget("all");
    }
  }, [activeWidgetMap, selectedLogsWidget, selectedSettingsWidget]);

  useEffect(() => {
    if (activeSubTab !== "Logs") return;
    void loadWidgetHistoryLogs();
  }, [activeSubTab, loadWidgetHistoryLogs]);

  const fetchIntegrationsData = useCallback(async () => {
    if (!user) return; // must be signed in to fetch integration data

    setIsRefreshing(true);

    try {
      const refreshPromises: Promise<void>[] = [];

      refreshPromises.push((async () => {
        try {
          const tasksRes = await fetch(`/api/integrations/todoist/tasks?all=true&cb=${Date.now()}`);
          if (tasksRes.ok) {
            const taskData = await tasksRes.json();
            const allTasks: any[] = taskData.tasks || [];
            setAllTodoistTasks(allTasks);

            const iso = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
            setTodoistTasks(allTasks.filter((t: any) => t.due?.date === iso));
          } else {
            console.error('Failed to refresh Todoist tasks');
          }
        } catch (err) {
          console.error('Error refreshing Todoist tasks', err);
        }
      })());

      const needFitbit = Object.values(widgetsByBucketRef.current)
        .flat()
        .some((w) => ["water", "steps"].includes(w.id) && w.dataSource === "fitbit");

      if (needFitbit) {
        refreshPromises.push((async () => {
          try {
            const res = await fetch(`/api/integrations/fitbit/metrics?cb=${Date.now()}`);
            if (!res.ok) return;

            const data = await res.json();
            const obj = {
              water: data.water || 0,
              steps: data.steps || 0,
              calories: data.calories || 0,
            };
            setFitbitData(obj);

            try {
              const todayStr = todayStrGlobal;
              const fitbitWidgets = Object.values(widgetsByBucketRef.current)
                .flat()
                .filter(
                  (w) => w.dataSource === "fitbit" && ["water", "steps"].includes(w.id)
                );

              if (!fitbitWidgets.length) return;

              const updatedProgress: Record<string, ProgressEntry> = {
                ...progressByWidgetRef.current,
              };

              fitbitWidgets.forEach((w) => {
                const val = w.id === "water" ? obj.water : obj.steps;
                const existing =
                  updatedProgress[w.instanceId] ?? {
                    value: 0,
                    date: todayStr,
                    streak: 0,
                    lastCompleted: "",
                  };

                if (existing.date !== todayStr) {
                  existing.value = 0;
                }
                existing.value = val;
                updatedProgress[w.instanceId] = existing;
              });

              setProgressByWidget(updatedProgress);

              const rows = fitbitWidgets.map((w) => ({
                widget_instance_id: w.instanceId,
                date: todayStr,
                value: w.id === "water" ? obj.water : obj.steps,
              }));

              if (rows.length) {
                await fetch('/api/widgets/progress', {
                  method: 'POST',
                  credentials: 'same-origin',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ rows }),
                });

                // Fire-and-forget: backfill yesterday's data in background
                if (!fetchedYesterdayRef.current) {
                  fetchedYesterdayRef.current = true;
                  const fwCopy = [...fitbitWidgets];
                  void (async () => {
                    try {
                      const resY = await fetch(`/api/integrations/fitbit/metrics?date=${yesterdayStrGlobal}`);
                      if (resY.ok) {
                        const dataY = await resY.json();
                        const rowsY = fwCopy.map((w) => ({
                          widget_instance_id: w.instanceId,
                          date: yesterdayStrGlobal,
                          value: w.id === "water" ? (dataY.water ?? 0) : (dataY.steps ?? 0),
                        }));
                        if (rowsY.length) {
                          await fetch('/api/widgets/progress', {
                            method: 'POST',
                            credentials: 'same-origin',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ rows: rowsY }),
                          });
                        }
                      }
                    } catch (errYesterday) {
                      console.error("Failed to backfill yesterday Fitbit history", errYesterday);
                    }
                  })();
                }
              }

              try {
                await saveWidgets(widgetsByBucketRef.current, updatedProgress);
              } catch (e) {
                console.error("Failed to save widget progress to preferences", e);
              }
            } catch (errFitbitProgress) {
              console.error("Failed to update Fitbit widget progress", errFitbitProgress);
            }
          } catch (err) {
            console.error('Failed to fetch Fitbit metrics', err);
          }
        })());
      }

      const needWithings = Object.values(widgetsByBucketRef.current)
        .flat()
        .some((w) => w.id === 'weight' && w.dataSource === 'withings');

      if (needWithings) {
        refreshPromises.push((async () => {
          try {
            const resW = await fetch(`/api/integrations/withings/metrics?cb=${Date.now()}`, { credentials: 'include' });
            if (!resW.ok) {
              console.error('Failed to fetch Withings metrics');
              return;
            }
            const dataW = await resW.json();
            const kg = dataW.weightKg;
            if (kg === undefined || kg === null) return;

            setWithingsData({ weightKg: kg });

            setWidgetsByBucket((prev) => {
              const updated = { ...prev };
              Object.keys(updated).forEach((bucket) => {
                updated[bucket] = updated[bucket].map((w) => {
                  if (w.id === 'weight' && w.dataSource === 'withings') {
                    const unit = w.weightData?.unit || w.unit || 'lbs';
                    const val = unit === 'lbs' ? parseFloat((kg * 2.20462).toFixed(1)) : parseFloat(kg.toFixed(2));
                    return {
                      ...w,
                      weightData: {
                        ...w.weightData,
                        currentWeight: val,
                        lastEntryDate: new Date().toISOString().split('T')[0],
                        unit,
                      },
                    } as typeof w;
                  }
                  return w;
                });
              });
              return updated;
            });

            // Also upsert today's weight into widget_progress_history for trends
            try {
              const withingsWidgets = Object.values(widgetsByBucketRef.current)
                .flat()
                .filter((w) => w.id === 'weight' && w.dataSource === 'withings');
              const rows = withingsWidgets.map((w) => {
                const wUnit = w.weightData?.unit || w.unit || 'lbs';
                const val = wUnit === 'lbs' ? parseFloat((kg * 2.20462).toFixed(1)) : parseFloat(kg.toFixed(2));
                return {
                  widget_instance_id: w.instanceId,
                  date: todayStrGlobal,
                  value: val,
                };
              });
              if (rows.length) {
                await fetch('/api/widgets/progress', {
                  method: 'POST',
                  credentials: 'same-origin',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ rows }),
                });
              }
            } catch (errProgress) {
              console.error('Failed to upsert Withings weight to progress history', errProgress);
            }
          } catch (errW) {
            console.error('Error fetching Withings metrics', errW);
          }
        })());
      }

      const needGoogleFit = Object.values(widgetsByBucketRef.current)
        .flat()
        .some((w) => ["water", "steps"].includes(w.id) && w.dataSource === "googlefit");

      if (needGoogleFit) {
        refreshPromises.push((async () => {
          try {
            const res = await fetch(`/api/integrations/googlefit/metrics?cb=${Date.now()}`);
            if (!res.ok) {
              console.error('Failed to fetch Google Fit metrics');
              return;
            }

            const data = await res.json();
            const obj: Record<string, number> = {
              water: data.water || 0,
              steps: data.steps || 0,
            };

            setGoogleFitData(obj);

            // Update progress for each Google Fit widget
            try {
              const todayStr = todayStrGlobal;
              const googleFitWidgets = Object.values(widgetsByBucketRef.current)
                .flat()
                .filter((w) => w.dataSource === "googlefit" && ["water", "steps"].includes(w.id));

              if (!googleFitWidgets.length) return;

              const updatedProgress: Record<string, ProgressEntry> = {
                ...progressByWidgetRef.current,
              };

              googleFitWidgets.forEach((w) => {
                const val = w.id === "water" ? obj.water : obj.steps;
                const existing = updatedProgress[w.instanceId] ?? {
                  value: 0,
                  date: todayStr,
                  streak: 0,
                  lastCompleted: "",
                };

                if (existing.date !== todayStr) {
                  existing.value = 0;
                }
                existing.value = val;
                updatedProgress[w.instanceId] = existing;
              });

              setProgressByWidget(updatedProgress);

              const rows = googleFitWidgets.map((w) => ({
                widget_instance_id: w.instanceId,
                date: todayStr,
                value: w.id === "water" ? obj.water : obj.steps,
              }));

              if (rows.length) {
                await fetch('/api/widgets/progress', {
                  method: 'POST',
                  credentials: 'same-origin',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ rows }),
                });
              }

              try {
                await saveWidgets(widgetsByBucketRef.current, updatedProgress);
              } catch (e) {
                console.error("Failed to save Google Fit widget progress to preferences", e);
              }
            } catch (errGoogleFitProgress) {
              console.error("Failed to update Google Fit widget progress", errGoogleFitProgress);
            }
          } catch (err) {
            console.error('Error refreshing Google Fit metrics', err);
          }
        })());
      }

      await Promise.all(refreshPromises);
    } catch (err) {
      console.error("Manual refresh failed", err);
    } finally {
      setIsRefreshing(false);
    }
  }, [user, selectedDate]);

  const fetchTodoistTasks = useCallback(async (d: Date) => {
    try {
      setIsLoadingTasks(true);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const res = await fetch(`/api/integrations/todoist/tasks?date=${iso}`);
      if (!res.ok) {
        setTodoistTasks([]);
        return;
      }
      const data = await res.json();
      setTodoistTasks(data.tasks || []);
    } catch (err) {
      console.error('Failed to load Todoist tasks', err);
      setTodoistTasks([]);
    } finally {
      setIsLoadingTasks(false);
    }
  }, []);

  const fetchAllTodoistTasks = useCallback(async (dateForDaily?: Date) => {
    try {
      setIsLoadingAllTasks(true);
      setIsLoadingTasks(true);

      // ---------- Try cached data first (1-minute TTL) ----------
      if (typeof window !== 'undefined') {
        try {
          const raw = localStorage.getItem('todoist_all_tasks');
          if (raw) {
            const cached = JSON.parse(raw);
            if (cached.savedAt && Date.now() - cached.savedAt < 60 * 1000) {
              const allTasks: any[] = cached.tasks || [];
              setAllTodoistTasks(allTasks);
              if (dateForDaily) {
                const iso = `${dateForDaily.getFullYear()}-${String(dateForDaily.getMonth() + 1).padStart(2, '0')}-${String(dateForDaily.getDate()).padStart(2, '0')}`;
                setTodoistTasks(allTasks.filter((t: any) => t.due?.date === iso));
              }
              return; // fresh cache
            }
          }
        } catch { }
      }

      const res = await fetch('/api/integrations/todoist/tasks?all=true');
      if (!res.ok) {
        setAllTodoistTasks([]);
        setTodoistTasks([]);
        return;
      }
      const data = await res.json();
      const allTasks: any[] = data.tasks || [];
      setAllTodoistTasks(allTasks);

      // Derive the tasks for the selected day so we don't need a second request
      if (dateForDaily) {
        const iso = `${dateForDaily.getFullYear()}-${String(dateForDaily.getMonth() + 1).padStart(2, '0')}-${String(dateForDaily.getDate()).padStart(2, '0')}`;
        const daily = allTasks.filter((t) => t.due?.date === iso);
        setTodoistTasks(daily);
      }

      // Persist cache
      if (typeof window !== 'undefined') {
        localStorage.setItem('todoist_all_tasks', JSON.stringify({ tasks: allTasks, savedAt: Date.now() }));
      }
    } catch (err) {
      console.error('Failed to load Todoist tasks', err);
      setAllTodoistTasks([]);
      setTodoistTasks([]);
    } finally {
      setIsLoadingAllTasks(false);
      setIsLoadingTasks(false);
    }
  }, []);

  // ----------------------------------------------------------------------
  // Drag & Drop handling between dailyTasks and openTasks
  // ----------------------------------------------------------------------
  const selectedDateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;

  const openTasksToShow = allTodoistTasks.filter((t: any) => t.due?.date !== selectedDateStr);

  // ----------------------------------------------------------------------
  // Upcoming tasks filtering and grouping logic
  // ----------------------------------------------------------------------
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  const getTimeUntilDue = (dueDate: string | null) => {
    if (!dueDate) return null;
    const due = new Date(dueDate);
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const formatTimeUntilDue = (days: number | null) => {
    if (days === null) return '';
    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    if (days === -1) return 'Yesterday';
    if (days < 0) return `${Math.abs(days)} days ago`;
    if (days === 7) return '1 week';
    if (days < 7) return `${days} days`;
    if (days < 14) return `${days} days`;
    if (days < 30) return `${Math.floor(days / 7)} weeks`;
    return `${Math.floor(days / 30)} months`;
  };

  const upcomingTasks = allTodoistTasks.filter((t: any) => {
    if (!t.due?.date) return false;
    return t.due.date > todayStr;
  });

  const groupUpcomingTasks = () => {
    const groups = {
      next7Days: [] as any[],
      next2Weeks: [] as any[],
      later: [] as any[],
      noDueDate: allTodoistTasks.filter((t: any) => !t.due?.date)
    };

    upcomingTasks.forEach((task: any) => {
      const daysUntil = getTimeUntilDue(task.due?.date);
      if (daysUntil !== null) {
        if (daysUntil <= 7) {
          groups.next7Days.push(task);
        } else if (daysUntil <= 14) {
          groups.next2Weeks.push(task);
        } else {
          groups.later.push(task);
        }
      }
    });

    return groups;
  };

  const upcomingTaskGroups = groupUpcomingTasks();

  const updateTaskDueDate = async (taskId: string, dueDate: string | null) => {
    try {
      await fetch('/api/integrations/todoist/tasks/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, dueDate }),
      });
    } catch (err) {
      console.error('Failed to update Todoist task', err);
    }
  };

  const updateTaskDuration = async (taskId: string, duration: number) => {
    try {
      await fetch('/api/integrations/todoist/tasks/update-duration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, duration }),
      });
    } catch (err) {
      console.error('Failed to update task duration', err);
    }
  };

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) {
      return;
    }

    const { source, destination, draggableId } = result;

    // If dropped in the same list and at same index, do nothing
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) {
      return;
    }

    // Helper to remove a task by id from an array (immutably)
    const removeById = (arr: any[], id: string) => arr.filter((t) => t.id.toString() !== id);

    // ------------------------------------------------------------------
    // 1) Moves involving the hourly planner - now using TasksContext
    // ------------------------------------------------------------------

    // Note: The HourlyPlanner component now uses TasksContext, so we need to
    // update tasks through the batch update API instead of local state

    if (source.droppableId === 'dailyTasks' && isHour(destination.droppableId)) {
      // Daily ➜ Hour slot - schedule the task
      const moved = todoistTasks[source.index];
      if (!moved) {
        return;
      }

      const dstHour = hourKey(destination.droppableId);

      try {
        // Use batchUpdateTasks for optimistic updates
        await batchUpdateTasks([{
          taskId: draggableId,
          updates: { hourSlot: dstHour, duration: 60 }, // Default 60 minutes
          occurrenceDate: selectedDateStr,
        }]);

      } catch (error) {
        console.error('Failed to schedule task:', error);
      }
      return;
    }

    if (source.droppableId === 'openTasks' && isHour(destination.droppableId)) {
      // Open list ➜ Hour slot - schedule the task and set due date
      const openVisible = allTodoistTasks.filter(
        (t: any) => t.due?.date !== selectedDateStr
      );
      const moved = openVisible[source.index];
      if (!moved) return;

      const dstHour = hourKey(destination.droppableId);

      try {
        // Use batchUpdateTasks for optimistic updates
        await batchUpdateTasks([{
          taskId: draggableId,
          updates: {
            hourSlot: dstHour,
            duration: 60 // Default 60 minutes
          },
          occurrenceDate: selectedDateStr,
        }]);

        // Also update the due date
        await updateTaskDueDate(draggableId, selectedDateStr);

      } catch (error) {
        console.error('Failed to schedule task from open list:', error);
      }
      return;
    }

    // Handle hour-to-hour moves (moving tasks between time slots)
    if (isHour(source.droppableId) && isHour(destination.droppableId)) {
      const srcHour = hourKey(source.droppableId);
      const dstHour = hourKey(destination.droppableId);

      if (srcHour === dstHour) {
        return;
      }


      try {
        // Use batchUpdateTasks for optimistic updates
        await batchUpdateTasks([{
          taskId: draggableId,
          updates: { hourSlot: dstHour },
          occurrenceDate: selectedDateStr,
        }]);

      } catch (error) {
        console.error('Failed to move task between hours:', error);
      }
      return;
    }

    // Skip old hourly planner logic since HourlyPlanner component now handles
    // its own drag and drop through TasksContext

    // ------------------------------------------------------------------
    // 2) Existing logic (daily ⟷ open etc.)
    // ------------------------------------------------------------------
    if (source.droppableId === 'dailyTasks' && destination.droppableId === 'openTasks') {
      // -------------------------------------------
      // Move task from daily list ➜ open list
      // -------------------------------------------
      const moved = todoistTasks[source.index];
      if (!moved) return;

      // 1) Update daily list order (remove)
      setTodoistTasks((prev) => {
        const next = [...prev];
        next.splice(source.index, 1);
        return next;
      });

      // 2) Insert into open list at destination.index
      setAllTodoistTasks((prev) => {
        const clearedDue = moved.due ? { ...moved.due, date: null } : { date: null };
        const cleared = { ...moved, due: clearedDue };

        const without = removeById(prev, draggableId);

        // Separate lists so we can insert into the open subset and then stitch back together
        const openSubset: any[] = [];
        const datedSubset: any[] = [];
        without.forEach((task) => {
          if (task.due?.date === selectedDateStr) datedSubset.push(task);
          else openSubset.push(task);
        });

        openSubset.splice(destination.index, 0, cleared);
        return [...openSubset, ...datedSubset];
      });

      await updateTaskDueDate(draggableId, null);
    } else if (source.droppableId === 'openTasks' && destination.droppableId === 'dailyTasks') {
      // -------------------------------------------
      // Move task from open list ➜ daily list
      // -------------------------------------------
      // Need to derive the actual task from openTasksToShow order.
      const openVisible = allTodoistTasks.filter(
        (t: any) => t.due?.date !== selectedDateStr
      );
      const moved = openVisible[source.index];
      if (!moved) return;

      // Prepare updated copy with new due date
      const updatedDue = moved.due ? { ...moved.due, date: selectedDateStr } : { date: selectedDateStr };
      const updated = { ...moved, due: updatedDue };

      // 1) Update allTodoistTasks (remove, then reinsert with due date) preserving order
      setAllTodoistTasks((prev) => {
        const updatedDue = moved.due ? { ...moved.due, date: selectedDateStr } : { date: selectedDateStr };
        const updated = { ...moved, due: updatedDue };

        const without = removeById(prev, draggableId);

        const openSubset: any[] = [];
        const datedSubset: any[] = [];
        without.forEach((task) => {
          if (task.due?.date === selectedDateStr) datedSubset.push(task);
          else openSubset.push(task);
        });

        // Now updated will belong to datedSubset; we'll insert into dated list later via todoistTasks state
        datedSubset.push(updated); // order inside dated subset managed below

        return [...openSubset, ...datedSubset];
      });

      // 2) Insert into daily list at drop position using the updated task
      setTodoistTasks((prev) => {
        const next = [...prev];
        next.splice(destination.index, 0, updated);
        return next;
      });

      await updateTaskDueDate(draggableId, selectedDateStr);
    } else if (source.droppableId === 'dailyTasks' && destination.droppableId === 'dailyTasks') {
      // Reorder within daily list
      setTodoistTasks((prev) => {
        const next = [...prev];
        const [movedItem] = next.splice(source.index, 1);
        next.splice(destination.index, 0, movedItem);
        return next;
      });
    } else if (source.droppableId === 'openTasks' && destination.droppableId === 'openTasks') {
      // Reorder within open list (affects allTodoistTasks order)
      const openSubset = allTodoistTasks.filter((t) => t.due?.date !== selectedDateStr);
      const datedSubset = allTodoistTasks.filter((t) => t.due?.date === selectedDateStr);

      const [movedItem] = openSubset.splice(source.index, 1);
      openSubset.splice(destination.index, 0, movedItem);

      setAllTodoistTasks([...openSubset, ...datedSubset]);
    }

    // ------------------------------------------------------------------
    // 3) Upcoming task group drag and drop handling
    // ------------------------------------------------------------------
    const upcomingDroppableIds = ['next7Days', 'next2Weeks', 'later', 'noDueDate'];

    if (upcomingDroppableIds.includes(source.droppableId) || upcomingDroppableIds.includes(destination.droppableId)) {

      // Get the task being moved
      let movedTask: any = null;

      // Find the task in the appropriate source group
      if (source.droppableId === 'next7Days') {
        movedTask = upcomingTaskGroups.next7Days[source.index];
      } else if (source.droppableId === 'next2Weeks') {
        movedTask = upcomingTaskGroups.next2Weeks[source.index];
      } else if (source.droppableId === 'later') {
        movedTask = upcomingTaskGroups.later[source.index];
      } else if (source.droppableId === 'noDueDate') {
        movedTask = upcomingTaskGroups.noDueDate[source.index];
      } else if (source.droppableId === 'dailyTasks') {
        movedTask = todoistTasks[source.index];
      } else if (source.droppableId === 'openTasks') {
        const openVisible = allTodoistTasks.filter((t: any) => t.due?.date !== selectedDateStr);
        movedTask = openVisible[source.index];
      }

      if (!movedTask) {
        return;
      }

      // Determine what date to set based on destination
      let newDueDate: string | null = null;
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const prevWeek = new Date(selectedDate.getTime() - 7 * 24 * 60 * 60 * 1000);
      const nextWeek = new Date(today);
      nextWeek.setDate(nextWeek.getDate() + 8);
      const nextMonth = new Date(today);
      nextMonth.setDate(nextMonth.getDate() + 30);

      if (destination.droppableId === 'next7Days') {
        newDueDate = tomorrow.toISOString().split('T')[0];
      } else if (destination.droppableId === 'next2Weeks') {
        newDueDate = nextWeek.toISOString().split('T')[0];
      } else if (destination.droppableId === 'later') {
        newDueDate = nextMonth.toISOString().split('T')[0];
      } else if (destination.droppableId === 'noDueDate') {
        newDueDate = null;
      } else if (destination.droppableId === 'dailyTasks') {
        newDueDate = selectedDateStr;
      } else if (destination.droppableId === 'openTasks') {
        newDueDate = null;
      }

      // Update the task's due date

      // Optimistically update the state
      setAllTodoistTasks((prev) => {
        return prev.map((task) => {
          if (task.id.toString() === draggableId) {
            const updatedDue = newDueDate ? { date: newDueDate } : null;
            return { ...task, due: updatedDue };
          }
          return task;
        });
      });

      // Also update daily tasks if moving to/from daily
      if (destination.droppableId === 'dailyTasks') {
        setTodoistTasks((prev) => {
          const updatedTask = { ...movedTask, due: { date: newDueDate } };
          const next = [...prev];
          next.splice(destination.index, 0, updatedTask);
          return next;
        });
      } else if (source.droppableId === 'dailyTasks') {
        setTodoistTasks((prev) => {
          return prev.filter((task) => task.id.toString() !== draggableId);
        });
      }

      // Update the server
      await updateTaskDueDate(draggableId, newDueDate);
    }

    // Optionally you can refresh from server, but keeping as-is to avoid flicker
    // fetchTodoistTasks(selectedDate);
    // fetchAllTodoistTasks();
  };

  // Defer the first integration sync until widgets are loaded and visible,
  // so it doesn't compete with the critical rendering path.
  // After the first run, repeat every 30 minutes to stay current.
  const hasFetchedIntegrationsRef = useRef(false);
  useEffect(() => {
    if (!isWidgetLoadComplete || hasFetchedIntegrationsRef.current) return;
    hasFetchedIntegrationsRef.current = true;

    // Delay so the browser can paint the widget grid first. Users see cached
    // integration data from localStorage instantly; this refresh just gets
    // the latest values from external APIs.
    const timeout = setTimeout(fetchIntegrationsData, 1500);
    const int = setInterval(fetchIntegrationsData, 30 * 60 * 1000); // 30 min
    return () => {
      clearTimeout(timeout);
      clearInterval(int);
    };
  }, [isWidgetLoadComplete, fetchIntegrationsData]);

  // Fetch tasks whenever date changes (single consolidated request).
  // Skip the initial mount call — fetchIntegrationsData already handles it.
  const hasLoadedTodoistRef = useRef(false);
  useEffect(() => {
    if (!hasLoadedTodoistRef.current) {
      hasLoadedTodoistRef.current = true;
      return; // fetchIntegrationsData handles the first load
    }
    fetchAllTodoistTasks(selectedDate);
  }, [selectedDate, fetchAllTodoistTasks]);

  // Load progress from localStorage or Supabase once on mount / user change
  useEffect(() => {
    async function loadProgress() {
      let loaded = false;
      if (typeof window !== 'undefined') {
        const raw = localStorage.getItem('widget_progress');
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            setProgressByWidget(parsed);
            loaded = true;
          } catch (e) {
            console.error('Failed to parse localStorage progress:', e);
          }
        }
      }

      if (!loaded && user) {
        try {
          const prefs = await getUserPreferencesClient();
          if (prefs?.progress_by_widget) {
            setProgressByWidget(prefs.progress_by_widget as Record<string, ProgressEntry>);
            loaded = true;
          }
        } catch (err) {
          console.error('Failed to load progress from Supabase', err);
        }
      }

      if (!loaded) {
      }
    }

    loadProgress();
  }, [user]);

  // Helper to get today string  
  const todayStrGlobal = new Date().toISOString().slice(0, 10);

  const incrementProgress = async (w: WidgetInstance) => {

    setProgressByWidget(prev => {
      const entry = prev[w.instanceId] ?? { value: 0, date: todayStrGlobal, streak: 0, lastCompleted: '' };
      let { value, streak, lastCompleted } = entry;
      // if the stored date isn't today, reset value
      if (entry.date !== todayStrGlobal) {
        value = 0;
      }
      value += 1;
      // determine if target reached
      let newLast = lastCompleted;
      let newStreak = streak;
      if (value >= w.target) {
        if (lastCompleted === yesterdayStrGlobal) {
          newStreak = streak + 1;
        } else if (lastCompleted !== todayStrGlobal) {
          newStreak = 1;
        }
        newLast = todayStrGlobal;

        // Celebrate with confetti the moment the goal is hit (only when value just reached target)
        if (value === w.target && typeof window !== 'undefined') {
          // Dynamically import to avoid SSR issues
          import('canvas-confetti').then((mod) => {
            const confetti = mod.default;
            // Fire a burst similar to the CodePen example
            confetti({
              particleCount: 80,
              spread: 70,
              origin: { y: 0.6 },
            });
          }).catch((err) => console.error('Failed to load confetti', err));
        }
      }

      const newProgress = { ...prev, [w.instanceId]: { value, date: todayStrGlobal, streak: newStreak, lastCompleted: newLast } };
      return newProgress;
    });

    // ---------------- Progress history upsert via API ----------------
    try {
      await fetch('/api/widgets/progress', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rows: [{
            widget_instance_id: w.instanceId,
            date: todayStrGlobal,
            value: (progressByWidget[w.instanceId]?.value ?? 0) + 1,
          }],
        }),
      });
    } catch (err) {
      console.error('Failed to upsert progress history', err);
    }
  };

  // Centralized function to save widgets, including to localStorage
  const saveWidgets = async (widgetsToSave: Record<string, WidgetInstance[]>, progressToSave?: Record<string, ProgressEntry>) => {
    const widgetCount = Object.values(widgetsToSave).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0);

    // Save to localStorage FIRST — synchronous, no auth dependency
    if (typeof window !== 'undefined') {
      try {
        const dataToSave = {
          widgets: widgetsToSave,
          savedAt: new Date().toISOString()
        };
        localStorage.setItem('widgets_by_bucket', JSON.stringify(dataToSave));
      } catch (lsErr) {
        console.error('[saveWidgets] localStorage.setItem FAILED:', lsErr);
      }
    }

    // Then save only the widget-related columns to Supabase.
    // Using a targeted update avoids race conditions where a concurrent
    // full-row upsert (e.g. bucket reorder) overwrites the new widgets.
    try {
      const fields: Record<string, any> = { widgets_by_bucket: widgetsToSave };
      if (progressToSave && Object.keys(progressToSave).length > 0) {
        fields.progress_by_widget = progressToSave;
      } else if (progressByWidgetRef.current && Object.keys(progressByWidgetRef.current).length > 0) {
        fields.progress_by_widget = progressByWidgetRef.current;
      }
      const ok = await updateUserPreferenceFields(fields);
      if (!ok) {
        console.error('[saveWidgets] Supabase save returned false for', widgetCount, 'widgets');
      }
    } catch (err) {
      console.error('[saveWidgets] Supabase save exception:', err);
    }
  };

  // Create a debounced save that always uses the latest state from the ref
  const debouncedSaveToSupabase = useRef(
    debounce(() => {
      // Always use the latest state from the ref
      const latestWidgets = widgetsByBucketRef.current;
      const latestProgress = progressByWidgetRef.current;
      saveWidgets(latestWidgets, latestProgress);
    }, 2000)
  ).current;

  // Handle widget drag-and-drop reorder within a bucket
  const handleWidgetDragEnd = useCallback((result: DropResult) => {
    const { source, destination } = result;
    if (!destination) return;
    if (source.index === destination.index) return;

    setWidgetsByBucket((prev) => {
      const bucketWidgets = [...(prev[activeBucket] || [])];
      // Work on display widgets only (exclude debug widgets)
      const displayWidgets = bucketWidgets.filter(w => !w.instanceId?.startsWith('debug-'));
      const debugWidgets = bucketWidgets.filter(w => w.instanceId?.startsWith('debug-'));
      const [moved] = displayWidgets.splice(source.index, 1);
      displayWidgets.splice(destination.index, 0, moved);
      const updated = { ...prev, [activeBucket]: [...displayWidgets, ...debugWidgets] };
      widgetsByBucketRef.current = updated;
      return updated;
    });
    debouncedSaveToSupabase();
  }, [activeBucket, debouncedSaveToSupabase]);

  // Handle habit tracker inline toggle (log / undo today)
  const handleHabitToggle = useCallback((widget: WidgetInstance, isCompletedToday: boolean) => {
    const habitData = widget.habitTrackerData;
    if (!habitData) return;

    const history = [...(habitData.completionHistory || [])];
    let total = habitData.totalCompletions || 0;
    const todayKey = new Date().toISOString().split('T')[0];

    // Calculate current streak for bestStreak update
    const sorted = Array.from(new Set(habitData.completionHistory || [])).sort().reverse();
    const yesterdayKey = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    let streak = 0;
    if (sorted.length && (sorted[0] === todayKey || sorted[0] === yesterdayKey)) {
      let expected = sorted[0];
      for (const date of sorted) {
        if (date === expected) {
          streak++;
          const d = new Date(expected + 'T12:00:00');
          d.setDate(d.getDate() - 1);
          expected = d.toISOString().split('T')[0];
        } else break;
      }
    }

    if (isCompletedToday) {
      const idx = history.lastIndexOf(todayKey);
      if (idx !== -1) history.splice(idx, 1);
      total = Math.max(0, total - 1);
    } else {
      history.push(todayKey);
      total++;
      incrementProgress(widget);
    }

    const updatedData = {
      habitTrackerData: {
        ...habitData,
        completionHistory: history,
        totalCompletions: total,
        bestStreak: Math.max(habitData.bestStreak || 0, streak + (isCompletedToday ? 0 : 1)),
      },
    };

    setWidgetsByBucket(prev => {
      const next = { ...prev };
      next[activeBucket] = (next[activeBucket] ?? []).map(ww =>
        ww.instanceId === widget.instanceId ? { ...ww, ...updatedData } : ww
      );
      if (typeof window !== 'undefined') {
        localStorage.setItem('widgets_by_bucket', JSON.stringify({ widgets: next, savedAt: new Date().toISOString() }));
      }
      return next;
    });
  }, [activeBucket, incrementProgress]);

  const handleSignOut = async () => {
    if (isSigningOut) return; // Prevent double-clicks
    setIsSigningOut(true);

    try {
      // Flush any pending debounced saves before logging out
      debouncedSaveToSupabase.flush?.();

      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Logout failed');
      }

      // On successful logout, the auth listener will detect the change,
      // and the useEffect hook will handle clearing state and redirecting.
      window.location.href = '/'; // Manually redirect after successful API call

    } catch (error) {
      console.error('Client: Error during sign out:', error);
      setIsSigningOut(false); // Re-enable button on error
    }
  };

  const handleAddBucket = async () => {
    const name = newBucket.trim();
    if (!name || buckets.includes(name)) return;
    const updated = [...buckets, name];
    setBuckets(updated);
    if (!activeBucket) {
      setActiveBucket(name);
    }
    setNewBucket("");
    // Auto-assign suggested color if this bucket has no color yet
    const existingColor = bucketColors[name];
    const colorToUse = existingColor || getSuggestedColorForBucket(name);
    if (!existingColor) {
      const nextColors = { ...bucketColors, [name]: colorToUse } as Record<string, string>;
      setBucketColors(nextColors);
      if (typeof window !== 'undefined') {
        localStorage.setItem('bucket_colors', JSON.stringify(nextColors));
      }
      // Broadcast change so any listeners update immediately
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('bucketColorsChanged'));
      }
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem('life_buckets', JSON.stringify(updated));
      markBucketsSaved();
      // Notify other views (e.g., Calendar) that buckets changed
      window.dispatchEvent(new CustomEvent('lifeBucketsChanged'));
    }

    // Save to Supabase for persistence — targeted update to avoid race conditions
    try {
      const mergedColors = { ...bucketColors, [name]: colorToUse } as Record<string, string>;
      const ok = await updateUserPreferenceFields({ life_buckets: updated, bucket_colors: mergedColors });
      if (ok) markBucketsSynced();
    } catch (err) {
      console.error('Failed to save buckets to Supabase:', err);
    }
  };

  // Quick-add helper for suggested buckets
  const handleAddBucketQuick = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || buckets.includes(trimmed)) return;
    const updated = [...buckets, trimmed];
    setBuckets(updated);
    if (!activeBucket) {
      setActiveBucket(trimmed);
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem('life_buckets', JSON.stringify(updated));
      markBucketsSaved();
      window.dispatchEvent(new CustomEvent('lifeBucketsChanged'));
    }
    try {
      // Auto-assign suggested color if missing
      const existing = bucketColors[trimmed];
      const colorToUse = existing || getSuggestedColorForBucket(trimmed);
      const nextColors = { ...bucketColors, [trimmed]: colorToUse } as Record<string, string>;
      setBucketColors(prev => ({ ...nextColors }));
      if (typeof window !== 'undefined') {
        localStorage.setItem('bucket_colors', JSON.stringify(nextColors));
      }
      // Broadcast
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('bucketColorsChanged'));
      }
      const ok = await updateUserPreferenceFields({ life_buckets: updated, bucket_colors: nextColors });
      if (ok) markBucketsSynced();
    } catch (err) {
      console.error('Failed to save buckets to Supabase:', err);
    }
  };

  const handleRemoveBucketImmediate = async (bucket: string) => {
    const updated = buckets.filter(b => b !== bucket);
    setBuckets(updated);
    if (activeBucket === bucket && updated.length) {
      setActiveBucket(updated[0]);
    } else if (!updated.length) {
      setActiveBucket('');
    }

    // Clean up widget data and bucket colors for the removed bucket.
    // Use refs/spread directly so values are available for the Supabase call
    // without depending on React setState callback timing.
    const cleanedWidgets = { ...widgetsByBucketRef.current };
    delete cleanedWidgets[bucket];
    widgetsByBucketRef.current = cleanedWidgets;
    setWidgetsByBucket(cleanedWidgets);

    const cleanedColors = { ...bucketColors };
    delete cleanedColors[bucket];
    setBucketColors(cleanedColors);

    if (typeof window !== 'undefined') {
      localStorage.setItem('life_buckets', JSON.stringify(updated));
      localStorage.setItem('bucket_colors', JSON.stringify(cleanedColors));
      localStorage.setItem('widgets_by_bucket', JSON.stringify({
        widgets: cleanedWidgets,
        savedAt: new Date().toISOString(),
      }));
      markBucketsSaved();
      window.dispatchEvent(new CustomEvent('lifeBucketsChanged'));
    }

    // Save life_buckets, widgets_by_bucket, and bucket_colors to Supabase
    // so the deleted bucket is fully removed on all devices.
    try {
      const ok = await updateUserPreferenceFields({
        life_buckets: updated,
        widgets_by_bucket: cleanedWidgets,
        bucket_colors: cleanedColors,
      });
      if (ok) markBucketsSynced();
    } catch (err) {
      console.error('Failed to save buckets to Supabase:', err);
    }

    // Cascade-delete tasks, calendar events, and shopping list items for this bucket
    try {
      await fetch('/api/user/bucket-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bucket }),
      });
    } catch (err) {
      console.error('Failed to cascade-delete bucket data:', err);
    }
  };

  const requestRemoveBucket = (bucket: string) => {
    const previousBuckets = [...buckets];
    const previousActiveBucket = activeBucket;

    // Close the Manage Tabs Sheet first so its portal overlay
    // doesn't block interaction with the confirm dialog.
    setIsEditorOpen(false);

    setConfirmState({
      title: `Remove "${bucket}" tab?`,
      description: "This permanently removes the tab and all its tasks, calendar events, and shopping list items.",
      confirmLabel: "Remove tab",
      onConfirm: async () => {
        await handleRemoveBucketImmediate(bucket);
        pushUndo(`Removed ${bucket} tab`, async () => {
          setBuckets(previousBuckets);
          bucketsRef.current = previousBuckets;
          if (previousActiveBucket) {
            setActiveBucket(previousActiveBucket);
          } else if (previousBuckets.length > 0) {
            setActiveBucket(previousBuckets[0]);
          } else {
            setActiveBucket("");
          }

          if (typeof window !== "undefined") {
            localStorage.setItem("life_buckets", JSON.stringify(previousBuckets));
            markBucketsSaved();
            window.dispatchEvent(new CustomEvent("lifeBucketsChanged"));
          }

          try {
            const ok = await updateUserPreferenceFields({ life_buckets: previousBuckets });
            if (ok) markBucketsSynced();
          } catch (err) {
            console.error("Failed to restore bucket after undo:", err);
          }
        });
      },
    });
  };

  // Assign / update a color for a given bucket and persist
  const handleBucketColorChange = async (bucket: string, colorHex: string) => {
    setBucketColors(prev => ({ ...prev, [bucket]: colorHex }));

    try {
      const nextColors = { ...bucketColors, [bucket]: colorHex } as Record<string, string>;
      await updateUserPreferenceFields({ bucket_colors: nextColors });
      // Persist locally as well
      if (typeof window !== 'undefined') {
        localStorage.setItem('bucket_colors', JSON.stringify(nextColors));
      }
      // Notify any listeners that colors changed
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('bucketColorsChanged'));
      }
    } catch (err) {
      console.error('Failed to save bucket color to Supabase:', err);
    }
  };

  // Start editing a bucket name
  const handleStartEditBucket = (bucket: string) => {
    setEditingBucketName(bucket);
    setEditingBucketNewName(bucket);
  };

  // Save the edited bucket name
  const handleSaveEditBucket = async () => {
    if (!editingBucketName || !editingBucketNewName.trim()) {
      setEditingBucketName(null);
      setEditingBucketNewName("");
      return;
    }

    const newName = editingBucketNewName.trim();
    if (newName === editingBucketName) {
      setEditingBucketName(null);
      setEditingBucketNewName("");
      return;
    }

    // Check if name already exists
    if (buckets.includes(newName)) {
      alert('A tab with this name already exists');
      return;
    }

    // Update buckets array
    const updated = buckets.map(b => b === editingBucketName ? newName : b);
    setBuckets(updated);

    // Update active bucket if needed
    if (activeBucket === editingBucketName) {
      setActiveBucket(newName);
    }

    // Update bucket colors with new name
    const oldColor = bucketColors[editingBucketName];
    const updatedColors = { ...bucketColors };
    if (oldColor) {
      delete updatedColors[editingBucketName];
      updatedColors[newName] = oldColor;
      setBucketColors(updatedColors);
    }

    // Update localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('life_buckets', JSON.stringify(updated));
      localStorage.setItem('bucket_colors', JSON.stringify(updatedColors));
      markBucketsSaved();
      window.dispatchEvent(new CustomEvent('lifeBucketsChanged'));
      window.dispatchEvent(new CustomEvent('bucketColorsChanged'));
    }

    // Update widgets for this bucket
    if (widgetsByBucket[editingBucketName]) {
      const bucketWidgets = widgetsByBucket[editingBucketName];
      const updatedWidgetsByBucket = { ...widgetsByBucket };
      delete updatedWidgetsByBucket[editingBucketName];
      updatedWidgetsByBucket[newName] = bucketWidgets;
      setWidgetsByBucket(updatedWidgetsByBucket);
    }

    // Save to Supabase — targeted update
    try {
      const ok = await updateUserPreferenceFields({ life_buckets: updated, bucket_colors: updatedColors });
      if (ok) markBucketsSynced();
    } catch (err) {
      console.error('Failed to save bucket rename to Supabase:', err);
    }

    setEditingBucketName(null);
    setEditingBucketNewName("");
  };

  // Cancel editing
  const handleCancelEditBucket = () => {
    setEditingBucketName(null);
    setEditingBucketNewName("");
  };

  // Handle bucket tab drag start
  const handleBucketDragStart = (index: number) => {
    manageDragIndexRef.current = index;
    setDraggedBucketIndex(index);
  };

  // Handle bucket tab drag over
  const handleBucketDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    const currentIndex = manageDragIndexRef.current;
    if (currentIndex === null || currentIndex === index) return;

    setBuckets((prev) => {
      if (currentIndex < 0 || currentIndex >= prev.length) {
        return prev;
      }
      const updated = [...prev];
      const [draggedBucket] = updated.splice(currentIndex, 1);
      updated.splice(index, 0, draggedBucket);
      manageDragIndexRef.current = index;
      bucketsRef.current = updated;
      return updated;
    });
    setDraggedBucketIndex(index);
  };

  // Handle bucket tab drag end
  const handleBucketDragEnd = async () => {
    if (manageDragIndexRef.current === null) return;

    manageDragIndexRef.current = null;
    setDraggedBucketIndex(null);

    const latestBuckets = bucketsRef.current.length ? bucketsRef.current : buckets;

    // Save to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('life_buckets', JSON.stringify(latestBuckets));
      markBucketsSaved();
      window.dispatchEvent(new CustomEvent('lifeBucketsChanged'));
    }
    // Save to Supabase — targeted update
    try {
      const ok = await updateUserPreferenceFields({ life_buckets: latestBuckets });
      if (ok) markBucketsSynced();
    } catch (err) {
      console.error('Failed to save bucket order to Supabase:', err);
    }
  };

  const loadWidgetsInProgress = useRef(false);

  async function loadWidgets() {
    // Guard against concurrent calls (getUser + onAuthStateChange both trigger this)
    if (loadWidgetsInProgress.current) return;
    loadWidgetsInProgress.current = true;

    setIsWidgetLoadComplete(false);

    // First try to load from localStorage for immediate display
    let loadedFromLocal = false;
    let localWidgets: Record<string, WidgetInstance[]> = {};
    let localSavedAt: string | null = null;

    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('widgets_by_bucket');

        if (stored) {
          const parsed = JSON.parse(stored);

          // Handle both old format (direct widgets) and new format (with metadata)
          if (parsed.widgets && parsed.savedAt) {
            localWidgets = parsed.widgets;
            localSavedAt = parsed.savedAt;
          } else if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            localWidgets = parsed;
          }

          const localCount = Object.values(localWidgets).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0);

          if (localCount > 0) {
            setWidgetsByBucket(localWidgets);
            loadedFromLocal = true;
          }
        }
      } catch (e) {
        console.error('Failed to parse stored widgets', e);
      }
    }

    // Always try to load from Supabase
    try {
      const prefs = await getUserPreferencesClient();

      const supabaseWidgets: Record<string, WidgetInstance[]> = prefs?.widgets_by_bucket ?? {};
      const sbCount = Object.values(supabaseWidgets).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
      const hasSupabase = sbCount > 0;
      const localCount = Object.values(localWidgets).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
      const hasLocal = loadedFromLocal && localCount > 0;

      if (hasSupabase || hasLocal) {
        // Merge strategy: combine widgets from both sources by instanceId
        // so that newly-added local widgets are never lost even when the
        // async Supabase save didn't complete before a page refresh.
        const merged: Record<string, WidgetInstance[]> = {};
        const allBucketKeys = Array.from(new Set([
          ...Object.keys(supabaseWidgets),
          ...Object.keys(localWidgets),
        ]));
        let mergedDiffersFromSupabase = false;

        for (const bucket of allBucketKeys) {
          const sbList: WidgetInstance[] = supabaseWidgets[bucket] ?? [];
          const localList: WidgetInstance[] = localWidgets[bucket] ?? [];

          // Index by instanceId for fast lookup
          const byId = new Map<string, WidgetInstance>();
          // Supabase widgets go in first (baseline)
          for (const w of sbList) {
            if (w && w.instanceId) byId.set(w.instanceId, w);
          }
          // Local widgets override / add — local state is always the
          // most-recently-edited copy on this device
          for (const w of localList) {
            if (w && w.instanceId) byId.set(w.instanceId, w);
          }

          merged[bucket] = Array.from(byId.values());
          if (merged[bucket].length !== sbList.length) {
            mergedDiffersFromSupabase = true;
          }
        }

        const mergedCount = Object.values(merged).reduce((sum, arr) => sum + arr.length, 0);

        const migratedMerged = migrateWidgetsToTemplates(merged);

        // Filter widget data to only include buckets that actually exist in
        // the current bucket list. This prevents deleted buckets from being
        // resurrected just because they still have leftover widget entries.
        // Use bucketsRef for a synchronous read of the latest bucket list.
        // IMPORTANT: Skip this filter when bucketsRef is empty — it means
        // loadBuckets hasn't populated it yet. Filtering against an empty
        // set would wipe ALL widgets (race condition).
        const currentBuckets = new Set(bucketsRef.current);
        let removedStaleBuckets = false;
        if (currentBuckets.size > 0) {
          for (const key of Object.keys(migratedMerged)) {
            if (!currentBuckets.has(key)) {
              delete migratedMerged[key];
              removedStaleBuckets = true;
            }
          }
        }

        setWidgetsByBucket(migratedMerged);
        widgetsByBucketRef.current = migratedMerged;

        // Mark widgets as ready immediately — Supabase write-back runs in background
        setIsWidgetLoadComplete(true);
        loadWidgetsInProgress.current = false;

        // Persist merged result
        if (typeof window !== 'undefined') {
          localStorage.setItem('widgets_by_bucket', JSON.stringify({
            widgets: migratedMerged,
            savedAt: new Date().toISOString(),
          }));
        }
        // Push cleaned data to Supabase in background if local-only widgets
        // were added or stale bucket keys were removed
        if (mergedDiffersFromSupabase || removedStaleBuckets) {
          void updateUserPreferenceFields({ widgets_by_bucket: migratedMerged });
        }
      }
    } catch (err) {
      console.error('Failed to load widgets from preferences', err);
    } finally {
      setIsWidgetLoadComplete(true);
      loadWidgetsInProgress.current = false;
    }
  }

  // Auth state change listener — uses deduplicating cached helper so
  // preferences can share the same auth round-trip instead of re-fetching.
  useEffect(() => {
    getCachedUser().then((resolvedUser) => {
      setUser(resolvedUser);
      setAuthInitialized(true);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') invalidateAuthCache();
      setUser(session?.user ?? null);
      setAuthInitialized(true);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let isCancelled = false;

    const fetchGreetingName = async () => {
      if (!user) {
        if (!isCancelled) {
          setGreetingName("");
        }
        return;
      }

      // Try prefetched greeting name first (started at module eval time)
      try {
        const prefetched = await getPrefetchedGreetingName();
        if (!isCancelled && prefetched) {
          setGreetingName(deriveGreetingName({ first_name: prefetched } as ProfileNameRow, user));
          return;
        }
      } catch { /* fall through to direct query */ }

      try {
        const res = await fetch('/api/user/profile', { credentials: 'same-origin' });
        if (isCancelled) return;

        if (res.ok) {
          const { profile } = await res.json();
          setGreetingName(deriveGreetingName(profile ?? null, user));
        } else {
          console.error('Failed to load profile for greeting');
          setGreetingName(deriveGreetingName(null, user));
        }
      } catch (err) {
        if (isCancelled) return;
        console.error('Failed to resolve greeting name', err);
        setGreetingName(deriveGreetingName(null, user));
      }
    };

    fetchGreetingName();

    return () => {
      isCancelled = true;
    };
  }, [user]);

  // Effect for user state changes (login/logout)
  // loadBuckets + loadWidgets both call getUserPreferencesClient() which deduplicates
  // via the in-flight cache, so running them concurrently is safe and faster.
  useEffect(() => {
    if (!authInitialized) return;

    if (user) {
      // Run in parallel — prefs fetch is deduplicated internally
      void Promise.all([
        loadBuckets({ fetchFromSupabase: true }),
        loadWidgets(),
      ]);
      ensureUserOnboarded();
    } else {
      loadBuckets({ fetchFromSupabase: false });
    }
  }, [user, authInitialized]);

  // Save widgets whenever they change
  useEffect(() => {
    if (!isWidgetLoadComplete || !user) {
      return; // Don't save on initial load or if logged out
    }

    // Safety: never overwrite stored widgets with an empty object.
    // This protects against race conditions where widgets haven't loaded yet
    // but isWidgetLoadComplete was already set to true.
    const widgetCount = Object.values(widgetsByBucket).reduce(
      (sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0
    );
    if (widgetCount === 0) {
      // Only allow saving empty if there's genuinely nothing in localStorage
      const existing = typeof window !== 'undefined' ? localStorage.getItem('widgets_by_bucket') : null;
      if (existing) {
        try {
          const parsed = JSON.parse(existing);
          const existingWidgets = parsed.widgets || parsed;
          const existingCount = Object.values(existingWidgets).reduce(
            (sum: number, arr: any) => sum + (Array.isArray(arr) ? arr.length : 0), 0
          );
          if (existingCount > 0) {
            console.warn('[saveWidgets] Skipping save — would overwrite', existingCount, 'existing widgets with empty state');
            return;
          }
        } catch { /* ignore parse errors */ }
      }
    }

    // Save to localStorage immediately
    if (typeof window !== 'undefined') {
      localStorage.setItem('widgets_by_bucket', JSON.stringify({
        widgets: widgetsByBucket,
        savedAt: new Date().toISOString()
      }));
    }

    // Debounce the Supabase save
    debouncedSaveToSupabase();
  }, [widgetsByBucket, isWidgetLoadComplete, user, debouncedSaveToSupabase]);

  // Save progress whenever it changes
  useEffect(() => {
    if (!isWidgetLoadComplete || !user) {
      return; // Avoid saving before initial load or when logged out
    }


    // Persist to localStorage immediately for fast reloads
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('widget_progress', JSON.stringify(progressByWidget));
      } catch (e) {
        console.error('Failed to persist widget progress', e);
      }
    }

    // Debounce Supabase save (re-use existing debounced function)
    debouncedSaveToSupabase();
  }, [progressByWidget, isWidgetLoadComplete, user, debouncedSaveToSupabase]);

  // Flush debounced saves before page unload so widgets aren't lost on refresh
  useEffect(() => {
    const handleBeforeUnload = () => {
      debouncedSaveToSupabase.flush?.();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [debouncedSaveToSupabase]);

  async function loadBuckets(options?: { fetchFromSupabase?: boolean }) {
    const shouldFetchFromSupabase = options?.fetchFromSupabase ?? true;
    let loadedFromLocal = false;
    let localBuckets: string[] = [];
    let localBucketColors: Record<string, string> | null = null;
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('life_buckets');
        if (stored) {
          const parsed: string[] = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length) {
            localBuckets = parsed;
            bucketsRef.current = parsed;   // sync ref immediately so loadWidgets can see it
            setBuckets(parsed);
            const savedActive = typeof window !== 'undefined' ? localStorage.getItem('active_bucket') : null;
            setActiveBucket(savedActive && parsed.includes(savedActive) ? savedActive : parsed[0]);
            loadedFromLocal = true;
            // Load any locally cached bucket colors immediately for smooth UX
            const storedColors = localStorage.getItem('bucket_colors');
            if (storedColors) {
              try {
                const parsedColors = JSON.parse(storedColors);
                if (parsedColors && typeof parsedColors === 'object') {
                  localBucketColors = parsedColors;
                  setBucketColors(parsedColors);
                }
              } catch (e) {
                console.warn('Failed to parse local bucket_colors');
              }
            }
          }
        }
      } catch (e) {
        console.error('Failed to parse stored buckets', e);
      }
    }

    try {
      if (!shouldFetchFromSupabase) {
        return;
      }

      const prefs = await getUserPreferencesClient();
      const serverBuckets = prefs?.life_buckets ?? [];
      const hasServer = serverBuckets.length > 0;
      const hasLocal = loadedFromLocal && localBuckets.length > 0;
      const unsynced = hasUnsyncedBucketChanges();

      if (hasLocal && unsynced) {
        // Local has unsynced changes (e.g. user refreshed before Supabase
        // save completed). Prefer local and push to server in background.
        bucketsRef.current = localBuckets;
        setBuckets(localBuckets);
        const active = (typeof window !== 'undefined' ? localStorage.getItem('active_bucket') : null) || localBuckets[0];
        setActiveBucket(localBuckets.includes(active || '') ? (active as string) : localBuckets[0]);
        if (localBucketColors) setBucketColors(localBucketColors);
        const mergedColors = { ...(prefs?.bucket_colors || {}), ...(localBucketColors || {}) } as Record<string, string>;
        void updateUserPreferenceFields({ life_buckets: localBuckets, bucket_colors: mergedColors }).then((ok) => {
          if (ok) markBucketsSynced();
        });
      } else if (hasServer) {
        // Local is fully synced (or empty) — server may have newer data
        // from another device. Use server as source of truth.
        bucketsRef.current = serverBuckets;
        setBuckets(serverBuckets);
        if (typeof window !== 'undefined') {
          localStorage.setItem('life_buckets', JSON.stringify(serverBuckets));
        }
        const localSaved = typeof window !== 'undefined' ? localStorage.getItem('active_bucket') : null;
        const initialActive = localSaved && serverBuckets.includes(localSaved) ? localSaved : serverBuckets[0];
        setActiveBucket(initialActive);
        // Apply colors from Supabase
        const serverColors = prefs?.bucket_colors || {};
        if (Object.keys(serverColors).length > 0) {
          setBucketColors(serverColors);
          if (typeof window !== 'undefined') {
            localStorage.setItem('bucket_colors', JSON.stringify(serverColors));
          }
        }
        // Mark as synced so next reload also uses server
        markBucketsSaved();
        markBucketsSynced();
      } else if (hasLocal) {
        // No server data but local exists — push local to server in background
        bucketsRef.current = localBuckets;
        if (localBucketColors) setBucketColors(localBucketColors);
        const mergedColors = { ...(localBucketColors || {}) } as Record<string, string>;
        void updateUserPreferenceFields({ life_buckets: localBuckets, bucket_colors: mergedColors }).then((ok) => {
          if (ok) markBucketsSynced();
        });
      } else {
        // If no buckets found anywhere, set default buckets
        const defaultBuckets = ['Health', 'Work', 'Personal', 'Finance'];
        bucketsRef.current = defaultBuckets;
        setBuckets(defaultBuckets);
        const defaultColors: Record<string, string> = Object.fromEntries(
          defaultBuckets.map((n) => [n, getSuggestedColorForBucket(n)])
        );
        setBucketColors(defaultColors);
        const savedActive = typeof window !== 'undefined' ? localStorage.getItem('active_bucket') : null;
        setActiveBucket(savedActive && defaultBuckets.includes(savedActive) ? savedActive : defaultBuckets[0]);

        if (typeof window !== 'undefined') {
          localStorage.setItem('life_buckets', JSON.stringify(defaultBuckets));
          localStorage.setItem('bucket_colors', JSON.stringify(defaultColors));
          window.dispatchEvent(new CustomEvent('bucketColorsChanged'));
        }

        void updateUserPreferenceFields({ life_buckets: defaultBuckets, bucket_colors: defaultColors });
      }
    } catch (err) {
      console.error('Failed to load preferences', err);
      // Set defaults on error too
      const defaultBuckets = ['Health', 'Work', 'Personal', 'Finance'];
      setBuckets(defaultBuckets);
      const savedActive = typeof window !== 'undefined' ? localStorage.getItem('active_bucket') : null;
      setActiveBucket(savedActive && defaultBuckets.includes(savedActive) ? savedActive : defaultBuckets[0]);
    } finally {
      setBucketsInitialized(true);
    }
  }

  // Safety net: if a user has preferences but somehow their onboarded flag
  // wasn't set, update it to prevent getting stuck in onboarding loop.
  // Runs as fire-and-forget so it never blocks widget rendering.
  function ensureUserOnboarded() {
    void (async () => {
      try {
        const cachedUser = await getCachedUser();
        if (!cachedUser) return;

        const [profileRes, prefs] = await Promise.all([
          fetch('/api/user/profile', { credentials: 'same-origin' }).then(r => r.ok ? r.json() : null),
          getUserPreferencesClient(),
        ]);

        const profile = profileRes?.profile;
        if (prefs?.life_buckets?.length && profile && profile.onboarded === false) {
          await fetch('/api/user/profile', {
            method: 'PATCH',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ onboarded: true }),
          });
        }
      } catch (err) {
        console.error('Error in ensureUserOnboarded:', err);
      }
    })();
  }

  const daysInMonth = () => {
    return new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0).getDate();
  };

  const firstDayOfMonth = () => {
    return new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
  };

  const getDayOfWeek = (date: Date) => {
    return date.toLocaleString('en-US', { weekday: 'long' });
  };

  const getDaysArray = () => {
    const days = [];
    for (let i = 1; i <= daysInMonth(); i++) {
      days.push(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), i));
    }
    return days;
  };

  // Returns an array of the 7 Date objects for the week that contains `selectedDate`
  const getWeekDays = () => {
    const start = new Date(selectedDate);
    // Move `start` back to Monday of the current week (Monday = 0)
    const day = start.getDay(); // 0 = Sunday, 1 = Monday, ... 6 = Saturday
    const diff = (day + 6) % 7; // converts Sunday->6, Monday->0, Tuesday->1, ...
    start.setDate(start.getDate() - diff);
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push(d);
    }
    return days;
  };

  const handleDateChange = (newDate: Date) => {
    const normalized = new Date(newDate.getFullYear(), newDate.getMonth(), newDate.getDate());
    setSelectedDate(normalized);
  };

  const clearLocalStorage = () => {
    localStorage.removeItem("widgets_by_bucket");
    localStorage.removeItem("life_buckets");
  };

  // Clean up debug widgets from all buckets
  const cleanupDebugWidgets = async () => {
    const cleaned: Record<string, WidgetInstance[]> = {};

    Object.entries(widgetsByBucket).forEach(([bucket, widgets]) => {
      cleaned[bucket] = widgets.filter(w => !w.instanceId?.startsWith('debug-'));
    });

    setWidgetsByBucket(cleaned);
    await saveWidgets(cleaned);
  };

  // Filter out debug widgets when displaying
  function getDisplayWidgets(bucket: string) {
    const widgets = widgetsByBucket[bucket] ?? [];
    return widgets.filter((w) => !w.instanceId?.startsWith('debug-'));
  }

  const resolveWidgetIcon = (widget: WidgetInstance): LucideIcon | null => {
    if (typeof widget.icon === "string") {
      const key = widget.icon.replace(/^Lucide/, "");
      return getIconComponent(key) || getIconComponent(widget.icon);
    }
    if (typeof widget.icon === "function") {
      return widget.icon;
    }
    return getIconComponent(widget.id);
  };

  const getDataSourceOptions = (widget: WidgetInstance): string[] => {
    if (widget.id === "water" || widget.id === "steps") {
      return ["manual", "fitbit", "googlefit"];
    }
    if (widget.id === "weight") {
      return ["manual", "withings"];
    }
    return ["manual"];
  };

  const patchWidgetInActiveBucket = (widgetId: string, updates: Partial<WidgetInstance>) => {
    setWidgetsByBucket((prev) => {
      const updated = { ...prev };
      updated[activeBucket] = (updated[activeBucket] ?? []).map((widget) =>
        widget.instanceId === widgetId ? { ...widget, ...updates } : widget
      );
      widgetsByBucketRef.current = updated;
      return updated;
    });
  };

  const removeWidgetByIdImmediate = async (widgetId: string) => {
    let nextWidgetsState: Record<string, WidgetInstance[]> | undefined;
    setWidgetsByBucket((prev) => {
      const updated = { ...prev };
      Object.keys(updated).forEach((bucketName) => {
        updated[bucketName] = (updated[bucketName] ?? []).filter(
          (widget) => widget.instanceId !== widgetId
        );
      });
      nextWidgetsState = updated;
      widgetsByBucketRef.current = updated;
      return updated;
    });

    const { [widgetId]: _removedProgress, ...nextProgressState } = progressByWidgetRef.current;
    progressByWidgetRef.current = nextProgressState;
    setProgressByWidget(nextProgressState);

    if (nextWidgetsState) {
      await saveWidgets(nextWidgetsState, nextProgressState);
    }
  };

  const requestRemoveWidget = (widget: WidgetInstance) => {
    const bucketEntry = Object.entries(widgetsByBucketRef.current).find(([, bucketWidgets]) =>
      (bucketWidgets ?? []).some((entry) => entry.instanceId === widget.instanceId)
    );
    const widgetBucket = bucketEntry?.[0] || activeBucket || buckets[0] || "General";
    const progressSnapshot = progressByWidgetRef.current[widget.instanceId];

    setConfirmState({
      title: `Remove "${widget.name}" widget?`,
      description: "This widget will be removed from your dashboard. You can undo immediately after confirming.",
      confirmLabel: "Remove widget",
      onConfirm: async () => {
        await removeWidgetByIdImmediate(widget.instanceId);
        pushUndo(`Removed ${widget.name}`, async () => {
          let restoredWidgetsState: Record<string, WidgetInstance[]> | undefined;
          setWidgetsByBucket((prev) => {
            const updated = { ...prev };
            const existing = updated[widgetBucket] ?? [];
            const alreadyPresent = existing.some((entry) => entry.instanceId === widget.instanceId);
            updated[widgetBucket] = alreadyPresent ? existing : [...existing, widget];
            restoredWidgetsState = updated;
            widgetsByBucketRef.current = updated;
            return updated;
          });

          const restoredProgressState: Record<string, ProgressEntry> = {
            ...progressByWidgetRef.current,
          };
          if (progressSnapshot) {
            restoredProgressState[widget.instanceId] = progressSnapshot;
          } else {
            delete restoredProgressState[widget.instanceId];
          }
          progressByWidgetRef.current = restoredProgressState;
          setProgressByWidget(restoredProgressState);

          if (restoredWidgetsState) {
            await saveWidgets(restoredWidgetsState, restoredProgressState);
          }
        });
      },
    });
  };

  const resetWidgetProgress = async (widget: WidgetInstance) => {
    const nextProgressState: Record<string, ProgressEntry> = {
      ...progressByWidgetRef.current,
      [widget.instanceId]: {
        value: 0,
        date: todayStrGlobal,
        streak: 0,
        lastCompleted: "",
      },
    };
    progressByWidgetRef.current = nextProgressState;
    setProgressByWidget(nextProgressState);
    await saveWidgets(widgetsByBucketRef.current, nextProgressState);
  };

  const handleSaveWidget = (updated: WidgetInstance) => {
    if (!editingBucket) return;
    let nextState: Record<string, WidgetInstance[]> | undefined;
    setWidgetsByBucket(prev => {
      const updatedState = { ...prev };
      updatedState[editingBucket] = (updatedState[editingBucket] ?? []).map(w =>
        w.instanceId === updated.instanceId ? updated : w
      );
      // persist
      if (typeof window !== 'undefined') {
        localStorage.setItem('widgets_by_bucket', JSON.stringify({ widgets: updatedState, savedAt: new Date().toISOString() }));
      }
      nextState = updatedState;
      return updatedState;
    });
    if (nextState) {
      widgetsByBucketRef.current = nextState;
      void saveWidgets(nextState, progressByWidgetRef.current);
    }
    setEditingWidget(null);
    setNewlyCreatedWidgetId(null);
  };

  const toggleTaskCompletion = async (taskId: string) => {
    // Determine current completion state
    const isCurrentlyCompleted =
      (allTodoistTasks.find((t) => t.id.toString() === taskId)?.completed ?? false);

    const newCompleted = !isCurrentlyCompleted;

    const reorder = (arr: any[]) => {
      const updated = arr.map((t) =>
        t.id.toString() === taskId ? { ...t, completed: newCompleted } : t
      );
      // sort: incomplete first, then completed (preserve relative order otherwise)
      return [
        ...updated.filter((t) => !t.completed),
        ...updated.filter((t) => t.completed),
      ];
    };

    // Update lists (only reorder if the task array contains it)
    setTodoistTasks((prev) => prev.some((t) => t.id.toString() === taskId) ? reorder(prev) : prev);
    setAllTodoistTasks((prev) => reorder(prev));

    setIsCompletingTask((prev) => ({ ...prev, [taskId]: true }));

    const endpoint = newCompleted
      ? '/api/integrations/todoist/tasks/complete'
      : '/api/integrations/todoist/tasks/reopen';

    try {
      await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId }),
      });
    } catch (err) {
      console.error('Failed to toggle Todoist task', err);
    } finally {
      setIsCompletingTask((prev) => {
        const { [taskId]: _removed, ...rest } = prev;
        return rest;
      });
    }
  };

  // Legacy createTask function removed - now using TasksContext

  const handleAddDailyTask = async () => {
    const selectedDateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
    try {
      await contextCreateTask(newDailyTask, selectedDateStr);
      setNewDailyTask('');
    } catch (error) {
      console.error('❌ Failed to create daily task:', error);
    }
  };

  const handleAddOpenTask = async () => {
    try {
      await contextCreateTask(newOpenTask, null);
      setNewOpenTask('');
    } catch (error) {
      console.error('❌ Failed to create open task:', error);
    }
  };

  // Fetch current weather using browser geolocation and open-meteo API (no key required).
  // Deferred via requestIdleCallback so it doesn't compete with critical rendering.
  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    const fetchWeather = async (lat: number, lon: number) => {
      try {
        const resp = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
        const data = await resp.json();
        if (data && data.current_weather) {
          const code = data.current_weather.weathercode as number;
          const tempC = data.current_weather.temperature as number;
          const temp = tempC * 9 / 5 + 32; // convert to °F

          // Map WMO weather codes to icons
          const iconMap: Record<string, LucideIcon> = {
            clear: Sun,
            partly: CloudSun,
            cloud: Cloud,
            drizzle: CloudRain,
            rain: CloudRain,
            snow: CloudSnow,
            thunder: CloudLightning,
          };

          const getIconForCode = (c: number): LucideIcon => {
            if (c === 0) return iconMap.clear;
            if ([1, 2].includes(c)) return iconMap.partly;
            if (c === 3) return iconMap.cloud;
            if (c >= 45 && c <= 48) return iconMap.cloud;
            if (c >= 51 && c <= 57) return iconMap.drizzle;
            if (c >= 61 && c <= 67) return iconMap.rain;
            if (c >= 71 && c <= 77) return iconMap.snow;
            if (c >= 95) return iconMap.thunder;
            return iconMap.cloud;
          };

          setWeather({ icon: getIconForCode(code), temp });
        }
      } catch (err) {
        console.error('Failed to fetch weather', err);
      }
    };

    const startWeatherFetch = () => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          fetchWeather(pos.coords.latitude, pos.coords.longitude);
        },
        () => {
          // fallback: New York City
          fetchWeather(40.7128, -74.006);
        }
      );
    };

    // Defer geolocation + weather API call so it doesn't compete with
    // critical rendering. Weather is decorative and low-priority.
    if (typeof requestIdleCallback !== 'undefined') {
      const id = requestIdleCallback(startWeatherFetch, { timeout: 3000 });
      return () => cancelIdleCallback(id);
    }
    // Fallback for browsers without requestIdleCallback (e.g. Safari)
    const timeout = setTimeout(startWeatherFetch, 2000);
    return () => clearTimeout(timeout);
  }, []);

  // ----------------------------------------------------------------------
  // Tab row scroll fade state
  // ----------------------------------------------------------------------
  const tabsScrollRef = useRef<HTMLDivElement | null>(null);
  const plannerRef = useRef<HTMLDivElement | null>(null);
  const [showLeftTabFade, setShowLeftTabFade] = useState(false);
  const [showRightTabFade, setShowRightTabFade] = useState(false);

  useEffect(() => {
    const el = tabsScrollRef.current;
    if (!el) return;
    const updateFades = () => {
      const { scrollLeft, scrollWidth, clientWidth } = el;
      setShowLeftTabFade(scrollLeft > 0);
      setShowRightTabFade(scrollLeft + clientWidth < scrollWidth - 1);
    };
    updateFades();
    el.addEventListener('scroll', updateFades);
    window.addEventListener('resize', updateFades);
    return () => {
      el.removeEventListener('scroll', updateFades);
      window.removeEventListener('resize', updateFades);
    };
  }, []);

  // Toggle for task views (right panel)

  // ------------------------------------------------------------------
  // Live "Now" time indicator
  // ------------------------------------------------------------------
  const [currentTime, setCurrentTime] = useState<Date>(() => new Date());

  // Refresh every minute so the indicator stays in sync
  useEffect(() => {
    const id = setInterval(() => setCurrentTime(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Display string for the current hour (e.g. "10AM") so we can match planner slot
  const currentHourDisplay = useMemo(() => {
    const h = currentTime.getHours();
    return `${(h % 12 || 12)}${h < 12 ? 'AM' : 'PM'}`;
  }, [currentTime]);

  // ----------------------------------------------
  // Hourly planner (7 AM → 9 PM)
  // ----------------------------------------------
  const hours = useMemo(() => {
    return Array.from({ length: 15 }, (_, i) => {
      const h = 7 + i; // 7-21
      const disp = `${((h % 12) || 12)}${h < 12 ? 'AM' : 'PM'}`;
      return disp;
    });
  }, []);

  // Map of hour → tasks scheduled for that slot
  // Height (px) representing one-hour slot in the planner – used for sizing + resizing
  const HOUR_HEIGHT = 48; // keep in sync with tailwind padding/line-height


  // Auto-scroll the planner so the current hour sits at the top
  useEffect(() => {
    if (isPlannerCollapsed) return;
    const container = plannerRef.current;
    if (!container) return;
    const target = container.querySelector<HTMLElement>(`[data-hour='${currentHourDisplay}']`);
    if (target) {
      container.scrollTop = target.offsetTop - container.offsetTop;
    }
  }, [currentHourDisplay, isPlannerCollapsed]);

  // ------------------------------ Resize state ------------------------------
  const [resizingTask, setResizingTask] = useState<{ taskId: string; hour: string } | null>(null);
  const resizeStartRef = useRef<{ y: number; duration: number; taskId: string; hour: string } | null>(null);

  function startResize(e: React.MouseEvent, hour: string, taskId: string) {
    e.stopPropagation();
    e.preventDefault();
    const startY = e.clientY;
    const task = hourlyPlan[hour].find((t: any) => t.id.toString() === taskId);
    const startDuration = task?.duration ?? 60;
    resizeStartRef.current = { y: startY, duration: startDuration, taskId, hour };
    setResizingTask({ taskId, hour });

    function onMove(ev: MouseEvent) {
      if (!resizeStartRef.current) return;
      const delta = ev.clientY - resizeStartRef.current.y;
      const minutesDelta = (delta / HOUR_HEIGHT) * 60;
      let newDur = Math.max(15, Math.round((resizeStartRef.current.duration + minutesDelta) / 15) * 15);
      setHourlyPlan((prev) => {
        const copy: Record<string, any[]> = { ...prev };
        copy[hour] = copy[hour].map((t) =>
          t.id.toString() === taskId ? { ...t, duration: newDur } : t
        );
        return copy;
      });
    }

    function onUp() {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      setResizingTask(null);
      // Restore cursor
      document.body.style.cursor = '';
      document.body.style.userSelect = '';

      if (resizeStartRef.current) {
        const { taskId: id, hour: hr } = resizeStartRef.current;
        const task = hourlyPlan[hr].find((t: any) => t.id.toString() === id);
        if (task) updateTaskDuration(id, task.duration ?? 60);
      }
      resizeStartRef.current = null;
    }

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  // Load hourly plan from user preferences or initialize empty
  const [hourlyPlan, setHourlyPlan] = useState<Record<string, any[]>>(() => {
    // Start with empty plan structure
    const obj: Record<string, any[]> = {};
    hours.forEach((h) => {
      obj[h] = [];
    });
    return obj;
  });

  // Removed manual saveHourlyPlan function

  // Automatically save hourly plan whenever it changes
  useEffect(() => {
    const dateKey = format(selectedDate, 'yyyy-MM-dd');
    const localStorageKey = 'lifeboard_hourly_plan';

    // 1) Persist immediately to localStorage so we never lose data on fast refreshes
    try {
      const existingData = localStorage.getItem(localStorageKey);
      const existingPlans = existingData ? JSON.parse(existingData) : {};
      const updatedPlans = { ...existingPlans, [dateKey]: hourlyPlan };
      localStorage.setItem(localStorageKey, JSON.stringify(updatedPlans));
    } catch (lsErr) {
      console.error('Failed saving hourly plan to localStorage:', lsErr);
    }

    // 2) Debounce the Supabase save so we don't spam the database while the user drags tasks around
    const supabaseDebounce = setTimeout(async () => {
      try {
        await updateUserPreferenceFields({ hourly_plan: JSON.parse(localStorage.getItem(localStorageKey) || '{}') });
      } catch (sbErr) {
        console.warn('Could not save hourly plan to Supabase (schema may need updating):', sbErr);
      }
    }, 1000);

    return () => clearTimeout(supabaseDebounce);
  }, [hourlyPlan, selectedDate]);

  // Load hourly plan for the selected date
  useEffect(() => {
    const loadHourlyPlan = async () => {
      try {
        const dateKey = format(selectedDate, 'yyyy-MM-dd');
        let savedPlan = null;

        // First try to load from Supabase
        try {
          const prefs = await getUserPreferencesClient();
          if (prefs && prefs.hourly_plan) {
            savedPlan = prefs.hourly_plan[dateKey];
            if (savedPlan) {
            }
          }
        } catch (supabaseError) {
          console.warn('Could not load hourly plan from Supabase:', supabaseError);
        }

        // If not found in Supabase, try localStorage
        if (!savedPlan) {
          const localStorageKey = 'lifeboard_hourly_plan';
          const localData = localStorage.getItem(localStorageKey);

          if (localData) {
            const localPlans = JSON.parse(localData);
            savedPlan = localPlans[dateKey];

            if (savedPlan) {
            }
          }
        }

        if (savedPlan) {
          // Merge saved plan with empty structure to ensure all hours exist
          const obj: Record<string, any[]> = {};
          hours.forEach((h) => {
            obj[h] = savedPlan[h] || [];
          });
          setHourlyPlan(obj);
        } else {
          // Reset to empty plan if no saved data for this date
          const obj: Record<string, any[]> = {};
          hours.forEach((h) => {
            obj[h] = [];
          });
          setHourlyPlan(obj);
        }
      } catch (error) {
        console.error('Failed to load hourly plan:', error);

        // Fallback to empty plan on error
        const obj: Record<string, any[]> = {};
        hours.forEach((h) => {
          obj[h] = [];
        });
        setHourlyPlan(obj);
      }
    };

    loadHourlyPlan();
  }, [selectedDate, hours]);

  // Convenience: tasks in planner so we can hide them from the daily list
  const assignedTaskIds = useMemo(() => {
    return new Set(
      scheduledTasks.map((t) => t.id.toString())
    );
  }, [scheduledTasks]);
  // Use tasks from context instead of local state
  const dailyVisibleTasks = contextDailyTasks;

  const linkedTaskMap = useMemo(() => {
    const map: Record<string, { bucket: string; widgetId: string }> = {};
    Object.entries(widgetsByBucket).forEach(([bucketName, widgets]) => {
      (widgets || []).forEach((widget) => {
        if (widget?.linkedTaskId) {
          map[widget.linkedTaskId] = { bucket: bucketName, widgetId: widget.instanceId };
        }
      });
    });
    return map;
  }, [widgetsByBucket]);

  const findWidgetForTask = useCallback((taskId: string) => {
    const widgetsState = widgetsByBucketRef.current;
    for (const [bucketName, widgets] of Object.entries(widgetsState)) {
      const match = (widgets || []).find((widget) => widget.linkedTaskId === taskId);
      if (match) {
        return { bucket: bucketName, widget: match };
      }
    }
    return null;
  }, [widgetsByBucketRef]);

  const toggleTaskWidgetLink = useCallback(async (task: Task, bucketOverride?: string) => {
    if (!task?.id) return;
    const taskId = task.id.toString();
    const existing = findWidgetForTask(taskId);

    if (existing) {
      let nextState: Record<string, WidgetInstance[]> | undefined;
      setWidgetsByBucket((prev) => {
        const updated = { ...prev };
        const currentWidgets = updated[existing.bucket] ?? [];
        updated[existing.bucket] = currentWidgets.filter(
          (widget) => widget.instanceId !== existing.widget.instanceId,
        );
        nextState = updated;
        return updated;
      });
      if (nextState) {
        widgetsByBucketRef.current = nextState;
        await saveWidgets(nextState, progressByWidgetRef.current);
      }
      return { status: "removed" as const, bucket: existing.bucket };
    }

    const candidateBuckets = [bucketOverride, task.bucket, activeBucket, buckets[0], "General"].filter(
      (value): value is string => Boolean(value && value.trim().length > 0),
    );
    const targetBucket = candidateBuckets[0] ?? "General";

    const newWidget: WidgetInstance = {
      id: "linked_task",
      name: task.content,
      description: "Task shortcut",
      icon: ListChecks,
      category: "tasks",
      color: "indigo",
      defaultTarget: 1,
      unit: "task",
      units: ["task"],
      instanceId: `task-link-${taskId}-${Date.now()}`,
      target: 1,
      schedule: [true, true, true, true, true, true, true],
      dataSource: "task",
      createdAt: new Date().toISOString(),
      linkedTaskId: taskId,
      linkedTaskSource: task.source,
      linkedTaskAutoCreated: false,
      linkedTaskTitle: task.content,
      linkedTaskConfig: {
        enabled: true,
        title: task.content,
        bucket: targetBucket,
        dueDate: task.due?.date ?? undefined,
        startTime: undefined,
        endTime: undefined,
        allDay: true,
        repeat: "none",
      },
    };

    let nextState: Record<string, WidgetInstance[]> | undefined;
    setWidgetsByBucket((prev) => {
      const updated = { ...prev };
      const bucketWidgets = updated[targetBucket] ?? [];
      // Avoid duplicates if toggled fast
      const existingIndex = bucketWidgets.findIndex((widget) => widget.linkedTaskId === taskId);
      if (existingIndex >= 0) {
        bucketWidgets[existingIndex] = newWidget;
      } else {
        bucketWidgets.push(newWidget);
      }
      updated[targetBucket] = [...bucketWidgets];
      nextState = updated;
      return updated;
    });
    if (nextState) {
      widgetsByBucketRef.current = nextState;
      await saveWidgets(nextState, progressByWidgetRef.current);
    }
    return { status: "added" as const, bucket: targetBucket };
  }, [activeBucket, buckets, debouncedSaveToSupabase, findWidgetForTask]);

  const handleToggleTaskWidget = useCallback(
    async (task: Task) => {
      await toggleTaskWidgetLink(task, activeBucket);
    },
    [activeBucket, toggleTaskWidgetLink],
  );

  const resolveWidgetBucket = useCallback(
    (widgetId: string, fallback?: string) => {
      if (fallback && fallback.trim().length > 0) {
        return fallback;
      }
      const widgetsState = widgetsByBucketRef.current;
      for (const [bucketName, widgets] of Object.entries(widgetsState)) {
        if ((widgets || []).some((entry) => entry.instanceId === widgetId)) {
          return bucketName;
        }
      }
      return activeBucket;
    },
    [activeBucket],
  );

  // Helpers for droppable id parsing
  const isHour = (id: string) => id.startsWith('hour-');
  const hourKey = (id: string) => id.replace('hour-', '');

  const widgetTimeToHourSlot = (time?: string | null): string | undefined => {
    if (!time) return undefined;
    const [rawHour, rawMinute = "0"] = time.split(":");
    const hour = Number.parseInt(rawHour ?? "", 10);
    if (Number.isNaN(hour)) return undefined;
    const minute = Number.parseInt(rawMinute, 10);
    let adjustedHour = hour;
    if (minute >= 30) {
      adjustedHour = Math.min(23, hour + 1);
    }
    const displayHour = (adjustedHour % 12) || 12;
    const suffix = adjustedHour >= 12 ? "PM" : "AM";
    return `hour-${displayHour}${suffix}`;
  };

  const convertWidgetToTask = async (widget: WidgetInstance, bucket: string) => {
    if (!widget) return;

    if (widget.linkedTaskId) {
      const shouldUnlink =
        typeof window === "undefined" ||
        window.confirm("Remove this widget from the Tasks tab?");
      if (!shouldUnlink) return;

      if (widget.linkedTaskAutoCreated && widget.linkedTaskId) {
        try {
          await deleteTask(widget.linkedTaskId);
        } catch (error) {
          console.error("Failed to delete auto-created task:", error);
        }
      }

      let nextState: Record<string, WidgetInstance[]> | undefined;
      setWidgetsByBucket((prev) => {
        const updated = { ...prev };
        const bucketName = resolveWidgetBucket(widget.instanceId, bucket);
        const resolvedBucket = bucketName && bucketName.length > 0 ? bucketName : activeBucket;
        if (!resolvedBucket) {
          nextState = updated;
          return updated;
        }
        const widgetsList = updated[resolvedBucket] ?? [];
        updated[resolvedBucket] = widgetsList.map((entry) => {
          if (entry.instanceId !== widget.instanceId) return entry;
          const sanitized = { ...entry };
          delete sanitized.linkedTaskId;
          delete sanitized.linkedTaskSource;
          delete sanitized.linkedTaskAutoCreated;
          delete sanitized.linkedTaskTitle;
          if (sanitized.linkedTaskConfig) {
            sanitized.linkedTaskConfig = {
              ...sanitized.linkedTaskConfig,
              enabled: false,
            };
          }
          return sanitized;
        });
        nextState = updated;
        return updated;
      });
      if (nextState) {
        widgetsByBucketRef.current = nextState;
        await saveWidgets(nextState, progressByWidgetRef.current);
      }
      return;
    }

    try {
      const config = widget.linkedTaskConfig ?? {};
      const taskContent = (config.title || widget.linkedTaskTitle || widget.name || "Widget Task").trim();
      const bucketName = resolveWidgetBucket(widget.instanceId, bucket);
      const targetBucket = bucketName && bucketName.length > 0 ? bucketName : activeBucket;
      const resolvedBucket = config.bucket?.trim() || targetBucket || undefined;
      const preferredDueDate = config.dueDate?.trim();
      const resolvedDueDate = preferredDueDate || selectedDateStr || null;
      const allDay = config.allDay ?? true;
      const hourSlot = allDay ? undefined : widgetTimeToHourSlot(config.startTime);
      const endHourSlot = allDay ? undefined : widgetTimeToHourSlot(config.endTime);
      const repeatRule = (config.repeat ?? "none") as RepeatOption;
      const newTask = await contextCreateTask(
        taskContent,
        resolvedDueDate,
        hourSlot,
        resolvedBucket,
        repeatRule,
        {
          endHourSlot,
          allDay,
          endDate: resolvedDueDate ?? undefined,
        },
      );
      if (!newTask) return;

      let nextState: Record<string, WidgetInstance[]> | undefined;
      setWidgetsByBucket((prev) => {
        const updated = { ...prev };
        const resolvedBucketTarget = targetBucket && targetBucket.length > 0 ? targetBucket : activeBucket;
        if (!resolvedBucketTarget) {
          nextState = updated;
          return updated;
        }
        const widgetsList = updated[resolvedBucketTarget] ?? [];
        updated[resolvedBucketTarget] = widgetsList.map((entry) => {
          if (entry.instanceId !== widget.instanceId) return entry;
          return {
            ...entry,
            linkedTaskId: newTask.id?.toString?.() ?? newTask.id,
            linkedTaskSource: newTask.source,
            linkedTaskAutoCreated: true,
            linkedTaskTitle: newTask.content,
            linkedTaskConfig: {
              ...entry.linkedTaskConfig,
              enabled: true,
              title: taskContent,
              bucket: resolvedBucket,
              dueDate: resolvedDueDate ?? undefined,
              startTime: config.startTime,
              endTime: config.endTime,
              allDay,
              repeat: repeatRule,
            },
          };
        });
        nextState = updated;
        return updated;
      });
      if (nextState) {
        widgetsByBucketRef.current = nextState;
        await saveWidgets(nextState, progressByWidgetRef.current);
      }
    } catch (error) {
      console.error("Failed to convert widget to task:", error);
    }
  };

  // -----------------------------------------------------------------------------
  // Daily reset – archive yesterday's progress and zero-out for the new day
  // -----------------------------------------------------------------------------
  const checkAndResetWidgets = useCallback(() => {
    const today = dateStr(new Date());
    const prevProgress = progressByWidgetRef.current;
    const updatedProgress: Record<string, ProgressEntry> = { ...prevProgress };
    const toArchive: Array<[string, ProgressEntry]> = [];

    // Identify entries from a previous day
    Object.entries(prevProgress).forEach(([instanceId, entry]) => {
      if (entry.date !== today) {
        toArchive.push([instanceId, entry]);
        updatedProgress[instanceId] = {
          ...entry,
          date: today,
          value: 0,            // reset value for the new day
        };
      }
    });

    const archiveNeeded = toArchive.length > 0;
    if (!archiveNeeded) return; // nothing to reset

    // 1️⃣  Archive in progress history API (fire-and-forget)
    void (async () => {
      try {
        const rows = toArchive.map(([instanceId, entry]) => ({
          widget_instance_id: instanceId,
          date: entry.date,
          value: entry.value,
        }));
        await fetch('/api/widgets/progress', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows }),
        });
      } catch (err) {
        console.error('Failed to archive progress history', err);
      }
    })();


    // 2️⃣  Update local state and persistence
    setProgressByWidget(updatedProgress);

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('widget_progress', JSON.stringify(updatedProgress));
      } catch (err) {
        console.error('Failed to persist reset progress to localStorage', err);
      }
    }

    // Persist to Supabase preferences as well
    saveWidgets(widgetsByBucketRef.current, updatedProgress);

    // 3️⃣  Clear integration caches and trigger fresh integration fetch (once per day)
    if (typeof window !== 'undefined') {
      localStorage.removeItem('todoist_all_tasks');
      localStorage.removeItem('fitbit_metrics');
      localStorage.removeItem('googlefit_metrics');
    }
    fetchIntegrationsData();


  }, [saveWidgets, fetchIntegrationsData]);

  // Add a useEffect to check for resets when the component mounts and periodically
  useEffect(() => {
    // Check for resets immediately when component mounts
    checkAndResetWidgets();

    // Set up an interval to check for resets periodically (every hour)
    // This handles the case where the app is left open overnight
    const intervalId = setInterval(checkAndResetWidgets, 60 * 60 * 1000);

    return () => clearInterval(intervalId);
  }, [checkAndResetWidgets]);

  // Also add a check for date changes when the user interacts with the app
  useEffect(() => {
    // Check for resets when the selected date changes
    checkAndResetWidgets();
  }, [selectedDate, checkAndResetWidgets]);

  // Re-evaluate reset once progress data has been loaded or changed (e.g., after localStorage load)
  useEffect(() => {
    checkAndResetWidgets();
    // Dependency intentionally limited to top-level progress map to avoid deep comparisons
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progressByWidget]);

  // Add a visibility change listener to check for resets when the user returns to the tab
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkAndResetWidgets();
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);

      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }
  }, [checkAndResetWidgets]);

  return (
    <div className="flex-1 relative min-h-screen overflow-hidden" style={{ background: 'linear-gradient(90deg, rgba(252,250,248,0.7) 0%, rgba(252,250,248,0.7) 100%), linear-gradient(90deg, #fff 0%, #fff 100%)' }}>

      {/* Main wrapper */}
      <div className="relative z-10 flex flex-col">

        {/* Greeting + Completion Ring row */}
        <section className="flex items-center justify-between mb-6">
          <div>
            <h1 className=" text-[24px] text-theme-text-primary tracking-tight">
              Welcome back, <span className="text-theme-primary font-bold">{greetingName || 'there'}</span>
            </h1>
            <p className=" text-sm text-theme-text-tertiary mt-1">You've got this! Let's make today productive.</p>
          </div>
          {/* Completion ring card */}
          <div className="hidden md:flex items-center gap-3 bg-white border border-theme-neutral-300 rounded-2xl px-5 py-3 shadow-warm-sm">
            <div className="relative w-12 h-12">
              <svg className="w-12 h-12 -rotate-90" viewBox="0 0 48 48">
                <circle cx="24" cy="24" r="20" fill="none" stroke="rgba(219,214,207,0.4)" strokeWidth="3" />
                <circle cx="24" cy="24" r="20" fill="none" stroke="#48B882" strokeWidth="3" strokeLinecap="round"
                  strokeDasharray={`${Math.round((activeWidgets.filter(w => {
                    const prog = progressByWidget[w.instanceId];
                    const todayVal = prog && prog.date === todayStrGlobal ? prog.value : 0;
                    const target = w.target && w.target > 0 ? w.target : 1;
                    return todayVal >= target;
                  }).length / Math.max(activeWidgets.length, 1)) * 125.6)} 125.6`}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center  text-[11px] font-medium text-theme-text-primary">
                {activeWidgets.length > 0 ? `${Math.round((activeWidgets.filter(w => {
                  const prog = progressByWidget[w.instanceId];
                  const todayVal = prog && prog.date === todayStrGlobal ? prog.value : 0;
                  const target = w.target && w.target > 0 ? w.target : 1;
                  return todayVal >= target;
                }).length / activeWidgets.length) * 100)}%` : '0%'}
              </span>
            </div>
            <div>
              <p className=" text-[13px] font-medium text-theme-text-primary">Today's Progress</p>
              <p className=" text-[11px] text-theme-text-tertiary">
                {activeWidgets.filter(w => {
                  const prog = progressByWidget[w.instanceId];
                  const todayVal = prog && prog.date === todayStrGlobal ? prog.value : 0;
                  const target = w.target && w.target > 0 ? w.target : 1;
                  return todayVal >= target;
                }).length} of {activeWidgets.length} goals met
              </p>
            </div>
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
                    markBucketsSaved();
                    window.dispatchEvent(new CustomEvent('lifeBucketsChanged'));
                  }
                  debouncedSaveBucketsToSupabase(latestBuckets);
                }}
                onClick={() => setActiveBucket(b)}
                style={{
                  // Active tab always highest; otherwise cascade left-over-right without negative z-index
                  zIndex: b === activeBucket ? 50 : Math.max(buckets.length - idx, 1),
                  marginRight: '-10px',
                  backgroundColor: b === activeBucket ? getBucketColor(b) : 'rgba(252, 250, 248, 0.9)',
                  borderColor: b === activeBucket ? getBucketColor(b) : 'rgba(219, 214, 207, 0.6)',
                  borderBottomColor: b === activeBucket ? getBucketColor(b) : 'transparent',
                  color: b === activeBucket ? 'white' : '#314158',
                  marginBottom: '-1px',
                }}
                className={`relative flex h-[42px] sm:h-[48px] items-center justify-center whitespace-nowrap rounded-t-[14px] sm:rounded-t-[16px] px-3 sm:px-6  text-xs sm:text-[13px] font-medium capitalize transition-all duration-300 border ${b === activeBucket
                  ? 'shadow-warm-sm text-white'
                  : 'shadow-none'
                  }`}
                onMouseEnter={(e) => {
                  if (b !== activeBucket) {
                    e.currentTarget.style.backgroundColor = 'rgba(252, 250, 248, 1)'
                    e.currentTarget.style.borderColor = 'rgba(219, 214, 207, 0.9)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (b !== activeBucket) {
                    e.currentTarget.style.backgroundColor = 'rgba(252, 250, 248, 0.9)'
                    e.currentTarget.style.borderColor = 'rgba(219, 214, 207, 0.6)'
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
              className="relative flex h-[42px] sm:h-[48px] items-center justify-center rounded-t-[14px] sm:rounded-t-[16px] bg-white px-4 sm:px-8 text-[18px] font-medium transition-colors hover:bg-[rgba(252,250,248,1)] border border-theme-neutral-300 shadow-none"
            >
              <span className="text-theme-primary">
                +
              </span>
            </button>
          </div>
          {/* scroll container ends */}
          {/* left & right fades indicating additional scrollable tabs (sit above scroll container) */}
          {showLeftTabFade && (
            <div
              className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-[#F6F6FC]/95 via-[#F6F6FC]/70 to-transparent"
              style={{ zIndex: 70 }}
            />
          )}
          {showRightTabFade && (
            <div
              className="pointer-events-none absolute inset-y-0 w-6 bg-gradient-to-l from-[#F6F6FC]/95 via-[#F6F6FC]/70 to-transparent"
              style={{ zIndex: 70, right: '0px' }}
            />
          )}
        </div>
        {/* Main content container */}
        <div className="w-full flex-1 pb-24 md:pb-4">
          {/* Left section: tabs and widgets */}
          <div className="flex-1 w-full">
            {/* Content container: white widget box with subtle shadow */}
            <div className="relative z-10 -mt-px flex h-full flex-col overflow-hidden rounded-b-xl border border-theme-neutral-300 bg-white shadow-warm-sm">
              {/* Inner nav */}
              <nav className="flex items-center border-b border-[rgba(219,214,207,0.7)] px-3 sm:px-5 pt-4 text-sm font-semibold overflow-x-auto no-scrollbar">
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
              <div className="flex-1 overflow-y-auto p-3 sm:p-5">
                {/* Overview Tab */}
                <div className={activeSubTab === 'Overview' ? '' : 'hidden'}>
                  {/* Stat summary row — Calidora pattern */}
                  {activeWidgets.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
                      <div className="rounded-xl border border-theme-neutral-300 bg-white p-4 shadow-warm-sm">
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-theme-brand-tint-strong mb-2">
                          <LayoutDashboard className="h-[18px] w-[18px] text-theme-primary" />
                        </div>
                        <p className=" text-[28px] text-theme-text-primary leading-none">{activeWidgets.length}</p>
                        <p className=" text-xs text-theme-text-tertiary mt-1">Total Widgets</p>
                      </div>
                      <div className="rounded-xl border border-theme-neutral-300 bg-white p-4 shadow-warm-sm">
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[rgba(74,173,224,0.15)] mb-2">
                          <Activity className="h-[18px] w-[18px] text-theme-info" />
                        </div>
                        <p className=" text-[28px] text-theme-text-primary leading-none">{activeWidgets.filter(w => { const prog = progressByWidget[w.instanceId]; const val = prog && prog.date === todayStrGlobal ? prog.value : 0; return val > 0 && val < (w.target || 1); }).length}</p>
                        <p className=" text-xs text-theme-text-tertiary mt-1">In Progress</p>
                      </div>
                      <div className="rounded-xl border border-theme-neutral-300 bg-white p-4 shadow-warm-sm">
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[rgba(72,184,130,0.15)] mb-2">
                          <Check className="h-[18px] w-[18px] text-theme-success" />
                        </div>
                        <p className=" text-[28px] text-theme-text-primary leading-none">{activeWidgets.filter(w => { const prog = progressByWidget[w.instanceId]; const val = prog && prog.date === todayStrGlobal ? prog.value : 0; return val >= (w.target || 1); }).length}</p>
                        <p className=" text-xs text-theme-text-tertiary mt-1">Completed</p>
                      </div>
                      <div className="rounded-xl border border-theme-neutral-300 bg-white p-4 shadow-warm-sm">
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[rgba(214,42,154,0.15)] mb-2">
                          <Target className="h-[18px] w-[18px] text-[#d62a9a]" />
                        </div>
                        <p className=" text-[28px] text-theme-text-primary leading-none">{activeWidgets.filter(w => { const prog = progressByWidget[w.instanceId]; const val = prog && prog.date === todayStrGlobal ? prog.value : 0; return val === 0; }).length}</p>
                        <p className=" text-xs text-theme-text-tertiary mt-1">Not Started</p>
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
                      bucketHex={getBucketColor(activeBucket)}
                      progressByWidget={progressByWidget}
                      allTasks={allTasks}
                      fitbitData={fitbitData}
                      googleFitData={googleFitData}
                      onCardClick={(widget) => {
                        if (widget.id === 'nutrition') {
                          setNutritionWidgetOpen(true);
                        } else if (widget.id === 'medication') {
                          setMedicationWidgetOpen(true);
                        } else if (widget.id === 'exercise') {
                          setExerciseWidgetOpen(true);
                        } else if (widget.id === 'home_projects') {
                          setHomeProjectsWidgetOpen(true);
                        } else if (widget.id === 'habit_tracker') {
                          setActiveHabitWidget(widget);
                          setHabitTrackerWidgetOpen(true);
                        } else if (widget.id === 'sleep') {
                          setActiveSleepWidget(widget);
                          setSleepWidgetOpen(true);
                        } else if (widget.id === 'meditation') {
                          setActiveMeditationWidget(widget);
                          setMeditationWidgetOpen(true);
                        } else if (widget.id === 'breathwork') {
                          setActiveBreathworkWidget(widget);
                          setBreathworkWidgetOpen(true);
                        } else if (widget.id === 'water' && (!widget.dataSource || widget.dataSource === 'manual')) {
                          setActiveWaterWidget(widget);
                          setWaterWidgetOpen(true);
                        } else if (widget.id === 'mood') {
                          setActiveMoodWidget(widget);
                          setMoodWidgetOpen(true);
                        } else if (widget.id === 'steps' && (!widget.dataSource || widget.dataSource === 'manual')) {
                          setActiveStepsWidget(widget);
                          setStepsWidgetOpen(true);
                        } else if (widget.id === 'heartrate' && (!widget.dataSource || widget.dataSource === 'manual')) {
                          setActiveHeartRateWidget(widget);
                          setHeartRateWidgetOpen(true);
                        } else if (widget.id === 'caffeine') {
                          setActiveCaffeineWidget(widget);
                          setCaffeineWidgetOpen(true);
                        } else {
                          setEditingWidget(widget);
                          setEditingBucket(activeBucket);
                          setNewlyCreatedWidgetId(null);
                        }
                      }}
                      onEditSettings={(widget) => {
                        setEditingWidget(widget);
                        setEditingBucket(activeBucket);
                        setNewlyCreatedWidgetId(null);
                      }}
                      onConvertToTask={convertWidgetToTask}
                      onRemove={requestRemoveWidget}
                      onIncrementProgress={incrementProgress}
                      onToggleTaskCompletion={(taskId) => void toggleTaskCompletionContext(taskId)}
                      onHabitToggle={handleHabitToggle}
                    />
                  ))}
                  {/* DnD placeholder */}
                  {droppableProvided.placeholder}
                  {/* Add Widget card */}
                  <button className="widget-card-size rounded-xl border border-dashed border-theme-neutral-300 bg-white p-4 hover:bg-[rgba(252,250,248,0.5)] transition-colors text-left cursor-pointer min-w-0 flex flex-col items-center justify-center gap-2" onClick={() => setIsWidgetSheetOpen(true)}>
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
                      />
                    )}
                  </div>
                )}

                {activeSubTab === 'Logs' && (
                  <div>
                    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h2 className="section-label-sm">Widget Logs</h2>
                        <p className=" text-[13px] text-theme-text-tertiary mt-1">
                          Recent syncs, entries, and progress updates for this bucket.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => void loadWidgetHistoryLogs()}
                          disabled={isWidgetLogsLoading || activeWidgets.length === 0}
                          className="inline-flex h-9 items-center justify-center rounded-md border border-theme-neutral-300 px-3 text-sm text-theme-text-subtle transition hover:bg-theme-surface-alt disabled:cursor-not-allowed disabled:opacity-60"
                          title="Refresh widget logs"
                          aria-label="Refresh widget logs"
                        >
                          <RotateCw className={`h-4 w-4 ${isWidgetLogsLoading ? "animate-spin" : ""}`} />
                        </button>
                        <WidgetSelector
                          widgets={activeWidgets}
                          selectedWidget={selectedLogsWidget}
                          onWidgetChange={setSelectedLogsWidget}
                          showAllOption={true}
                          className="w-56"
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      {widgetLogsError ? (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                          Unable to load full history. Showing local activity only.
                        </div>
                      ) : null}
                      {activeWidgets.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 px-4 text-center rounded-xl border border-dashed border-theme-neutral-300 bg-white">
                          <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-theme-brand-tint-light mb-3">
                            <ClipboardList className="h-6 w-6 text-theme-primary" />
                          </div>
                          <p className=" text-sm font-medium text-theme-text-primary">No activity yet</p>
                          <p className=" text-xs text-theme-text-tertiary mt-1 max-w-xs">Add widgets to this bucket to start tracking activity and see your logs here.</p>
                          <button onClick={() => setIsWidgetSheetOpen(true)} className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-theme-neutral-300 bg-white px-4 py-2  text-[13px] font-medium text-theme-text-primary shadow-[0px_1px_1.5px_0.1px_rgba(22,25,36,0.05)] hover:bg-[rgba(252,250,248,0.5)] transition-colors">
                            <Plus className="h-3.5 w-3.5 text-theme-primary" />
                            Add Widget
                          </button>
                        </div>
                      ) : filteredWidgetLogs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-14 px-4 text-center rounded-xl border border-dashed border-theme-neutral-300 bg-white">
                          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-theme-brand-tint-light mb-3">
                            <ClipboardList className="h-5 w-5 text-theme-primary" />
                          </div>
                          <p className=" text-[13px] font-medium text-theme-text-primary">No activity yet</p>
                          <p className=" text-xs text-theme-text-tertiary mt-1">Track progress or update a widget to start building logs.</p>
                        </div>
                      ) : (
                        <div className="bg-white rounded-xl border border-theme-neutral-300 shadow-warm-sm overflow-hidden">
                          <div className="flex items-center gap-2 px-5 py-4 border-b border-[rgba(219,214,207,0.7)]">
                            <ClipboardList className="h-4 w-4 text-theme-primary" />
                            <h3 className=" text-sm tracking-[0.6px] uppercase text-theme-secondary">
                              {selectedLogsWidget === 'all' ? 'All Widget Activity' :
                                `${activeWidgets.find(w => w.instanceId === selectedLogsWidget)?.name || 'Widget'} Activity`}
                            </h3>
                            <span className=" text-[11px] text-theme-text-tertiary">
                              ({filteredWidgetLogs.length})
                            </span>
                          </div>
                          <div className="max-h-[480px] overflow-y-auto">
                            {filteredWidgetLogs.slice(0, 80).map((entry) => (
                              <div key={entry.id} className="flex items-start gap-4 px-5 py-3 border-b border-theme-neutral-300/50 last:border-b-0 hover:bg-[rgba(252,250,248,0.5)] transition-colors">
                                <div className={`mt-1.5 h-2 w-2 rounded-full ${LOG_KIND_DOT_CLASS[entry.kind]}`} />
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-medium text-theme-text-primary">{entry.message}</p>
                                  <p className="truncate text-xs text-theme-text-tertiary">
                                    {entry.widgetName}
                                    {entry.details ? ` • ${entry.details}` : ""}
                                  </p>
                                </div>
                                <p className="whitespace-nowrap text-xs text-theme-text-tertiary/70">
                                  {formatLogTimestamp(entry.occurredAt)}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeSubTab === 'Settings' && (
                  <div>
                    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <h2 className="section-label-sm">Widget Settings</h2>
                      <WidgetSelector
                        widgets={activeWidgets}
                        selectedWidget={selectedSettingsWidget}
                        onWidgetChange={setSelectedSettingsWidget}
                        showAllOption={true}
                        className="w-56"
                      />
                    </div>

                    <div className="space-y-6">
                      {activeWidgets.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 px-4 text-center rounded-xl border border-dashed border-theme-neutral-300 bg-white">
                          <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-theme-brand-tint-light mb-3">
                            <Settings2 className="h-6 w-6 text-theme-primary" />
                          </div>
                          <p className=" text-sm font-medium text-theme-text-primary">No widgets to configure</p>
                          <p className=" text-xs text-theme-text-tertiary mt-1 max-w-xs">Add widgets to this bucket to customize their targets, colors, and data sources.</p>
                          <button onClick={() => setIsWidgetSheetOpen(true)} className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-theme-neutral-300 bg-white px-4 py-2  text-[13px] font-medium text-theme-text-primary shadow-[0px_1px_1.5px_0.1px_rgba(22,25,36,0.05)] hover:bg-[rgba(252,250,248,0.5)] transition-colors">
                            <Plus className="h-3.5 w-3.5 text-theme-primary" />
                            Add Widget
                          </button>
                        </div>
                      ) : (
                        <div className="grid gap-6">
                          {selectedSettingsWidgets.map((widget) => {
                            const IconComponent = resolveWidgetIcon(widget);
                            const sourceOptions = getDataSourceOptions(widget);
                            const activeDataSource = widget.dataSource || "manual";
                            const selectedDataSource = sourceOptions.includes(activeDataSource)
                              ? activeDataSource
                              : sourceOptions[0];

                            return (
                              <div key={widget.instanceId} className="bg-white rounded-xl border border-theme-neutral-300 shadow-warm-sm overflow-hidden">
                                <div className="flex items-center gap-3 px-5 py-4 border-b border-[rgba(219,214,207,0.7)]">
                                  {(() => {
                                    const settingsBucketHex = getBucketColor(activeBucket);
                                    const sStyles = getWidgetColorStyles(settingsBucketHex);
                                    return (
                                      <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: sStyles.iconTint }}>
                                        {IconComponent ? (
                                          <IconComponent className="h-5 w-5" style={{ color: sStyles.text }} />
                                        ) : (
                                          <LayoutDashboard className="h-5 w-5" style={{ color: sStyles.text }} />
                                        )}
                                      </div>
                                    );
                                  })()}
                                  <div>
                                    <h3 className=" text-sm tracking-[0.6px] uppercase text-theme-secondary">{widget.name}</h3>
                                    <p className=" text-[11px] text-theme-text-tertiary">{widget.id}</p>
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-5">
                                  <div>
                                    <label className="block  text-xs font-medium text-theme-text-tertiary uppercase tracking-wide mb-2">Daily target</label>
                                    <input
                                      type="number"
                                      min={1}
                                      step={1}
                                      value={widget.target || 1}
                                      onChange={(event) => {
                                        const parsed = Number.parseInt(event.target.value, 10);
                                        if (Number.isNaN(parsed)) return;
                                        patchWidgetInActiveBucket(widget.instanceId, {
                                          target: Math.max(1, parsed),
                                        });
                                      }}
                                      className="w-full px-3 py-2 border border-theme-neutral-300 rounded-lg bg-white  text-[13px] text-theme-text-primary focus:outline-none focus:ring-2 focus:ring-theme-primary/30 focus:border-theme-primary transition-colors"
                                    />
                                  </div>
                                  <div>
                                    <label className="block  text-xs font-medium text-theme-text-tertiary uppercase tracking-wide mb-2">Data source</label>
                                    <select
                                      value={selectedDataSource}
                                      onChange={(event) => {
                                        patchWidgetInActiveBucket(widget.instanceId, {
                                          dataSource: event.target.value,
                                        });
                                        void fetchIntegrationsData();
                                      }}
                                      className="w-full rounded-lg border border-theme-neutral-300 bg-white px-3 py-2  text-[13px] text-theme-text-primary capitalize focus:outline-none focus:ring-2 focus:ring-theme-primary/30 focus:border-theme-primary transition-colors"
                                    >
                                      {sourceOptions.map((option) => (
                                        <option key={option} value={option}>
                                          {option}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block  text-xs font-medium text-theme-text-tertiary uppercase tracking-wide mb-2">Created</label>
                                    <span className="text-sm text-theme-text-subtle">
                                      {widget.createdAt
                                        ? new Date(widget.createdAt).toLocaleDateString()
                                        : "Unknown"}
                                    </span>
                                  </div>
                                </div>

                                <div className="flex flex-wrap gap-2 border-t border-[rgba(219,214,207,0.7)] px-5 py-4">
                                  <button
                                    onClick={() => {
                                      setEditingBucket(activeBucket);
                                      setEditingWidget(widget);
                                      setNewlyCreatedWidgetId(null);
                                    }}
                                    className="rounded-lg bg-theme-primary px-4 py-2  text-[13px] font-medium text-white shadow-[0px_1px_1.5px_0.1px_rgba(22,25,36,0.05)] hover:bg-theme-primary-600 transition-colors"
                                  >
                                    Open Editor
                                  </button>
                                  <button
                                    onClick={() => {
                                      void resetWidgetProgress(widget);
                                    }}
                                    className="rounded-lg border border-theme-neutral-300 px-4 py-2  text-[13px] font-medium text-theme-text-primary shadow-[0px_1px_1.5px_0.1px_rgba(22,25,36,0.05)] hover:bg-[rgba(252,250,248,0.5)] transition-colors"
                                  >
                                    Reset Today
                                  </button>
                                  <button
                                    onClick={() => {
                                      requestRemoveWidget(widget);
                                    }}
                                    className="rounded-lg border border-red-200 px-4 py-2  text-[13px] font-medium text-red-600 hover:bg-red-50 transition-colors ml-auto"
                                  >
                                    Remove
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
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
            bucketColor={getBucketColor(activeBucket)}
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
                bucketColor={getBucketColor(activeBucket)}
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

        {/* Bucket editor: add/remove tabs */}
        <Sheet open={isEditorOpen} onOpenChange={setIsEditorOpen}>
          <SheetContent side="right" className="w-full sm:w-[520px] md:w-[560px] overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="text-theme-text-primary">Manage Tabs</SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-theme-text-body mb-1">Add a new tab</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Tab name (e.g., Side Projects)"
                    value={newBucket}
                    onChange={(e) => setNewBucket(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddBucket()}
                    className="flex-1 rounded-lg border border-theme-neutral-300 px-3 py-2 text-sm focus:border-theme-primary focus:ring-1 focus:ring-theme-primary/30 focus:outline-none transition-colors"
                  />
                  <button
                    onClick={handleAddBucket}
                    disabled={!newBucket.trim() || buckets.includes(newBucket.trim())}
                    className="px-3 py-2 text-sm rounded-lg bg-theme-primary text-white hover:bg-theme-primary-600 disabled:opacity-50 transition-colors"
                  >
                    Add
                  </button>
                </div>
              </div>

              <div>
                <div className="text-sm font-medium text-theme-text-body mb-2">Suggested tabs</div>
                <div className="flex flex-wrap gap-2">
                  {suggestedToShow.length > 0 ? (
                    suggestedToShow.map((name) => (
                      <button
                        key={name}
                        onClick={() => handleAddBucketQuick(name)}
                        className="px-3 py-1.5 rounded-full border border-theme-neutral-300 text-sm hover:bg-theme-surface-alt active:bg-theme-brand-tint-light"
                        aria-label={`Add ${name} tab`}
                      >
                        {name}
                      </button>
                    ))
                  ) : (
                    <div className="text-xs text-theme-text-tertiary">All suggested tabs are already added</div>
                  )}
                </div>
              </div>

              <div>
                <div className="text-sm font-medium text-theme-text-body mb-2">Existing tabs</div>
                <ul className="divide-y divide-theme-neutral-300 rounded-md border border-theme-neutral-300 overflow-hidden">
                  {buckets.map((b, index) => (
                    <li
                      key={b}
                      className={`px-3 py-3 bg-white ${draggedBucketIndex === index ? 'opacity-50' : ''}`}
                      draggable={editingBucketName !== b}
                      onDragStart={() => handleBucketDragStart(index)}
                      onDragOver={(e) => handleBucketDragOver(e, index)}
                      onDragEnd={handleBucketDragEnd}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          {editingBucketName !== b && (
                            <GripVertical className="w-4 h-4 text-theme-text-tertiary/70 cursor-grab active:cursor-grabbing" />
                          )}
                          <span
                            className="inline-block w-4 h-4 rounded-full border border-theme-neutral-300 flex-shrink-0"
                            style={{ backgroundColor: getBucketColor(b) }}
                            aria-hidden
                          />
                          {editingBucketName === b ? (
                            <input
                              type="text"
                              value={editingBucketNewName}
                              onChange={(e) => setEditingBucketNewName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveEditBucket();
                                if (e.key === 'Escape') handleCancelEditBucket();
                              }}
                              className="flex-1 text-sm border border-theme-primary rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-theme-primary/30"
                              autoFocus
                            />
                          ) : (
                            <span className={`truncate text-sm ${b === activeBucket ? 'font-semibold text-theme-primary' : 'text-theme-text-body'}`}>{b}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {editingBucketName === b ? (
                            <>
                              <button
                                onClick={handleSaveEditBucket}
                                className="text-xs p-1.5 rounded-md border border-green-200 text-green-600 hover:bg-green-50"
                                title="Save"
                                aria-label="Save bucket name"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={handleCancelEditBucket}
                                className="text-xs p-1.5 rounded-md border border-theme-neutral-300 text-theme-text-subtle hover:bg-theme-surface-alt"
                                title="Cancel"
                                aria-label="Cancel bucket rename"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => handleStartEditBucket(b)}
                                className="text-xs p-1.5 rounded-lg border border-theme-neutral-300 text-theme-primary hover:bg-theme-brand-tint-subtle"
                                title="Edit name"
                                aria-label="Edit bucket name"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => requestRemoveBucket(b)}
                                className="text-xs px-2 py-1 rounded-md border border-red-200 text-red-600 hover:bg-red-50"
                              >
                                Remove
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      {/* Custom color picker only (auto-assigned initially) */}
                      <div className="mt-3 flex items-center justify-end gap-3">
                        <label className="flex items-center gap-2 text-xs text-theme-text-tertiary">
                          <span>Custom</span>
                          <input
                            type="color"
                            value={(bucketColors[b] || getSuggestedColorForBucket(b)) as string}
                            onChange={(e) => handleBucketColorChange(b, e.target.value)}
                            className="h-6 w-6 p-0 border rounded cursor-pointer"
                            aria-label={`Choose custom color for ${b}`}
                          />
                        </label>
                      </div>
                    </li>
                  ))}
                  {buckets.length === 0 && (
                    <li className="px-3 py-6 text-sm text-theme-text-tertiary text-center">No tabs yet</li>
                  )}
                </ul>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        {/* Nutrition Widget Modal */}
        <Sheet open={nutritionWidgetOpen} onOpenChange={(open) => {
          setNutritionWidgetOpen(open)
          if (open) {
            setShouldLoadNutritionWidget(true)
          } else {
            // Force refresh nutrition widgets when panel closes
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent('nutritionDataUpdated'))
            }, 100)
          }
        }}>
          <SheetContent side="right" className="w-full sm:w-[600px] md:w-[700px] overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="text-theme-text-primary">Daily Nutrition Tracker</SheetTitle>
            </SheetHeader>
            <div className="mt-6">
              {(nutritionWidgetOpen || shouldLoadNutritionWidget) && (
                shouldLoadNutritionWidget ? <NutritionMealTracker /> : <Skeleton className="h-32 w-full" />
              )}
            </div>
          </SheetContent>
        </Sheet>

        {/* Medication Widget Modal */}
        <Sheet open={medicationWidgetOpen} onOpenChange={(open) => {
          setMedicationWidgetOpen(open)
          if (open) {
            setShouldLoadMedicationWidget(true)
          }
        }}>
          <SheetContent side="right" className="w-full sm:w-[600px] md:w-[700px] overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="text-theme-text-primary">Medication Tracker</SheetTitle>
            </SheetHeader>
            <div className="mt-6">
              {(medicationWidgetOpen || shouldLoadMedicationWidget) && (
                shouldLoadMedicationWidget ? <MedicationTrackerWidget /> : <Skeleton className="h-24 w-full" />
              )}
            </div>
          </SheetContent>
        </Sheet>

        {/* Exercise Widget Modal */}
        <Sheet open={exerciseWidgetOpen} onOpenChange={(open) => {
          setExerciseWidgetOpen(open)
          if (open) {
            setShouldLoadExerciseWidget(true)
          }
        }}>
          <SheetContent side="right" className="w-full sm:w-[600px] md:w-[700px] overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="text-warm-950">Exercise Tracker</SheetTitle>
            </SheetHeader>
            <div className="mt-6">
              {(exerciseWidgetOpen || shouldLoadExerciseWidget) && (
                shouldLoadExerciseWidget ? <ExerciseWidget onClose={() => setExerciseWidgetOpen(false)} /> : <Skeleton className="h-24 w-full" />
              )}
            </div>
          </SheetContent>
        </Sheet>

        {/* Home Projects Widget Modal */}
        <Sheet open={homeProjectsWidgetOpen} onOpenChange={(open) => {
          setHomeProjectsWidgetOpen(open)
          if (open) {
            setShouldLoadHomeProjectsWidget(true)
          }
        }}>
          <SheetContent side="right" className="w-full sm:w-[600px] md:w-[700px] overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="text-warm-950">Home Projects</SheetTitle>
            </SheetHeader>
            <div className="mt-6">
              {(homeProjectsWidgetOpen || shouldLoadHomeProjectsWidget) && (
                shouldLoadHomeProjectsWidget ? (
                  <HomeProjectsWidget
                    widget={{
                      id: 'home-projects-modal',
                      instanceId: 'home-projects-modal',
                      name: 'Home Projects',
                      description: 'Track and manage home improvement projects',
                      icon: 'Hammer',
                      category: 'productivity',
                      unit: 'projects',
                      defaultTarget: 5,
                      color: 'blue',
                      target: 0,
                      schedule: [true, true, true, true, true, true, true],
                      createdAt: new Date().toISOString()
                    }}
                    onUpdate={() => { }}
                  />
                ) : <Skeleton className="h-24 w-full" />
              )}
            </div>
          </SheetContent>
        </Sheet>

        {/* Habit Tracker Widget Modal */}
        <Sheet open={habitTrackerWidgetOpen} onOpenChange={(open) => {
          setHabitTrackerWidgetOpen(open);
          if (open) {
            setShouldLoadHabitTrackerWidget(true);
          }
        }}>
          <SheetContent side="right" className="w-full sm:w-[600px] md:w-[700px] overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="text-theme-text-primary">Habit Tracker</SheetTitle>
            </SheetHeader>
            <div className="mt-2">
              {(habitTrackerWidgetOpen || shouldLoadHabitTrackerWidget) && activeHabitWidget && (
                shouldLoadHabitTrackerWidget ? (
                  <HabitTrackerWidget
                    widget={activeHabitWidget}
                    onUpdate={(updates) => {
                      const merged = { ...activeHabitWidget, ...updates };
                      setActiveHabitWidget(merged);
                      setWidgetsByBucket(prev => {
                        const next = { ...prev };
                        next[activeBucket] = (next[activeBucket] ?? []).map(w =>
                          w.instanceId === activeHabitWidget.instanceId ? { ...w, ...updates } : w
                        );
                        if (typeof window !== 'undefined') {
                          localStorage.setItem('widgets_by_bucket', JSON.stringify({ widgets: next, savedAt: new Date().toISOString() }));
                        }
                        return next;
                      });
                      saveWidgets(widgetsByBucketRef.current, progressByWidgetRef.current);
                    }}
                    progress={(() => {
                      const p = progressByWidget[activeHabitWidget.instanceId];
                      const today = todayStrGlobal;
                      if (!p || p.date !== today) return { value: 0, streak: p?.streak || 0, isToday: false };
                      return { value: p.value, streak: p.streak, isToday: true };
                    })()}
                    onComplete={() => incrementProgress(activeHabitWidget)}
                  />
                ) : <Skeleton className="h-24 w-full" />
              )}
            </div>
          </SheetContent>
        </Sheet>

        {/* Sleep Tracker Widget Modal */}
        <Sheet open={sleepWidgetOpen} onOpenChange={(open) => {
          setSleepWidgetOpen(open);
          if (open) setShouldLoadSleepWidget(true);
        }}>
          <SheetContent side="right" className="w-full sm:w-[600px] md:w-[700px] overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="text-theme-text-primary">Sleep Tracker</SheetTitle>
            </SheetHeader>
            <div className="mt-2">
              {(sleepWidgetOpen || shouldLoadSleepWidget) && activeSleepWidget && (
                shouldLoadSleepWidget ? (
                  <SleepTrackerWidget
                    widget={activeSleepWidget}
                    onUpdate={(updates) => {
                      const merged = { ...activeSleepWidget, ...updates };
                      setActiveSleepWidget(merged);
                      setWidgetsByBucket(prev => {
                        const next = { ...prev };
                        next[activeBucket] = (next[activeBucket] ?? []).map(w =>
                          w.instanceId === activeSleepWidget.instanceId ? { ...w, ...updates } : w
                        );
                        if (typeof window !== 'undefined') {
                          localStorage.setItem('widgets_by_bucket', JSON.stringify({ widgets: next, savedAt: new Date().toISOString() }));
                        }
                        return next;
                      });
                      saveWidgets(widgetsByBucketRef.current, progressByWidgetRef.current);
                    }}
                    progress={(() => {
                      const p = progressByWidget[activeSleepWidget.instanceId];
                      const today = todayStrGlobal;
                      if (!p || p.date !== today) return { value: 0, streak: p?.streak || 0, isToday: false };
                      return { value: p.value, streak: p.streak, isToday: true };
                    })()}
                    onComplete={() => incrementProgress(activeSleepWidget)}
                  />
                ) : <Skeleton className="h-24 w-full" />
              )}
            </div>
          </SheetContent>
        </Sheet>

        {/* Meditation Timer Widget Modal */}
        <Sheet open={meditationWidgetOpen} onOpenChange={(open) => {
          setMeditationWidgetOpen(open);
          if (open) setShouldLoadMeditationWidget(true);
        }}>
          <SheetContent side="right" className="w-full sm:w-[600px] md:w-[700px] overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="text-theme-text-primary">Meditation</SheetTitle>
            </SheetHeader>
            <div className="mt-2">
              {(meditationWidgetOpen || shouldLoadMeditationWidget) && activeMeditationWidget && (
                shouldLoadMeditationWidget ? (
                  <MeditationTimerWidget
                    widget={activeMeditationWidget}
                    onUpdate={(updates) => {
                      const merged = { ...activeMeditationWidget, ...updates };
                      setActiveMeditationWidget(merged);
                      setWidgetsByBucket(prev => {
                        const next = { ...prev };
                        next[activeBucket] = (next[activeBucket] ?? []).map(w =>
                          w.instanceId === activeMeditationWidget.instanceId ? { ...w, ...updates } : w
                        );
                        if (typeof window !== 'undefined') {
                          localStorage.setItem('widgets_by_bucket', JSON.stringify({ widgets: next, savedAt: new Date().toISOString() }));
                        }
                        return next;
                      });
                      saveWidgets(widgetsByBucketRef.current, progressByWidgetRef.current);
                    }}
                    progress={(() => {
                      const p = progressByWidget[activeMeditationWidget.instanceId];
                      const today = todayStrGlobal;
                      if (!p || p.date !== today) return { value: 0, streak: p?.streak || 0, isToday: false };
                      return { value: p.value, streak: p.streak, isToday: true };
                    })()}
                    onComplete={() => incrementProgress(activeMeditationWidget)}
                  />
                ) : <Skeleton className="h-24 w-full" />
              )}
            </div>
          </SheetContent>
        </Sheet>

        {/* Breathwork Widget Modal */}
        <Sheet open={breathworkWidgetOpen} onOpenChange={(open) => {
          setBreathworkWidgetOpen(open);
          if (open) setShouldLoadBreathworkWidget(true);
        }}>
          <SheetContent side="right" className="w-full sm:w-[600px] md:w-[700px] overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="text-theme-text-primary">Breathwork</SheetTitle>
            </SheetHeader>
            <div className="mt-2">
              {(breathworkWidgetOpen || shouldLoadBreathworkWidget) && activeBreathworkWidget && (
                shouldLoadBreathworkWidget ? (
                  <BreathworkWidget
                    widget={activeBreathworkWidget}
                    onUpdate={(updates) => {
                      const merged = { ...activeBreathworkWidget, ...updates };
                      setActiveBreathworkWidget(merged);
                      setWidgetsByBucket(prev => {
                        const next = { ...prev };
                        next[activeBucket] = (next[activeBucket] ?? []).map(w =>
                          w.instanceId === activeBreathworkWidget.instanceId ? { ...w, ...updates } : w
                        );
                        if (typeof window !== 'undefined') {
                          localStorage.setItem('widgets_by_bucket', JSON.stringify({ widgets: next, savedAt: new Date().toISOString() }));
                        }
                        return next;
                      });
                      saveWidgets(widgetsByBucketRef.current, progressByWidgetRef.current);
                    }}
                    progress={(() => {
                      const p = progressByWidget[activeBreathworkWidget.instanceId];
                      const today = todayStrGlobal;
                      if (!p || p.date !== today) return { value: 0, streak: p?.streak || 0, isToday: false };
                      return { value: p.value, streak: p.streak, isToday: true };
                    })()}
                    onComplete={() => incrementProgress(activeBreathworkWidget)}
                  />
                ) : <Skeleton className="h-24 w-full" />
              )}
            </div>
          </SheetContent>
        </Sheet>

        {/* Water Intake Widget Modal */}
        <Sheet open={waterWidgetOpen} onOpenChange={(open) => {
          setWaterWidgetOpen(open);
          if (open) setShouldLoadWaterWidget(true);
        }}>
          <SheetContent side="right" className="w-full sm:w-[600px] md:w-[700px] overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="text-theme-text-primary">Water Intake</SheetTitle>
            </SheetHeader>
            <div className="mt-2">
              {(waterWidgetOpen || shouldLoadWaterWidget) && activeWaterWidget && (
                shouldLoadWaterWidget ? (
                  <WaterIntakeWidget
                    widget={activeWaterWidget}
                    onUpdate={(updates) => {
                      const merged = { ...activeWaterWidget, ...updates };
                      setActiveWaterWidget(merged);
                      setWidgetsByBucket(prev => {
                        const next = { ...prev };
                        next[activeBucket] = (next[activeBucket] ?? []).map(w =>
                          w.instanceId === activeWaterWidget.instanceId ? { ...w, ...updates } : w
                        );
                        if (typeof window !== 'undefined') {
                          localStorage.setItem('widgets_by_bucket', JSON.stringify({ widgets: next, savedAt: new Date().toISOString() }));
                        }
                        return next;
                      });
                      saveWidgets(widgetsByBucketRef.current, progressByWidgetRef.current);
                    }}
                    progress={(() => {
                      const p = progressByWidget[activeWaterWidget.instanceId];
                      const today = todayStrGlobal;
                      if (!p || p.date !== today) return { value: 0, streak: p?.streak || 0, isToday: false };
                      return { value: p.value, streak: p.streak, isToday: true };
                    })()}
                    onComplete={() => incrementProgress(activeWaterWidget)}
                  />
                ) : <Skeleton className="h-24 w-full" />
              )}
            </div>
          </SheetContent>
        </Sheet>

        {/* Mood Tracker Widget Modal */}
        <Sheet open={moodWidgetOpen} onOpenChange={(open) => {
          setMoodWidgetOpen(open);
          if (open) setShouldLoadMoodWidget(true);
        }}>
          <SheetContent side="right" className="w-full sm:w-[600px] md:w-[700px] overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="text-theme-text-primary">Mood Tracker</SheetTitle>
            </SheetHeader>
            <div className="mt-2">
              {(moodWidgetOpen || shouldLoadMoodWidget) && activeMoodWidget && (
                shouldLoadMoodWidget ? (
                  <MoodTrackerWidget
                    widget={activeMoodWidget}
                    onUpdate={(updates) => {
                      const merged = { ...activeMoodWidget, ...updates };
                      setActiveMoodWidget(merged);
                      setWidgetsByBucket(prev => {
                        const next = { ...prev };
                        next[activeBucket] = (next[activeBucket] ?? []).map(w =>
                          w.instanceId === activeMoodWidget.instanceId ? { ...w, ...updates } : w
                        );
                        if (typeof window !== 'undefined') {
                          localStorage.setItem('widgets_by_bucket', JSON.stringify({ widgets: next, savedAt: new Date().toISOString() }));
                        }
                        return next;
                      });
                      saveWidgets(widgetsByBucketRef.current, progressByWidgetRef.current);
                    }}
                    progress={(() => {
                      const p = progressByWidget[activeMoodWidget.instanceId];
                      const today = todayStrGlobal;
                      if (!p || p.date !== today) return { value: 0, streak: p?.streak || 0, isToday: false };
                      return { value: p.value, streak: p.streak, isToday: true };
                    })()}
                    onComplete={() => incrementProgress(activeMoodWidget)}
                  />
                ) : <Skeleton className="h-24 w-full" />
              )}
            </div>
          </SheetContent>
        </Sheet>

        {/* Steps Tracker Widget Modal */}
        <Sheet open={stepsWidgetOpen} onOpenChange={(open) => {
          setStepsWidgetOpen(open);
          if (open) setShouldLoadStepsWidget(true);
        }}>
          <SheetContent side="right" className="w-full sm:w-[600px] md:w-[700px] overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="text-theme-text-primary">Daily Steps</SheetTitle>
            </SheetHeader>
            <div className="mt-2">
              {(stepsWidgetOpen || shouldLoadStepsWidget) && activeStepsWidget && (
                shouldLoadStepsWidget ? (
                  <StepsTrackerWidget
                    widget={activeStepsWidget}
                    onUpdate={(updates) => {
                      const merged = { ...activeStepsWidget, ...updates };
                      setActiveStepsWidget(merged);
                      setWidgetsByBucket(prev => {
                        const next = { ...prev };
                        next[activeBucket] = (next[activeBucket] ?? []).map(w =>
                          w.instanceId === activeStepsWidget.instanceId ? { ...w, ...updates } : w
                        );
                        if (typeof window !== 'undefined') {
                          localStorage.setItem('widgets_by_bucket', JSON.stringify({ widgets: next, savedAt: new Date().toISOString() }));
                        }
                        return next;
                      });
                      saveWidgets(widgetsByBucketRef.current, progressByWidgetRef.current);
                    }}
                    progress={(() => {
                      const p = progressByWidget[activeStepsWidget.instanceId];
                      const today = todayStrGlobal;
                      if (!p || p.date !== today) return { value: 0, streak: p?.streak || 0, isToday: false };
                      return { value: p.value, streak: p.streak, isToday: true };
                    })()}
                    onComplete={() => incrementProgress(activeStepsWidget)}
                  />
                ) : <Skeleton className="h-24 w-full" />
              )}
            </div>
          </SheetContent>
        </Sheet>

        {/* Heart Rate Widget Modal */}
        <Sheet open={heartRateWidgetOpen} onOpenChange={(open) => {
          setHeartRateWidgetOpen(open);
          if (open) setShouldLoadHeartRateWidget(true);
        }}>
          <SheetContent side="right" className="w-full sm:w-[600px] md:w-[700px] overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="text-theme-text-primary">Heart Rate</SheetTitle>
            </SheetHeader>
            <div className="mt-2">
              {(heartRateWidgetOpen || shouldLoadHeartRateWidget) && activeHeartRateWidget && (
                shouldLoadHeartRateWidget ? (
                  <HeartRateWidget
                    widget={activeHeartRateWidget}
                    onUpdate={(updates) => {
                      const merged = { ...activeHeartRateWidget, ...updates };
                      setActiveHeartRateWidget(merged);
                      setWidgetsByBucket(prev => {
                        const next = { ...prev };
                        next[activeBucket] = (next[activeBucket] ?? []).map(w =>
                          w.instanceId === activeHeartRateWidget.instanceId ? { ...w, ...updates } : w
                        );
                        if (typeof window !== 'undefined') {
                          localStorage.setItem('widgets_by_bucket', JSON.stringify({ widgets: next, savedAt: new Date().toISOString() }));
                        }
                        return next;
                      });
                      saveWidgets(widgetsByBucketRef.current, progressByWidgetRef.current);
                    }}
                    progress={(() => {
                      const p = progressByWidget[activeHeartRateWidget.instanceId];
                      const today = todayStrGlobal;
                      if (!p || p.date !== today) return { value: 0, streak: p?.streak || 0, isToday: false };
                      return { value: p.value, streak: p.streak, isToday: true };
                    })()}
                    onComplete={() => incrementProgress(activeHeartRateWidget)}
                  />
                ) : <Skeleton className="h-24 w-full" />
              )}
            </div>
          </SheetContent>
        </Sheet>

        {/* Caffeine Tracker Widget Modal */}
        <Sheet open={caffeineWidgetOpen} onOpenChange={(open) => {
          setCaffeineWidgetOpen(open);
          if (open) setShouldLoadCaffeineWidget(true);
        }}>
          <SheetContent side="right" className="w-full sm:w-[600px] md:w-[700px] overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="text-theme-text-primary">Caffeine Intake</SheetTitle>
            </SheetHeader>
            <div className="mt-2">
              {(caffeineWidgetOpen || shouldLoadCaffeineWidget) && activeCaffeineWidget && (
                shouldLoadCaffeineWidget ? (
                  <CaffeineTrackerWidget
                    widget={activeCaffeineWidget}
                    onUpdate={(updates) => {
                      const merged = { ...activeCaffeineWidget, ...updates };
                      setActiveCaffeineWidget(merged);
                      setWidgetsByBucket(prev => {
                        const next = { ...prev };
                        next[activeBucket] = (next[activeBucket] ?? []).map(w =>
                          w.instanceId === activeCaffeineWidget.instanceId ? { ...w, ...updates } : w
                        );
                        if (typeof window !== 'undefined') {
                          localStorage.setItem('widgets_by_bucket', JSON.stringify({ widgets: next, savedAt: new Date().toISOString() }));
                        }
                        return next;
                      });
                      saveWidgets(widgetsByBucketRef.current, progressByWidgetRef.current);
                    }}
                    progress={(() => {
                      const p = progressByWidget[activeCaffeineWidget.instanceId];
                      const today = todayStrGlobal;
                      if (!p || p.date !== today) return { value: 0, streak: p?.streak || 0, isToday: false };
                      return { value: p.value, streak: p.streak, isToday: true };
                    })()}
                    onComplete={() => incrementProgress(activeCaffeineWidget)}
                  />
                ) : <Skeleton className="h-24 w-full" />
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Confirm dialog & undo toast rendered outside the z-10 stacking context
          so they always appear above the sidebar / mobile bottom nav. */}
      {confirmState && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-label={confirmState.title}
            className="w-full max-w-md rounded-xl border border-theme-neutral-300 bg-white p-5 shadow-xl"
          >
            <h3 className="text-base font-semibold text-theme-text-primary">{confirmState.title}</h3>
            <p className="mt-2 text-sm text-theme-text-subtle">{confirmState.description}</p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmState(null)}
                className="rounded-md border border-theme-neutral-300 px-3 py-2 text-sm text-theme-text-body hover:bg-theme-surface-alt"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const pending = confirmState;
                  setConfirmState(null);
                  void Promise.resolve(pending.onConfirm());
                }}
                className="rounded-md bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-700"
              >
                {confirmState.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {undoState && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-24 right-4 z-[110] w-[min(92vw,360px)] rounded-lg border border-theme-neutral-300 bg-white p-3 shadow-warm-lg"
        >
          <p className="text-sm text-theme-text-primary">{undoState.message}</p>
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                clearUndoTimer();
                setUndoState(null);
              }}
              className="rounded-md border border-theme-neutral-300 px-2 py-1 text-xs text-theme-text-subtle hover:bg-theme-surface-alt"
            >
              Dismiss
            </button>
            <button
              type="button"
              onClick={() => {
                const pending = undoState;
                clearUndoTimer();
                setUndoState(null);
                void Promise.resolve(pending.onUndo());
              }}
              className="rounded-lg bg-theme-primary px-2 py-1 text-xs text-white hover:bg-theme-primary-600 transition-colors"
            >
              Undo
            </button>
          </div>
        </div>
      )}

      {chatBarReady && <ChatBarLazy />}

      <TaskEditorModal
        ref={taskEditorRef}
        availableBuckets={buckets}
        selectedBucket={activeBucket}
        bucketColors={bucketColors}
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
