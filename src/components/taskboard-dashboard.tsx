"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";

import Image from "next/image";
import { supabase } from "@/utils/supabase/client";
import { getUserPreferencesClient, saveUserPreferences } from "@/lib/user-preferences";
import { format, addDays, isSameDay } from 'date-fns';
import {
  type LucideIcon,
  Plus,
  Search,
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
  Cloud,
  CloudSun,
  CloudRain,
  CloudSnow,
  CloudLightning,
  Sun,
  LayoutDashboard,
  Settings as SettingsIcon,
  User,
  ListChecks,
} from "lucide-react";
import { WidgetLibrary } from "./widget-library";
import type { WidgetTemplate, WidgetInstance } from "@/types/widgets";
import WidgetEditorSheet from "@/components/widget-editor";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import TrendsPanel from "./trends-panel";

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

export function TaskBoardDashboard() {
  const [buckets, setBuckets] = useState<string[]>([]);
  const [activeBucket, setActiveBucket] = useState<string>("");
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [newBucket, setNewBucket] = useState("");
  const [isWidgetSheetOpen, setIsWidgetSheetOpen] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [widgetsByBucket, setWidgetsByBucket] = useState<Record<string, WidgetInstance[]>>({});
  const [weather, setWeather] = useState<{ icon: LucideIcon; temp: number } | null>(null);
  const [date, setDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isWidgetLoadComplete, setIsWidgetLoadComplete] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const widgetsByBucketRef = useRef(widgetsByBucket);
  widgetsByBucketRef.current = widgetsByBucket;

  // Editing widget state
  const [editingWidget, setEditingWidget] = useState<WidgetInstance | null>(null);
  const [editingBucket, setEditingBucket] = useState<string | null>(null);

  // ----------------------------------------------------------------------
  // Progress tracking state  { [instanceId]: { value:number; streak:number; lastCompleted:string } }
  // ----------------------------------------------------------------------
  interface ProgressEntry { value:number; date:string; streak:number; lastCompleted:string; }
  const [progressByWidget, setProgressByWidget] = useState<Record<string, ProgressEntry>>({});
  
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
  const [isLoadingFitbit, setIsLoadingFitbit] = useState(false);
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
  
  // Dashboard inner subtabs (left panel)
  const [activeSubTab, setActiveSubTab] = useState<'Overview'|'Trends'|'Logs'|'Settings'>('Overview');
  
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
                  existing.date = todayStr;
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
                setTodoistTasks(allTasks.filter(t=>t.due?.date===iso));
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

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
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
    // 1) Moves involving the hourly planner
    // ------------------------------------------------------------------
    if (isHour(source.droppableId) && isHour(destination.droppableId)) {
      // Re-arrange or move between hours
      setHourlyPlan((prev) => {
        const next = { ...prev };
        const srcHour = hourKey(source.droppableId);
        const dstHour = hourKey(destination.droppableId);
        const srcArr = [...next[srcHour]];
        const [moved] = srcArr.splice(source.index, 1);
        if (!moved) return prev;
        next[srcHour] = srcArr;
        const dstArr = [...next[dstHour]];
        dstArr.splice(destination.index, 0, moved);
        next[dstHour] = dstArr;
        return next;
      });
      return;
    }

    if (source.droppableId === 'dailyTasks' && isHour(destination.droppableId)) {
      // Daily ➜ Hour slot (no due-date change)
      const moved = todoistTasks[source.index];
      if (!moved) return;

      // Remove from daily list
      setTodoistTasks((prev) => {
        const next = [...prev];
        next.splice(source.index, 1);
        return next;
      });

      // Add to planner
      const dstHour = hourKey(destination.droppableId);
      setHourlyPlan((prev) => {
        const next = { ...prev };
        const arr = [...next[dstHour]];
        arr.splice(destination.index, 0, moved);
        next[dstHour] = arr;
        return next;
      });
      return;
    }

    if (isHour(source.droppableId) && destination.droppableId === 'dailyTasks') {
      // Hour slot ➜ Daily list
      const srcHour = hourKey(source.droppableId);
      const moved = hourlyPlan[srcHour][source.index];
      if (!moved) return;

      // Remove from planner
      setHourlyPlan((prev) => {
        const next = { ...prev };
        const arr = [...next[srcHour]];
        arr.splice(source.index, 1);
        next[srcHour] = arr;
        return next;
      });

      // Insert into daily list
      setTodoistTasks((prev) => {
        const next = [...prev];
        next.splice(destination.index, 0, moved);
        return next;
      });
      return;
    }

    if (source.droppableId === 'openTasks' && isHour(destination.droppableId)) {
      // Open list ➜ Hour slot (needs due-date set to today)
      const openVisible = allTodoistTasks.filter(
        (t: any) => t.due?.date !== selectedDateStr
      );
      const moved = openVisible[source.index];
      if (!moved) return;

      const updatedDue = moved.due ? { ...moved.due, date: selectedDateStr } : { date: selectedDateStr };
      const updated = { ...moved, due: updatedDue };

      // Update master list
      setAllTodoistTasks((prev) => {
        const without = removeById(prev, draggableId);
        const openSubset: any[] = [];
        const datedSubset: any[] = [];
        without.forEach((task) => {
          if (task.due?.date === selectedDateStr) datedSubset.push(task);
          else openSubset.push(task);
        });
        datedSubset.push(updated);
        return [...openSubset, ...datedSubset];
      });

      // Add to planner
      const dstHour = hourKey(destination.droppableId);
      setHourlyPlan((prev) => {
        const next = { ...prev };
        const arr = [...next[dstHour]];
        arr.splice(destination.index, 0, updated);
        next[dstHour] = arr;
        return next;
      });

      await updateTaskDueDate(draggableId, selectedDateStr);
      return;
    }

    if (isHour(source.droppableId) && destination.droppableId === 'openTasks') {
      // Hour slot ➜ Open list (clear due-date)
      const srcHour = hourKey(source.droppableId);
      const moved = hourlyPlan[srcHour][source.index];
      if (!moved) return;

      const clearedDue = moved.due ? { ...moved.due, date: null } : { date: null };
      const cleared = { ...moved, due: clearedDue };

      // Remove from planner
      setHourlyPlan((prev) => {
        const next = { ...prev };
        const arr = [...next[srcHour]];
        arr.splice(source.index, 1);
        next[srcHour] = arr;
        return next;
      });

      // Insert into open list ui order
      setAllTodoistTasks((prev) => {
        const without = removeById(prev, draggableId);
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
      return;
    }

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

    // Optionally you can refresh from server, but keeping as-is to avoid flicker
    // fetchTodoistTasks(selectedDate);
    // fetchAllTodoistTasks();
  };

  // modify useEffect to use fetchIntegrationsData
  useEffect(()=>{fetchIntegrationsData(); const int=setInterval(fetchIntegrationsData,5*60*1000); return ()=>clearInterval(int);},[fetchIntegrationsData]);

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
  const todayStr = new Date().toISOString().slice(0,10);

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
      } catch (e) {
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
          setWidgetsByBucket(prefs.widgets_by_bucket);
          
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
        if (prefs) {
          await saveUserPreferences({
            ...prefs,
            widgets_by_bucket: localWidgets
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

  async function loadBuckets() {
    let loadedFromLocal = false;
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('life_buckets');
        if (stored) {
          const parsed: string[] = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length) {
            setBuckets(parsed);
            setActiveBucket(parsed[0]);
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
        setActiveBucket(prefs.life_buckets[0]);
      } else {
        // If no buckets found, set default buckets
        console.log('No buckets found, setting defaults');
        const defaultBuckets = ['Health', 'Work', 'Personal', 'Finance'];
        setBuckets(defaultBuckets);
        setActiveBucket(defaultBuckets[0]);
        
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
      setActiveBucket(defaultBuckets[0]);
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
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const firstDayOfMonth = () => {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  };

  const getDayOfWeek = (date: Date) => {
    return date.toLocaleString('en-US', { weekday: 'long' });
  };

  const getDaysArray = () => {
    const days = [];
    for (let i = 1; i <= daysInMonth(); i++) {
      days.push(new Date(date.getFullYear(), date.getMonth(), i));
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
    setDate(normalized);
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

  /**
   * Create a new Todoist task (optionally for the selected date)
   */
  const createTask = async (content: string, dueDate: string | null) => {
    const trimmed = content.trim();
    if (!trimmed) return;

    // --------------------------------------------------
    // 1. Optimistic UI update
    // --------------------------------------------------
    const tempId = `temp-${Date.now()}`;
    const optimisticTask: any = {
      id: tempId,
      content: trimmed,
      completed: false,
      due: dueDate ? { date: dueDate } : null,
    };

    setAllTodoistTasks((prev) => [optimisticTask, ...prev]);
    if (dueDate) {
      const selectedDateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
      if (dueDate === selectedDateStr) {
        setTodoistTasks((prev) => [optimisticTask, ...prev]);
      }
    }

    try {
      // --------------------------------------------------
      // 2. Call API to actually create task in Todoist
      // --------------------------------------------------
      const res = await fetch('/api/integrations/todoist/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: trimmed, dueDate }),
      });

      if (!res.ok) {
        console.error('Failed to create task', await res.text());
        throw new Error('Todoist create failed');
      }

      const { task } = await res.json();
      if (!task) throw new Error('No task returned');

      task.completed = false;

      // --------------------------------------------------
      // 3. Replace optimistic task with the real one
      // --------------------------------------------------
      setAllTodoistTasks((prev) => {
        const without = prev.filter((t) => t.id !== tempId);
        return [task, ...without];
      });

      if (dueDate) {
        const selectedDateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
        if (dueDate === selectedDateStr) {
          setTodoistTasks((prev) => {
            const without = prev.filter((t) => t.id !== tempId);
            return [task, ...without];
          });
        }
      }
    } catch (err) {
      // --------------------------------------------------
      // 4. Roll back optimistic update on failure
      // --------------------------------------------------
      console.error('Error creating task', err);
      setAllTodoistTasks((prev) => prev.filter((t) => t.id !== tempId));
      if (dueDate) {
        const selectedDateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
        if (dueDate === selectedDateStr) {
          setTodoistTasks((prev) => prev.filter((t) => t.id !== tempId));
        }
      }
    }
  };

  const handleAddDailyTask = () => {
    const selectedDateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
    createTask(newDailyTask, selectedDateStr);
    setNewDailyTask('');
  };

  const handleAddOpenTask = () => {
    createTask(newOpenTask, null);
    setNewOpenTask('');
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

  // ----------------------------------------------
  // Hourly planner (7 AM → 5 PM)
  // ----------------------------------------------
  const hours = useMemo(() => {
    return Array.from({ length: 11 }, (_, i) => {
      const h = 7 + i; // 7-17
      const disp = `${((h % 12) || 12)}${h < 12 ? 'AM' : 'PM'}`;
      return disp;
    });
  }, []);

  // Map of hour → tasks scheduled for that slot
  const [hourlyPlan, setHourlyPlan] = useState<Record<string, any[]>>(() => {
    const obj: Record<string, any[]> = {};
    hours.forEach((h) => {
      obj[h] = [];
    });
    return obj;
  });

  // Convenience: tasks in planner so we can hide them from the daily list
  const assignedTaskIds = useMemo(() => {
    return new Set(
      Object.values(hourlyPlan)
        .flat()
        .map((t) => t.id.toString())
    );
  }, [hourlyPlan]);
  const dailyVisibleTasks = todoistTasks.filter(
    (t) => !assignedTaskIds.has(t.id.toString())
  );

  // Helpers for droppable id parsing
  const isHour = (id: string) => id.startsWith('hour-');
  const hourKey = (id: string) => id.replace('hour-', '');

  // Add the convertWidgetToTask function after the createTask function (around line 1480)
  const convertWidgetToTask = async (widget: WidgetInstance) => {
    // Create a task content string from the widget
    const taskContent = `${widget.name}: ${widget.target} ${widget.unit}`;
    
    // Create a task for today
    await createTask(taskContent, selectedDateStr);
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
    <div className="min-h-screen bg-[#F6F6FC] pl-[120px]">

      {/* Sidebar */}
      <div className="fixed left-0 top-16 bottom-0 w-20 bg-white border-r border-gray-100 flex flex-col items-center py-4 gap-6 z-30">
        {/* Home (active) */}
        <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center">
          <Home className="w-5 h-5 text-indigo-500" />
        </div>
        {/* Profile */}
        <div className="w-10 h-10 rounded-lg flex items-center justify-center">
          <User className="w-5 h-5 text-gray-400" />
        </div>
        {/* Tasks */}
        <div className="w-10 h-10 rounded-lg flex items-center justify-center">
          <FileText className="w-5 h-5 text-gray-400" />
        </div>
        {/* Calendar */}
        <div className="w-10 h-10 rounded-lg flex items-center justify-center">
          <Calendar className="w-5 h-5 text-gray-400" />
        </div>
        {/* Search */}
        <div className="w-10 h-10 rounded-lg flex items-center justify-center">
          <Search className="w-5 h-5 text-gray-400" />
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Main column */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex min-h-screen flex-col">
        {/* Header */}
        {/* Full-width header – pull left over the sidebar */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-gray-100 bg-white px-10 -ml-[120px] w-[calc(100%+120px)]">
          <div className="flex items-center gap-1 text-2xl font-semibold">
            <span className="text-indigo-500">AI</span>
            <span>TaskBoard</span>
          </div>
          <div className="flex items-center gap-4">
            {weather && (() => { const Icon = weather.icon; return (
              <div className="flex items-center gap-1 text-gray-600 text-sm">
                <Icon className="h-5 w-5" />
                <span>{Math.round(weather.temp)}°</span>
              </div>
            ); })()}
            {/* Temporary cleanup button - remove after use */}
            {Object.values(widgetsByBucket).some(widgets => 
              widgets.some(w => w.instanceId?.startsWith('debug-'))
            ) && (
              <button 
                onClick={cleanupDebugWidgets}
                className="text-xs text-red-600 underline"
              >
                Clean Debug Widgets
              </button>
            )}
            <button 
              onClick={handleSignOut} 
              disabled={isSigningOut}
              className={`flex items-center gap-2 rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 ${isSigningOut ? 'opacity-50 cursor-not-allowed' : ''}`}>
              <LogOut className="h-5 w-5" />
              Sign out
            </button>
          </div>
        </header>

        {/* Greeting */}
        <section className="w-full pr-10 pt-6 sm:pt-10">
          <h2 className="text-base font-medium text-gray-800">
            Hello Dalit <span className="ml-2 text-sm font-normal text-gray-500">You've got this!</span>
          </h2>
          
          {/* Bucket tabs row (scrollable) */}
          <div
            className="relative z-20 mt-10"
            /* Width matches the white widget panel: total minus sidebar (400px) + gap (40px) */
            style={{ width: 'calc(100% - 440px)' }}
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
                      ? 'bg-gradient-to-r from-[#7482FE] to-[#909CFF] text-white shadow-[0_2px_6px_rgba(0,0,0,0.12)]'
                      : 'bg-white text-[#7482FE] hover:bg-gray-50 shadow-[0_2px_4px_rgba(0,0,0,0.08)]'
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
                className="relative flex h-[44px] items-center justify-center rounded-t-[20px] bg-white px-8 text-[21px] font-bold transition-colors hover:bg-gray-50 shadow-[0_2px_4px_rgba(0,0,0,0.08)]"
              >
                <span className="bg-gradient-to-r from-[#7482FE] to-[#909CFF] bg-clip-text text-transparent">
                  +
                </span>
              </button>
            </div>
            {/* scroll container ends */}
            {/* bottom gray divider under all tabs (fixed) */}
            <div
              className="pointer-events-none absolute bottom-0 left-0 h-px bg-gray-200"
              style={{ zIndex: 60, width: '100%' }}
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
                className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-[#F6F6FC]/95 via-[#F6F6FC]/70 to-transparent"
                style={{ zIndex: 70 }}
              />
            )}
            </div>
        </section>

        {/* Main content container */}
        <div className="w-full flex-1 pr-10 pb-24 flex gap-10">
          {/* Left section: tabs and widgets */}
          <div className="flex-1">
            <div className="relative z-10 -mt-px flex h-full flex-col overflow-hidden rounded-b-lg border-t border-gray-200 bg-white shadow-sm">
              {/* Inner nav */}
              <nav className="flex items-center gap-8 border-b border-gray-100 px-6 pt-4 text-sm font-medium">
                {(['Overview','Trends','Logs','Settings'] as const).map((item) => (
                  <button
                    key={item}
                    onClick={() => setActiveSubTab(item)}
                    className={`pb-3 border-b-2 transition-colors ${
                      item === activeSubTab
                        ? 'border-indigo-500 text-indigo-500'
                        : 'border-transparent text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </nav>

              {/* Content area */}
              <div className="flex-1 overflow-y-auto p-6">
                {/* Widgets grid */}
                <div className={activeSubTab === 'Overview' ? 'flex flex-wrap gap-4' : 'hidden'}>
                  {/* Refresh card */}
                  <div
                    onClick={isRefreshing ? undefined : fetchIntegrationsData}
                    className="w-48 rounded-lg border bg-white p-3 shadow-sm relative cursor-pointer hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded flex items-center justify-center bg-indigo-500">
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
                    if (w.id === 'water' && w.dataSource === 'fitbit' && fitbitData.water !== undefined) {
                      todayVal = fitbitData.water;
                    } else if (w.id === 'steps' && w.dataSource === 'fitbit' && fitbitData.steps !== undefined) {
                      todayVal = fitbitData.steps;
                    } else {
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
                      <div key={w.instanceId} className={`w-48 rounded-lg border ${cardBgClass} p-3 shadow-sm relative group cursor-pointer`} onClick={() => { setEditingWidget(w); setEditingBucket(activeBucket); }}>
                                                  <div className="flex absolute top-1 right-1 gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                convertWidgetToTask(w);
                              }}
                              className="rounded-full bg-indigo-100 hover:bg-indigo-200 p-1"
                              aria-label="Convert to task"
                            >
                              <ListChecks className="h-3 w-3 text-indigo-600" />
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
                              className="rounded-full bg-red-100 hover:bg-red-200 p-1"
                              aria-label="Delete widget"
                            >
                              <X className="h-3 w-3 text-red-600" />
                            </button>
                          </div>
                        <div className="flex items-center gap-2">
                          {(() => {
                            let IconComponent:any = null;
                            if (typeof w.icon === 'string') {
                              IconComponent = getIconComponent(w.icon);
                            } else if (typeof w.icon === 'function') {
                              IconComponent = w.icon;
                            }
                            if (!IconComponent) {
                              IconComponent = getIconComponent(w.id);
                            }
                            if (!IconComponent) return <div className="h-5 w-5 bg-gray-300 rounded" />;

                            // Get color - fallback to widget template default if not set
                            const widgetColor = w.color || getTemplateColor(w.id) || 'gray';

                            return (
                              <div
                                className={`w-8 h-8 rounded flex items-center justify-center ${BG_COLOR_CLASSES[widgetColor] ?? 'bg-gray-500'}`}
                              >
                                <IconComponent className="h-5 w-5 text-white" />
                              </div>
                            );
                          })()}
                          <span className="text-sm font-medium truncate">{w.name}</span>
                        </div>
                        <p className="mt-2 text-xs text-gray-500 truncate">{w.description}</p>

                        {(() => {
                          // For water widgets with Fitbit data source, use Fitbit data
                          let todayVal = 0;
                          let isFitbitData = false;
                          
                          if (w.id === 'water' && w.dataSource === 'fitbit' && fitbitData.water !== undefined) {
                            todayVal = fitbitData.water;
                            isFitbitData = true;
                          } else if (w.id === 'steps' && w.dataSource === 'fitbit' && fitbitData.steps !== undefined) {
                            todayVal = fitbitData.steps;
                            isFitbitData = true;
                          } else {
                            // Use manual progress tracking
                            const prog = progressByWidget[w.instanceId];
                            todayVal = prog && prog.date === todayStrGlobal ? prog.value : 0;
                          }
                          
                          const pct = Math.min(100, Math.round((todayVal / w.target) * 100));
                          const prog = progressByWidget[w.instanceId];
                          
                          return (
                            <div className="mt-3">
                              <div className="h-1 rounded bg-gray-200">
                                <div className={`h-1 rounded ${BG_COLOR_CLASSES[widgetColor] ?? 'bg-indigo-500'}`} style={{ width: `${pct}%` }} />
                              </div>
                              <div className="mt-1 flex items-center justify-between text-[11px] text-gray-500">
                                <span>
                                  {todayVal} / {w.target}
                                  {isFitbitData && <span className="ml-1 text-[10px] text-blue-500">Fitbit</span>}
                                </span>
                                {prog?.streak >= 2 && (<span className="text-amber-500">🔥 {prog.streak}</span>)}
                              </div>
                            </div>
                          );
                        })()}

                        {!( ['water','steps'].includes(w.id) && w.dataSource === 'fitbit') && (
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
                  <div className="w-48 rounded-lg border border-gray-100 bg-white p-3 shadow-sm flex flex-col items-center gap-2 cursor-pointer hover:bg-gray-50" onClick={() => setIsWidgetSheetOpen(true)}>
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
                  // Show trends only for widgets belonging to the currently selected bucket
                  <TrendsPanel widgets={getDisplayWidgets(activeBucket)} />
                )}
              </div>
            </div>
          </div>

          {/* Right section: Calendar and To-do */}
          <aside className="w-[400px] flex-shrink-0 -mt-12">
            <div className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm h-full flex flex-col">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-900">{format(date, 'MMMM yyyy')}</h3>
                <div className="flex gap-1 text-gray-500">
                  <button onClick={() => handleDateChange(addDays(date, -7))} aria-label="Previous week">&lt;</button>
                  <button onClick={() => handleDateChange(addDays(date, 7))} aria-label="Next week">&gt;</button>
                </div>
              </div>

              {/* Week view */}
              <div className="flex justify-between gap-2 overflow-x-auto pb-1">
                {getWeekDays().map((day, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleDateChange(day)}
                    className={`flex flex-col items-center rounded-xl px-3 py-2 w-14 transition-colors ${
                      isSameDay(day, selectedDate)
                        ? 'bg-gradient-to-r from-[#7482FE] to-[#909CFF] text-white'
                        : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <span className="text-lg font-semibold leading-none">{format(day, 'd')}</span>
                    <span className="text-xs leading-none mt-1">{format(day, 'EEE')}</span>
                  </button>
                ))}
              </div>

              {/* Task view toggle */}
              <div className="mt-4">
                <div className="flex rounded-full border border-[#E2E6F6] bg-white p-1 w-full shadow-sm">
                  {(['Today','Upcoming','Master List'] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setTaskView(tab)}
                      className={`flex-1 rounded-full px-4 py-1 text-sm font-semibold transition-colors ${
                        taskView === tab
                          ? 'bg-gradient-to-r from-[#7482FE] to-[#909CFF] text-white shadow'
                          : 'text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>

              {/* To-do lists with drag & drop */}
              <div className="mt-6 flex-1 overflow-hidden flex flex-col">
                <DragDropContext onDragEnd={handleDragEnd}>
                  {taskView === 'Today' && (<>
                  {/* Daily tasks (header + list share same droppable so header accepts drops) */}
                  <Droppable droppableId="dailyTasks">
                    {(provided: any) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className="flex flex-col"
                      >
                        <div
                          className="flex items-center justify-between text-sm font-medium text-gray-900 mb-2 cursor-pointer select-none"
                          onClick={() => setIsDailyCollapsed((c) => !c)}
                        >
                          <span>Todoist tasks on {format(selectedDate,'MMM d, yyyy')}</span>
                          {isDailyCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                        </div>

                        <ul
                          className="space-y-2 text-sm text-gray-700 overflow-y-auto pr-1 transition-[max-height] duration-200"
                          style={{ maxHeight: isDailyCollapsed ? 0 : '10rem' }}
                        >
                          {isLoadingTasks && dailyVisibleTasks.length === 0 ? (
                            <li className="text-gray-500">Loading…</li>
                          ) : null}

                          {!isLoadingTasks && dailyVisibleTasks.length === 0 ? (
                            <li className="text-gray-500">No tasks</li>
                          ) : null}

                          {dailyVisibleTasks.map((t: any, index: number) => (
                            <Draggable draggableId={t.id.toString()} index={index} key={t.id}>
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
                        className={`space-y-2 text-sm text-gray-700 overflow-y-auto pr-1 transition-[max-height] duration-200 ${(taskView as any)==='Today' ? 'hidden' : ''}`}
                        style={{ maxHeight: isOpenCollapsed ? 0 : '12rem' }}
                      >
                        {isLoadingAllTasks && openTasksToShow.length === 0 ? (
                          <li className="text-gray-500">Loading…</li>
                        ) : null}

                        {!isLoadingAllTasks && openTasksToShow.length === 0 ? (
                          <li className="text-gray-500">No tasks</li>
                        ) : null}

                        {openTasksToShow.map((t: any, index: number) => (
                          <Draggable draggableId={t.id.toString()} index={index} key={t.id}>
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
                          <span>Todoist tasks on {format(selectedDate,'MMM d, yyyy')}</span>
                          {isDailyCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                        </div>

                        <ul
                          className="space-y-2 text-sm text-gray-700 overflow-y-auto pr-1 transition-[max-height] duration-200"
                          style={{ maxHeight: isDailyCollapsed ? 0 : '10rem' }}
                        >
                          {dailyVisibleTasks.map((t: any, index: number) => (
                            <Draggable draggableId={t.id.toString()} index={index} key={t.id}>
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
                        className="space-y-2 text-sm text-gray-700 overflow-y-auto pr-1 transition-[max-height] duration-200"
                        style={{ maxHeight: isOpenCollapsed ? 0 : '12rem' }}
                      >
                        {isLoadingAllTasks && openTasksToShow.length === 0 ? (
                          <li className="text-gray-500">Loading…</li>
                        ) : null}

                        {!isLoadingAllTasks && openTasksToShow.length === 0 ? (
                          <li className="text-gray-500">No tasks</li>
                        ) : null}

                        {openTasksToShow.map((t: any, index: number) => (
                          <Draggable draggableId={t.id.toString()} index={index} key={t.id}>
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
                      {/* Hourly Planner */}
                      <div
                        className="flex items-center justify-between text-sm font-medium text-gray-900 mt-4 mb-2 cursor-pointer select-none"
                        onClick={() => setIsPlannerCollapsed((c) => !c)}
                      >
                        <span>Hourly Planner</span>
                        {isPlannerCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                      </div>
                      <div
                        className="space-y-2 overflow-y-auto pr-1 transition-[max-height] duration-200"
                        style={{ maxHeight: isPlannerCollapsed ? 0 : '16rem' }}
                      >
                        {hours.map((disp) => (
                          <Droppable droppableId={`hour-${disp}`} key={disp}>
                            {(provided: any) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.droppableProps}
                                className="flex items-start gap-2 py-1"
                              >
                                <span className="w-14 text-xs text-gray-500 shrink-0">{disp}</span>
                                <ul className="flex-1 flex flex-col gap-2">
                                  {hourlyPlan[disp].map((t: any, index: number) => (
                                    <Draggable draggableId={t.id.toString()} index={index} key={t.id}>
                                      {(provided: any) => (
                                        <li
                                          ref={provided.innerRef}
                                          {...provided.draggableProps}
                                          {...provided.dragHandleProps}
                                          style={provided.draggableProps.style}
                                          className="flex items-start gap-2 px-3 py-3 bg-white border border-black/10 shadow-sm rounded-lg"
                                        >
                                          <span>{t.content}</span>
                                        </li>
                                      )}
                                    </Draggable>
                                  ))}
                                  {provided.placeholder}
                                </ul>
                              </div>
                            )}
                          </Droppable>
                        ))}
                      </div>
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
            onClose={() => setEditingWidget(null)}
            onSave={handleSaveWidget}
          />
        )}

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
                    };
                const updated = { ...widgetsByBucket };
                updated[activeBucket] = [...(updated[activeBucket] ?? []), newInstance];
                setWidgetsByBucket(updated);
                widgetsByBucketRef.current = updated; // Update the ref immediately
                setIsWidgetSheetOpen(false);
                // Save immediately
                debouncedSaveToSupabase();
              }}
            />
          </SheetContent>
        </Sheet>

      </div>
    </div>
  );
}