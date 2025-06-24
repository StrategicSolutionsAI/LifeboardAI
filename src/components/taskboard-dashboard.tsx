"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";

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
} from "lucide-react";
import { WidgetLibrary } from "./widget-library";
import type { WidgetTemplate, WidgetInstance } from "@/types/widgets";
import WidgetEditorSheet from "@/components/widget-editor";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

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
  
  // Fitbit data state
  const [fitbitData, setFitbitData] = useState<Record<string, number>>(()=>{
    if (typeof window !== 'undefined'){
      try{ const stored=localStorage.getItem('fitbit_metrics'); if(stored) return JSON.parse(stored);}catch(e){}
    }
    return {};
  });
  const [isLoadingFitbit, setIsLoadingFitbit] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const fetchIntegrationsData = useCallback( async () => {
    // detect if any widget needs fitbit
    const needFitbit = Object.values(widgetsByBucketRef.current).flat().some(w=>['water','steps'].includes(w.id)&& w.dataSource==='fitbit');
    if(!needFitbit || !user) return;
    setIsRefreshing(true);
    try{
       const res = await fetch('/api/integrations/fitbit/metrics');
       if(res.ok){
          const data = await res.json();
          setFitbitData({water:data.water||0,steps:data.steps||0,calories:data.calories||0});
          if(typeof window!=='undefined') localStorage.setItem('fitbit_metrics', JSON.stringify({water:data.water||0,steps:data.steps||0,calories:data.calories||0}));
       }
    }catch(err){console.error('Manual refresh failed',err);}finally{
       setIsRefreshing(false);
    }
  },[user]);

  // modify useEffect to use fetchIntegrationsData
  useEffect(()=>{fetchIntegrationsData(); const int=setInterval(fetchIntegrationsData,5*60*1000); return ()=>clearInterval(int);},[fetchIntegrationsData]);

  // Load progress from localStorage once
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = localStorage.getItem('widget_progress');
    if (raw) {
      try { setProgressByWidget(JSON.parse(raw)); } catch {}
    }
  }, []);

  // Save progress whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('widget_progress', JSON.stringify(progressByWidget));
    }
  }, [progressByWidget]);

  // Helper to get today string
  const todayStr = new Date().toISOString().slice(0,10);

  const incrementProgress = (w: WidgetInstance) => {
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
      }
      return { ...prev, [w.instanceId]: { value, date: todayStrGlobal, streak: newStreak, lastCompleted: newLast } };
    });
  };

  // Centralized function to save widgets, including to localStorage
  const saveWidgets = async (widgetsToSave: Record<string, WidgetInstance[]>) => {
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
      console.log('Debounced save executing with widgets:', latestWidgets);
      saveWidgets(latestWidgets);
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
        body: JSON.stringify({ widgetsByBucket: widgetsByBucketRef.current }),
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

  const handleDateChange = (newDate: Date) => {
    setDate(newDate);
    setSelectedDate(newDate);
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

  return (
    <div className="min-h-screen bg-violet-50">


      {/* ------------------------------------------------------------------ */}
      {/* Main column */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex min-h-screen flex-col">
        {/* Header */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-gray-100 bg-white px-6">
          <div className="flex items-center gap-1 text-2xl font-semibold">
            <span className="text-indigo-500">AI</span>
            <span>TaskBoard</span>
          </div>
          <div className="flex items-center gap-4">
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
        <section className="mx-auto w-full max-w-7xl px-6 pt-6 sm:pt-10">
          <h2 className="text-base font-medium text-gray-800">
            Hello Dalit <span className="ml-2 text-sm font-normal text-gray-500">You've got this!</span>
          </h2>
          
          {/* Bucket tabs */}
          <div
            className="mt-10 flex overflow-x-auto"
            style={{ maxWidth: 'calc(100% - 344px)' }}
          >
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
                  // persist reordering
                  if (typeof window !== 'undefined') {
                    localStorage.setItem('life_buckets', JSON.stringify(updated));
                  }
                }}
                onDragEnd={() => setDragIndex(null)}
                onClick={() => setActiveBucket(b)}
                style={{ 
                  zIndex: b === activeBucket ? 20 : 10 - idx,
                  marginRight: '-10px'
                }}
                className={`relative flex h-[44px] items-center justify-center whitespace-nowrap rounded-t-[20px] px-6 text-[11px] font-bold uppercase tracking-[0.05em] transition-all ${
                  b === activeBucket
                    ? 'bg-gradient-to-r from-[#7482FE] to-[#909CFF] text-white shadow-[1px_2px_4px_1px_rgba(32,35,64,0.1)]'
                    : 'bg-white text-[#7482FE] hover:bg-gray-50 shadow-[1px_0_2px_rgba(0,0,0,0.05)]'
                }`}
              >
                {b}
              </button>
            ))}
            <button
              onClick={() => setIsEditorOpen(true)}
              style={{ 
                zIndex: 5
              }}
              className="relative flex h-[44px] items-center justify-center rounded-t-[20px] bg-white px-8 text-[21px] font-bold transition-colors hover:bg-gray-50 shadow-[1px_0_2px_rgba(0,0,0,0.05)]"
            >
              <span className="bg-gradient-to-r from-[#7482FE] to-[#909CFF] bg-clip-text text-transparent">
                +
              </span>
            </button>
          </div>
        </section>

        {/* Main content container */}
        <div className="mx-auto w-full max-w-7xl flex-1 px-6 pb-24 flex gap-6">
          {/* Left section: tabs and widgets */}
          <div className="flex-1">
            <div className="relative -mt-px flex h-full flex-col overflow-hidden rounded-b-lg rounded-tr-lg border-t border-gray-200 bg-white">
              {/* Inner nav */}
              <nav className="flex items-center gap-8 border-b border-gray-100 px-6 pt-4 text-sm font-medium">
                {[
                  "Overview",
                  "Trends",
                  "Logs",
                  "Settings",
                ].map((item, idx) => (
                  <span
                    key={item}
                    className={
                      idx === 0
                        ? "border-indigo-500 text-indigo-500 pb-3 border-b-2"
                        : "text-gray-400"
                    }
                  >
                    {item}
                  </span>
                ))}
              </nav>

              {/* Content area */}
              <div className="flex-1 overflow-y-auto p-6">
                {/* Widgets grid */}
                <div className="flex flex-wrap gap-4">
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
                  {getDisplayWidgets(activeBucket).map((w) => (
                    <div key={w.instanceId} className="w-48 rounded-lg border bg-white p-3 shadow-sm relative group cursor-pointer" onClick={() => { setEditingWidget(w); setEditingBucket(activeBucket); }}>
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
                        className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity rounded-full bg-red-100 hover:bg-red-200 p-1"
                        aria-label="Delete widget"
                      >
                        <X className="h-3 w-3 text-red-600" />
                      </button>
                      <div className="flex items-center gap-2">
                        {(() => {
                          const colorClasses: Record<string,string> = {
                            blue:'bg-blue-500', green:'bg-green-500', red:'bg-red-500', orange:'bg-orange-500', purple:'bg-purple-500', indigo:'bg-indigo-500', amber:'bg-amber-500', teal:'bg-teal-500', rose:'bg-rose-500', cyan:'bg-cyan-500', yellow:'bg-yellow-500', sky:'bg-sky-500', emerald:'bg-emerald-500', violet:'bg-violet-500', lime:'bg-lime-500', fuchsia:'bg-fuchsia-500', gray:'bg-gray-500', slate:'bg-slate-500', stone:'bg-stone-500'
                          };
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
                              className={`w-8 h-8 rounded flex items-center justify-center ${colorClasses[widgetColor] ?? 'bg-gray-500'}`}
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
                              <div className="h-1 rounded bg-indigo-500" style={{ width: `${pct}%` }} />
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
                        <button aria-label="Add one" onClick={(e)=>{e.stopPropagation(); incrementProgress(w);}} className="absolute bottom-2 right-2 w-6 h-6 flex items-center justify-center rounded-full bg-indigo-600 text-white text-xs">+</button>
                      )}
                    </div>
                  ))}

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
              </div>
            </div>
          </div>

          {/* Right section: Calendar and To-do */}
          <aside className="w-80 flex-shrink-0">
            <div className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm h-full">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-900">{format(date, 'MMMM yyyy')}</h3>
                <div className="flex gap-1 text-gray-500">
                  <button onClick={() => handleDateChange(addDays(date, -7))} aria-label="Previous week">&lt;</button>
                  <button onClick={() => handleDateChange(addDays(date, 7))} aria-label="Next week">&gt;</button>
                </div>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-500 mb-1">
                {['S','M','T','W','T','F','S'].map((d, index) => <span key={`weekday-${index}`}>{d}</span>)}
              </div>
              <div className="grid grid-cols-7 gap-1 text-center text-xs">
                {getDaysArray().map((day, idx) => (
                  <span key={idx} className={`py-1 ${isSameDay(day, selectedDate) ? 'rounded bg-indigo-500 text-white' : ''}`}>{format(day,'d')}</span>
                ))}
              </div>

              {/* To-do list */}
              <div className="mt-6">
                <h4 className="text-sm font-medium text-gray-900 mb-2">To-dos on {format(selectedDate,'MMM d, yyyy')}</h4>
                <ul className="space-y-2 text-sm text-gray-700">
                  <li className="flex items-center gap-2"><input type="checkbox" disabled aria-label="Example task 1" className="accent-indigo-500"/> Example task 1</li>
                  <li className="flex items-center gap-2"><input type="checkbox" disabled aria-label="Example task 2" className="accent-indigo-500"/> Example task 2</li>
                  <li className="flex items-center gap-2"><input type="checkbox" disabled aria-label="Example task 3" className="accent-indigo-500"/> Example task 3</li>
                </ul>
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
            <SheetContent side="right" className="w-[420px] sm:w-[500px]">
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
          <SheetContent side="right" className="w-[800px]">
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