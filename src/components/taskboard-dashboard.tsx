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
import { WidgetLibrary, widgetTemplates } from "./widget-library";
import type { WidgetTemplate, WidgetInstance } from "@/types/widgets";
import WidgetEditorSheet from "@/components/widget-editor";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ChatBar } from "./chat-bar";
import { Button } from "@/components/ui/button";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import TrendsPanel from "./trends-panel";
import WidgetSelector from "./widget-selector";
import { TasksContext, TasksProvider, useTasksContext } from '@/contexts/tasks-context';
import HourlyPlanner from "./hourly-planner";
import { NutritionMealTracker } from "./nutrition-meal-tracker";
import { NutritionSummaryWidget } from "./nutrition-summary-widget";
import { MedicationTrackerWidget } from "./medication-tracker-simple";
import { ExerciseWidget } from "./exercise-widget-simple";
import { HomeProjectsWidget } from "./home-projects-widget";

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
  
  const [buckets, setBuckets] = useState<string[]>([]);
  const [activeBucket, setActiveBucket] = useState<string>("");
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [newBucket, setNewBucket] = useState("");
  const [isWidgetSheetOpen, setIsWidgetSheetOpen] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [widgetsByBucket, setWidgetsByBucket] = useState<Record<string, WidgetInstance[]>>({});
  // Ensures we only backfill yesterday's Fitbit totals once per session
  const fetchedYesterdayRef = useRef(false);
  const [weather, setWeather] = useState<{ icon: LucideIcon; temp: number } | null>(null);
  const [isWidgetLoadComplete, setIsWidgetLoadComplete] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
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
  const [isLoadingAllTasks, setIsLoadingAllTasks] = useState(false);
  
  const [isCompletingTask, setIsCompletingTask] = useState<Record<string, boolean>>({});
  
  // New task input state
  const [newDailyTask, setNewDailyTask] = useState('');
  const [newOpenTask, setNewOpenTask] = useState('');
  
  // Collapse state for task lists
  const [isDailyCollapsed, setIsDailyCollapsed] = useState(false);
  const [isOpenCollapsed, setIsOpenCollapsed] = useState(false);
  // Collapse state for the new hourly planner
  const [isPlannerCollapsed, setIsPlannerCollapsed] = useState(false);
  // Collapse state for upcoming task sections
  const [isNext7DaysCollapsed, setIsNext7DaysCollapsed] = useState(false);
  const [isNext2WeeksCollapsed, setIsNext2WeeksCollapsed] = useState(false);
  const [isLaterCollapsed, setIsLaterCollapsed] = useState(false);
  const [isNoDueDateCollapsed, setIsNoDueDateCollapsed] = useState(true);
  
  // Dashboard inner subtabs (left panel)
  const [activeSubTab, setActiveSubTab] = useState<'Overview'|'Trends'|'Logs'|'Settings'>('Overview');
  
  // Widget selection for filtering
  const [selectedLogsWidget, setSelectedLogsWidget] = useState<string | 'all'>('all');
  const [selectedSettingsWidget, setSelectedSettingsWidget] = useState<string | 'all'>('all');
  
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
      // -----------------------------------------------------------
      // 1) Force-refresh Todoist tasks (clear cache ➜ fetch fresh)
      // -----------------------------------------------------------
      if (typeof window !== 'undefined') {
        localStorage.removeItem('todoist_all_tasks');
      }

      try {
        const tasksRes = await fetch(`/api/integrations/todoist/tasks?all=true&cb=${Date.now()}`);
        if (tasksRes.ok) {
          const taskData = await tasksRes.json();
          const allTasks: any[] = taskData.tasks || [];
          setAllTodoistTasks(allTasks);

          // Also update the daily list for the currently selected date
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

      // -----------------------------------------------------------
      // 2) Refresh Fitbit metrics if there are Fitbit-backed widgets
      // -----------------------------------------------------------
      const needFitbit = Object.values(widgetsByBucketRef.current)
        .flat()
        .some((w) => ["water", "steps"].includes(w.id) && w.dataSource === "fitbit");

      if (needFitbit) {
        // Skip cache entirely – always fetch fresh metrics
        const res = await fetch(`/api/integrations/fitbit/metrics?cb=${Date.now()}`);
        if (res.ok) {
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

          // -----------------------------------------------------------
          // 2a) Update widget progress & history for Fitbit-backed widgets
          // -----------------------------------------------------------
          try {
            const todayStr = todayStrGlobal;

            // Find all Fitbit widgets currently on the dashboard
            const fitbitWidgets = Object.values(widgetsByBucketRef.current)
              .flat()
              .filter(
                (w) => w.dataSource === "fitbit" && ["water", "steps"].includes(w.id)
              );

            if (fitbitWidgets.length) {
              // Build updated progress map
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

                // Reset value if stored date isn't today yet
                if (existing.date !== todayStr) {
                  existing.value = 0;
                }
                existing.value = val;
                updatedProgress[w.instanceId] = existing;
              });

              // Update in-memory state
              setProgressByWidget(updatedProgress);

              // Persist to localStorage
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

              // Upsert daily snapshot into Supabase history table
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

                  // -------------------------------------------------------
                  //  Back-fill yesterday's totals exactly once per session
                  // -------------------------------------------------------
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

              // Persist progress inside user_preferences (non-blocking)
              try {
                await saveWidgets(widgetsByBucketRef.current, updatedProgress);
              } catch (e) {
                console.error("Failed to save widget progress to preferences", e);
              }
            }
          } catch (errFitbitProgress) {
            console.error("Failed to update Fitbit widget progress", errFitbitProgress);
          }
        }
      }

      // -----------------------------------------------------------
      // 3) Refresh Withings weight if weight widgets use Withings
      // -----------------------------------------------------------
      const needWithings = Object.values(widgetsByBucketRef.current)
        .flat()
        .some((w) => w.id === 'weight' && w.dataSource === 'withings');

      if (needWithings) {
        try {
          const resW = await fetch(`/api/integrations/withings/metrics?cb=${Date.now()}`, { credentials: 'include' });
          if (resW.ok) {
            const dataW = await resW.json();
            const kg = dataW.weightKg;
            if (kg !== undefined && kg !== null) {
              setWithingsData({ weightKg: kg });
              if (typeof window !== 'undefined') {
                localStorage.setItem('withings_metrics', JSON.stringify({ weightKg: kg, savedAt: Date.now() }));
              }

              // Update widgets in memory
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
            }
          } else {
            console.error('Failed to fetch Withings metrics');
          }
        } catch (errW) {
          console.error('Error fetching Withings metrics', errW);
        }
      }
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
          updates: { hourSlot: dstHour, duration: 60 } // Default 60 minutes
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
          }
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
          updates: { hourSlot: dstHour }
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
        body: JSON.stringify({ widgetsByBucket: widgetsByBucketRef.current, progressByWidget }),
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
    setNewBucket("");
    if (typeof window !== 'undefined') {
      localStorage.setItem('life_buckets', JSON.stringify(updated));
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

  const handleRemoveBucket = async (bucket: string) => {
    const updated = buckets.filter(b => b !== bucket);
    setBuckets(updated);
    if (activeBucket === bucket && updated.length) {
      setActiveBucket(updated[0]);
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem('life_buckets', JSON.stringify(updated));
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
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Effect for user state changes (login/logout)
  useEffect(() => {
    if (user) {
      console.log('User detected, loading data...');
      loadBuckets();
      loadWidgets();
      ensureUserOnboarded();
    } else {
      // This logic runs when the user is not signed in, or after they sign out.
      console.log('No user detected, clearing data and redirecting...');
      setBuckets([]);
      setActiveBucket('');
      setWidgetsByBucket({});
      if (typeof window !== 'undefined') {
        localStorage.removeItem('life_buckets');
        localStorage.removeItem('widgets_by_bucket');
      }
      
      // Redirect to home page if not already there.
      // No redirect here, as it is handled by the component that calls signout
      // or by the user navigating away.
    }
  }, [user]);

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

  async function loadBuckets() {
    let loadedFromLocal = false;
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('life_buckets');
        if (stored) {
          const parsed: string[] = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length) {
            setBuckets(parsed);
            const savedActive = typeof window !== 'undefined' ? localStorage.getItem('active_bucket') : null;
            setActiveBucket(savedActive && parsed.includes(savedActive) ? savedActive : parsed[0]);
            loadedFromLocal = true;
          }
        }
      } catch(e) {
        console.error('Failed to parse stored buckets', e);
      }
    }

    if (loadedFromLocal) return;

    try {
      const prefs = await getUserPreferencesClient();
      if (prefs && prefs.life_buckets && prefs.life_buckets.length) {
        setBuckets(prefs.life_buckets);
        const localSaved = typeof window !== 'undefined' ? localStorage.getItem('active_bucket') : null;
        const initialActive = localSaved && prefs.life_buckets.includes(localSaved) ? localSaved : prefs.life_buckets[0];
        setActiveBucket(initialActive);
      } else {
        // If no buckets found, set default buckets
        console.log('No buckets found, setting defaults');
        const defaultBuckets = ['Health', 'Work', 'Personal', 'Finance'];
        setBuckets(defaultBuckets);
        const savedActive = typeof window !== 'undefined' ? localStorage.getItem('active_bucket') : null;
        setActiveBucket(savedActive && defaultBuckets.includes(savedActive) ? savedActive : defaultBuckets[0]);
        
        // Save the default buckets
        if (typeof window !== 'undefined') {
          localStorage.setItem('life_buckets', JSON.stringify(defaultBuckets));
        }
        
        // Save to Supabase
        if (prefs) {
          await saveUserPreferences({
            ...prefs,
            life_buckets: defaultBuckets
          });
        }
      }
    } catch (err) {
      console.error('Failed to load preferences', err);
      // Set defaults on error too
      const defaultBuckets = ['Health', 'Work', 'Personal', 'Finance'];
      setBuckets(defaultBuckets);
      const savedActive = typeof window !== 'undefined' ? localStorage.getItem('active_bucket') : null;
        setActiveBucket(savedActive && defaultBuckets.includes(savedActive) ? savedActive : defaultBuckets[0]);
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
  const getDisplayWidgets = (bucket: string) => {
    const widgets = widgetsByBucket[bucket] ?? [];
    return widgets.filter(w => !w.instanceId?.startsWith('debug-'));
  };

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
  const [taskView, setTaskView] = useState<'Today'|'Upcoming'|'Master List'>('Today');

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

  // Ref for the scrollable hourly planner container
  const plannerRef = useRef<HTMLDivElement | null>(null);

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
      <div className="flex-1">
      <div className="flex flex-col">

        {/* Greeting */}
        <section className="w-full">
          <h2 className="text-base font-medium text-gray-800">
            Hello Dalit <span className="ml-2 text-sm font-normal text-gray-500">You've got this!</span>
          </h2>
          
          {/* Bucket tabs row (scrollable) */}
          <div
            className="relative z-10 mt-10 transition-all duration-300 ease-in-out"
            style={{ width: isSidebarCollapsed ? 'calc(100% - 88px)' : 'calc(100% - 440px)' }}
          >
            <div className="flex items-start overflow-x-auto pt-1 no-scrollbar" ref={tabsScrollRef}>
              {buckets.length > 0 && buckets.map((b, idx) => (
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
                    marginRight: '-10px'
                  }}
                  className={`relative flex h-[44px] items-center justify-center whitespace-nowrap rounded-t-[20px] px-6 text-[13px] font-medium capitalize transition-colors ${
                    b === activeBucket
                      ? 'bg-theme-primary-600 text-theme-text-inverse shadow-[0_2px_6px_rgba(0,0,0,0.12)]'
                      : 'bg-theme-surface-base text-theme-primary-600 hover:bg-theme-neutral-50 shadow-[0_2px_4px_rgba(0,0,0,0.08)]'
                  }`}
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
                className="relative flex h-[44px] items-center justify-center rounded-t-[20px] bg-theme-surface-base px-8 text-[21px] font-bold transition-colors hover:bg-theme-neutral-50 shadow-[0_2px_4px_rgba(0,0,0,0.08)]"
              >
                <span className="text-theme-primary-600">
                  +
                </span>
              </button>
            </div>
            {/* scroll container ends */}
            {/* bottom gray divider under all tabs (fixed) */}
            <div
              className="pointer-events-none absolute bottom-0 left-0 h-px bg-gray-200"
              style={{ zIndex: 60, width: 'calc(100% - 440px)' }}
            />
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
        </section>

        {/* Main content container */}
        <div className="w-full flex-1 pb-24 flex gap-10">
          {/* Left section: tabs and widgets */}
          <div className="flex-1" style={{ width: 'calc(100% - 440px)' }}>
            <div className="relative z-10 -mt-px flex h-full flex-col overflow-hidden rounded-b-lg border-t border-gray-200 bg-white shadow-sm">
              {/* Inner nav */}
              <nav className="flex items-center gap-8 border-b border-gray-100 px-6 pt-4 text-sm font-medium">
                {(['Overview','Trends','Logs','Settings'] as const).map((item) => (
                  <button
                    key={item}
                    onClick={() => setActiveSubTab(item)}
                    className={`pb-3 border-b-2 transition-colors ${
                      item === activeSubTab
                        ? 'border-theme-primary-500 text-theme-primary-600'
                        : 'border-transparent text-theme-text-quaternary hover:text-theme-text-secondary'
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </nav>

              {/* Content area */}
              <div className="flex-1 overflow-y-auto p-6">
                {/* Overview Tab */}
                <div className={activeSubTab === 'Overview' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 auto-rows-fr' : 'hidden'}>
                  {/* Refresh card */}
                  <div
                    onClick={isRefreshing ? undefined : fetchIntegrationsData}
                    className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm relative cursor-pointer hover:bg-gray-50 hover:shadow-md transition-all"
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

                  {/* Widget cards */}
                  {getDisplayWidgets(activeBucket).map((w) => {
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
                    const cardBgClass = goalMet ? (bgTintClasses[widgetColor] ?? 'bg-gray-100') : 'bg-white';

                    return (
                      <div key={w.instanceId} className={`rounded-xl border border-gray-100 ${cardBgClass} p-4 shadow-sm relative group cursor-pointer hover:shadow-md hover:border-gray-200 transition-all min-w-0`} onClick={() => { 
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
                            className={`absolute bottom-2 right-2 text-xl font-bold leading-none ${TEXT_COLOR_CLASSES[widgetColor] ?? 'text-indigo-600'} hover:scale-110 transition-transform`}
                          >
                            +
                          </button>
                        )}
                      </div>
                    );
                  })}

                  {/* Add Widget card */}
                  <div className="rounded-lg border border-gray-100 bg-white p-3 shadow-sm flex flex-col items-center gap-2 cursor-pointer hover:bg-gray-50 min-w-0" onClick={() => setIsWidgetSheetOpen(true)}>
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-indigo-50">
                      <Plus className="h-6 w-6 text-indigo-500" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-gray-800">Add Widget</p>
                      <p className="text-xs text-gray-500">Track your stats</p>
                    </div>
                  </div>
                </div>

                {activeSubTab === 'Trends' && (
                  <TrendsPanel 
                    widgets={getDisplayWidgets(activeBucket)} 
                    bucketName={activeBucket}
                  />
                )}

                {activeSubTab === 'Logs' && (
                  <div>
                    {/* Logs Header with Widget Selector */}
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-xl font-semibold">Widget Logs</h2>
                      <WidgetSelector
                        widgets={getDisplayWidgets(activeBucket)}
                        selectedWidget={selectedLogsWidget}
                        onWidgetChange={setSelectedLogsWidget}
                        showAllOption={true}
                        className="w-48"
                      />
                    </div>
                    
                    {/* Logs Content */}
                    <div className="space-y-4">
                      {getDisplayWidgets(activeBucket).length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                          <p>No widgets available to show logs for.</p>
                          <p className="text-sm mt-2">Add some widgets to see their activity logs here.</p>
                        </div>
                      ) : (
                        <div className="bg-white rounded-lg border border-gray-200 p-6">
                          <h3 className="text-lg font-medium mb-4">
                            {selectedLogsWidget === 'all' ? 'All Widget Activity' : 
                             `${getDisplayWidgets(activeBucket).find(w => w.instanceId === selectedLogsWidget)?.name || 'Widget'} Activity`}
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
                        widgets={getDisplayWidgets(activeBucket)}
                        selectedWidget={selectedSettingsWidget}
                        onWidgetChange={setSelectedSettingsWidget}
                        showAllOption={true}
                        className="w-48"
                      />
                    </div>
                    
                    {/* Settings Content */}
                    <div className="space-y-6">
                      {getDisplayWidgets(activeBucket).length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                          <p>No widgets available to configure.</p>
                          <p className="text-sm mt-2">Add some widgets to manage their settings here.</p>
                        </div>
                      ) : (
                        <div className="grid gap-6">
                          {(selectedSettingsWidget === 'all' ? getDisplayWidgets(activeBucket) : getDisplayWidgets(activeBucket).filter(w => w.instanceId === selectedSettingsWidget)).map((widget) => (
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
                                  className="px-4 py-2 bg-theme-primary-600 text-theme-text-inverse rounded-md hover:bg-theme-primary-700 focus:outline-none focus:ring-2 focus:ring-theme-primary-500 mr-2"
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

          {/* Right section: Calendar and To-do */}
          <aside 
            className={`flex-shrink-0 -mt-12 transition-all duration-300 ease-in-out relative ${
              isSidebarCollapsed ? 'w-12' : 'w-[400px]'
            }`}
            style={{ zIndex: 40 }}
          >
            <div 
              className={`rounded-lg border border-gray-100 bg-white shadow-sm flex flex-col relative ${
                taskView === 'Today' ? 'min-h-full' : 'h-full'
              } ${isSidebarCollapsed ? 'p-2 overflow-hidden' : 'p-4'}`}
              style={{ zIndex: 40 }}
            >
              <div className={`mb-4 flex items-center ${isSidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
                {!isSidebarCollapsed && (
                  <h3 className="text-sm font-medium text-gray-900">{format(selectedDate, 'MMMM yyyy')}</h3>
                )}
                <div className="flex gap-1 text-gray-500">
                  <button 
                    onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                    className="p-1 hover:bg-gray-100 rounded transition-colors"
                    aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                  >
                    {isSidebarCollapsed ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
                  </button>
                  {!isSidebarCollapsed && (
                    <>
                      <button onClick={() => handleDateChange(addDays(selectedDate, -7))} aria-label="Previous week">&lt;</button>
                      <button onClick={() => handleDateChange(addDays(selectedDate, 7))} aria-label="Next week">&gt;</button>
                    </>
                  )}
                </div>
              </div>

              {/* Week view */}
              <div className="flex justify-between gap-2 overflow-x-auto pb-1">
                {getWeekDays().map((day: Date, index: number) => (
                  <button
                    key={index}
                    onClick={() => handleDateChange(day)}
                    className={`flex flex-col items-center rounded-xl px-3 py-2 w-14 transition-colors ${
                      isSameDay(day, selectedDate)
                        ? 'bg-theme-primary-500 text-theme-text-inverse'
                        : 'bg-theme-neutral-100 text-theme-text-secondary hover:bg-theme-neutral-200'
                    }`}
                  >
                    <span className="text-lg font-semibold leading-none">{format(day, 'd')}</span>
                    <span className="text-xs leading-none mt-1">{format(day, 'EEE')}</span>
                  </button>
                ))}
              </div>

              {/* Task view toggle */}
              <div className="mt-4">
                <div className="flex rounded-full border border-theme-neutral-200 bg-theme-surface-raised p-1 w-full shadow-sm">
                  {(['Today','Upcoming','Master List'] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setTaskView(tab)}
                      className={`flex-1 rounded-full px-4 py-1 text-sm font-semibold transition-colors ${
                        taskView === tab
                          ? 'bg-theme-primary-500 text-theme-text-inverse shadow'
                          : 'text-theme-text-secondary hover:bg-theme-hover hover:text-theme-primary-600'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>

              {/* To-do lists with drag & drop */}
              <div className="mt-6 flex-1 flex flex-col">
                <DragDropContext onDragEnd={handleDragEnd}>
                  {taskView === 'Today' && (<>
                  {/* Daily tasks (header + list share same droppable so header accepts drops) */}
                  <Droppable droppableId="dailyTasks">
                    {(provided: any) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className="flex flex-col relative"
                        style={{ zIndex: isDailyCollapsed ? 'auto' : 10000 }}
                      >
                        <div
                          className="flex items-center justify-between text-sm font-medium text-gray-900 mb-2 cursor-pointer select-none"
                          onClick={() => setIsDailyCollapsed((c) => !c)}
                        >
                          <span>Tasks on {format(selectedDate,'MMM d, yyyy')}</span>
                          {isDailyCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                        </div>

                        {!isDailyCollapsed && (
                          <ul className="space-y-3 pr-1 overflow-visible">
                            {isLoadingTasks && dailyVisibleTasks.length === 0 ? (
                              <li className="text-gray-500 text-sm">Loading…</li>
                            ) : null}

                            {!isLoadingTasks && dailyVisibleTasks.length === 0 ? (
                              <li className="text-gray-500 text-sm">No tasks</li>
                            ) : null}

                            {dailyVisibleTasks.map((t: any, index: number) => (
                              <Draggable draggableId={t.id.toString()} index={index} key={t.id} isDragDisabled={!!resizingTask}>
                                {(provided: any, dragSnapshot: any) => (
                                  <li
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    style={{
                                      ...provided.draggableProps.style,
                                      zIndex: dragSnapshot.isDragging ? 10000 : 9999
                                    }}
                                    className={`group flex items-start gap-3 px-4 py-3 
                                      bg-card border border-border/60 
                                      shadow-sm hover:shadow-md 
                                      rounded-xl transition-all duration-200 
                                      hover:border-primary/40 hover:bg-card/80
                                      ${dragSnapshot.isDragging ? 'shadow-lg rotate-1 scale-105 border-primary/60' : ''}
                                      ${t.completed ? 'opacity-60' : ''}
                                    `}
                                  >
                                    {/* Enhanced status indicator */}
                                    <div className="flex-shrink-0 mt-1">
                                      <div 
                                        className={`w-2.5 h-2.5 rounded-full ring-2 transition-all duration-200 cursor-pointer
                                          ${t.completed 
                                            ? 'bg-green-500 ring-green-500/20' 
                                            : 'bg-primary ring-primary/20 hover:ring-primary/40'
                                          }`}
                                        onClick={() => toggleTaskCompletion(t.id.toString())}
                                        title={t.completed ? 'Mark as pending' : 'Mark as complete'}
                                      />
                                    </div>

                                    {/* Task content with drag handle */}
                                    <div className="flex-1 min-w-0" {...provided.dragHandleProps}>
                                      <div className={`font-medium text-sm leading-tight ${t.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                                        {t.content}
                                      </div>
                                      {t.due?.date && (
                                        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                          <span>Due: {format(new Date(t.due.date), 'MMM d')}</span>
                                        </div>
                                      )}
                                    </div>

                                    {/* Delete button - always visible for testing */}
                                    <button
                                      onClick={async (e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        console.log('🗑️ Delete button clicked for task:', t.id, t.content);
                                        console.log('🗑️ deleteTask function:', typeof deleteTask);
                                        try {
                                          await deleteTask(t.id.toString());
                                          console.log('✅ Task deleted successfully');
                                        } catch (error) {
                                          console.error('❌ Failed to delete task:', error);
                                        }
                                      }}
                                      className="flex-shrink-0 opacity-100 transition-opacity duration-200 p-1 hover:bg-red-100 rounded text-red-500 hover:text-red-700 z-10 ml-2"
                                      title="Delete task"
                                      type="button"
                                    >
                                      <X size={14} />
                                    </button>
                                  </li>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                          </ul>
                        )}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>

                  {/* Add task to daily list */}
                  {!isDailyCollapsed && (
                    <div className="mt-2 flex gap-2">
                      <input
                        type="text"
                        placeholder="Add task…"
                        value={newDailyTask}
                        onChange={(e) => setNewDailyTask(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleAddDailyTask(); }}
                        className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none"
                      />
                      <button
                        onClick={handleAddDailyTask}
                        className="text-sm text-indigo-600 hover:underline"
                      >Add</button>
                    </div>
                  )}
                   
                  {/* Divider removed */}

                  {/* Master tasks */}
                  <div
                    className={`flex items-center justify-between text-sm font-medium text-gray-900 mb-2 cursor-pointer select-none ${(taskView as any)==='Today' ? 'hidden' : ''}`}
                    onClick={() => setIsOpenCollapsed((c) => !c)}
                  >
                    <span>All open tasks</span>
                    {isOpenCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                  </div>
                  <Droppable droppableId="openTasks">
                    {(provided: any) => (
                      <ul
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`space-y-2 text-sm text-gray-700 pr-1 transition-[max-height] duration-200 overflow-y-auto ${(taskView as any)==='Today' ? 'hidden' : ''}`}
                        style={{ maxHeight: isOpenCollapsed ? 0 : '12rem' }}
                      >
                        {isLoadingAllTasks && openTasksToShow.length === 0 ? (
                          <li className="text-gray-500">Loading…</li>
                        ) : null}

                        {!isLoadingAllTasks && openTasksToShow.length === 0 ? (
                          <li className="text-gray-500">No tasks</li>
                        ) : null}

                        {openTasksToShow.map((t: any, index: number) => (
                          <Draggable draggableId={t.id.toString()} index={index} key={t.id} isDragDisabled={!!resizingTask}>
                            {(provided: any) => (
                              <li
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                style={provided.draggableProps.style}
                                className="flex items-start gap-2 px-3 py-3 bg-white border border-black/10 shadow-sm rounded-lg"
                              >
                                <input
                                  type="checkbox"
                                  aria-label={t.content}
                                  checked={t.completed ?? false}
                                  onChange={() => toggleTaskCompletion(t.id.toString())}
                                  className={`${t.completed ? 'accent-purple-600' : 'accent-indigo-500'} mt-0.5`}
                                />
                                <span className={t.completed ? 'line-through text-gray-400' : ''}>{t.content}</span>
                              </li>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </ul>
                    )}
                  </Droppable>

                  {/* Add open task (hidden in Today view) */}
                  {false && (
                    <div className="mt-2 flex gap-2">
                      <input
                        type="text"
                        placeholder="Add task…"
                        value={newOpenTask}
                        onChange={(e) => setNewOpenTask(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleAddOpenTask(); }}
                        className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none"
                      />
                      <button
                        onClick={handleAddOpenTask}
                        className="text-sm text-indigo-600 hover:underline"
                      >Add</button>
                    </div>
                  )}
                  </>)}

                  {taskView === 'Master List' && (<>
                  {/* Divider removed */}

                  {/* Today tasks header (droppable) */}
                  <Droppable droppableId="dailyTasks">
                    {(provided: any) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className="flex flex-col mb-4"
                      >
                        <div
                          className="flex items-center justify-between text-sm font-medium text-gray-900 mb-2 cursor-pointer select-none"
                          onClick={() => setIsDailyCollapsed((c) => !c)}
                        >
                          <span>Tasks on {format(selectedDate,'MMM d, yyyy')}</span>
                          {isDailyCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                        </div>

                        <ul
                          className="space-y-2 text-sm text-gray-700 pr-1 transition-[max-height] duration-200"
                          style={{ maxHeight: isDailyCollapsed ? 0 : '10rem' }}
                        >
                          {dailyVisibleTasks.map((t: any, index: number) => (
                            <Draggable draggableId={t.id.toString()} index={index} key={t.id} isDragDisabled={!!resizingTask}>
                              {(provided: any) => (
                                <li
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  style={provided.draggableProps.style}
                                  className="flex items-start gap-2 px-3 py-3 bg-white border border-black/10 shadow-sm rounded-lg"
                                >
                                  <input
                                    type="checkbox"
                                    aria-label={t.content}
                                    checked={t.completed ?? false}
                                    onChange={() => toggleTaskCompletion(t.id.toString())}
                                    className={`${t.completed ? 'accent-purple-600' : 'accent-indigo-500'} mt-0.5`}
                                  />
                                  <span className={t.completed ? 'line-through text-gray-400' : ''}>{t.content}</span>
                                </li>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </ul>
                      </div>
                    )}
                  </Droppable>

                  {/* Divider removed */}

                  {/* Master tasks */}
                  <div
                    className={`flex items-center justify-between text-sm font-medium text-gray-900 mb-2 cursor-pointer select-none ${(taskView as any)==='Today' ? 'hidden' : ''}`}
                    onClick={() => setIsOpenCollapsed((c) => !c)}
                  >
                    <span>All open tasks</span>
                    {isOpenCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                  </div>
                  <Droppable droppableId="openTasks">
                    {(provided: any) => (
                      <ul
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className="space-y-2 text-sm text-gray-700 pr-1 transition-[max-height] duration-200 overflow-y-auto"
                        style={{ maxHeight: isOpenCollapsed ? 0 : '12rem' }}
                      >
                        {isLoadingAllTasks && openTasksToShow.length === 0 ? (
                          <li className="text-gray-500">Loading…</li>
                        ) : null}

                        {!isLoadingAllTasks && openTasksToShow.length === 0 ? (
                          <li className="text-gray-500">No tasks</li>
                        ) : null}

                        {openTasksToShow.map((t: any, index: number) => (
                          <Draggable draggableId={t.id.toString()} index={index} key={t.id} isDragDisabled={!!resizingTask}>
                            {(provided: any) => (
                              <li
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                style={provided.draggableProps.style}
                                className="flex items-start gap-2 px-3 py-3 bg-white border border-black/10 shadow-sm rounded-lg"
                              >
                                <input
                                  type="checkbox"
                                  aria-label={t.content}
                                  checked={t.completed ?? false}
                                  onChange={() => toggleTaskCompletion(t.id.toString())}
                                  className={`${t.completed ? 'accent-purple-600' : 'accent-indigo-500'} mt-0.5`}
                                />
                                <span className={t.completed ? 'line-through text-gray-400' : ''}>{t.content}</span>
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
                    <div className="mt-2 flex gap-2">
                      <input
                        type="text"
                        placeholder="Add task…"
                        value={newOpenTask}
                        onChange={(e) => setNewOpenTask(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleAddOpenTask(); }}
                        className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none"
                      />
                      <button
                        onClick={handleAddOpenTask}
                        className="text-sm text-indigo-600 hover:underline"
                      >Add</button>
                    </div>
                  )}
                  </>)}

                  {taskView === 'Today' && (
                    <>
                      {/* Current Time Indicator */}
            <div className="flex items-center gap-1 text-sm text-gray-600 mt-4">
              <Clock size={14} className="text-indigo-500" />
              <span suppressHydrationWarning>{format(currentTime, 'h:mm a')}</span>
            </div>
            {/* Hourly Planner */}
                      <div
                        className="flex items-center justify-between text-sm font-medium text-gray-900 mt-4 mb-2 cursor-pointer select-none"
                        onClick={() => setIsPlannerCollapsed((c) => !c)}
                      >
                        <span>Hourly Planner</span>
                        {isPlannerCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                      </div>
                      <div
                        ref={plannerRef} className="space-y-2 pr-1 transition-[max-height] duration-200"
                        style={{ maxHeight: isPlannerCollapsed ? 0 : 'none' }}
                      >
                        {!isPlannerCollapsed && <HourlyPlanner className="" />}
                      </div>
                    </>
                  )}

                  {/* Upcoming Tasks View */}
                  {taskView === 'Upcoming' && (
                    <>
                      {/* Next 7 Days */}
                      <div
                        className="flex items-center justify-between text-sm font-medium text-gray-900 mb-2 cursor-pointer select-none"
                        onClick={() => setIsNext7DaysCollapsed((c) => !c)}
                      >
                        <span className="flex items-center gap-2">
                          <span>⚡</span>
                          <span>Next 7 Days</span>
                          <span className="text-xs text-gray-500">({upcomingTaskGroups.next7Days.length})</span>
                        </span>
                        {isNext7DaysCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                      </div>
                      <Droppable droppableId="next7Days">
                        {(provided: any) => (
                          <ul
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className="space-y-2 text-sm text-gray-700 pr-1 transition-[max-height] duration-200 overflow-y-auto"
                            style={{ maxHeight: isNext7DaysCollapsed ? 0 : '12rem' }}
                          >
                            {upcomingTaskGroups.next7Days.length === 0 ? (
                              <li className="text-gray-500">No tasks</li>
                            ) : null}
                            {upcomingTaskGroups.next7Days.map((t: any, index: number) => (
                              <Draggable draggableId={t.id.toString()} index={index} key={t.id}>
                                {(provided: any) => (
                                  <li
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    className="flex items-center justify-between rounded-md border border-gray-200 bg-gray-50 p-2 hover:bg-gray-100"
                                  >
                                    <span className="flex-1">{t.content}</span>
                                    <span className="text-xs text-gray-500 ml-2">
                                      {formatTimeUntilDue(getTimeUntilDue(t.due?.date))}
                                    </span>
                                  </li>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                          </ul>
                        )}
                      </Droppable>

                      {/* Next 2 Weeks */}
                      <div
                        className="flex items-center justify-between text-sm font-medium text-gray-900 mb-2 mt-4 cursor-pointer select-none"
                        onClick={() => setIsNext2WeeksCollapsed((c) => !c)}
                      >
                        <span className="flex items-center gap-2">
                          <span>📅</span>
                          <span>Next 2 Weeks</span>
                          <span className="text-xs text-gray-500">({upcomingTaskGroups.next2Weeks.length})</span>
                        </span>
                        {isNext2WeeksCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                      </div>
                      <Droppable droppableId="next2Weeks">
                        {(provided: any) => (
                          <ul
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className="space-y-2 text-sm text-gray-700 pr-1 transition-[max-height] duration-200 overflow-y-auto"
                            style={{ maxHeight: isNext2WeeksCollapsed ? 0 : '12rem' }}
                          >
                            {upcomingTaskGroups.next2Weeks.length === 0 ? (
                              <li className="text-gray-500">No tasks</li>
                            ) : null}
                            {upcomingTaskGroups.next2Weeks.map((t: any, index: number) => (
                              <Draggable draggableId={t.id.toString()} index={index} key={t.id}>
                                {(provided: any) => (
                                  <li
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    className="flex items-center justify-between rounded-md border border-gray-200 bg-gray-50 p-2 hover:bg-gray-100"
                                  >
                                    <span className="flex-1">{t.content}</span>
                                    <span className="text-xs text-gray-500 ml-2">
                                      {formatTimeUntilDue(getTimeUntilDue(t.due?.date))}
                                    </span>
                                  </li>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                          </ul>
                        )}
                      </Droppable>

                      {/* Later */}
                      <div
                        className="flex items-center justify-between text-sm font-medium text-gray-900 mb-2 mt-4 cursor-pointer select-none"
                        onClick={() => setIsLaterCollapsed((c) => !c)}
                      >
                        <span className="flex items-center gap-2">
                          <span>🗓️</span>
                          <span>Later</span>
                          <span className="text-xs text-gray-500">({upcomingTaskGroups.later.length})</span>
                        </span>
                        {isLaterCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                      </div>
                      <Droppable droppableId="later">
                        {(provided: any) => (
                          <ul
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className="space-y-2 text-sm text-gray-700 pr-1 transition-[max-height] duration-200 overflow-y-auto"
                            style={{ maxHeight: isLaterCollapsed ? 0 : '12rem' }}
                          >
                            {upcomingTaskGroups.later.length === 0 ? (
                              <li className="text-gray-500">No tasks</li>
                            ) : null}
                            {upcomingTaskGroups.later.map((t: any, index: number) => (
                              <Draggable draggableId={t.id.toString()} index={index} key={t.id}>
                                {(provided: any) => (
                                  <li
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    className="flex items-center justify-between rounded-md border border-gray-200 bg-gray-50 p-2 hover:bg-gray-100"
                                  >
                                    <span className="flex-1">{t.content}</span>
                                    <span className="text-xs text-gray-500 ml-2">
                                      {formatTimeUntilDue(getTimeUntilDue(t.due?.date))}
                                    </span>
                                  </li>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                          </ul>
                        )}
                      </Droppable>

                      {/* No Due Date */}
                      <div
                        className="flex items-center justify-between text-sm font-medium text-gray-900 mb-2 mt-4 cursor-pointer select-none"
                        onClick={() => setIsNoDueDateCollapsed((c) => !c)}
                      >
                        <span className="flex items-center gap-2">
                          <span>📋</span>
                          <span>No Due Date</span>
                          <span className="text-xs text-gray-500">({upcomingTaskGroups.noDueDate.length})</span>
                        </span>
                        {isNoDueDateCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                      </div>
                      <Droppable droppableId="noDueDate">
                        {(provided: any) => (
                          <ul
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className="space-y-2 text-sm text-gray-700 pr-1 transition-[max-height] duration-200 overflow-y-auto"
                            style={{ maxHeight: isNoDueDateCollapsed ? 0 : '12rem' }}
                          >
                            {upcomingTaskGroups.noDueDate.length === 0 ? (
                              <li className="text-gray-500">No tasks</li>
                            ) : null}
                            {upcomingTaskGroups.noDueDate.map((t: any, index: number) => (
                              <Draggable draggableId={t.id.toString()} index={index} key={t.id}>
                                {(provided: any) => (
                                  <li
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    className="flex items-center justify-between rounded-md border border-gray-200 bg-gray-50 p-2 hover:bg-gray-100"
                                  >
                                    <span className="flex-1">{t.content}</span>
                                    <span className="text-xs text-gray-500 ml-2">No due date</span>
                                  </li>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                          </ul>
                        )}
                      </Droppable>
                    </>
                  )}
                </DragDropContext>
              </div>
            </div>
          </aside>
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

        {/* Nutrition Widget Modal */}
        <Sheet open={nutritionWidgetOpen} onOpenChange={(open) => {
          setNutritionWidgetOpen(open)
          if (!open) {
            // Force refresh nutrition widgets when panel closes
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent('nutritionDataUpdated'))
            }, 100)
          }
        }}>
          <SheetContent side="right" className="w-[600px] sm:w-[700px] overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="text-indigo-950">Daily Nutrition Tracker</SheetTitle>
            </SheetHeader>
            <div className="mt-6">
              <NutritionMealTracker />
            </div>
          </SheetContent>
        </Sheet>

        {/* Medication Widget Modal */}
        <Sheet open={medicationWidgetOpen} onOpenChange={setMedicationWidgetOpen}>
          <SheetContent side="right" className="w-[600px] sm:w-[700px] overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="text-indigo-950">Medication Tracker</SheetTitle>
            </SheetHeader>
            <div className="mt-6">
              <MedicationTrackerWidget />
            </div>
          </SheetContent>
        </Sheet>

        {/* Exercise Widget Modal */}
        <Sheet open={exerciseWidgetOpen} onOpenChange={setExerciseWidgetOpen}>
          <SheetContent side="right" className="w-[600px] sm:w-[700px] overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="text-indigo-950">Exercise Tracker</SheetTitle>
            </SheetHeader>
            <div className="mt-6">
              <ExerciseWidget onClose={() => setExerciseWidgetOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>

        {/* Home Projects Widget Modal */}
        <Sheet open={homeProjectsWidgetOpen} onOpenChange={setHomeProjectsWidgetOpen}>
          <SheetContent side="right" className="w-[600px] sm:w-[700px] overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="text-indigo-950">Home Projects</SheetTitle>
            </SheetHeader>
            <div className="mt-6">
              <HomeProjectsWidget 
                widget={getDisplayWidgets(activeBucket).find(w => w.id === 'home_projects') || {} as WidgetInstance}
                onUpdate={(updatedWidget) => {
                  setWidgetsByBucket(prev => ({
                    ...prev,
                    [activeBucket]: prev[activeBucket]?.map(w => 
                      w.instanceId === updatedWidget.instanceId ? updatedWidget : w
                    ) || []
                  }));
                }}
                onAddToTasks={async (projectTitle: string, projectDescription?: string, dueDate?: string) => {
                  try {
                    await contextCreateTask(projectTitle, dueDate || null);
                  } catch (error) {
                    console.error('Failed to add project to tasks:', error);
                  }
                }}
              />
            </div>
          </SheetContent>
        </Sheet>

        {/* Add Bucket Sheet */}
        <Sheet open={isEditorOpen} onOpenChange={setIsEditorOpen}>
            <SheetContent side="right" className="w-[420px] sm:w-[500px] overflow-y-auto">
              <SheetHeader>
                <SheetTitle className="text-indigo-950">Add a new bucket</SheetTitle>
              </SheetHeader>
              <div className="space-y-6 mt-6">
                {/* Add new bucket input */}
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="New bucket name (e.g. Fitness)"
                    value={newBucket}
                    onChange={(e) => setNewBucket(e.target.value)}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  />
                  <div className="flex justify-end gap-3">
                    <Button variant="secondary" onClick={() => setIsEditorOpen(false)}>Close</Button>
                    <Button onClick={() => {
                      handleAddBucket();
                      setNewBucket('');
                    }}>Add Bucket</Button>
                  </div>
                </div>

                {/* Suggested buckets */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Suggestions</h4>
                  <div className="flex flex-wrap gap-2">
                    {SUGGESTED_BUCKETS.filter(b=>!buckets.includes(b)).map((b)=>(
                      <button
                        key={b}
                        onClick={() => {
                          if (buckets.includes(b)) return;
                          setBuckets(prev=>[...prev,b]);
                          if (typeof window!== 'undefined') {
                            localStorage.setItem('life_buckets', JSON.stringify([...buckets,b]));
                          }
                          // Save to Supabase
                          (async ()=>{
                            try{
                              const prefs = await getUserPreferencesClient();
                              if (prefs){ await saveUserPreferences({ ...prefs, life_buckets:[...buckets,b] }); }
                            }catch(err){ console.error('Failed to save bucket suggestion',err);} })();
                        }}
                        className="px-3 py-1.5 rounded bg-gray-100 text-gray-700 hover:bg-gray-200 text-xs"
                      >{b}</button>
                    ))}
                  </div>
                </div>

                {/* Existing buckets list */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Existing buckets</h4>
                  <ul className="space-y-2">
                    {buckets.map((b) => (
                      <li key={b} className="flex items-center justify-between rounded border px-3 py-2 text-sm">
                        <span>{b}</span>
                        {buckets.length > 1 ? (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleRemoveBucket(b)}
                            aria-label={`Delete ${b}`}
                          >
                            <X className="h-4 w-4 text-red-500" />
                          </Button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </SheetContent>
          </Sheet>

        {/* Widget library sheet */}
        <Sheet open={isWidgetSheetOpen} onOpenChange={setIsWidgetSheetOpen}>
          <SheetContent side="right" className="w-[800px] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Add a Widget</SheetTitle>
            </SheetHeader>
            <WidgetLibrary
              bucket={activeBucket}
              onAdd={(widgetOrTemplate: WidgetTemplate | WidgetInstance) => {
                const isInstance = 'instanceId' in widgetOrTemplate;
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
                    };
                const updated = { ...widgetsByBucket };
                updated[activeBucket] = [...(updated[activeBucket] ?? []), newInstance];
                setWidgetsByBucket(updated);
                widgetsByBucketRef.current = updated; // Update the ref immediately
                setIsWidgetSheetOpen(false);
                // Automatically open editor for new widgets
                setNewlyCreatedWidgetId(newInstance.instanceId);
                setEditingWidget(newInstance);
                setEditingBucket(activeBucket);
                // Save immediately
                debouncedSaveToSupabase();
              }}
            />
          </SheetContent>
        </Sheet>

      </div>
      <ChatBar />
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
      <TaskBoardDashboardInner selectedDate={selectedDate} setSelectedDate={setSelectedDate} />
    </TasksProvider>
  );
}