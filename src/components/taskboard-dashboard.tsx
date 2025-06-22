"use client";

import React, { useState, useEffect, useRef, useLayoutEffect } from "react";

import Image from "next/image";
import { supabase } from "@/utils/supabase/client";
import { getUserPreferencesClient, saveUserPreferences } from "@/lib/user-preferences";
import { format, addDays, isSameDay } from 'date-fns';
import {
  Plus,
  Search,
  MessageSquare,
  LogOut,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { WidgetLibrary, WidgetTemplate } from "./widget-library";

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

export function TaskBoardDashboard() {
  const [buckets, setBuckets] = useState<string[]>([]);
  const [activeBucket, setActiveBucket] = useState<string>("");
  const [maxTabWidth, setMaxTabWidth] = useState<number>(0);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [newBucket, setNewBucket] = useState("");
  const [isWidgetSheetOpen, setIsWidgetSheetOpen] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [widgetsByBucket, setWidgetsByBucket] = useState<Record<string, WidgetTemplate[]>>({});
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [date, setDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isWidgetLoadComplete, setIsWidgetLoadComplete] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const widgetsByBucketRef = useRef(widgetsByBucket);
  widgetsByBucketRef.current = widgetsByBucket;

  // Centralized function to save widgets, including to localStorage
  const saveWidgets = async (widgetsToSave: Record<string, WidgetTemplate[]>) => {
    if (!user) {
      console.log('User not logged in, skipping save.');
      return;
    }
    console.log('Saving widgets...', widgetsToSave);

    // Save to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('widgets_by_bucket', JSON.stringify(widgetsToSave));
    }

    // Save to Supabase
    try {
      const prefs = await getUserPreferencesClient();
      if (prefs) {
        await saveUserPreferences({
          ...prefs,
          widgets_by_bucket: widgetsToSave,
        });
        console.log('Widgets saved to Supabase successfully.');
      }
    } catch (err) {
      console.error('Failed to save widgets to preferences', err);
    }
  };

  const debouncedSave = useRef(debounce(saveWidgets, 2000)).current;

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

  useLayoutEffect(() => {
    // ensure refs array matches buckets length
    tabRefs.current.length = buckets.length;
    const widths = tabRefs.current.map(el => (el ? el.scrollWidth : 0));
    const max = widths.length ? Math.max(...widths) : 0;
    setMaxTabWidth(max);
  }, [buckets]);

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
    setIsWidgetLoadComplete(false);
    
    // First try to load from localStorage for immediate display
    let loadedFromLocal = false;
    let localWidgets = {};
    
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('widgets_by_bucket');
        if (stored) {
          localWidgets = JSON.parse(stored);
          console.log('Found widgets in localStorage:', localWidgets);
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
      return; // Don't save on initial load or if logged out
    }
    debouncedSave(widgetsByBucket);
  }, [widgetsByBucket, isWidgetLoadComplete, user, debouncedSave]);

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
      }
    } catch (err) {
      console.error('Failed to load preferences', err);
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
            <button 
              onClick={handleSignOut} 
              disabled={isSigningOut}
              className={`flex items-center gap-2 rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 ${isSigningOut ? 'opacity-50 cursor-not-allowed' : ''}`}>
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </header>

        {/* Greeting */}
        <section className="mx-auto w-full max-w-7xl px-6 pt-6 sm:pt-10">
          <h2 className="text-base font-medium text-gray-800">
            Hello Dalit <span className="ml-2 text-sm font-normal text-gray-500">You've got this!</span>
          </h2>
          
          {/* Bucket tabs */}
          <div className="mt-6 flex items-end overflow-x-auto px-px">
            {buckets.length > 0 && buckets.map((b, idx) => (
              <button
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
                  if (typeof window !== 'undefined') {
                    localStorage.setItem('life_buckets', JSON.stringify(updated));
                  }
                }}
                onDragEnd={() => setDragIndex(null)}
                key={b}
                onClick={() => setActiveBucket(b)}
  ref={el => { tabRefs.current[idx] = el; }}
                style={{ zIndex: b === activeBucket ? buckets.length + 5 : buckets.length - idx, minWidth: maxTabWidth || undefined }}
                className={`relative -mx-0.5 flex h-[44px] items-center justify-center whitespace-nowrap rounded-t-[20px] px-4 text-[11px] font-bold uppercase tracking-[0.05em] shadow-[1px_2px_4px_1px_rgba(32,35,64,0.1)] transition-colors ${
                  b === activeBucket
                    ? 'bg-gradient-to-r from-[#7482FE] to-[#909CFF]'
                    : 'bg-white hover:bg-gray-50'
                }`}
              >
                {b === activeBucket ? (
                  <span className="text-white">{b}</span>
                ) : (
                  <span className="bg-gradient-to-r from-[#7482FE] to-[#909CFF] bg-clip-text text-transparent">
                    {b}
                  </span>
                )}
              </button>
            ))}
            <button
              style={{ zIndex: 0 }}
              onClick={() => setIsEditorOpen(true)}
              className="relative -mx-0.5 flex h-[44px] items-center justify-center rounded-t-[20px] bg-white px-6 text-[21px] font-bold shadow-[1px_2px_4px_1px_rgba(32,35,64,0.1)] transition-colors hover:bg-gray-50"
            >
              <span className="bg-gradient-to-r from-[#7482FE] to-[#909CFF] bg-clip-text text-transparent">
                +
              </span>
            </button>
          </div>
        </section>

        {/* Main white card */}
        <div className="mx-auto w-full max-w-7xl flex-1 px-6 pb-24">
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
            <div className="flex-1 overflow-y-auto p-6 flex gap-6">
              {/* Widgets grid */}
              <div className="flex flex-wrap gap-4">
                {(widgetsByBucket[activeBucket] ?? []).map((w) => (
                  <div key={w.id} className="w-48 rounded-lg border bg-white p-3 shadow-sm">
                    <div className="flex items-center gap-2">
                      {React.createElement(w.icon, { className: 'h-5 w-5 text-gray-500' })}
                      <span className="text-sm font-medium truncate">{w.name}</span>
                    </div>
                    <p className="mt-2 text-xs text-gray-500 truncate">{w.description}</p>
                  </div>
                ))}
              </div>

              {/* Add Widget card */}
              <div className="w-64 rounded-xl border border-gray-100 bg-white p-4 shadow-sm flex items-center gap-3">
                <Image
                  src="/images/addwidget.png"
                  alt="Add Widget"
                  width={56}
                  height={56}
                  className="rounded-md"
                />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-800">Add a Widget</p>
                  <p className="text-xs text-gray-500">Track your stats</p>
                </div>
                <button
                    onClick={() => setIsWidgetSheetOpen(true)}
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-50 text-indigo-500" >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              {/* Right sidebar */}
              <aside className="ml-auto w-72 flex-shrink-0 space-y-6">
                {/* Simple calendar */}
                <div className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-sm font-medium text-gray-900">{format(date, 'MMMM yyyy')}</h3>
                    <div className="flex gap-1 text-gray-500">
                      <button onClick={() => handleDateChange(addDays(date, -7))} aria-label="Previous week">&lt;</button>
                      <button onClick={() => handleDateChange(addDays(date, 7))} aria-label="Next week">&gt;</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-500 mb-1">
                    {['S','M','T','W','T','F','S'].map(d=> <span key={d}>{d}</span>)}
                  </div>
                  <div className="grid grid-cols-7 gap-1 text-center text-xs">
                    {getDaysArray().map((day, idx) => (
                      <span key={idx} className={`py-1 ${isSameDay(day, selectedDate) ? 'rounded bg-indigo-500 text-white' : ''}`}>
                        {day.getDate()}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Todo list */}
                <div className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
                  <h3 className="mb-4 text-sm font-medium text-gray-900">{format(selectedDate, 'MMM d')} <span className="ml-1 text-xs text-indigo-400">{getDayOfWeek(selectedDate)}</span></h3>
                  <ul className="space-y-3 text-sm text-gray-800">
                    <li className="flex items-start gap-2"><input type="checkbox" className="mt-1" aria-label="Create user flow"/> <span>Create user flow</span></li>
                    <li className="flex items-start gap-2"><input type="checkbox" className="mt-1" aria-label="Add a task"/> <span>Add a task +</span></li>
                    <li className="flex items-start gap-2"><input type="checkbox" className="mt-1" aria-label="Connect Todoist"/> <span>Connect Todoist</span></li>
                  </ul>
                </div>
              </aside>
            </div>
            </div>
          </div>

        {/* Chat bar */}
        <footer className="sticky bottom-4 z-10 mx-auto w-full max-w-7xl px-6">
          <div className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-indigo-500 p-1.5 text-white">
                <Search className="h-5 w-5" />
              </div>
              <span className="text-sm text-gray-500">Ask me anything</span>
            </div>
            <div className="flex items-center gap-4 text-indigo-500">
              <Plus className="h-5 w-5" />
              <MessageSquare className="h-5 w-5" />
            </div>
          </div>
        </footer>

      {/* Bucket editor modal */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
            <h3 className="mb-4 text-lg font-semibold text-gray-800">Edit Buckets</h3>
            <div className="mb-4 flex flex-wrap gap-2 max-h-48 overflow-y-auto">
              {buckets.map((b) => (
                <div key={b} className="flex items-center gap-1 rounded bg-gray-100 px-2 py-1 text-sm">
                  <span>{b}</span>
                  <button
                    onClick={() => handleRemoveBucket(b)}
                    className="text-gray-400 hover:text-red-500"
                    title="Remove"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <div className="mb-4 flex gap-2">
              <input
                type="text"
                value={newBucket}
                onChange={(e) => setNewBucket(e.target.value)}
                placeholder="New bucket name"
                className="flex-1 rounded border px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <button
                onClick={handleAddBucket}
                className="rounded bg-indigo-500 px-3 py-1 text-sm font-medium text-white hover:bg-indigo-600"
              >
                Add
              </button>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setIsEditorOpen(false)}
                className="rounded bg-gray-200 px-4 py-2 text-sm hover:bg-gray-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Widget Library Sheet */}
      <Sheet open={isWidgetSheetOpen} onOpenChange={setIsWidgetSheetOpen}>
        <SheetContent side="right" className="w-[480px] sm:w-[540px]">
          <SheetHeader>
            <SheetTitle className="text-indigo-950">Widget Library</SheetTitle>
          </SheetHeader>
          <div className="mt-6">
            <WidgetLibrary bucket={activeBucket} onAdd={(w) => {
              console.log('Adding widget to bucket:', activeBucket, 'widget:', w);
              
              // Update local state, which will trigger the debounced save
              const updatedWidgets = { ...widgetsByBucket };
              const list = updatedWidgets[activeBucket] ?? [];
              updatedWidgets[activeBucket] = [...list, w];
              setWidgetsByBucket(updatedWidgets);
              
              // Close the widget sheet
              setIsWidgetSheetOpen(false);
            }} />
          </div>
        </SheetContent>
      </Sheet>
      </div>
    </div>
  );
}


