"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";

import Image from "next/image";
import Link from "next/link";
import { supabase } from "@/utils/supabase/client";
import { getUserPreferencesClient, saveUserPreferences } from "@/lib/user-preferences";
import { invalidateTaskCaches } from "@/hooks/use-data-cache";
import { format, addDays, isSameDay } from 'date-fns';
import {
  type LucideIcon,
  Plus,
  MessageSquare,
  LogOut,
  X,
  Droplets,
  Flame,
  Target,
  Scale,
  Heart,
  Moon,
  Activity,
  Coffee,
  Brain,
  Calendar,
  CheckSquare,
  Clock,
  Users,
  Pill,
  Apple,
  Utensils,
  TreePine,
  Dumbbell,
  Home,
  DollarSign,
  Briefcase,
  Zap,
  Book,
  Gamepad2,
  Music,
  Palette,
  Camera,
  Plane,
  ShoppingBag,
  Wrench,
  FileText,
  BarChart,
  TrendingUp,
  Award,
  Gift,
  Sparkles,
  Smile,
  Notebook,
  Wind,
  Move,
  Quote,
  Smartphone,
  Gauge,
  CalendarClock,
  ClipboardList,
  Wallet,
  ImageIcon,
  HeartPulse,
  Car,
  Cake,
  PartyPopper,
  ShieldOff,
  Timer,
  PiggyBank,
  Flag,
  HomeIcon,
  Hammer,
  Brush,
  CalendarDays,
  RotateCw,
  Loader2,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Cloud,
  CloudSun,
  CloudRain,
  CloudSnow,
  CloudLightning,
  Sun,
  LayoutDashboard,
  Settings as SettingsIcon,
  ListChecks,
} from "lucide-react";
import { widgetTemplates } from "./widget-library";
import type { WidgetTemplate, WidgetInstance } from "@/types/widgets";
import dynamic from 'next/dynamic';

function withRetry<T>(loader: () => Promise<T>, retries = 2, delayMs = 1500) {
  return async () => {
    let lastErr: any
    for (let i = 0; i <= retries; i++) {
      try { return await loader() } catch (e) { lastErr = e }
      await new Promise(r => setTimeout(r, delayMs))
    }
    throw lastErr
  }
}
// Import the widget editor statically to avoid dynamic chunk loading issues
// seen during login (ChunkLoadError for widget-editor.tsx). This slightly
// increases the initial bundle size but removes the fragile runtime fetch
// for this component.
import WidgetEditorSheet from "@/components/widget-editor";
import { WidgetLibrary } from "@/components/widget-library";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import WidgetSelector from "./widget-selector";
import { TasksContext, TasksProvider, useTasksContext } from '@/contexts/tasks-context';
import { Skeleton } from "@/components/ui/skeleton";
import { TasksQuickActions } from "@/components/tasks-quick-actions";
import { TasksGroupedList } from "@/components/tasks-grouped-list";
import { TasksDailyProgress } from "@/components/tasks-daily-progress";
import { EnhancedTasksView } from "@/components/enhanced-tasks-view";

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
const TrendsPanel = dynamic(
  () => import("./trends-panel"),
  { loading: () => <Skeleton className="h-48 w-full" /> }
);
const ChatBarLazy = dynamic(
  () => import("./chat-bar").then(m => m.ChatBar),
  { ssr: false, loading: () => null }
);

// Icon mapping for serialization
const iconMap: Record<string, LucideIcon> = {
  Droplets,
  Flame,
  Target,
  Scale,
  Heart,
  Moon,
  Activity,
  Coffee,
  Brain,
  Calendar,
  CheckSquare,
  Clock,
  Users,
  Pill,
  Apple,
  Utensils,
  TreePine,
  Dumbbell,
  Home,
  DollarSign,
  Briefcase,
  Zap,
  Book,
  Gamepad2,
  Music,
  Palette,
  Camera,
  Plane,
  ShoppingBag,
  Wrench,
  FileText,
  BarChart,
  TrendingUp,
  Award,
  Gift,
  Sparkles,
  water: Droplets,
  calories: Flame,
  steps: Target,
  weight: Scale,
  heartrate: Heart,
  sleep: Moon,
  exercise: Activity,
  caffeine: Coffee,
  chores: CheckSquare,
  nutrition: Utensils,
  mood: Smile,
  journal: Notebook,
  meditation: Brain,
  gratitude: Sparkles,
  breathwork: Wind,
  stretch: Move,
  affirmations: Quote,
  screen_time: Smartphone,
  stress: Gauge,
  self_care: CheckSquare,
  doctor_appt: CalendarClock,
  medication: Pill,
  quit_habit: ShieldOff,
  symptom_log: ClipboardList,
  medical_bills: DollarSign,
  home_projects: Hammer,
  maintenance: Wrench,
  cleaning: Brush,
  family_members: Users,
  family_calendar: CalendarDays,
  family_chores: ClipboardList,
  meal_plan: Utensils,
  family_budget: Wallet,
  photo_carousel: ImageIcon,
  emergency_info: HeartPulse,
  carpool: Car,
  birthdays: Cake,
  social_events: PartyPopper,
  holidays: Gift,
  work_projects: Briefcase,
  work_deadlines: CalendarClock,
  pomodoro: Timer,
  finance_budget: Wallet,
  savings_tracker: PiggyBank,
  net_worth: TrendingUp,
  properties: HomeIcon,
  financial_goals: Flag,
};

// Helper to get icon component from string name
const getIconComponent = (name: string): LucideIcon | null => {
  return iconMap[name] || null
}

// Default colors for widget templates
const templateColors: Record<string, string> = {
  water: "blue",
  calories: "orange",
  steps: "green",
  weight: "purple",
  heartrate: "red",
  sleep: "indigo",
  exercise: "teal",
  caffeine: "amber",
  chores: "amber",
  nutrition: "emerald",
};

const getTemplateColor = (id: string): string | null => {
  return templateColors[id] || null;
};

// Color to Tailwind background class map (500 tone)
const BG_COLOR_CLASSES: Record<string,string> = {
  blue:'bg-blue-500', green:'bg-green-500', red:'bg-red-500', orange:'bg-orange-500', purple:'bg-purple-500', indigo:'bg-indigo-500', amber:'bg-amber-500', teal:'bg-teal-500', rose:'bg-rose-500', cyan:'bg-cyan-500', yellow:'bg-yellow-500', sky:'bg-sky-500', emerald:'bg-emerald-500', violet:'bg-violet-500', lime:'bg-lime-500', fuchsia:'bg-fuchsia-500', gray:'bg-gray-500', slate:'bg-slate-500', stone:'bg-stone-500'
};

// Text color classes to match widget icon color (500 tone)
const TEXT_COLOR_CLASSES: Record<string,string> = {
  blue:'text-blue-500', green:'text-green-500', red:'text-red-500', orange:'text-orange-500', purple:'text-purple-500', indigo:'text-indigo-500', amber:'text-amber-500', teal:'text-teal-500', rose:'text-rose-500', cyan:'text-cyan-500', yellow:'text-yellow-500', sky:'text-sky-500', emerald:'text-emerald-500', violet:'text-violet-500', lime:'text-lime-500', fuchsia:'text-fuchsia-500', gray:'text-gray-500', slate:'text-slate-500', stone:'text-stone-500'
};

/**
 * TaskBoardDashboard
 * -----------------------------------------------------------------------------
 * Clean, responsive rebuild of the TaskBoard dashboard based on Figma design.
 * - Sticky header
 * - Fixed left sidebar
 * - Main scrollable content
 * - Greeting ➜ bucket tabs ➜ card layout
 *
 * This component avoids absolute-positioned pixels. Instead it uses normal flow,
 * flex / grid utilities, and Tailwind spacing so elements never overlap and the
 * dashboard remains responsive.
 */
const debounce = (func: (...args: any[]) => void, delay: number) => {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: any[]) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
};

// -----------------------------------------------------------------------------
// Date helpers
// -----------------------------------------------------------------------------
const dateStr = (d: Date) => d.toISOString().slice(0, 10);
const todayStrGlobal = dateStr(new Date());
const yesterdayStrGlobal = dateStr(new Date(Date.now() - 86400000));

const SUGGESTED_BUCKETS = [
  "Health",
  "Wellness",
  "Medical",
  "Household",
  "Family",
  "Social",
  "Work",
  "Finance",
  "Education",
  "Hobbies",
  "Travel",
  "Meals",
];

// Migration function to update existing widgets to match current templates
function migrateWidgetsToTemplates(widgetsByBucket: Record<string, WidgetInstance[]>): Record<string, WidgetInstance[]> {
  const migratedWidgets = { ...widgetsByBucket };
  let hasChanges = false;
  
  // Create a lookup map for templates
  const templateMap = new Map<string, WidgetTemplate>();
  widgetTemplates.forEach(template => {
    templateMap.set(template.id, template);
  });
  
  // Migrate widgets in each bucket
  Object.keys(migratedWidgets).forEach(bucketName => {
    const widgets = migratedWidgets[bucketName];
    
    widgets.forEach((widget, index) => {
      const template = templateMap.get(widget.id);
      if (template) {
        // Check if widget needs migration
        const needsNameUpdate = widget.name !== template.name;
        const needsColorUpdate = (widget.color || '') !== template.color;
        const needsIconUpdate = widget.icon !== template.icon;
        
        if (needsNameUpdate || needsColorUpdate || needsIconUpdate) {
          console.log(`Migrating widget ${widget.id} in bucket ${bucketName}:`, {
            oldName: widget.name,
            newName: template.name,
            oldColor: widget.color,
            newColor: template.color
          });
          
          // Update widget with template data
          migratedWidgets[bucketName][index] = {
            ...widget,
            name: template.name,
            color: template.color || 'gray',
            icon: template.icon
          };
          hasChanges = true;
        }
      }
    });
  });
  
  if (hasChanges) {
    console.log('Widget migration completed with changes');
  }
  
  return migratedWidgets;
}

// Inner component that uses TasksContext
function TaskBoardDashboardInner({ selectedDate, setSelectedDate }: { selectedDate: Date; setSelectedDate: (date: Date) => void }) {
  // Access tasks context for all task operations
  const { scheduledTasks, dailyVisibleTasks: contextDailyTasks, batchUpdateTasks, deleteTask, createTask: contextCreateTask } = useTasksContext();
  
  // State for task management
  const [taskView, setTaskView] = useState('Today');
  const [isDailyCollapsed, setIsDailyCollapsed] = useState(false);
  const [isOpenCollapsed, setIsOpenCollapsed] = useState(false);
  const [newOpenTask, setNewOpenTask] = useState('');
  const [isLoadingAllTasks, setIsLoadingAllTasks] = useState(false);
  const [buckets, setBuckets] = useState<string[]>([]);
  const [activeBucket, setActiveBucket] = useState<string>('');
  const [bucketsInitialized, setBucketsInitialized] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [newBucket, setNewBucket] = useState("");
  const [bucketColors, setBucketColors] = useState<Record<string, string>>({});
  const [isWidgetSheetOpen, setIsWidgetSheetOpen] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [widgetsByBucket, setWidgetsByBucket] = useState<Record<string, WidgetInstance[]>>({});
  const fetchedYesterdayRef = useRef(false);
  const [weather, setWeather] = useState<{ icon: LucideIcon; temp: number } | null>(null);

  const [isWidgetLoadComplete, setIsWidgetLoadComplete] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Track when we've completed the initial auth check to avoid clearing
  // localStorage/state before Supabase auth resolves on first load
  const [authInitialized, setAuthInitialized] = useState(false);

  // Bucket color utility functions
  const getBucketColor = (bucket: string) => {
    return bucketColors[bucket] || '#8491FF'
  }

  const hexToRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
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

  // Recommended color per common bucket name
  const SUGGESTED_BUCKET_COLOR_MAP: Record<string, string> = {
    health: '#22C55E',     // green-500
    wellness: '#10B981',   // emerald-500
    family: '#60A5FA',     // blue-400
    social: '#F43F5E',     // rose-500
    work: '#6366F1',       // indigo-500
    personal: '#8B5CF6',   // violet-500
    projects: '#0EA5E9',   // sky-500
    home: '#64748B',       // slate-500
    finance: '#EAB308',    // yellow-500
    fitness: '#EF4444',    // red-500
  }

  function getSuggestedColorForBucket(name: string): string {
    const key = name?.toLowerCase?.().trim() || ''
    return SUGGESTED_BUCKET_COLOR_MAP[key] || '#6366F1'
  }

  const suggestedToShow = useMemo(
    () => SUGGESTED_BUCKETS.filter((name) => !buckets.includes(name)),
    [buckets]
  )

  // Preset color palette (hex) for bucket color selection
  const BUCKET_COLOR_PALETTE = [
    '#6366F1', // indigo-500
    '#22C55E', // green-500
    '#EF4444', // red-500
    '#F59E0B', // amber-500
    '#8B5CF6', // violet-500
    '#06B6D4', // cyan-500
    '#F43F5E', // rose-500
    '#0EA5E9', // sky-500
    '#10B981', // emerald-500
    '#EAB308', // yellow-500
    '#64748B', // slate-500
    '#A3A3A3', // neutral-400
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

  // Debug logging for bucket state
  useEffect(() => {
    console.log('🔍 DEBUG - Current buckets state:', buckets);
    console.log('🔍 DEBUG - Active bucket:', activeBucket);
    console.log('🔍 DEBUG - User:', user?.id);
    console.log('🔍 DEBUG - Is loading:', isLoading);
  }, [buckets, activeBucket, user, isLoading]);

  // Listen for bucket color changes
  useEffect(() => {
    const handleBucketColorsChanged = () => {
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
  const [shouldLoadNutritionWidget, setShouldLoadNutritionWidget] = useState(false);
  const [shouldLoadMedicationWidget, setShouldLoadMedicationWidget] = useState(false);
  const [shouldLoadExerciseWidget, setShouldLoadExerciseWidget] = useState(false);
  const [shouldLoadHomeProjectsWidget, setShouldLoadHomeProjectsWidget] = useState(false);
  const [chatBarReady, setChatBarReady] = useState(false);

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
  interface ProgressEntry { value:number; date:string; streak:number; lastCompleted:string; }
  const [progressByWidget, setProgressByWidget] = useState<Record<string, ProgressEntry>>({});

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
  const [fitbitData, setFitbitData] = useState<Record<string, number>>(()=>{
    if (typeof window !== 'undefined'){
      try{ const stored=localStorage.getItem('fitbit_metrics'); if(stored) return JSON.parse(stored);}catch(e){}
    }
    return {};
  });

  // Google Fit data state
  const [googleFitData, setGoogleFitData] = useState<Record<string, number>>(()=>{
    const stored = typeof window !== 'undefined' ? localStorage.getItem('googlefit_metrics') : null;
    return stored ? JSON.parse(stored) : {};
  });

  // Withings weight (kg)
  const [withingsData, setWithingsData] = useState<{ weightKg: number | null }>(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('withings_metrics') : null;
    return stored ? JSON.parse(stored) : { weightKg: null };
  });

  const [isLoadingFitbit, setIsLoadingFitbit] = useState(false);

  // Fetch Google Fit metrics on mount & when widgets change
  useEffect(() => {
    const widgets = Object.values(widgetsByBucketRef.current).flat();
    const needGF = widgets.some(
      (w) => ["water", "steps"].includes(w.id) && w.dataSource === "googlefit"
    );
    if (!needGF) return;

    let cancelled = false;
    async function fetchGF() {
      try {
        const res = await fetch(`/api/integrations/googlefit/metrics?cb=${Date.now()}`);
        if (!res.ok) return;
        const data = await res.json();
        const obj: Record<string, number> = {
          water: data.water || 0,
          steps: data.steps || 0,
        };
        if (cancelled) return;
        setGoogleFitData(obj);
        if (typeof window !== 'undefined') {
          localStorage.setItem('googlefit_metrics', JSON.stringify({ ...obj, savedAt: Date.now() }));
        }

        // Update progress for each Google Fit widget (only today)
        const todayStr = todayStrGlobal;
        const updated: Record<string, ProgressEntry> = { ...progressByWidgetRef.current };
        widgets.forEach((w) => {
          if (w.dataSource !== 'googlefit') return;
          const val = w.id === 'water' ? obj.water : obj.steps;
          const existing = updated[w.instanceId] ?? { value: 0, date: todayStr, streak: 0, lastCompleted: '' };
          if (existing.date !== todayStr) existing.value = 0;
          existing.value = val;
          updated[w.instanceId] = existing;
        });
        setProgressByWidget(updated);
      } catch (e) {
        console.error('Failed to fetch Google Fit metrics', e);
      }
    }
    fetchGF();
    const id = setInterval(fetchGF, 1000 * 60 * 15); // refresh every 15min
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [widgetsByBucketRef.current]);
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
  const [activeSubTab, setActiveSubTab] = useState<'Overview'|'Trends'|'Logs'|'Tasks'|'Settings'>('Overview');
  
  // Widget selection for filtering
  const [selectedLogsWidget, setSelectedLogsWidget] = useState<string | 'all'>('all');
  const [selectedSettingsWidget, setSelectedSettingsWidget] = useState<string | 'all'>('all');
  const activeWidgets = useMemo(() => getDisplayWidgets(activeBucket), [widgetsByBucket, activeBucket]);
  
  // Debounced persistence of bucket order to Supabase
  const debouncedSaveBucketsToSupabase = useRef(
    debounce(async (ordered: string[]) => {
      try {
        const prefs = await getUserPreferencesClient();
        if (prefs) {
          await saveUserPreferences({
            ...prefs,
            life_buckets: ordered,
          });
        }
      } catch (err) {
        console.error('Failed to save bucket order to Supabase', err);
      }
    }, 1500)
  ).current;

  const fetchIntegrationsData = useCallback( async () => {
    if (!user) return; // must be signed in to fetch integration data

    setIsRefreshing(true);

    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('todoist_all_tasks');
      }

      const refreshPromises: Promise<void>[] = [];

      refreshPromises.push((async () => {
        try {
          const tasksRes = await fetch(`/api/integrations/todoist/tasks?all=true&cb=${Date.now()}`);
          if (tasksRes.ok) {
            const taskData = await tasksRes.json();
            const allTasks: any[] = taskData.tasks || [];
            setAllTodoistTasks(allTasks);

            const iso = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2,'0')}-${String(selectedDate.getDate()).padStart(2,'0')}`;
            setTodoistTasks(allTasks.filter((t: any) => t.due?.date === iso));

            if (typeof window !== 'undefined') {
              localStorage.setItem('todoist_all_tasks', JSON.stringify({ tasks: allTasks, savedAt: Date.now() }));
            }
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
            if (typeof window !== "undefined") {
              localStorage.setItem(
                "fitbit_metrics",
                JSON.stringify({ ...obj, savedAt: Date.now() })
              );
            }

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

              if (typeof window !== "undefined") {
                try {
                  localStorage.setItem(
                    "widget_progress",
                    JSON.stringify(updatedProgress)
                  );
                } catch (e) {
                  console.error("Failed to persist widget progress", e);
                }
              }

              const {
                data: { user: currentUser },
              } = await supabase.auth.getUser();
              if (currentUser) {
                const rows = fitbitWidgets.map((w) => ({
                  user_id: currentUser.id,
                  widget_instance_id: w.instanceId,
                  date: todayStr,
                  value: w.id === "water" ? obj.water : obj.steps,
                }));

                if (rows.length) {
                  await supabase
                    .from("widget_progress_history")
                    .upsert(rows, {
                      onConflict: "user_id,widget_instance_id,date",
                    });

                  if (!fetchedYesterdayRef.current) {
                    fetchedYesterdayRef.current = true;
                    try {
                      const resY = await fetch(`/api/integrations/fitbit/metrics?date=${yesterdayStrGlobal}`);
                      if (resY.ok) {
                        const dataY = await resY.json();
                        const rowsY = fitbitWidgets.map((w) => ({
                          user_id: currentUser.id,
                          widget_instance_id: w.instanceId,
                          date: yesterdayStrGlobal,
                          value: w.id === "water" ? (dataY.water ?? 0) : (dataY.steps ?? 0),
                        }));
                        if (rowsY.length) {
                          await supabase
                            .from("widget_progress_history")
                            .upsert(rowsY, {
                              onConflict: "user_id,widget_instance_id,date",
                            });
                        }
                      }
                    } catch (errYesterday) {
                      console.error("Failed to backfill yesterday Fitbit history", errYesterday);
                    }
                  }
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
            if (typeof window !== 'undefined') {
              localStorage.setItem('withings_metrics', JSON.stringify({ weightKg: kg, savedAt: Date.now() }));
            }

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
          } catch (errW) {
            console.error('Error fetching Withings metrics', errW);
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
      const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
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
                const iso = `${dateForDaily.getFullYear()}-${String(dateForDaily.getMonth() + 1).padStart(2,'0')}-${String(dateForDaily.getDate()).padStart(2,'0')}`;
                setTodoistTasks(allTasks.filter((t: any) => t.due?.date === iso));
              }
              return; // fresh cache
            }
          }
        } catch {}
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
    console.log('🚀 DRAG EVENT DETECTED! handleDragEnd called');
    console.log('🎯 Drag end triggered:', {
      source: result.source,
      destination: result.destination,
      draggableId: result.draggableId
    });
    
    if (!result.destination) {
      console.log('❌ No destination, drag cancelled');
      return;
    }
    
    const { source, destination, draggableId } = result;
    
    // If dropped in the same list and at same index, do nothing
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) {
      console.log('↩️ Same position, no action needed');
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
      console.log('📅 Daily task ➜ Hour slot detected');
      // Daily ➜ Hour slot - schedule the task
      const moved = todoistTasks[source.index];
      if (!moved) {
        console.log('❌ No task found at source index');
        return;
      }

      const dstHour = hourKey(destination.droppableId);
      console.log(`🕰️ Scheduling task "${moved.content}" to ${dstHour}`);
      
      try {
        // Use batchUpdateTasks for optimistic updates
        await batchUpdateTasks([{
          taskId: draggableId,
          updates: { hourSlot: dstHour, duration: 60 }, // Default 60 minutes
          occurrenceDate: selectedDateStr,
        }]);
        
        console.log(`✅ Scheduled task "${moved.content}" to ${dstHour}`);
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
        
        console.log(`✅ Scheduled task "${moved.content}" from open list to ${dstHour}`);
      } catch (error) {
        console.error('Failed to schedule task from open list:', error);
      }
      return;
    }

    // Handle hour-to-hour moves (moving tasks between time slots)
    if (isHour(source.droppableId) && isHour(destination.droppableId)) {
      console.log('🕐 Hour ➜ Hour slot detected');
      const srcHour = hourKey(source.droppableId);
      const dstHour = hourKey(destination.droppableId);
      
      if (srcHour === dstHour) {
        console.log('↩️ Same hour slot, no action needed');
        return;
      }
      
      console.log(`🔄 Moving task from ${srcHour} to ${dstHour}`);
      
      try {
        // Use batchUpdateTasks for optimistic updates
        await batchUpdateTasks([{
          taskId: draggableId,
          updates: { hourSlot: dstHour },
          occurrenceDate: selectedDateStr,
        }]);
        
        console.log(`✅ Successfully moved task from ${srcHour} to ${dstHour}`);
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
      console.log('🔄 Upcoming task drag detected');
      
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
        console.log('❌ No task found in source group');
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
      console.log(`📅 Updating task "${movedTask.content}" due date to: ${newDueDate}`);
      
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
      console.log(`✅ Successfully moved task to ${destination.droppableId}`);
    }

    // Optionally you can refresh from server, but keeping as-is to avoid flicker
    // fetchTodoistTasks(selectedDate);
    // fetchAllTodoistTasks();
  };

  // modify useEffect to use fetchIntegrationsData
  // Run once immediately, then every 30 minutes to avoid Fitbit rate limits
  useEffect(() => {
    fetchIntegrationsData();
    const int = setInterval(fetchIntegrationsData, 30 * 60 * 1000); // 30 min
    return () => clearInterval(int);
  }, [fetchIntegrationsData]);

  // Fetch tasks whenever date changes (single consolidated request)
  useEffect(() => {
    fetchAllTodoistTasks(selectedDate);
  }, [selectedDate, fetchAllTodoistTasks]);

  // Load progress from localStorage or Supabase once on mount / user change
  useEffect(() => {
    async function loadProgress() {
      console.log('Loading progress...');
      let loaded = false;
      if (typeof window !== 'undefined') {
        const raw = localStorage.getItem('widget_progress');
        console.log('Raw localStorage progress:', raw);
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            console.log('Parsed localStorage progress:', parsed);
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
          console.log('User preferences:', prefs);
          if (prefs?.progress_by_widget) {
            console.log('Loading progress from Supabase:', prefs.progress_by_widget);
            setProgressByWidget(prefs.progress_by_widget as Record<string, ProgressEntry>);
            loaded = true;
          }
        } catch (err) {
          console.error('Failed to load progress from Supabase', err);
        }
      }
      
      if (!loaded) {
        console.log('No progress found in localStorage or Supabase');
      }
    }

    loadProgress();
  }, [user]);

  // Helper to get today string  
  const todayStrGlobal = new Date().toISOString().slice(0,10);

  const incrementProgress = async (w: WidgetInstance) => {
    console.log('incrementProgress called for widget:', w.instanceId);
    console.log('Current progressByWidget:', progressByWidget);
    
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
      console.log('New progress state:', newProgress);
      return newProgress;
    });

    // ---------------- Supabase history upsert ----------------
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser) {
        await supabase.from('widget_progress_history').upsert({
          user_id: currentUser.id,
          widget_instance_id: w.instanceId,
          date: todayStrGlobal,
          value: (progressByWidget[w.instanceId]?.value ?? 0) + 1,
        }, { onConflict: 'user_id,widget_instance_id,date' });
      }
    } catch (err) {
      console.error('Failed to upsert progress history', err);
    }
  };

  // Centralized function to save widgets, including to localStorage
  const saveWidgets = async (widgetsToSave: Record<string, WidgetInstance[]>, progressToSave?: Record<string, ProgressEntry>) => {
    // Always fetch the current user from Supabase to avoid race conditions
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) {
      console.log('User not logged in (supabase session missing), skipping save.');
      return;
    }
    console.log('*** SAVING WIDGETS ***');
    console.log('User:', currentUser.id);
    console.log('Widgets to save:', JSON.stringify(widgetsToSave, null, 2));

    // Save to localStorage immediately (no async needed)
    if (typeof window !== 'undefined') {
      const dataToSave = {
        widgets: widgetsToSave,
        savedAt: new Date().toISOString()
      };
      localStorage.setItem('widgets_by_bucket', JSON.stringify(dataToSave));
      console.log('Auto-saved to localStorage at:', dataToSave.savedAt);
      console.log('Total buckets:', Object.keys(widgetsToSave).length);
      Object.entries(widgetsToSave).forEach(([bucket, widgets]) => {
        console.log(`  Bucket "${bucket}": ${widgets.length} widgets`);
      });
      
      // Verify save by reading back
      const savedData = localStorage.getItem('widgets_by_bucket');
      const verified = JSON.parse(savedData!);
      console.log('Verified save - savedAt:', verified.savedAt);
    }
    
    // Save to Supabase
    try {
      const prefs = await getUserPreferencesClient();
      console.log('Current preferences before save:', prefs);
      if (prefs) {
        const savedPrefs = await saveUserPreferences({
          ...prefs,
          widgets_by_bucket: widgetsToSave,
          progress_by_widget: progressToSave || progressByWidgetRef.current, // Include current progress
        });
        console.log('Widgets saved to Supabase successfully:', savedPrefs);
      }
    } catch (err) {
      console.error('Failed to save widgets to preferences', err);
    }
  };

  // Create a debounced save that always uses the latest state from the ref
  const debouncedSaveToSupabase = useRef(
    debounce(() => {
      // Always use the latest state from the ref
      const latestWidgets = widgetsByBucketRef.current;
      const latestProgress = progressByWidgetRef.current;
      console.log('Debounced save executing with widgets:', latestWidgets);
      console.log('Debounced save executing with progress:', latestProgress);
      saveWidgets(latestWidgets, latestProgress);
    }, 2000)
  ).current;

  const handleSignOut = async () => {
    if (isSigningOut) return; // Prevent double-clicks
    setIsSigningOut(true);

    console.log('Client: Signing out via API...');
    try {
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
      const nextColors = { ...bucketColors, [name]: colorToUse } as Record<string,string>;
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
      // Notify other views (e.g., Calendar) that buckets changed
      window.dispatchEvent(new CustomEvent('lifeBucketsChanged'));
    }
    
    // Save to Supabase for persistence
    try {
      const prefs = await getUserPreferencesClient();
      if (prefs) {
        const mergedColors = { ...(prefs.bucket_colors || {}), [name]: colorToUse } as Record<string,string>;
        await saveUserPreferences({
          ...prefs,
          life_buckets: updated,
          bucket_colors: mergedColors,
        });
      }
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
      window.dispatchEvent(new CustomEvent('lifeBucketsChanged'));
    }
    try {
      const prefs = await getUserPreferencesClient();
      if (prefs) {
        // Auto-assign suggested color if missing
        const existing = (bucketColors[trimmed] || (prefs.bucket_colors || {})[trimmed]);
        const colorToUse = existing || getSuggestedColorForBucket(trimmed);
        const nextColors = { ...(prefs.bucket_colors || {}), [trimmed]: colorToUse } as Record<string,string>;
        setBucketColors(prev => ({ ...nextColors }));
        if (typeof window !== 'undefined') {
          localStorage.setItem('bucket_colors', JSON.stringify(nextColors));
        }
        // Broadcast
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('bucketColorsChanged'));
        }
        await saveUserPreferences({
          ...prefs,
          life_buckets: updated,
          bucket_colors: nextColors,
        });
      }
    } catch (err) {
      console.error('Failed to save buckets to Supabase:', err);
    }
  };

  const handleRemoveBucket = async (bucket: string) => {
    const updated = buckets.filter(b => b !== bucket);
    setBuckets(updated);
    if (activeBucket === bucket && updated.length) {
      setActiveBucket(updated[0]);
    } else if (!updated.length) {
      setActiveBucket('');
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem('life_buckets', JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent('lifeBucketsChanged'));
    }
    
    // Save to Supabase for persistence
    try {
      const prefs = await getUserPreferencesClient();
      if (prefs) {
        await saveUserPreferences({
          ...prefs,
          life_buckets: updated
        });
      }
    } catch (err) {
      console.error('Failed to save buckets to Supabase:', err);
    }
  };

  // Assign / update a color for a given bucket and persist
  const handleBucketColorChange = async (bucket: string, colorHex: string) => {
    setBucketColors(prev => ({ ...prev, [bucket]: colorHex }));

    try {
      const prefs = await getUserPreferencesClient();
      if (prefs) {
        const nextColors = { ...(prefs.bucket_colors || {}), [bucket]: colorHex } as Record<string, string>;
        await saveUserPreferences({
          ...prefs,
          bucket_colors: nextColors,
        });
        // Persist locally as well
        if (typeof window !== 'undefined') {
          localStorage.setItem('bucket_colors', JSON.stringify(nextColors));
        }
        // Notify any listeners that colors changed
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('bucketColorsChanged'));
        }
      }
    } catch (err) {
      console.error('Failed to save bucket color to Supabase:', err);
    }
  };

  async function loadWidgets() {
    console.log('*** LOADING WIDGETS ***');
    console.log('Current user:', user?.id);
    console.log('Current buckets:', buckets);
    
    setIsWidgetLoadComplete(false);
    
    // First try to load from localStorage for immediate display
    let loadedFromLocal = false;
    let localWidgets = {};
    
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('widgets_by_bucket');
        console.log('Raw localStorage data:', stored);
        
        if (stored) {
          const parsed = JSON.parse(stored);
          
          // Handle both old format (direct widgets) and new format (with metadata)
          if (parsed.widgets && parsed.savedAt) {
            console.log('Found new format data, saved at:', parsed.savedAt);
            localWidgets = parsed.widgets;
          } else {
            console.log('Found old format data');
            localWidgets = parsed;
          }
          
          console.log('Found widgets in localStorage:', localWidgets);
          console.log('Widget keys:', Object.keys(localWidgets));
          
          // Count widgets per bucket
          Object.entries(localWidgets).forEach(([bucket, widgets]) => {
            console.log(`Bucket "${bucket}" has ${(widgets as any[]).length} widgets`);
          });
          
          setWidgetsByBucket(localWidgets);
          loadedFromLocal = true;
        } else {
          console.log('No widgets found in localStorage');
        }
      } catch(e) {
        console.error('Failed to parse stored widgets', e);
      }
    }
    
    // Always try to load from Supabase (source of truth)
    try {
      const prefs = await getUserPreferencesClient();
      console.log('User preferences from Supabase:', prefs);
      
      if (prefs?.widgets_by_bucket && Object.keys(prefs.widgets_by_bucket).length > 0) {
        console.log('Loading widgets from Supabase:', prefs.widgets_by_bucket);
        console.log('Current buckets available:', buckets);
        
        const supabaseWidgetsStr = JSON.stringify(prefs.widgets_by_bucket);
        const localWidgetsStr = JSON.stringify(localWidgets);
        const dataIsDifferent = supabaseWidgetsStr !== localWidgetsStr;
        
        console.log('Data is different:', dataIsDifferent);
        
        if (dataIsDifferent) {
          console.log('Supabase widgets differ from localStorage, updating state...');
          
          // Migrate existing widgets to match current templates
          const migratedWidgets = migrateWidgetsToTemplates(prefs.widgets_by_bucket);
          setWidgetsByBucket(migratedWidgets);
          
          // --- NEW: ensure bucket list includes any bucket keys from widgets ---
          const widgetBuckets = Object.keys(prefs.widgets_by_bucket);
          setBuckets(prev => {
            const merged = Array.from(new Set([...prev, ...widgetBuckets]));
            if (merged.length !== prev.length) {
              console.log('Adding buckets from widgets to bucket list:', merged);
              // Persist merged buckets to localStorage
              if (typeof window !== 'undefined') {
                localStorage.setItem('life_buckets', JSON.stringify(merged));
              }
              // Persist merged buckets to Supabase
              saveUserPreferences({
                ...prefs,
                life_buckets: merged
              });
            }
            return merged;
          });
          
          if (typeof window !== 'undefined') {
            localStorage.setItem('widgets_by_bucket', supabaseWidgetsStr);
            console.log('Updated localStorage with Supabase data');
          }
        } else {
          console.log('Supabase and localStorage widgets are the same');
        }
      } else if (loadedFromLocal && Object.keys(localWidgets).length > 0) {
        console.log('No widgets in Supabase but found in localStorage, saving to Supabase...');
        
        // Migrate local widgets before saving to Supabase
        const migratedLocalWidgets = migrateWidgetsToTemplates(localWidgets);
        setWidgetsByBucket(migratedLocalWidgets);
        
        if (prefs) {
          await saveUserPreferences({
            ...prefs,
            widgets_by_bucket: migratedLocalWidgets
          });
        }
      } else {
        console.log('No widgets found in either Supabase or localStorage');
      }
    } catch (err) {
      console.error('Failed to load widgets from preferences', err);
    } finally {
      console.log('Widget load complete');
      setIsWidgetLoadComplete(true);
    }
  }

  // Auth state change listener
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user }, error }) => {
      console.log('Client auth check:', { user: user?.id, error });
      setUser(user);
      // Mark auth as initialized after the initial getUser resolves
      setAuthInitialized(true);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state change:', event, { user: session?.user?.id });
      setUser(session?.user ?? null);
      // Ensure we mark initialized when we receive any auth event
      setAuthInitialized(true);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Effect for user state changes (login/logout)
  useEffect(() => {
    // Do not act until the initial auth status has been determined
    if (!authInitialized) return;

    if (user) {
      console.log('User detected, loading dashboard data...');
      loadBuckets({ fetchFromSupabase: true });
      loadWidgets();
      ensureUserOnboarded();
    } else {
      console.log('No authenticated user yet; loading dashboard state from local cache');
      loadBuckets({ fetchFromSupabase: false });
    }
  }, [user, authInitialized]);

  // Save widgets whenever they change
  useEffect(() => {
    if (!isWidgetLoadComplete || !user) {
      console.log('Skipping save - load not complete or no user', { isWidgetLoadComplete, user: !!user });
      return; // Don't save on initial load or if logged out
    }
    
    console.log('Widget save effect triggered');
    console.log('Current widgets:', JSON.stringify(widgetsByBucket, null, 2));
    
    // Save to localStorage immediately
    if (typeof window !== 'undefined') {
      const dataToSave = {
        widgets: widgetsByBucket,
        savedAt: new Date().toISOString()
      };
      localStorage.setItem('widgets_by_bucket', JSON.stringify(dataToSave));
      console.log('Auto-saved to localStorage at:', dataToSave.savedAt);
      console.log('Total buckets:', Object.keys(widgetsByBucket).length);
      Object.entries(widgetsByBucket).forEach(([bucket, widgets]) => {
        console.log(`  Bucket "${bucket}": ${widgets.length} widgets`);
      });
      
      // Verify save by reading back
      const savedData = localStorage.getItem('widgets_by_bucket');
      const verified = JSON.parse(savedData!);
      console.log('Verified save - savedAt:', verified.savedAt);
    }
    
    // Debounce the Supabase save
    debouncedSaveToSupabase();
  }, [widgetsByBucket, isWidgetLoadComplete, user, debouncedSaveToSupabase]);

  // Save progress whenever it changes
  useEffect(() => {
    if (!isWidgetLoadComplete || !user) {
      console.log('Skipping progress save - load not complete or no user', { isWidgetLoadComplete, user: !!user });
      return; // Avoid saving before initial load or when logged out
    }

    console.log('Progress save effect triggered');

    // Persist to localStorage immediately for fast reloads
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('widget_progress', JSON.stringify(progressByWidget));
        console.log('Progress auto-saved to localStorage');
      } catch (e) {
        console.error('Failed to persist widget progress', e);
      }
    }

    // Debounce Supabase save (re-use existing debounced function)
    debouncedSaveToSupabase();
  }, [progressByWidget, isWidgetLoadComplete, user, debouncedSaveToSupabase]);

  async function loadBuckets(options?: { fetchFromSupabase?: boolean }) {
    const shouldFetchFromSupabase = options?.fetchFromSupabase ?? true;
    console.log('[Buckets] loadBuckets start', {
      bucketsState: buckets,
      activeBucketState: activeBucket,
      shouldFetchFromSupabase,
    });
    let loadedFromLocal = false;
    let localBuckets: string[] = [];
    let localBucketColors: Record<string, string> | null = null;
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('life_buckets');
        if (stored) {
          const parsed: string[] = JSON.parse(stored);
          console.log('[Buckets] Parsed localStorage value', parsed);
          if (Array.isArray(parsed) && parsed.length) {
            localBuckets = parsed;
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
      } catch(e) {
        console.error('Failed to parse stored buckets', e);
      }
    }

    try {
      if (!shouldFetchFromSupabase) {
        console.log('[Buckets] Skipping Supabase fetch (no authenticated user yet)');
        return;
      }

      console.log('[Buckets] Attempting to load from Supabase');
      const prefs = await getUserPreferencesClient();
      console.log('[Buckets] Supabase preferences response', {
        lifeBuckets: prefs?.life_buckets,
        bucketColors: prefs?.bucket_colors,
      });
      if (prefs && prefs.life_buckets && prefs.life_buckets.length) {
        // If we already loaded buckets from localStorage, prefer them to avoid flicker
        if (!loadedFromLocal) {
          console.log('[Buckets] Loading buckets from Supabase');
          setBuckets(prefs.life_buckets);
          const localSaved = typeof window !== 'undefined' ? localStorage.getItem('active_bucket') : null;
          const initialActive = localSaved && prefs.life_buckets.includes(localSaved) ? localSaved : prefs.life_buckets[0];
          console.log('[Buckets] Setting active bucket to', initialActive);
          setActiveBucket(initialActive);
        }
        // Apply colors from Supabase only if non-empty to avoid wiping out locally cached colors
        const serverColors = prefs.bucket_colors || {};
        if (serverColors && Object.keys(serverColors).length > 0) {
          setBucketColors(serverColors);
          if (typeof window !== 'undefined') {
            localStorage.setItem('bucket_colors', JSON.stringify(serverColors));
          }
        }
        // If we have locally cached buckets that aren't yet on the server, merge and persist them
        if (loadedFromLocal && localBuckets.length) {
          const union = Array.from(new Set([...(prefs.life_buckets ?? []), ...localBuckets]));
          if (union.length !== prefs.life_buckets.length) {
            setBuckets(union);
            const active = (typeof window !== 'undefined' ? localStorage.getItem('active_bucket') : null) || union[0];
            setActiveBucket(union.includes(active || '') ? (active as string) : union[0]);
            if (typeof window !== 'undefined') {
              localStorage.setItem('life_buckets', JSON.stringify(union));
              window.dispatchEvent(new CustomEvent('lifeBucketsChanged'));
            }
            const mergedColors = {
              ...(prefs.bucket_colors || {}),
              ...(localBucketColors || {}),
            } as Record<string, string>;
            await saveUserPreferences({
              ...prefs,
              life_buckets: union,
              bucket_colors: mergedColors,
            });
          }
        }
      } else {
        if (loadedFromLocal && localBuckets.length) {
          console.log('No buckets found on server, preserving locally cached buckets');
          if (prefs) {
            const mergedColors = {
              ...(prefs.bucket_colors || {}),
              ...(localBucketColors || {}),
            } as Record<string, string>;
            await saveUserPreferences({
              ...prefs,
              life_buckets: localBuckets,
              bucket_colors: mergedColors,
            });
          }
        } else {
          // If no buckets found anywhere, set default buckets
          console.log('No buckets found locally or on server, setting defaults');
          const defaultBuckets = ['Health', 'Work', 'Personal', 'Finance'];
          setBuckets(defaultBuckets);
          // Assign default colors for defaults if none exist
          const defaultColors: Record<string, string> = Object.fromEntries(
            defaultBuckets.map((n) => [n, getSuggestedColorForBucket(n)])
          );
          setBucketColors(defaultColors);
          const savedActive = typeof window !== 'undefined' ? localStorage.getItem('active_bucket') : null;
          setActiveBucket(savedActive && defaultBuckets.includes(savedActive) ? savedActive : defaultBuckets[0]);
          
          // Save the default buckets
          if (typeof window !== 'undefined') {
            localStorage.setItem('life_buckets', JSON.stringify(defaultBuckets));
            localStorage.setItem('bucket_colors', JSON.stringify(defaultColors));
            // Broadcast so any open views refresh colors
            window.dispatchEvent(new CustomEvent('bucketColorsChanged'));
          }
          
          // Save to Supabase
          if (prefs) {
            await saveUserPreferences({
              ...prefs,
              life_buckets: defaultBuckets,
              bucket_colors: { ...(prefs.bucket_colors || {}), ...defaultColors },
            });
          }
        }
      }
    } catch (err) {
      console.error('Failed to load preferences', err);
      // Set defaults on error too
      const defaultBuckets = ['Health', 'Work', 'Personal', 'Finance'];
      setBuckets(defaultBuckets);
      const savedActive = typeof window !== 'undefined' ? localStorage.getItem('active_bucket') : null;
      setActiveBucket(savedActive && defaultBuckets.includes(savedActive) ? savedActive : defaultBuckets[0]);
    } finally {
      console.log('[Buckets] loadBuckets finished', {
        bucketsAfter: buckets,
        localBuckets,
        activeBucketAfter: activeBucket,
        loadedFromLocal,
      });
      setBucketsInitialized(true);
    }
  }

  // Safety net: if a user has preferences but somehow their onboarded flag
  // wasn't set, update it to prevent getting stuck in onboarding loop
  async function ensureUserOnboarded() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('onboarded')
        .eq('id', user.id)
        .single();
      
      // If user has buckets but onboarded flag is false, fix it
      const prefs = await getUserPreferencesClient();
      if (prefs?.life_buckets?.length && profile && profile.onboarded === false) {
        console.log('User has preferences but onboarded=false, fixing...');
        await supabase
          .from('profiles')
          .update({ onboarded: true })
          .eq('id', user.id);
      }
    } catch (err) {
      console.error('Error in ensureUserOnboarded:', err);
    }
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
    console.log('Cleaning up debug widgets...');
    const cleaned: Record<string, WidgetInstance[]> = {};
    
    Object.entries(widgetsByBucket).forEach(([bucket, widgets]) => {
      cleaned[bucket] = widgets.filter(w => !w.instanceId?.startsWith('debug-'));
    });
    
    setWidgetsByBucket(cleaned);
    await saveWidgets(cleaned);
    console.log('Debug widgets cleaned up');
  };

  // Filter out debug widgets when displaying
  function getDisplayWidgets(bucket: string) {
    const widgets = widgetsByBucket[bucket] ?? [];
    return widgets.filter((w) => !w.instanceId?.startsWith('debug-'));
  }

  const handleSaveWidget = (updated: WidgetInstance) => {
    if (!editingBucket) return;
    setWidgetsByBucket(prev => {
      const updatedState = { ...prev };
      updatedState[editingBucket] = (updatedState[editingBucket] ?? []).map(w =>
        w.instanceId === updated.instanceId ? updated : w
      );
      // persist
      if (typeof window !== 'undefined') {
        localStorage.setItem('widgets_by_bucket', JSON.stringify({ widgets: updatedState, savedAt: new Date().toISOString() }));
      }
      return updatedState;
    });
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
    console.log('🔄 Creating daily task:', newDailyTask, 'for date:', selectedDateStr);
    try {
      await contextCreateTask(newDailyTask, selectedDateStr);
      console.log('✅ Daily task created successfully');
      setNewDailyTask('');
    } catch (error) {
      console.error('❌ Failed to create daily task:', error);
    }
  };

  const handleAddOpenTask = async () => {
    console.log('🔄 Creating open task:', newOpenTask);
    try {
      await contextCreateTask(newOpenTask, null);
      console.log('✅ Open task created successfully');
      setNewOpenTask('');
    } catch (error) {
      console.error('❌ Failed to create open task:', error);
    }
  };

  // Fetch current weather using browser geolocation and open-meteo API (no key required)
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
            if ([1,2].includes(c)) return iconMap.partly;
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

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        fetchWeather(pos.coords.latitude, pos.coords.longitude);
      },
      () => {
        // fallback: New York City
        fetchWeather(40.7128, -74.006);
      }
    );
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
    if (taskView !== 'Today' || isPlannerCollapsed) return;
    const container = plannerRef.current;
    if (!container) return;
    const target = container.querySelector<HTMLElement>(`[data-hour='${currentHourDisplay}']`);
    if (target) {
      container.scrollTop = target.offsetTop - container.offsetTop;
    }
  }, [currentHourDisplay, taskView, isPlannerCollapsed]);

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
        const prefs = await getUserPreferencesClient();
        if (prefs) {
          await saveUserPreferences({ ...prefs, hourly_plan: JSON.parse(localStorage.getItem(localStorageKey) || '{}') });
          console.log('✅ Hourly plan synced to Supabase');
        }
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
              console.log('✅ Loaded hourly plan from Supabase for', dateKey);
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
              console.log('✅ Loaded hourly plan from localStorage for', dateKey);
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
          console.log('No saved hourly plan found for', dateKey);
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

  // Helpers for droppable id parsing
  const isHour = (id: string) => id.startsWith('hour-');
  const hourKey = (id: string) => id.replace('hour-', '');

  // Add the convertWidgetToTask function after the createTask function (around line 1480)
  const convertWidgetToTask = async (widget: WidgetInstance) => {
    // Create a task content string from the widget
    const taskContent = `${widget.name}: ${widget.target} ${widget.unit}`;
    
    // Create a task for today
    await contextCreateTask(taskContent, selectedDateStr);
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

    // 1️⃣  Archive in Supabase (fire-and-forget)
    (async () => {

      try {
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (!currentUser) return;
        const rows = toArchive.map(([instanceId, entry]) => ({
          user_id: currentUser.id,
          widget_instance_id: instanceId,
          date: entry.date,
          value: entry.value,
        }));
        await supabase
          .from('widget_progress_history')
          .upsert(rows, { onConflict: 'user_id,widget_instance_id,date' });
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
    <div className="flex-1 relative min-h-screen overflow-hidden">
        {/* Background Image Layer */}
        <div className="absolute inset-0 w-full h-full -z-10 pointer-events-none">
          <img 
            src="/images/background.png" 
            alt="dashboard background" 
            className="w-full h-full object-cover object-center" 
          />
          <div className="absolute inset-0 bg-gradient-to-br from-white/50 via-white/25 to-white/10"></div>
          <div className="absolute inset-0 bg-gradient-to-t from-white/30 via-transparent to-transparent"></div>
          <div className="absolute inset-0 bg-gradient-to-br from-theme-primary-500/5 via-transparent to-transparent"></div>
        </div>
        
        {/* Main wrapper: no styling, acts purely as a container */}
        <div className="relative z-10 flex flex-col">

          {/* Greeting */}
          <section className="w-full mb-4">
            <h1 className="text-xl font-semibold text-gray-900 mb-1">
              Hello <span className="text-theme-primary-600">Dalit</span>
            </h1>
            <p className="text-sm text-gray-600">You've got this! Let's make today productive.</p>
          </section>
          
          {/* Bucket tabs row (scrollable) */}
          <div
            className="relative z-10 mt-6 transition-all duration-300 ease-in-out"
            style={{ width: '100%' }}
          >
            <div className="flex items-start overflow-x-auto pt-1 no-scrollbar" ref={tabsScrollRef}>
              {bucketsInitialized && buckets.length === 0 && (
                <div className="flex h-[48px] items-center justify-between gap-3 rounded-t-[16px] border border-dashed border-gray-300 bg-white/70 px-4 text-sm text-gray-500">
                  <span>No tabs yet. Click + to add your first bucket.</span>
                </div>
              )}
              {bucketsInitialized && buckets.length > 0 && buckets.map((b, idx) => (
                <button
                  key={b}
                  draggable
                  onDragStart={() => setDragIndex(idx)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (dragIndex === null || dragIndex === idx) return;
                    // reorder
                    const updated = [...buckets];
                    const [moved] = updated.splice(dragIndex, 1);
                    updated.splice(idx, 0, moved);
                    setBuckets(updated);
                    setDragIndex(idx);
                    // Persist reordering to localStorage & Supabase
                    if (typeof window !== 'undefined') {
                      localStorage.setItem('life_buckets', JSON.stringify(updated));
                    }
                    debouncedSaveBucketsToSupabase(updated);
                  }}
                  onDragEnd={() => setDragIndex(null)}
                  onClick={() => setActiveBucket(b)}
                  style={{
                    // Active tab always highest; otherwise cascade left-over-right
                    zIndex: b === activeBucket ? 50 : 9 - idx,
                    marginRight: '-10px',
                    backgroundColor: b === activeBucket ? getBucketColor(b) : getLighterColor(getBucketColor(b), 0.85),
                    borderColor: b === activeBucket ? getBucketColor(b) : getLighterColor(getBucketColor(b), 0.6),
                    color: b === activeBucket ? 'white' : '#374151'
                  }}
                  className={`relative flex h-[48px] items-center justify-center whitespace-nowrap rounded-t-[16px] px-4 sm:px-6 text-[14px] font-semibold capitalize transition-all duration-300 border-2 ${
                    b === activeBucket
                      ? 'scale-[1.02] shadow-lg text-white'
                      : 'hover:scale-[1.01] shadow-none'
                  }`}
                  onMouseEnter={(e) => {
                    if (b !== activeBucket) {
                      e.currentTarget.style.backgroundColor = getLighterColor(getBucketColor(b), 0.7)
                      e.currentTarget.style.borderColor = getLighterColor(getBucketColor(b), 0.4)
                      e.currentTarget.style.color = '#1F2937'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (b !== activeBucket) {
                      e.currentTarget.style.backgroundColor = getLighterColor(getBucketColor(b), 0.85)
                      e.currentTarget.style.borderColor = getLighterColor(getBucketColor(b), 0.6)
                      e.currentTarget.style.color = '#374151'
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
                  marginRight: '-10px'
                }}
                className="relative flex h-[48px] items-center justify-center rounded-t-[16px] bg-white px-6 sm:px-8 text-[18px] font-bold transition-all duration-300 hover:bg-white hover:border-theme-primary-500/30 border border-gray-100 shadow-none"
              >
                <span className="text-theme-primary-600">
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
        <div className="w-full flex-1 pb-24">
          {/* Left section: tabs and widgets */}
          <div className="flex-1 w-full">
            {/* Content container: white widget box with subtle shadow */}
            <div className="relative z-10 -mt-px flex h-full flex-col overflow-hidden rounded-b-2xl border border-gray-100 bg-white shadow-sm">
              {/* Inner nav */}
              <nav className="flex items-center gap-4 sm:gap-8 border-b border-white/20 px-4 sm:px-6 pt-3 sm:pt-4 text-sm font-semibold">
                {(['Overview','Trends','Logs','Tasks','Settings'] as const).map((item) => (
                  <button
                    key={item}
                    onClick={() => setActiveSubTab(item)}
                    className={`pb-3 border-b-2 transition-all duration-300 ${
                      item === activeSubTab
                        ? 'border-theme-primary-500 text-theme-primary-600 font-bold'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-theme-primary-300/50'
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </nav>

              {/* Content area */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                {/* Overview Tab */}
                <div className={activeSubTab === 'Overview' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 auto-rows-fr' : 'hidden'}>
                  {/* Refresh card */}
                  {activeWidgets.length > 0 && (
                    <div
                      onClick={isRefreshing ? undefined : fetchIntegrationsData}
                      className="rounded-2xl border border-white/40 bg-white/80 backdrop-blur-md p-5 shadow-[0_8px_32px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_48px_rgba(0,0,0,0.12)] relative cursor-pointer hover:bg-white/95 hover:border-theme-primary-500/30 transition-all duration-500 hover:scale-[1.02]"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-theme-primary-500/90 shadow-sm">
                          {isRefreshing ? (
                            <Loader2 className="h-5 w-5 animate-spin text-white" />
                          ) : (
                            <RotateCw className="h-5 w-5 text-white" />
                          )}
                        </div>
                        <span className="text-sm font-medium truncate">Refresh</span>
                      </div>
                      <p className="mt-2 text-xs text-gray-500 truncate">Sync integrations</p>
                      {/* Invisible progress bar placeholder to equalize height */}
                      <div className="mt-3 h-1 bg-transparent" />
                    </div>
                  )}

                  {/* Widget cards */}
                  {activeWidgets.map((w) => {
                    // Determine today's progress value and percentage towards target
                    let todayVal = 0;
                    let isFitbitData = false;
                    let isGoogleFitData = false;
                    
                    if (w.id === 'water' && w.dataSource === 'fitbit' && fitbitData.water !== undefined) {
                      todayVal = fitbitData.water;
                      isFitbitData = true;
                    } else if (w.id === 'steps' && w.dataSource === 'fitbit' && fitbitData.steps !== undefined) {
                      todayVal = fitbitData.steps;
                      isFitbitData = true;
                    } else if (w.id === 'water' && w.dataSource === 'googlefit' && googleFitData.water !== undefined) {
                      todayVal = googleFitData.water;
                      isGoogleFitData = true;
                    } else if (w.id === 'steps' && w.dataSource === 'googlefit' && googleFitData.steps !== undefined) {
                      todayVal = googleFitData.steps;
                      isGoogleFitData = true;
                    } else {
                      // Use manual progress tracking
                      const prog = progressByWidget[w.instanceId];
                      todayVal = prog && prog.date === todayStrGlobal ? prog.value : 0;
                    }
                    
                    const pct = Math.min(100, Math.round((todayVal / w.target) * 100));
                    const goalMet = pct >= 100;

                    // Background tint (5% opacity of widget color) when goal met
                    const bgTintClasses: Record<string,string> = {
                      blue:'bg-blue-500/5', green:'bg-green-500/5', red:'bg-red-500/5', orange:'bg-orange-500/5', purple:'bg-purple-500/5', indigo:'bg-indigo-500/5', amber:'bg-amber-500/5', teal:'bg-teal-500/5', rose:'bg-rose-500/5', cyan:'bg-cyan-500/5', yellow:'bg-yellow-500/5', sky:'bg-sky-500/5', emerald:'bg-emerald-500/5', violet:'bg-violet-500/5', lime:'bg-lime-500/5', fuchsia:'bg-fuchsia-500/5', gray:'bg-gray-500/5', slate:'bg-slate-500/5', stone:'bg-stone-500/5'
                    };
                    const widgetColor = w.color || getTemplateColor(w.id) || 'gray';
                    const cardBgClass = goalMet ? (bgTintClasses[widgetColor] ?? 'bg-gray-100/60') : 'bg-white/80';

                    return (
                      <div key={w.instanceId} className={`rounded-2xl border border-white/40 ${cardBgClass} backdrop-blur-md p-5 shadow-[0_8px_32px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_48px_rgba(0,0,0,0.12)] relative group cursor-pointer hover:border-theme-primary-500/30 transition-all duration-500 hover:scale-[1.02] min-w-0`} onClick={() => { 
                        if (w.id === 'nutrition') {
                          // For nutrition widget, show a modal with the full FatSecret widget
                          setNutritionWidgetOpen(true);
                        } else if (w.id === 'medication') {
                          // For medication widget, show a modal with the full medication tracker
                          setMedicationWidgetOpen(true);
                        } else if (w.id === 'exercise') {
                          // For exercise widget, show a modal with the enhanced exercise tracker
                          setExerciseWidgetOpen(true);
                        } else if (w.id === 'home_projects') {
                          // For home projects widget, show a modal with the comprehensive project manager
                          setHomeProjectsWidgetOpen(true);
                        } else {
                          setEditingWidget(w); setEditingBucket(activeBucket); setNewlyCreatedWidgetId(null);
                        }
                      }}>
                        <div className="flex absolute top-1 right-1 gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {/* Edit button for nutrition widget */}
                          {w.id === 'nutrition' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingWidget(w); 
                                setEditingBucket(activeBucket); 
                                setNewlyCreatedWidgetId(null);
                              }}
                              className="rounded-full bg-green-100 hover:bg-green-200 p-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-green-500 transition"
                              aria-label="Edit widget settings"
                              title="Edit settings"
                            >
                              <SettingsIcon className="h-3 w-3 text-green-600" />
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              convertWidgetToTask(w);
                            }}
                            className="rounded-full bg-theme-primary-100 hover:bg-theme-primary-200 p-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-theme-primary-500 transition"
                            aria-label="Convert to task"
                            title="Convert to task"
                          >
                            <ListChecks className="h-3 w-3 text-theme-primary-600" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              console.log('Deleting widget:', w.instanceId);
                              // Use callback pattern to ensure we're working with the latest state
                              setWidgetsByBucket(prevWidgets => {
                                const updatedWidgets = { ...prevWidgets };
                                updatedWidgets[activeBucket] = (updatedWidgets[activeBucket] ?? []).filter(widget => widget.instanceId !== w.instanceId);
                                
                                console.log('Widget deleted from bucket:', activeBucket);
                                console.log('Remaining widgets in bucket:', updatedWidgets[activeBucket]?.length || 0);
                                console.log('Full updated state:', JSON.stringify(updatedWidgets, null, 2));
                                
                                // Also update the ref immediately
                                widgetsByBucketRef.current = updatedWidgets;
                                
                                // Force immediate save to localStorage
                                if (typeof window !== 'undefined') {
                                  const dataToSave = {
                                    widgets: updatedWidgets,
                                    savedAt: new Date().toISOString()
                                  };
                                  localStorage.setItem('widgets_by_bucket', JSON.stringify(dataToSave));
                                  console.log('Deletion saved to localStorage at:', dataToSave.savedAt);
                                }
                                
                                return updatedWidgets;
                              });
                            }}
                            className="rounded-full bg-red-100 hover:bg-red-200 p-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-red-500 transition"
                            aria-label="Delete widget"
                            title="Delete widget"
                          >
                            <X className="h-3 w-3 text-red-600" />
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          {(() => {
                            let IconComponent: any = null;
                            // If icon is stored as a string (its name), resolve via map
                            if (typeof w.icon === 'string') {
                              const key = w.icon.replace(/^Lucide/, '');
                              IconComponent = getIconComponent(key) || getIconComponent(w.icon);
                            }
                            // If icon is a function (React component), use directly
                            else if (typeof w.icon === 'function') {
                              IconComponent = w.icon;
                            }

                            // Handle cases where icon became a plain object `{}` after JSON serialization
                            if (!IconComponent || typeof IconComponent !== 'function') {
                              IconComponent = getIconComponent(w.id);
                            }
                            if (!IconComponent) return <div className="h-5 w-5 bg-gray-300 rounded" />;

                            // Get color - fallback to widget template default if not set
                            const widgetColor = w.color || getTemplateColor(w.id) || 'gray';

                            return (
                              <div
                                className={`w-9 h-9 rounded-lg flex items-center justify-center shadow-sm ${BG_COLOR_CLASSES[widgetColor] ?? 'bg-gray-500'}`}
                              >
                                <IconComponent className="h-5 w-5 text-white" />
                              </div>
                            );
                          })()}
                          {w.id === 'birthdays' && w.birthdayData && w.birthdayData.friendName ? (
                            <span className="text-sm font-medium truncate">{w.birthdayData.friendName}</span>
                          ) : w.id === 'social_events' && w.eventData ? (
                            <span className="text-sm font-medium truncate">{w.eventData.eventName}</span>
                          ) : w.id === 'holidays' && w.holidayData && w.holidayData.holidayName ? (
                            <span className="text-sm font-medium truncate">{w.holidayData.holidayName}</span>
                          ) : w.id === 'quit_habit' && w.quitHabitData && w.quitHabitData.habitName ? (
                             <span className="text-sm font-medium truncate">{w.quitHabitData.habitName}</span>
                           ) : (
                             <span className="text-sm font-medium truncate">{w.name}</span>
                          )}
                        </div>

                        {(() => {
                          // Special handling for birthday widgets
                          if (w.id === 'birthdays') {
                            if (w.birthdayData && w.birthdayData.birthDate) {
                              const birthDate = new Date(w.birthdayData.birthDate);
                              const today = new Date();
                              const currentYear = today.getFullYear();
                              
                              // Create this year's birthday
                              const thisYearBirthday = new Date(currentYear, birthDate.getMonth(), birthDate.getDate());
                              
                              // If birthday already passed this year, show next year's
                              const nextBirthday = thisYearBirthday < today 
                                ? new Date(currentYear + 1, birthDate.getMonth(), birthDate.getDate())
                                : thisYearBirthday;
                              
                              // Calculate days until birthday
                              const daysUntil = Math.ceil((nextBirthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                              
                              return (
                                <div className="mt-2">
                                  <div className="text-xs text-gray-500">
                                    {birthDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                                  </div>
                                  <div className="text-xs text-gray-600 mt-1">
                                    {daysUntil === 0 ? '🎉 Today!' : 
                                     daysUntil === 1 ? '🎂 Tomorrow' : 
                                     `🗓️ ${daysUntil} days`}
                                  </div>
                                </div>
                              );
                            } else {
                              return (
                                <div className="mt-2 text-xs text-gray-500">
                                  Click to add birthday details
                                </div>
                              );
                            }
                          }
                          
                          // Special handling for events widgets
                          if (w.id === 'social_events') {
                            if (w.eventData && w.eventData.eventDate) {
                              const eventDate = new Date(w.eventData.eventDate);
                              const today = new Date();
                              const daysUntil = Math.ceil((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                              
                              return (
                                <div className="mt-2">
                                  {w.eventData.description && (
                                    <div className="text-xs text-gray-600">
                                      {w.eventData.description}
                                    </div>
                                  )}
                                  <div className="text-xs text-gray-500">
                                    {eventDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                                  </div>
                                  <div className="text-xs text-gray-600 mt-1">
                                    {daysUntil === 0 ? '🎉 Today!' : 
                                     daysUntil === 1 ? '📅 Tomorrow' : 
                                     daysUntil < 0 ? '✅ Past event' :
                                     `📆 ${daysUntil} days`}
                                  </div>
                                </div>
                              );
                            } else {
                              return (
                                <div className="mt-2 text-xs text-gray-500">
                                  Click to add event details
                                </div>
                              );
                            }
                          }
                          
                          // Special handling for holidays widgets  
                          if (w.id === 'holidays') {
                            if (w.holidayData && w.holidayData.holidayDate) {
                              const holidayDate = new Date(w.holidayData.holidayDate);
                              const today = new Date();
                              const currentYear = today.getFullYear();
                              
                              // Create this year's holiday
                              const thisYearHoliday = new Date(currentYear, holidayDate.getMonth(), holidayDate.getDate());
                              
                              // If holiday already passed this year, show next year's
                              const nextHoliday = thisYearHoliday < today 
                                ? new Date(currentYear + 1, holidayDate.getMonth(), holidayDate.getDate())
                                : thisYearHoliday;
                                
                              const daysUntil = Math.ceil((nextHoliday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                              
                              return (
                                <div className="mt-2">
                                  <div className="text-xs text-gray-500">
                                    {holidayDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                                  </div>
                                  <div className="text-xs text-gray-600 mt-1">
                                    {daysUntil === 0 ? '🎄 Today!' : 
                                     daysUntil === 1 ? '🎁 Tomorrow' : 
                                     `🗓️ ${daysUntil} days`}
                                  </div>
                                </div>
                              );
                            } else {
                              return (
                                <div className="mt-2 text-xs text-gray-500">
                                  Click to add holiday details
                                </div>
                              );
                            }
                          }
                          
                          // Special handling for mood tracker widget
                          if (w.id === 'mood') {
                            const moodEmojis = ['😢', '😕', '😐', '😊', '😁'];
                            const moodLabels = ['Very Poor', 'Poor', 'Neutral', 'Good', 'Excellent'];
                            
                            if (w.moodData?.currentMood) {
                              const moodIndex = w.moodData.currentMood - 1;
                              const emoji = moodEmojis[moodIndex];
                              const label = moodLabels[moodIndex];
                              
                              return (
                                <div className="mt-3">
                                  <div className="flex items-center gap-2">
                                    <span className="text-2xl">{emoji}</span>
                                    <div>
                                      <div className="text-sm font-medium text-gray-900">{label}</div>
                                      <div className="text-xs text-gray-500">Today's mood</div>
                                    </div>
                                  </div>
                                  {w.moodData.moodNote && (
                                    <div className="text-xs text-gray-600 mt-2 italic">
                                      "{w.moodData.moodNote}"
                                    </div>
                                  )}
                                  <div className="flex gap-1 mt-2">
                                    {moodEmojis.map((emoji, index) => (
                                      <span 
                                        key={index} 
                                        className={`text-xs ${index === moodIndex ? 'opacity-100' : 'opacity-30'}`}
                                      >
                                        {emoji}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              );
                            } else {
                              return (
                                <div className="mt-3">
                                  <div className="text-center">
                                    <div className="text-2xl mb-2">😐</div>
                                    <div className="text-xs text-gray-500">Tap to log mood</div>
                                  </div>
                                  <div className="flex gap-1 mt-2 justify-center">
                                    {moodEmojis.map((emoji, index) => (
                                      <span key={index} className="text-xs opacity-50">{emoji}</span>
                                    ))}
                                  </div>
                                </div>
                              );
                            }
                          }
                          
                          // Special handling for journal widget
                          if (w.id === 'journal') {
                            const today = new Date().toISOString().split('T')[0];
                            const hasEntryToday = w.journalData?.lastEntryDate === today;
                            const entryPreview = w.journalData?.todaysEntry ? 
                              w.journalData.todaysEntry.substring(0, 100) + (w.journalData.todaysEntry.length > 100 ? '...' : '') : '';
                            
                            if (hasEntryToday && w.journalData?.todaysEntry) {
                              const wordCount = w.journalData.todaysEntry.split(' ').filter(word => word.length > 0).length;
                              
                              return (
                                <div className="mt-3">
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className="text-lg">📖</span>
                                    <div>
                                      <div className="text-sm font-medium text-gray-900">Today's Entry</div>
                                      <div className="text-xs text-gray-500">{wordCount} words</div>
                                    </div>
                                  </div>
                                  <div className="text-xs text-gray-700 italic bg-gray-50 p-2 rounded">
                                    "{entryPreview}"
                                  </div>
                                  {w.journalData.entryCount && w.journalData.entryCount > 1 && (
                                    <div className="text-xs text-gray-500 mt-2">
                                      📚 {w.journalData.entryCount} total entries
                                    </div>
                                  )}
                                </div>
                              );
                            } else {
                              const prompts = [
                                "What are you grateful for today?",
                                "How are you feeling right now?", 
                                "What did you learn today?",
                                "What's on your mind?",
                                "Describe your day in three words."
                              ];
                              const randomPrompt = prompts[Math.floor(Math.random() * prompts.length)];
                              
                              return (
                                <div className="mt-3">
                                  <div className="text-center">
                                    <div className="text-2xl mb-2">📝</div>
                                    <div className="text-xs text-gray-500 mb-2">No entry today</div>
                                    <div className="text-xs text-gray-600 italic px-2">
                                      "{randomPrompt}"
                                    </div>
                                    {w.journalData?.entryCount && (
                                      <div className="text-xs text-gray-500 mt-2">
                                        📚 {w.journalData.entryCount} total entries
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            }
                          }
                          
                          // Special handling for quit habit tracker widget
                          if (w.id === 'quit_habit') {
                            if (w.quitHabitData && w.quitHabitData.habitName && w.quitHabitData.quitDate) {
                              const quitDate = new Date(w.quitHabitData.quitDate);
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
                              const latestMilestone = achieved.length ? achieved[achieved.length - 1] : null;

                              return (
                                <div className="mt-3 space-y-2">
                                  <div className="flex items-center gap-2 text-xs">
                                    <span className="text-sm">🚫</span>
                                    <span className="font-medium text-gray-700">
                                      Quitting {w.quitHabitData.habitName}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 text-xs text-gray-600">
                                    <span className="text-sm">📅</span>
                                    <span>Since {quitDate.toLocaleDateString()}</span>
                                  </div>
                                  <div className="flex items-baseline gap-1">
                                    <span className="text-2xl font-bold text-green-600">{daysSince}</span>
                                    <span className="text-sm text-green-600 font-medium">days clean</span>
                                  </div>
                                  {w.quitHabitData.costPerDay && w.quitHabitData.costPerDay > 0 && (
                                    <div className="flex items-center gap-2 text-xs text-gray-600">
                                      <span className="text-sm">💰</span>
                                      <span>
                                        Daily savings: {w.quitHabitData.currency || '$'}{w.quitHabitData.costPerDay.toFixed(2)}
                                      </span>
                                    </div>
                                  )}
                                  {latestMilestone && (
                                    <div className="flex items-center gap-2 text-xs">
                                      <span className="text-sm">{latestMilestone.emoji}</span>
                                      <span className="text-amber-600 font-medium">{latestMilestone.label}</span>
                                    </div>
                                  )}
                                </div>
                              );
                            } else {
                              return (
                                <div className="mt-3 text-xs text-gray-500 text-center">
                                  Click to set up habit tracking
                                </div>
                              );
                            }
                          }

                          // Special handling for gratitude journal widget
                          if (w.id === 'gratitude') {
                            const today = new Date().toISOString().split('T')[0];
                            const hasEntryToday = w.gratitudeData?.lastEntryDate === today;
                            
                            if (hasEntryToday && w.gratitudeData?.gratitudeItems?.length) {
                              return (
                                <div className="mt-3">
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className="text-lg">✨</span>
                                    <div>
                                      <div className="text-sm font-medium text-gray-900">Today's Gratitude</div>
                                      <div className="text-xs text-gray-500">{w.gratitudeData.gratitudeItems.length} items</div>
                                    </div>
                                  </div>
                                  <div className="space-y-1">
                                    {w.gratitudeData.gratitudeItems.slice(0, 2).map((item, index) => (
                                      <div key={index} className="text-xs text-gray-700 flex items-start gap-1">
                                        <span className="text-yellow-500 mt-0.5">•</span>
                                        <span className="italic">"{item}"</span>
                                      </div>
                                    ))}
                                    {w.gratitudeData.gratitudeItems.length > 2 && (
                                      <div className="text-xs text-gray-500">
                                        +{w.gratitudeData.gratitudeItems.length - 2} more...
                                      </div>
                                    )}
                                  </div>
                                  {w.gratitudeData.entryCount && w.gratitudeData.entryCount > 1 && (
                                    <div className="text-xs text-gray-500 mt-2">
                                      🙏 {w.gratitudeData.entryCount} grateful days
                                    </div>
                                  )}
                                </div>
                              );
                            } else {
                              return (
                                <div className="mt-3">
                                  <div className="text-center">
                                    <div className="text-2xl mb-2">🙏</div>
                                    <div className="text-xs text-gray-500 mb-2">What are you grateful for?</div>
                                    <div className="text-xs text-gray-600 italic">
                                      Tap to add today's gratitude
                                    </div>
                                    {w.gratitudeData?.entryCount && (
                                      <div className="text-xs text-gray-500 mt-2">
                                        🙏 {w.gratitudeData.entryCount} grateful days
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            }
                          }
                          
                          // Special handling for weight tracking widget
                          if (w.id === 'weight') {
                            if (w.weightData && w.weightData.currentWeight !== undefined) {
                              return (
                                <div className="mt-3 space-y-1">
                                  {/* Current weight */}
                                  <div className="flex items-center gap-1">
                                    <span className="text-xs">⚖️</span>
                                    <p className="text-xs font-medium text-gray-700">Current Weight</p>
                                  </div>
                                  <p className="text-lg font-bold text-purple-600">
                                    {w.weightData.currentWeight} {w.weightData.unit || w.unit || 'lbs'}
                                  </p>

                                  {/* Change from starting weight */}
                                  {w.weightData.startingWeight !== undefined && (
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs">📈</span>
                                      <p
                                        className={`text-xs ${w.weightData.currentWeight < w.weightData.startingWeight ? 'text-green-600' : w.weightData.currentWeight > w.weightData.startingWeight ? 'text-orange-600' : 'text-gray-600'}`}
                                      >
                                        {w.weightData.currentWeight < w.weightData.startingWeight ? 'Lost' : w.weightData.currentWeight > w.weightData.startingWeight ? 'Gained' : 'No change'}: {Math.abs(w.weightData.currentWeight - w.weightData.startingWeight).toFixed(1)} {w.weightData.unit || w.unit || 'lbs'}
                                      </p>
                                    </div>
                                  )}

                                  {/* Goal weight */}
                                  {w.weightData.goalWeight !== undefined && (
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs">🎯</span>
                                      <p className="text-xs text-blue-600">
                                        Goal: {w.weightData.goalWeight} {w.weightData.unit || w.unit || 'lbs'}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              );
                            }
                            return (
                              <div className="mt-3 text-xs text-gray-500 text-center">
                                Click to set up weight tracking
                              </div>
                            );
                          }

                          // Special handling for nutrition widget
                          if (w.id === 'nutrition') {
                            return (
                              <div className="mt-3">
                                <NutritionSummaryWidget 
                                  variant="embedded"
                                  className="p-0"
                                />
                              </div>
                            );
                          }

                          // Special handling for exercise widget
                          if (w.id === 'exercise') {
                            return (
                              <div className="mt-3 text-center">
                                <div className="text-2xl mb-2">💪</div>
                                <div className="text-xs text-gray-600 mb-1">Exercise Tracker</div>
                                <div className="text-xs text-gray-500">
                                  Track workouts & goals
                                </div>
                              </div>
                            );
                          }

                          // Special handling for home projects widget
                          if (w.id === 'home_projects') {
                            const projects = w.homeProjectsData?.projects || [];
                            const activeProjects = projects.filter(p => p.status === 'active' || p.status === 'planning');
                            const urgentProjects = projects.filter(p => 
                              (p.priority === 'critical' || p.priority === 'high') && 
                              p.status !== 'completed'
                            );
                            const completedProjects = projects.filter(p => p.status === 'completed');
                            const completionRate = projects.length > 0 ? Math.round((completedProjects.length / projects.length) * 100) : 0;

                            if (projects.length === 0) {
                              return (
                                <div className="mt-3 text-center">
                                  <div className="text-2xl mb-2">🔨</div>
                                  <div className="text-xs text-gray-600 mb-1">Home Projects</div>
                                  <div className="text-xs text-gray-500">
                                    Track household tasks & improvements
                                  </div>
                                </div>
                              );
                            }

                            // Find next priority project
                            const sortedActive = activeProjects.sort((a, b) => {
                              const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
                              return priorityOrder[a.priority] - priorityOrder[b.priority];
                            });
                            const nextProject = sortedActive[0];

                            return (
                              <div className="mt-3 space-y-2">
                                {/* Stats */}
                                <div className="grid grid-cols-3 gap-2 text-center">
                                  <div>
                                    <div className="text-sm font-semibold text-gray-900">{activeProjects.length}</div>
                                    <div className="text-xs text-gray-500">Active</div>
                                  </div>
                                  <div>
                                    <div className="text-sm font-semibold text-red-600">{urgentProjects.length}</div>
                                    <div className="text-xs text-gray-500">Urgent</div>
                                  </div>
                                  <div>
                                    <div className="text-sm font-semibold text-green-600">{completionRate}%</div>
                                    <div className="text-xs text-gray-500">Done</div>
                                  </div>
                                </div>
                                
                                {/* Next priority project */}
                                {nextProject && (
                                  <div className="border-t border-gray-100 pt-2">
                                    <div className="text-xs text-gray-600 mb-1">Next Priority:</div>
                                    <div className="flex items-center gap-1">
                                      <span className={`w-2 h-2 rounded-full ${nextProject.priority === 'critical' ? 'bg-red-500' : nextProject.priority === 'high' ? 'bg-orange-500' : nextProject.priority === 'medium' ? 'bg-blue-500' : 'bg-gray-400'}`}></span>
                                      <span className="text-xs font-medium text-gray-900 truncate">{nextProject.title}</span>
                                    </div>
                                    {nextProject.room && (
                                      <div className="text-xs text-gray-500 capitalize mt-1">📍 {nextProject.room}</div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          }

                          // Regular progress bar for other widgets
                          const pct = Math.min(100, Math.round((todayVal / w.target) * 100));
                          const prog = progressByWidget[w.instanceId];
                           
                          return (
                            <div className="mt-2 mb-1">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="text-lg font-bold text-gray-900">
                                    {todayVal}
                                  </span>
                                  <span className="text-sm text-gray-500">
                                    / {w.target}
                                  </span>
                                </div>
                                {prog?.streak >= 2 && (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                                    🔥 {prog.streak}
                                  </span>
                                )}
                              </div>
                              <div className="w-full bg-gray-100 rounded-full h-1 mt-2">
                                <div className={`h-1 rounded-full transition-all duration-300 ${BG_COLOR_CLASSES[widgetColor] ?? 'bg-theme-primary-500'}`} style={{ width: `${pct}%` }} />
                              </div>
                              {(w.dataSource === 'fitbit' || w.dataSource === 'googlefit') && (
                                <div className="text-right mt-1 mb-1">
                                  {w.dataSource === 'fitbit' && <span className="text-xs text-blue-500">Fitbit</span>}
                                  {w.dataSource === 'googlefit' && <span className="text-xs text-green-600">Google Fit</span>}
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {!( ['water','steps'].includes(w.id) && (w.dataSource === 'fitbit' || w.dataSource === 'googlefit')) && !['birthdays', 'social_events', 'holidays', 'mood', 'journal', 'gratitude', 'weight', 'exercise', 'nutrition', 'medication'].includes(w.id) && (
                          <button
                            aria-label="Add one"
                            onClick={(e) => {
                              e.stopPropagation();
                              incrementProgress(w);
                            }}
                            className={`absolute bottom-2 right-2 text-xl font-bold leading-none ${TEXT_COLOR_CLASSES[widgetColor] ?? 'text-theme-primary-600'} hover:scale-110 transition-transform`}
                          >
                            +
                          </button>
                        )}
                      </div>
                    );
                  })}

                  {/* Add Widget card */}
                  <div className="rounded-2xl border border-white/40 bg-white/80 backdrop-blur-md p-4 shadow-[0_8px_32px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_48px_rgba(0,0,0,0.12)] flex flex-col items-center gap-3 cursor-pointer hover:bg-white/95 hover:border-theme-primary-500/30 transition-all duration-500 hover:scale-[1.02] min-w-0" onClick={() => setIsWidgetSheetOpen(true)}>
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-theme-primary-500/10">
                      <Plus className="h-6 w-6 text-theme-primary-600" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-gray-800">Add Widget</p>
                      <p className="text-xs text-gray-500">Track your stats</p>
                    </div>
                  </div>
                </div>

                {activeSubTab === 'Trends' && (
                  <TrendsPanel 
                    widgets={activeWidgets} 
                    bucketName={activeBucket}
                  />
                )}

                {activeSubTab === 'Tasks' && (
                  <div>
                    {/* Enhanced Empty State */}
                    {!activeBucket || buckets.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 px-4">
                        <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-6">
                          <ListChecks className="h-10 w-10 text-blue-600" />
                        </div>
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">
                          Organize Your Tasks
                        </h3>
                        <p className="text-sm text-gray-500 text-center max-w-md mb-6">
                          Connect your Todoist account to sync tasks automatically, or start adding tasks manually. 
                          Keep everything organized by bucket.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-3">
                          <button 
                            onClick={() => window.location.href = '/integrations'}
                            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors flex items-center gap-2"
                          >
                            <Zap className="h-5 w-5" />
                            Connect Todoist
                          </button>
                          <button 
                            onClick={() => setIsEditorOpen(true)}
                            className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                          >
                            Create a Bucket First
                          </button>
                        </div>
                        
                        {/* Feature highlights */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-12 max-w-3xl">
                          <div className="text-center p-4">
                            <Calendar className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                            <h4 className="font-medium text-gray-900 mb-1">Due Dates</h4>
                            <p className="text-xs text-gray-500">Schedule tasks with smart date parsing</p>
                          </div>
                          <div className="text-center p-4">
                            <Flag className="h-8 w-8 text-orange-600 mx-auto mb-2" />
                            <h4 className="font-medium text-gray-900 mb-1">Priorities</h4>
                            <p className="text-xs text-gray-500">Mark critical tasks to focus on what matters</p>
                          </div>
                          <div className="text-center p-4">
                            <Target className="h-8 w-8 text-green-600 mx-auto mb-2" />
                            <h4 className="font-medium text-gray-900 mb-1">Bucket Tags</h4>
                            <p className="text-xs text-gray-500">Auto-tag tasks with your current bucket</p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <TasksProvider selectedDate={new Date()}>
                        <EnhancedTasksView
                          activeBucket={activeBucket}
                          buckets={buckets}
                        />
                      </TasksProvider>
                    )}
                  </div>
                )}

                {activeSubTab === 'Logs' && (
                  <div>
                    {/* Logs Header with Widget Selector */}
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-xl font-semibold">Widget Logs</h2>
                      <WidgetSelector
                        widgets={activeWidgets}
                        selectedWidget={selectedLogsWidget}
                        onWidgetChange={setSelectedLogsWidget}
                        showAllOption={true}
                        className="w-48"
                      />
                    </div>
                    
                    {/* Logs Content */}
                    <div className="space-y-4">
                      {activeWidgets.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                          <p>No widgets available to show logs for.</p>
                          <p className="text-sm mt-2">Add some widgets to see their activity logs here.</p>
                        </div>
                      ) : (
                        <div className="bg-white rounded-lg border border-gray-200 p-6">
                          <h3 className="text-lg font-medium mb-4">
                            {selectedLogsWidget === 'all' ? 'All Widget Activity' : 
                             `${activeWidgets.find(w => w.instanceId === selectedLogsWidget)?.name || 'Widget'} Activity`}
                          </h3>
                          <div className="space-y-3">
                            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded">
                              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                              <div className="flex-1">
                                <p className="text-sm font-medium">Widget data updated</p>
                                <p className="text-xs text-gray-500">2 minutes ago</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded">
                              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                              <div className="flex-1">
                                <p className="text-sm font-medium">Progress updated</p>
                                <p className="text-xs text-gray-500">15 minutes ago</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded">
                              <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                              <div className="flex-1">
                                <p className="text-sm font-medium">Goal target reached</p>
                                <p className="text-xs text-gray-500">1 hour ago</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeSubTab === 'Settings' && (
                  <div>
                    {/* Settings Header with Widget Selector */}
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-xl font-semibold">Widget Settings</h2>
                      <WidgetSelector
                        widgets={activeWidgets}
                        selectedWidget={selectedSettingsWidget}
                        onWidgetChange={setSelectedSettingsWidget}
                        showAllOption={true}
                        className="w-48"
                      />
                    </div>
                    
                    {/* Settings Content */}
                    <div className="space-y-6">
                      {activeWidgets.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                          <p>No widgets available to configure.</p>
                          <p className="text-sm mt-2">Add some widgets to manage their settings here.</p>
                        </div>
                      ) : (
                        <div className="grid gap-6">
                          {(selectedSettingsWidget === 'all' ? activeWidgets : activeWidgets.filter(w => w.instanceId === selectedSettingsWidget)).map((widget) => (
                            <div key={widget.instanceId} className="bg-white rounded-lg border border-gray-200 p-6">
                              <div className="flex items-center gap-3 mb-4">
                                <span className="text-2xl">{typeof widget.icon === 'string' ? widget.icon : '📊'}</span>
                                <div>
                                  <h3 className="text-lg font-medium">{widget.name}</h3>
                                  <p className="text-sm text-gray-500">Widget ID: {widget.id}</p>
                                </div>
                              </div>
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-2">Target</label>
                                  <input 
                                    type="number" 
                                    value={widget.target || 0}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    readOnly
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
                                  <div className="flex items-center gap-2">
                                    <div className={`w-6 h-6 rounded ${BG_COLOR_CLASSES[widget.color || 'indigo']}`}></div>
                                    <span className="text-sm text-gray-600">{widget.color || 'indigo'}</span>
                                  </div>
                                </div>
                                {widget.dataSource && (
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Data Source</label>
                                    <span className="text-sm text-gray-600 capitalize">{widget.dataSource}</span>
                                  </div>
                                )}
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-2">Created</label>
                                  <span className="text-sm text-gray-600">
                                    {new Date().toLocaleDateString()}
                                  </span>
                                </div>
                              </div>
                              
                              <div className="mt-4 pt-4 border-t border-gray-200">
                                <button 
                                  onClick={() => {
                                    setEditingWidget(widget);
                                    setIsWidgetSheetOpen(true);
                                  }}
                                  className="px-4 py-2 bg-theme-primary-500 text-white rounded-md hover:bg-theme-primary-500/90 focus:outline-none focus:ring-2 focus:ring-theme-primary-500 mr-2"
                                >
                                  Edit Widget
                                </button>
                                <button 
                                  onClick={() => {
                                    setWidgetsByBucket(prev => {
                                      const updated = { ...prev };
                                      Object.keys(updated).forEach(bucket => {
                                        updated[bucket] = updated[bucket].filter(w => w.instanceId !== widget.instanceId);
                                      });
                                      return updated;
                                    });
                                  }}
                                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                                >
                                  Remove Widget
                                </button>
                              </div>
                            </div>
                          ))}
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
          />
        )}

        {/* Widget library sheet */}
        <Sheet open={isWidgetSheetOpen} onOpenChange={setIsWidgetSheetOpen}>
          <SheetContent
            side={isMobileView ? 'bottom' : 'right'}
            className={`w-full sm:w-[800px] max-w-full p-0 sm:p-6 flex flex-col ${isMobileView ? 'max-h-[90vh]' : ''}`}
          >
            <SheetHeader
              className={`px-4 pt-6 pb-4 sm:px-0 sm:pt-0 sm:pb-6 border-b border-gray-200 sm:border-none ${isMobileView ? 'sticky top-0 z-10 bg-white/95 backdrop-blur' : ''}`}
            >
              <SheetTitle>Add a Widget</SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto px-4 pb-8 sm:px-0 sm:pb-0">
              <WidgetLibrary
                bucket={activeBucket}
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

                  setWidgetsByBucket(prev => {
                    const updated = { ...prev };
                    updated[activeBucket] = [...(updated[activeBucket] ?? []), newInstance];
                    // update ref immediately so debounced save reads latest
                    widgetsByBucketRef.current = updated;
                    return updated;
                  });

                  // Open editor for the newly added widget for quick tweaks
                  setEditingBucket(activeBucket);
                  setEditingWidget(newInstance);
                  setNewlyCreatedWidgetId(newInstance.instanceId);

                  // Persist
                  debouncedSaveToSupabase();
                  setIsWidgetSheetOpen(false);
                }}
              />
            </div>
          </SheetContent>
        </Sheet>

        {/* Bucket editor: add/remove tabs */}
        <Sheet open={isEditorOpen} onOpenChange={setIsEditorOpen}>
          <SheetContent side="right" className="w-full sm:w-[520px] md:w-[560px] overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="text-gray-900">Manage Tabs</SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Add a new tab</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Tab name (e.g., Side Projects)"
                    value={newBucket}
                    onChange={(e) => setNewBucket(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddBucket()}
                    className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  />
                  <button
                    onClick={handleAddBucket}
                    disabled={!newBucket.trim() || buckets.includes(newBucket.trim())}
                    className="px-3 py-2 text-sm rounded-md bg-theme-primary-500 text-white hover:bg-theme-primary-600 disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>
              </div>

              <div>
                <div className="text-sm font-medium text-gray-700 mb-2">Suggested tabs</div>
                <div className="flex flex-wrap gap-2">
                  {suggestedToShow.length > 0 ? (
                    suggestedToShow.map((name) => (
                      <button
                        key={name}
                        onClick={() => handleAddBucketQuick(name)}
                        className="px-3 py-1.5 rounded-full border border-gray-200 text-sm hover:bg-gray-50 active:bg-gray-100"
                        aria-label={`Add ${name} tab`}
                      >
                        {name}
                      </button>
                    ))
                  ) : (
                    <div className="text-xs text-gray-500">All suggested tabs are already added</div>
                  )}
                </div>
              </div>

              <div>
                <div className="text-sm font-medium text-gray-700 mb-2">Existing tabs</div>
                <ul className="divide-y divide-gray-200 rounded-md border border-gray-200 overflow-hidden">
                  {buckets.map((b) => (
                    <li key={b} className="px-3 py-3 bg-white">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className="inline-block w-4 h-4 rounded-full border border-gray-200"
                            style={{ backgroundColor: getBucketColor(b) }}
                            aria-hidden
                          />
                          <span className={`truncate text-sm ${b === activeBucket ? 'font-semibold text-theme-primary-600' : 'text-gray-700'}`}>{b}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleRemoveBucket(b)}
                            className="text-xs px-2 py-1 rounded-md border border-red-200 text-red-600 hover:bg-red-50"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                      {/* Custom color picker only (auto-assigned initially) */}
                      <div className="mt-3 flex items-center justify-end gap-3">
                        <label className="flex items-center gap-2 text-xs text-gray-500">
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
                    <li className="px-3 py-6 text-sm text-gray-500 text-center">No tabs yet</li>
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
              <SheetTitle className="text-gray-900">Daily Nutrition Tracker</SheetTitle>
            </SheetHeader>
            <div className="mt-6">
              { (nutritionWidgetOpen || shouldLoadNutritionWidget) && (
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
              <SheetTitle className="text-gray-900">Medication Tracker</SheetTitle>
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
              <SheetTitle className="text-indigo-950">Exercise Tracker</SheetTitle>
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
              <SheetTitle className="text-indigo-950">Home Projects</SheetTitle>
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
                    onUpdate={() => {}}
                  />
                ) : <Skeleton className="h-24 w-full" />
              )}
            </div>
          </SheetContent>
        </Sheet>
        </div>
        {chatBarReady && <ChatBarLazy />}
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
