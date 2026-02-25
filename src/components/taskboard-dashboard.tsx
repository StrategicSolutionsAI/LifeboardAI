"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import type { User } from "@supabase/supabase-js";

import Image from "next/image";
import Link from "next/link";
import { supabase } from "@/utils/supabase/client";
import { getUserPreferencesClient, saveUserPreferences } from "@/lib/user-preferences";
import { invalidateTaskCaches } from "@/hooks/use-data-cache";
import { format, addDays, isSameDay, parseISO, formatDistanceToNow } from 'date-fns';
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
  Pencil,
  Check,
  GripVertical,
} from "lucide-react";
import { widgetTemplates } from "./widget-library";
import type { WidgetTemplate, WidgetInstance } from "@/types/widgets";
import type { Task, RepeatOption } from "@/hooks/use-tasks";
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
import { TasksProvider, useTasksContext } from '@/contexts/tasks-context';
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

type ProfileNameRow = {
  first_name?: string | null;
};

const extractFirstWord = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const [first] = trimmed.split(/\s+/);
  return first || null;
};

const deriveGreetingName = (profile: ProfileNameRow | null, supabaseUser: User | null): string => {
  if (!supabaseUser) {
    return "there";
  }

  const metadata = (supabaseUser.user_metadata ?? {}) as Record<string, unknown>;
  const candidates: unknown[] = [
    profile?.first_name,
    metadata.preferred_name,
    metadata.first_name,
    metadata.given_name,
    metadata.nickname,
    metadata.name,
    metadata.full_name,
    metadata.user_name,
    metadata.username,
  ];

  for (const candidate of candidates) {
    const extracted = extractFirstWord(candidate);
    if (extracted) {
      return extracted;
    }
  }

  if (typeof supabaseUser.email === "string" && supabaseUser.email.includes("@")) {
    const [localPart] = supabaseUser.email.split("@");
    if (localPart) {
      return localPart;
    }
  }

  return "there";
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
const BG_COLOR_CLASSES: Record<string, string> = {
  blue: 'bg-warm-500', green: 'bg-green-500', red: 'bg-red-500', orange: 'bg-orange-500', purple: 'bg-amber-500', indigo: 'bg-warm-500', amber: 'bg-amber-500', teal: 'bg-teal-500', rose: 'bg-rose-500', cyan: 'bg-cyan-500', yellow: 'bg-yellow-500', sky: 'bg-sky-500', emerald: 'bg-emerald-500', violet: 'bg-violet-500', lime: 'bg-lime-500', fuchsia: 'bg-fuchsia-500', gray: 'bg-[#b8b0a8]', slate: 'bg-slate-500', stone: 'bg-stone-500'
};

// Text color classes to match widget icon color (500 tone)
const TEXT_COLOR_CLASSES: Record<string, string> = {
  blue: 'text-warm-500', green: 'text-green-500', red: 'text-red-500', orange: 'text-orange-500', purple: 'text-amber-500', indigo: 'text-warm-500', amber: 'text-amber-500', teal: 'text-teal-500', rose: 'text-rose-500', cyan: 'text-cyan-500', yellow: 'text-yellow-500', sky: 'text-sky-500', emerald: 'text-emerald-500', violet: 'text-violet-500', lime: 'text-lime-500', fuchsia: 'text-fuchsia-500', gray: 'text-[#8e99a8]', slate: 'text-slate-500', stone: 'text-stone-500'
};

const WIDGET_COLOR_OPTIONS = Object.keys(BG_COLOR_CLASSES);

const LOG_KIND_DOT_CLASS: Record<WidgetLogEntry["kind"], string> = {
  progress: "bg-warm-500",
  integration: "bg-emerald-500",
  entry: "bg-violet-500",
  task: "bg-amber-500",
  system: "bg-[#b8b0a8]",
};

interface WidgetLogEntry {
  id: string;
  widgetInstanceId: string;
  widgetName: string;
  message: string;
  details?: string;
  occurredAt: string;
  kind: "progress" | "integration" | "entry" | "task" | "system";
}

interface DestructiveConfirmState {
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => Promise<void> | void;
}

interface UndoState {
  id: number;
  message: string;
  onUndo: () => Promise<void> | void;
}

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

  return migratedWidgets;
}

// Inner component that uses TasksContext
function TaskBoardDashboardInner({ selectedDate, setSelectedDate }: { selectedDate: Date; setSelectedDate: (date: Date) => void }) {
  // Access tasks context for all task operations
  const { scheduledTasks, dailyVisibleTasks: contextDailyTasks, batchUpdateTasks, deleteTask, createTask: contextCreateTask, allTasks, toggleTaskCompletion: toggleTaskCompletionContext } = useTasksContext();

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
  const [editingBucketName, setEditingBucketName] = useState<string | null>(null);
  const [editingBucketNewName, setEditingBucketNewName] = useState("");
  const [draggedBucketIndex, setDraggedBucketIndex] = useState<number | null>(null);
  const [isWidgetSheetOpen, setIsWidgetSheetOpen] = useState(false);
  const [widgetsByBucket, setWidgetsByBucket] = useState<Record<string, WidgetInstance[]>>({});
  const bucketsRef = useRef<string[]>([]);
  const dragIndexRef = useRef<number | null>(null);
  const manageDragIndexRef = useRef<number | null>(null);
  const fetchedYesterdayRef = useRef(false);
  const [weather, setWeather] = useState<{ icon: LucideIcon; temp: number } | null>(null);

  const [isWidgetLoadComplete, setIsWidgetLoadComplete] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [greetingName, setGreetingName] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
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
    work: '#B1916A',       // indigo-500
    personal: '#8B5CF6',   // violet-500
    projects: '#0EA5E9',   // sky-500
    home: '#64748B',       // slate-500
    finance: '#EAB308',    // yellow-500
    fitness: '#EF4444',    // red-500
  }

  function getSuggestedColorForBucket(name: string): string {
    const key = name?.toLowerCase?.().trim() || ''
    return SUGGESTED_BUCKET_COLOR_MAP[key] || '#B1916A'
  }

  const suggestedToShow = useMemo(
    () => SUGGESTED_BUCKETS.filter((name) => !buckets.includes(name)),
    [buckets]
  )

  // Preset color palette (hex) for bucket color selection
  const BUCKET_COLOR_PALETTE = [
    '#B1916A', // indigo-500
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
  const [shouldLoadNutritionWidget, setShouldLoadNutritionWidget] = useState(false);
  const [shouldLoadMedicationWidget, setShouldLoadMedicationWidget] = useState(false);
  const [shouldLoadExerciseWidget, setShouldLoadExerciseWidget] = useState(false);
  const [shouldLoadHomeProjectsWidget, setShouldLoadHomeProjectsWidget] = useState(false);
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
      const { data, error } = await supabase
        .from("widget_progress_history")
        .select("widget_instance_id,date,value,created_at")
        .in("widget_instance_id", widgetIds)
        .order("date", { ascending: false })
        .limit(200);

      if (error) {
        throw error;
      }

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

            const iso = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
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
            if (typeof window !== 'undefined') {
              localStorage.setItem('googlefit_metrics', JSON.stringify({ ...obj, savedAt: Date.now() }));
            }

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

              if (typeof window !== "undefined") {
                try {
                  localStorage.setItem("widget_progress", JSON.stringify(updatedProgress));
                } catch (e) {
                  console.error("Failed to persist widget progress", e);
                }
              }

              const { data: { user: currentUser } } = await supabase.auth.getUser();
              if (currentUser) {
                const rows = googleFitWidgets.map((w) => ({
                  user_id: currentUser.id,
                  widget_instance_id: w.instanceId,
                  date: todayStr,
                  value: w.id === "water" ? obj.water : obj.steps,
                }));

                if (rows.length) {
                  await supabase.from("widget_progress_history").upsert(rows, {
                    onConflict: "user_id,widget_instance_id,date",
                  });
                }
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
      return;
    }

    // Save to localStorage immediately (no async needed)
    if (typeof window !== 'undefined') {
      const dataToSave = {
        widgets: widgetsToSave,
        savedAt: new Date().toISOString()
      };
      localStorage.setItem('widgets_by_bucket', JSON.stringify(dataToSave));
      Object.entries(widgetsToSave).forEach(([bucket, widgets]) => {
      });

      // Verify save by reading back
      const savedData = localStorage.getItem('widgets_by_bucket');
      const verified = JSON.parse(savedData!);
    }

    // Save to Supabase
    try {
      const prefs = await getUserPreferencesClient();
      if (prefs) {
        const savedPrefs = await saveUserPreferences({
          ...prefs,
          widgets_by_bucket: widgetsToSave,
          progress_by_widget: progressToSave || progressByWidgetRef.current, // Include current progress
        });
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
      saveWidgets(latestWidgets, latestProgress);
    }, 2000)
  ).current;

  const handleSignOut = async () => {
    if (isSigningOut) return; // Prevent double-clicks
    setIsSigningOut(true);

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
      // Notify other views (e.g., Calendar) that buckets changed
      window.dispatchEvent(new CustomEvent('lifeBucketsChanged'));
    }

    // Save to Supabase for persistence
    try {
      const prefs = await getUserPreferencesClient();
      if (prefs) {
        const mergedColors = { ...(prefs.bucket_colors || {}), [name]: colorToUse } as Record<string, string>;
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
        const nextColors = { ...(prefs.bucket_colors || {}), [trimmed]: colorToUse } as Record<string, string>;
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

  const handleRemoveBucketImmediate = async (bucket: string) => {
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

  const requestRemoveBucket = (bucket: string) => {
    const previousBuckets = [...buckets];
    const previousActiveBucket = activeBucket;

    setConfirmState({
      title: `Remove "${bucket}" tab?`,
      description: "This removes the tab from your dashboard. You can undo immediately after confirming.",
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
            window.dispatchEvent(new CustomEvent("lifeBucketsChanged"));
          }

          try {
            const prefs = await getUserPreferencesClient();
            if (prefs) {
              await saveUserPreferences({
                ...prefs,
                life_buckets: previousBuckets,
              });
            }
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

    // Save to Supabase
    try {
      const prefs = await getUserPreferencesClient();
      if (prefs) {
        await saveUserPreferences({
          ...prefs,
          life_buckets: updated,
          bucket_colors: updatedColors,
        });
      }
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
      window.dispatchEvent(new CustomEvent('lifeBucketsChanged'));
    }
    // Save to Supabase
    try {
      const prefs = await getUserPreferencesClient();
      if (prefs) {
        await saveUserPreferences({
          ...prefs,
          life_buckets: latestBuckets,
        });
      }
    } catch (err) {
      console.error('Failed to save bucket order to Supabase:', err);
    }
  };

  async function loadWidgets() {

    setIsWidgetLoadComplete(false);

    // First try to load from localStorage for immediate display
    let loadedFromLocal = false;
    let localWidgets = {};
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
          } else {
            localWidgets = parsed;
          }


          // Count widgets per bucket
          Object.entries(localWidgets).forEach(([bucket, widgets]) => {
          });

          setWidgetsByBucket(localWidgets);
          loadedFromLocal = true;
        } else {
        }
      } catch (e) {
        console.error('Failed to parse stored widgets', e);
      }
    }

    // Always try to load from Supabase (source of truth)
    try {
      const prefs = await getUserPreferencesClient();

      if (prefs?.widgets_by_bucket && Object.keys(prefs.widgets_by_bucket).length > 0) {
        const supabaseUpdatedAt = prefs.updated_at ? Date.parse(prefs.updated_at) : 0;
        const localUpdatedAt = localSavedAt ? Date.parse(localSavedAt) : 0;
        const supabaseWidgetsStr = JSON.stringify(prefs.widgets_by_bucket ?? {});
        const localWidgetsStr = JSON.stringify(localWidgets ?? {});

        const dataIsDifferent = supabaseWidgetsStr !== localWidgetsStr;

        if (dataIsDifferent && localUpdatedAt > supabaseUpdatedAt) {
          // Local copy is newer – promote it to Supabase and keep it
          const migratedLocalWidgets = migrateWidgetsToTemplates(localWidgets);
          setWidgetsByBucket(migratedLocalWidgets);

          if (prefs) {
            await saveUserPreferences({
              ...prefs,
              widgets_by_bucket: migratedLocalWidgets,
            });
          }

          if (typeof window !== 'undefined') {
            const dataToSave = {
              widgets: migratedLocalWidgets,
              savedAt: new Date().toISOString(),
            };
            localStorage.setItem('widgets_by_bucket', JSON.stringify(dataToSave));
          }
        } else if (dataIsDifferent) {
          // Supabase copy is newer – adopt it locally
          const migratedWidgets = migrateWidgetsToTemplates(prefs.widgets_by_bucket);
          setWidgetsByBucket(migratedWidgets);

          // --- NEW: ensure bucket list includes any bucket keys from widgets ---
          const widgetBuckets = Object.keys(prefs.widgets_by_bucket);
          setBuckets(prev => {
            const merged = Array.from(new Set([...prev, ...widgetBuckets]));
            if (merged.length !== prev.length) {
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
            const dataToSave = {
              widgets: migratedWidgets,
              savedAt: new Date().toISOString(),
            };
            localStorage.setItem('widgets_by_bucket', JSON.stringify(dataToSave));
          }
        } else {
        }
      } else if (loadedFromLocal && Object.keys(localWidgets).length > 0) {

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
      }
    } catch (err) {
      console.error('Failed to load widgets from preferences', err);
    } finally {
      setIsWidgetLoadComplete(true);
    }
  }

  // Auth state change listener
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user }, error }) => {
      setUser(user);
      // Mark auth as initialized after the initial getUser resolves
      setAuthInitialized(true);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      // Ensure we mark initialized when we receive any auth event
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

      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('first_name')
          .eq('id', user.id)
          .maybeSingle();

        if (isCancelled) {
          return;
        }

        if (error && error.code !== 'PGRST116') {
          console.error('Failed to load profile for greeting', error);
        }

        setGreetingName(deriveGreetingName(profile ?? null, user));
      } catch (err) {
        if (isCancelled) {
          return;
        }
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
  useEffect(() => {
    // Do not act until the initial auth status has been determined
    if (!authInitialized) return;

    if (user) {
      loadBuckets({ fetchFromSupabase: true });
      loadWidgets();
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


    // Save to localStorage immediately
    if (typeof window !== 'undefined') {
      const dataToSave = {
        widgets: widgetsByBucket,
        savedAt: new Date().toISOString()
      };
      localStorage.setItem('widgets_by_bucket', JSON.stringify(dataToSave));
      Object.entries(widgetsByBucket).forEach(([bucket, widgets]) => {
      });

      // Verify save by reading back
      const savedData = localStorage.getItem('widgets_by_bucket');
      const verified = JSON.parse(savedData!);
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
      if (prefs && prefs.life_buckets && prefs.life_buckets.length) {
        // If we already loaded buckets from localStorage, prefer them to avoid flicker
        if (!loadedFromLocal) {
          setBuckets(prefs.life_buckets);
          const localSaved = typeof window !== 'undefined' ? localStorage.getItem('active_bucket') : null;
          const initialActive = localSaved && prefs.life_buckets.includes(localSaved) ? localSaved : prefs.life_buckets[0];
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
        // If we have locally cached buckets that aren't yet on the server, merge and persist them.
        // Preserve the local ordering as the primary source of truth and append any server-only buckets.
        if (loadedFromLocal && localBuckets.length) {
          const merged = [...localBuckets];
          (prefs.life_buckets ?? []).forEach((bucket: string) => {
            if (!merged.includes(bucket)) {
              merged.push(bucket);
            }
          });
          if (merged.length !== prefs.life_buckets.length || merged.some((name, idx) => name !== prefs.life_buckets[idx])) {
            setBuckets(merged);
            const active = (typeof window !== 'undefined' ? localStorage.getItem('active_bucket') : null) || merged[0];
            setActiveBucket(merged.includes(active || '') ? (active as string) : merged[0]);
            if (typeof window !== 'undefined') {
              localStorage.setItem('life_buckets', JSON.stringify(merged));
              window.dispatchEvent(new CustomEvent('lifeBucketsChanged'));
            }
            const mergedColors = {
              ...(prefs.bucket_colors || {}),
              ...(localBucketColors || {}),
            } as Record<string, string>;
            await saveUserPreferences({
              ...prefs,
              life_buckets: merged,
              bucket_colors: mergedColors,
            });
          }
        }
      } else {
        if (loadedFromLocal && localBuckets.length) {
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
        <section className="w-full mb-6 mt-2">
          <h1 className="text-[28px] tracking-[0.5px] font-semibold text-[#171A1F] mb-1">
            Hello <span className="text-theme-primary-600 font-bold">{greetingName || 'there'}</span>
          </h1>
          <p className="text-[15px] text-[#6b7688]">You've got this! Let's make today productive.</p>
        </section>
        {/* Bucket tabs row (scrollable) */}
        <div
          className="relative z-10 mt-6 transition-all duration-300 ease-in-out"
          style={{ width: '100%' }}
        >
          <div className="flex items-start overflow-x-auto pt-1 no-scrollbar" ref={tabsScrollRef}>
            {bucketsInitialized && buckets.length === 0 && (
              <div className="flex h-[48px] items-center justify-between gap-3 rounded-t-[16px] border border-dashed border-[#dbd6cf] bg-white/70 px-4 text-sm text-[#8e99a8]">
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
                  color: b === activeBucket ? 'white' : '#314158'
                }}
                className={`relative flex h-[48px] items-center justify-center whitespace-nowrap rounded-t-[16px] px-4 sm:px-6 text-[14px] font-semibold capitalize transition-all duration-300 border-2 ${b === activeBucket
                  ? 'scale-[1.02] shadow-[0px_8px_24px_rgba(163,133,96,0.15)] text-white'
                  : 'hover:scale-[1.01] shadow-none'
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
                marginRight: '-10px'
              }}
              className="relative flex h-[48px] items-center justify-center rounded-t-[16px] bg-white px-6 sm:px-8 text-[18px] font-bold transition-all duration-300 hover:bg-white hover:border-theme-primary-500/30 border border-[#dbd6cf]/60 shadow-none"
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
            <div className="relative z-10 -mt-px flex h-full flex-col overflow-hidden rounded-b-2xl border border-[#dbd6cf]/60 bg-white shadow-sm">
              {/* Inner nav */}
              <nav className="flex items-center gap-4 sm:gap-8 border-b border-white/20 px-4 sm:px-6 pt-3 sm:pt-4 text-sm font-semibold">
                {(['Overview', 'Trends', 'Logs', 'Tasks', 'Settings'] as const).map((item) => (
                  <button
                    key={item}
                    onClick={() => setActiveSubTab(item)}
                    className={`pb-3 border-b-2 transition-all duration-300 ${item === activeSubTab
                      ? 'border-theme-primary-500 text-theme-primary-600 font-bold'
                      : 'border-transparent text-[#8e99a8] hover:text-[#4a5568] hover:border-theme-primary-300/50'
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
                      <p className="mt-2 text-xs text-[#8e99a8] truncate">Sync integrations</p>
                      {/* Invisible progress bar placeholder to equalize height */}
                      <div className="mt-3 h-1 bg-transparent" />
                    </div>
                  )}

                  {/* Widget cards */}
                  {activeWidgets.map((w) => {
                    const isLinkedTask = Boolean(w.linkedTaskId);
                    const linkedTask = isLinkedTask
                      ? allTasks.find((task) => task.id?.toString?.() === w.linkedTaskId)
                      : undefined;
                    const linkedTaskCompleted = Boolean(linkedTask?.completed);
                    const linkedTaskContent = linkedTask?.content ?? w.linkedTaskTitle ?? w.name;
                    const linkedTaskDueRaw = linkedTask?.due?.date ?? linkedTask?.due?.datetime ?? null;
                    const linkedTaskDueDisplay = (() => {
                      if (!linkedTaskDueRaw) return null;
                      try {
                        const parsed =
                          linkedTaskDueRaw.length === 10
                            ? parseISO(`${linkedTaskDueRaw}T00:00:00`)
                            : parseISO(linkedTaskDueRaw);
                        return format(parsed, "MMM d");
                      } catch {
                        return null;
                      }
                    })();
                    // Determine today's progress value and percentage towards target
                    let todayVal = 0;
                    let isFitbitData = false;
                    let isGoogleFitData = false;

                    if (isLinkedTask) {
                      todayVal = linkedTaskCompleted ? (w.target || 1) : 0;
                    } else if (w.id === 'water' && w.dataSource === 'fitbit' && fitbitData.water !== undefined) {
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

                    const normalizedTarget = w.target && w.target > 0 ? w.target : 1;
                    const pct = isLinkedTask
                      ? (linkedTaskCompleted ? 100 : 0)
                      : Math.min(100, Math.round((todayVal / normalizedTarget) * 100));
                    const goalMet = isLinkedTask ? linkedTaskCompleted : pct >= 100;

                    // Background tint (5% opacity of widget color) when goal met
                    const bgTintClasses: Record<string, string> = {
                      blue: 'bg-warm-500/5', green: 'bg-green-500/5', red: 'bg-red-500/5', orange: 'bg-orange-500/5', purple: 'bg-amber-500/5', indigo: 'bg-warm-500/5', amber: 'bg-amber-500/5', teal: 'bg-teal-500/5', rose: 'bg-rose-500/5', cyan: 'bg-cyan-500/5', yellow: 'bg-yellow-500/5', sky: 'bg-sky-500/5', emerald: 'bg-emerald-500/5', violet: 'bg-violet-500/5', lime: 'bg-lime-500/5', fuchsia: 'bg-fuchsia-500/5', gray: 'bg-[#b8b0a8]/5', slate: 'bg-slate-500/5', stone: 'bg-stone-500/5'
                    };
                    const widgetColor = w.color || getTemplateColor(w.id) || 'gray';
                    const cardBgClass = goalMet ? (bgTintClasses[widgetColor] ?? 'bg-[rgba(183,148,106,0.08)]/60') : 'bg-white/80';

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
                              convertWidgetToTask(w, activeBucket);
                            }}
                            className={`rounded-full p-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-theme-primary-500 transition ${w.linkedTaskId
                              ? "bg-theme-primary-600 hover:bg-theme-primary-700"
                              : "bg-theme-primary-100 hover:bg-theme-primary-200"
                              }`}
                            aria-label={w.linkedTaskId ? "Remove from Tasks" : "Show in Tasks"}
                            title={w.linkedTaskId ? "Remove from Tasks tab" : "Show in Tasks tab"}
                          >
                            <ListChecks
                              className={`h-3 w-3 ${w.linkedTaskId ? "text-white" : "text-theme-primary-600"
                                }`}
                            />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              requestRemoveWidget(w);
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
                            if (!IconComponent) return <div className="h-5 w-5 bg-[#dbd6cf] rounded" />;

                            // Get color - fallback to widget template default if not set
                            const widgetColor = w.color || getTemplateColor(w.id) || 'gray';

                            return (
                              <div
                                className={`w-9 h-9 rounded-lg flex items-center justify-center shadow-sm ${BG_COLOR_CLASSES[widgetColor] ?? 'bg-[#b8b0a8]'}`}
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
                        {isLinkedTask && (
                          <div className="mt-3 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 text-sm text-[#4a5568]">
                                <ListChecks className="h-4 w-4 text-theme-primary-600" />
                                <span className="truncate">{linkedTaskContent}</span>
                              </div>
                              <button
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  if (!linkedTask) return;
                                  void toggleTaskCompletionContext(linkedTask.id.toString());
                                }}
                                disabled={!linkedTask}
                                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${linkedTaskCompleted
                                  ? "border-green-500 text-green-600 bg-green-50 hover:bg-green-100"
                                  : "border-[#dbd6cf] text-[#6b7688] hover:bg-[rgba(183,148,106,0.08)]"
                                  } ${!linkedTask ? "opacity-60 cursor-not-allowed" : ""}`}
                              >
                                {linkedTaskCompleted ? "Undo" : "Mark done"}
                              </button>
                            </div>
                            {linkedTaskDueDisplay ? (
                              <p className="text-xs text-[#8e99a8]">Due {linkedTaskDueDisplay}</p>
                            ) : null}
                          </div>
                        )}

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
                                  <div className="text-xs text-[#8e99a8]">
                                    {birthDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                                  </div>
                                  <div className="text-xs text-[#6b7688] mt-1">
                                    {daysUntil === 0 ? '🎉 Today!' :
                                      daysUntil === 1 ? '🎂 Tomorrow' :
                                        `🗓️ ${daysUntil} days`}
                                  </div>
                                </div>
                              );
                            } else {
                              return (
                                <div className="mt-2 text-xs text-[#8e99a8]">
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
                                    <div className="text-xs text-[#6b7688]">
                                      {w.eventData.description}
                                    </div>
                                  )}
                                  <div className="text-xs text-[#8e99a8]">
                                    {eventDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                                  </div>
                                  <div className="text-xs text-[#6b7688] mt-1">
                                    {daysUntil === 0 ? '🎉 Today!' :
                                      daysUntil === 1 ? '📅 Tomorrow' :
                                        daysUntil < 0 ? '✅ Past event' :
                                          `📆 ${daysUntil} days`}
                                  </div>
                                </div>
                              );
                            } else {
                              return (
                                <div className="mt-2 text-xs text-[#8e99a8]">
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
                                  <div className="text-xs text-[#8e99a8]">
                                    {holidayDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                                  </div>
                                  <div className="text-xs text-[#6b7688] mt-1">
                                    {daysUntil === 0 ? '🎄 Today!' :
                                      daysUntil === 1 ? '🎁 Tomorrow' :
                                        `🗓️ ${daysUntil} days`}
                                  </div>
                                </div>
                              );
                            } else {
                              return (
                                <div className="mt-2 text-xs text-[#8e99a8]">
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
                                      <div className="text-sm font-medium text-[#314158]">{label}</div>
                                      <div className="text-xs text-[#8e99a8]">Today's mood</div>
                                    </div>
                                  </div>
                                  {w.moodData.moodNote && (
                                    <div className="text-xs text-[#6b7688] mt-2 italic">
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
                                    <div className="text-xs text-[#8e99a8]">Tap to log mood</div>
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
                                      <div className="text-sm font-medium text-[#314158]">Today's Entry</div>
                                      <div className="text-xs text-[#8e99a8]">{wordCount} words</div>
                                    </div>
                                  </div>
                                  <div className="text-xs text-[#4a5568] italic bg-[#faf8f5] p-2 rounded">
                                    "{entryPreview}"
                                  </div>
                                  {w.journalData.entryCount && w.journalData.entryCount > 1 && (
                                    <div className="text-xs text-[#8e99a8] mt-2">
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
                                    <div className="text-xs text-[#8e99a8] mb-2">No entry today</div>
                                    <div className="text-xs text-[#6b7688] italic px-2">
                                      "{randomPrompt}"
                                    </div>
                                    {w.journalData?.entryCount && (
                                      <div className="text-xs text-[#8e99a8] mt-2">
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
                                    <span className="font-medium text-[#4a5568]">
                                      Quitting {w.quitHabitData.habitName}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 text-xs text-[#6b7688]">
                                    <span className="text-sm">📅</span>
                                    <span>Since {quitDate.toLocaleDateString()}</span>
                                  </div>
                                  <div className="flex items-baseline gap-1">
                                    <span className="text-2xl font-bold text-green-600">{daysSince}</span>
                                    <span className="text-sm text-green-600 font-medium">days clean</span>
                                  </div>
                                  {w.quitHabitData.costPerDay && w.quitHabitData.costPerDay > 0 && (
                                    <div className="flex items-center gap-2 text-xs text-[#6b7688]">
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
                                <div className="mt-3 text-xs text-[#8e99a8] text-center">
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
                                      <div className="text-sm font-medium text-[#314158]">Today's Gratitude</div>
                                      <div className="text-xs text-[#8e99a8]">{w.gratitudeData.gratitudeItems.length} items</div>
                                    </div>
                                  </div>
                                  <div className="space-y-1">
                                    {w.gratitudeData.gratitudeItems.slice(0, 2).map((item, index) => (
                                      <div key={index} className="text-xs text-[#4a5568] flex items-start gap-1">
                                        <span className="text-yellow-500 mt-0.5">•</span>
                                        <span className="italic">"{item}"</span>
                                      </div>
                                    ))}
                                    {w.gratitudeData.gratitudeItems.length > 2 && (
                                      <div className="text-xs text-[#8e99a8]">
                                        +{w.gratitudeData.gratitudeItems.length - 2} more...
                                      </div>
                                    )}
                                  </div>
                                  {w.gratitudeData.entryCount && w.gratitudeData.entryCount > 1 && (
                                    <div className="text-xs text-[#8e99a8] mt-2">
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
                                    <div className="text-xs text-[#8e99a8] mb-2">What are you grateful for?</div>
                                    <div className="text-xs text-[#6b7688] italic">
                                      Tap to add today's gratitude
                                    </div>
                                    {w.gratitudeData?.entryCount && (
                                      <div className="text-xs text-[#8e99a8] mt-2">
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
                                    <p className="text-xs font-medium text-[#4a5568]">Current Weight</p>
                                  </div>
                                  <p className="text-lg font-bold text-amber-600">
                                    {w.weightData.currentWeight} {w.weightData.unit || w.unit || 'lbs'}
                                  </p>

                                  {/* Change from starting weight */}
                                  {w.weightData.startingWeight !== undefined && (
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs">📈</span>
                                      <p
                                        className={`text-xs ${w.weightData.currentWeight < w.weightData.startingWeight ? 'text-green-600' : w.weightData.currentWeight > w.weightData.startingWeight ? 'text-orange-600' : 'text-[#6b7688]'}`}
                                      >
                                        {w.weightData.currentWeight < w.weightData.startingWeight ? 'Lost' : w.weightData.currentWeight > w.weightData.startingWeight ? 'Gained' : 'No change'}: {Math.abs(w.weightData.currentWeight - w.weightData.startingWeight).toFixed(1)} {w.weightData.unit || w.unit || 'lbs'}
                                      </p>
                                    </div>
                                  )}

                                  {/* Goal weight */}
                                  {w.weightData.goalWeight !== undefined && (
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs">🎯</span>
                                      <p className="text-xs text-warm-600">
                                        Goal: {w.weightData.goalWeight} {w.weightData.unit || w.unit || 'lbs'}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              );
                            }
                            return (
                              <div className="mt-3 text-xs text-[#8e99a8] text-center">
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
                                <div className="text-xs text-[#6b7688] mb-1">Exercise Tracker</div>
                                <div className="text-xs text-[#8e99a8]">
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
                                  <div className="text-xs text-[#6b7688] mb-1">Home Projects</div>
                                  <div className="text-xs text-[#8e99a8]">
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
                                    <div className="text-sm font-semibold text-[#314158]">{activeProjects.length}</div>
                                    <div className="text-xs text-[#8e99a8]">Active</div>
                                  </div>
                                  <div>
                                    <div className="text-sm font-semibold text-red-600">{urgentProjects.length}</div>
                                    <div className="text-xs text-[#8e99a8]">Urgent</div>
                                  </div>
                                  <div>
                                    <div className="text-sm font-semibold text-green-600">{completionRate}%</div>
                                    <div className="text-xs text-[#8e99a8]">Done</div>
                                  </div>
                                </div>

                                {/* Next priority project */}
                                {nextProject && (
                                  <div className="border-t border-[#dbd6cf]/60 pt-2">
                                    <div className="text-xs text-[#6b7688] mb-1">Next Priority:</div>
                                    <div className="flex items-center gap-1">
                                      <span className={`w-2 h-2 rounded-full ${nextProject.priority === 'critical' ? 'bg-red-500' : nextProject.priority === 'high' ? 'bg-orange-500' : nextProject.priority === 'medium' ? 'bg-warm-500' : 'bg-[#b8b0a8]'}`}></span>
                                      <span className="text-xs font-medium text-[#314158] truncate">{nextProject.title}</span>
                                    </div>
                                    {nextProject.room && (
                                      <div className="text-xs text-[#8e99a8] capitalize mt-1">📍 {nextProject.room}</div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          }

                          // Regular progress bar for other widgets
                          const displayPct = pct;
                          const prog = progressByWidget[w.instanceId];

                          return (
                            <div className="mt-2 mb-1">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="text-lg font-bold text-[#314158]">
                                    {todayVal}
                                  </span>
                                  <span className="text-sm text-[#8e99a8]">
                                    / {w.target}
                                  </span>
                                </div>
                                {prog?.streak >= 2 && (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                                    🔥 {prog.streak}
                                  </span>
                                )}
                              </div>
                              <div className="w-full bg-[rgba(183,148,106,0.08)] rounded-full h-1 mt-2">
                                <div className={`h-1 rounded-full transition-all duration-300 ${BG_COLOR_CLASSES[widgetColor] ?? 'bg-theme-primary-500'}`} style={{ width: `${displayPct}%` }} />
                              </div>
                              {(w.dataSource === 'fitbit' || w.dataSource === 'googlefit') && (
                                <div className="text-right mt-1 mb-1">
                                  {w.dataSource === 'fitbit' && <span className="text-xs text-warm-500">Fitbit</span>}
                                  {w.dataSource === 'googlefit' && <span className="text-xs text-green-600">Google Fit</span>}
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {!(['water', 'steps'].includes(w.id) && (w.dataSource === 'fitbit' || w.dataSource === 'googlefit')) && !['birthdays', 'social_events', 'holidays', 'mood', 'journal', 'gratitude', 'weight', 'exercise', 'nutrition', 'medication'].includes(w.id) && !isLinkedTask && (
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
                      <p className="text-sm font-semibold text-[#314158]">Add Widget</p>
                      <p className="text-xs text-[#8e99a8]">Track your stats</p>
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
                    {buckets.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 px-4 text-center border border-dashed border-[#dbd6cf] rounded-2xl bg-white/80">
                        <div className="w-16 h-16 bg-warm-50 rounded-full flex items-center justify-center mb-4">
                          <ListChecks className="h-8 w-8 text-warm-600" />
                        </div>
                        <h3 className="text-xl font-semibold text-[#314158] mb-2">
                          Set up your first bucket
                        </h3>
                        <p className="text-sm text-[#8e99a8] max-w-md mb-6">
                          Buckets help you organise widgets and tasks together. Create one to unlock the full dashboard experience.
                        </p>
                        <button
                          onClick={() => setIsEditorOpen(true)}
                          className="px-6 py-3 bg-warm-600 text-white rounded-lg hover:bg-warm-700 font-medium transition-colors"
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
                      />
                    )}
                  </div>
                )}

                {activeSubTab === 'Logs' && (
                  <div>
                    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h2 className="text-xl font-semibold">Widget Logs</h2>
                        <p className="text-sm text-[#8e99a8]">
                          Recent syncs, entries, and progress updates for this bucket.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => void loadWidgetHistoryLogs()}
                          disabled={isWidgetLogsLoading || activeWidgets.length === 0}
                          className="inline-flex h-9 items-center justify-center rounded-md border border-[#dbd6cf] px-3 text-sm text-[#6b7688] transition hover:bg-[#faf8f5] disabled:cursor-not-allowed disabled:opacity-60"
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
                        <div className="text-center py-12 text-[#8e99a8]">
                          <p>No widgets available to show logs for.</p>
                          <p className="text-sm mt-2">Add some widgets to see their activity logs here.</p>
                        </div>
                      ) : filteredWidgetLogs.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-[#dbd6cf] bg-white px-6 py-12 text-center text-[#8e99a8]">
                          <p>No activity yet for this selection.</p>
                          <p className="mt-1 text-sm">Track progress or update a widget to start building logs.</p>
                        </div>
                      ) : (
                        <div className="bg-white rounded-lg border border-[#dbd6cf] p-6">
                          <h3 className="mb-4 text-lg font-medium">
                            {selectedLogsWidget === 'all' ? 'All Widget Activity' :
                              `${activeWidgets.find(w => w.instanceId === selectedLogsWidget)?.name || 'Widget'} Activity`}
                            <span className="ml-2 text-sm font-normal text-[#8e99a8]">
                              ({filteredWidgetLogs.length})
                            </span>
                          </h3>
                          <div className="max-h-[480px] space-y-2 overflow-y-auto pr-1">
                            {filteredWidgetLogs.slice(0, 80).map((entry) => (
                              <div key={entry.id} className="flex items-start gap-3 rounded bg-[#faf8f5] p-3">
                                <div className={`mt-1.5 h-2 w-2 rounded-full ${LOG_KIND_DOT_CLASS[entry.kind]}`} />
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-medium text-[#314158]">{entry.message}</p>
                                  <p className="truncate text-xs text-[#8e99a8]">
                                    {entry.widgetName}
                                    {entry.details ? ` • ${entry.details}` : ""}
                                  </p>
                                </div>
                                <p className="whitespace-nowrap text-xs text-[#8e99a8]/70">
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
                      <h2 className="text-xl font-semibold">Widget Settings</h2>
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
                        <div className="text-center py-12 text-[#8e99a8]">
                          <p>No widgets available to configure.</p>
                          <p className="text-sm mt-2">Add some widgets to manage their settings here.</p>
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
                              <div key={widget.instanceId} className="bg-white rounded-lg border border-[#dbd6cf] p-6">
                                <div className="flex items-center gap-3 mb-4">
                                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${BG_COLOR_CLASSES[widget.color || "gray"] ?? "bg-[#b8b0a8]"}`}>
                                    {IconComponent ? (
                                      <IconComponent className="h-5 w-5 text-white" />
                                    ) : (
                                      <LayoutDashboard className="h-5 w-5 text-white" />
                                    )}
                                  </div>
                                  <div>
                                    <h3 className="text-lg font-medium">{widget.name}</h3>
                                    <p className="text-sm text-[#8e99a8]">Widget ID: {widget.id}</p>
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div>
                                    <label className="block text-sm font-medium text-[#4a5568] mb-2">Daily target</label>
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
                                      className="w-full px-3 py-2 border border-[#dbd6cf] rounded-md focus:outline-none focus:ring-2 focus:ring-warm-500"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium text-[#4a5568] mb-2">Color</label>
                                    <select
                                      value={widget.color || "gray"}
                                      onChange={(event) => {
                                        patchWidgetInActiveBucket(widget.instanceId, {
                                          color: event.target.value,
                                        });
                                      }}
                                      className="w-full rounded-md border border-[#dbd6cf] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-warm-500"
                                    >
                                      {WIDGET_COLOR_OPTIONS.map((colorName) => (
                                        <option key={colorName} value={colorName}>
                                          {colorName}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium text-[#4a5568] mb-2">Data source</label>
                                    <select
                                      value={selectedDataSource}
                                      onChange={(event) => {
                                        patchWidgetInActiveBucket(widget.instanceId, {
                                          dataSource: event.target.value,
                                        });
                                        void fetchIntegrationsData();
                                      }}
                                      className="w-full rounded-md border border-[#dbd6cf] px-3 py-2 text-sm capitalize focus:outline-none focus:ring-2 focus:ring-warm-500"
                                    >
                                      {sourceOptions.map((option) => (
                                        <option key={option} value={option}>
                                          {option}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium text-[#4a5568] mb-2">Created</label>
                                    <span className="text-sm text-[#6b7688]">
                                      {widget.createdAt
                                        ? new Date(widget.createdAt).toLocaleDateString()
                                        : "Unknown"}
                                    </span>
                                  </div>
                                </div>

                                <div className="mt-4 flex flex-wrap gap-2 border-t border-[#dbd6cf] pt-4">
                                  <button
                                    onClick={() => {
                                      setEditingBucket(activeBucket);
                                      setEditingWidget(widget);
                                      setNewlyCreatedWidgetId(null);
                                    }}
                                    className="rounded-md bg-theme-primary-500 px-4 py-2 text-white hover:bg-theme-primary-500/90 focus:outline-none focus:ring-2 focus:ring-theme-primary-500"
                                  >
                                    Open Editor
                                  </button>
                                  <button
                                    onClick={() => {
                                      void resetWidgetProgress(widget);
                                    }}
                                    className="rounded-md border border-[#dbd6cf] px-4 py-2 text-[#4a5568] hover:bg-[#faf8f5] focus:outline-none focus:ring-2 focus:ring-[#bb9e7b]"
                                  >
                                    Reset Today
                                  </button>
                                  <button
                                    onClick={() => {
                                      requestRemoveWidget(widget);
                                    }}
                                    className="rounded-md bg-red-600 px-4 py-2 text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                                  >
                                    Remove Widget
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


        {confirmState && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4">
            <div
              role="dialog"
              aria-modal="true"
              aria-label={confirmState.title}
              className="w-full max-w-md rounded-xl border border-[#dbd6cf] bg-white p-5 shadow-xl"
            >
              <h3 className="text-base font-semibold text-[#314158]">{confirmState.title}</h3>
              <p className="mt-2 text-sm text-[#6b7688]">{confirmState.description}</p>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmState(null)}
                  className="rounded-md border border-[#dbd6cf] px-3 py-2 text-sm text-[#4a5568] hover:bg-[#faf8f5]"
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
            className="fixed bottom-24 right-4 z-[110] w-[min(92vw,360px)] rounded-lg border border-[#dbd6cf] bg-white p-3 shadow-warm-lg"
          >
            <p className="text-sm text-[#314158]">{undoState.message}</p>
            <div className="mt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  clearUndoTimer();
                  setUndoState(null);
                }}
                className="rounded-md border border-[#dbd6cf] px-2 py-1 text-xs text-[#6b7688] hover:bg-[#faf8f5]"
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
                className="rounded-md bg-theme-primary-600 px-2 py-1 text-xs text-white hover:bg-theme-primary-700"
              >
                Undo
              </button>
            </div>
          </div>
        )}

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
          />
        )}

        {/* Widget library sheet */}
        <Sheet open={isWidgetSheetOpen} onOpenChange={setIsWidgetSheetOpen}>
          <SheetContent
            side={isMobileView ? 'bottom' : 'right'}
            className={`w-full sm:w-[800px] max-w-full p-0 sm:p-6 flex flex-col ${isMobileView ? 'max-h-[90vh]' : ''}`}
          >
            <SheetHeader
              className={`px-4 pt-6 pb-4 sm:px-0 sm:pt-0 sm:pb-6 border-b border-[#dbd6cf] sm:border-none ${isMobileView ? 'sticky top-0 z-10 bg-white/95 backdrop-blur' : ''}`}
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
              <SheetTitle className="text-[#314158]">Manage Tabs</SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#4a5568] mb-1">Add a new tab</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Tab name (e.g., Side Projects)"
                    value={newBucket}
                    onChange={(e) => setNewBucket(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddBucket()}
                    className="flex-1 rounded-md border border-[#dbd6cf] px-3 py-2 text-sm focus:border-warm-500 focus:ring-1 focus:ring-warm-500 focus:outline-none"
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
                <div className="text-sm font-medium text-[#4a5568] mb-2">Suggested tabs</div>
                <div className="flex flex-wrap gap-2">
                  {suggestedToShow.length > 0 ? (
                    suggestedToShow.map((name) => (
                      <button
                        key={name}
                        onClick={() => handleAddBucketQuick(name)}
                        className="px-3 py-1.5 rounded-full border border-[#dbd6cf] text-sm hover:bg-[#faf8f5] active:bg-[rgba(183,148,106,0.08)]"
                        aria-label={`Add ${name} tab`}
                      >
                        {name}
                      </button>
                    ))
                  ) : (
                    <div className="text-xs text-[#8e99a8]">All suggested tabs are already added</div>
                  )}
                </div>
              </div>

              <div>
                <div className="text-sm font-medium text-[#4a5568] mb-2">Existing tabs</div>
                <ul className="divide-y divide-[#dbd6cf] rounded-md border border-[#dbd6cf] overflow-hidden">
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
                            <GripVertical className="w-4 h-4 text-[#8e99a8]/70 cursor-grab active:cursor-grabbing" />
                          )}
                          <span
                            className="inline-block w-4 h-4 rounded-full border border-[#dbd6cf] flex-shrink-0"
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
                              className="flex-1 text-sm border border-warm-500 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-warm-500"
                              autoFocus
                            />
                          ) : (
                            <span className={`truncate text-sm ${b === activeBucket ? 'font-semibold text-theme-primary-600' : 'text-[#4a5568]'}`}>{b}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {editingBucketName === b ? (
                            <>
                              <button
                                onClick={handleSaveEditBucket}
                                className="text-xs p-1.5 rounded-md border border-green-200 text-green-600 hover:bg-green-50"
                                title="Save"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={handleCancelEditBucket}
                                className="text-xs p-1.5 rounded-md border border-[#dbd6cf] text-[#6b7688] hover:bg-[#faf8f5]"
                                title="Cancel"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => handleStartEditBucket(b)}
                                className="text-xs p-1.5 rounded-md border border-warm-200 text-warm-600 hover:bg-warm-50"
                                title="Edit name"
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
                        <label className="flex items-center gap-2 text-xs text-[#8e99a8]">
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
                    <li className="px-3 py-6 text-sm text-[#8e99a8] text-center">No tabs yet</li>
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
              <SheetTitle className="text-[#314158]">Daily Nutrition Tracker</SheetTitle>
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
              <SheetTitle className="text-[#314158]">Medication Tracker</SheetTitle>
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
