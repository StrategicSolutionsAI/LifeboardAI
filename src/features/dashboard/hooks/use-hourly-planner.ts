"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { format } from 'date-fns';
import { getUserPreferencesClient, updateUserPreferenceFields } from "@/lib/user-preferences";

const HOUR_HEIGHT = 48; // keep in sync with tailwind padding/line-height

interface UseHourlyPlannerOptions {
  selectedDate: Date;
  isPlannerCollapsed: boolean;
  updateTaskDuration: (taskId: string, duration: number) => Promise<void>;
}

export function useHourlyPlanner({
  selectedDate,
  isPlannerCollapsed,
  updateTaskDuration,
}: UseHourlyPlannerOptions) {
  const plannerRef = useRef<HTMLDivElement | null>(null);

  // Live "Now" time indicator
  const [currentTime, setCurrentTime] = useState<Date>(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setCurrentTime(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const currentHourDisplay = useMemo(() => {
    const h = currentTime.getHours();
    return `${(h % 12 || 12)}${h < 12 ? 'AM' : 'PM'}`;
  }, [currentTime]);

  // Hourly planner (7 AM → 9 PM)
  const hours = useMemo(() => {
    return Array.from({ length: 15 }, (_, i) => {
      const h = 7 + i;
      const disp = `${((h % 12) || 12)}${h < 12 ? 'AM' : 'PM'}`;
      return disp;
    });
  }, []);

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

  // Resize state
  const [resizingTask, setResizingTask] = useState<{ taskId: string; hour: string } | null>(null);
  const resizeStartRef = useRef<{ y: number; duration: number; taskId: string; hour: string } | null>(null);

  // Load hourly plan from user preferences or initialize empty
  const [hourlyPlan, setHourlyPlan] = useState<Record<string, any[]>>(() => {
    const obj: Record<string, any[]> = {};
    hours.forEach((h) => {
      obj[h] = [];
    });
    return obj;
  });

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
      const newDur = Math.max(15, Math.round((resizeStartRef.current.duration + minutesDelta) / 15) * 15);
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

  // Automatically save hourly plan whenever it changes
  useEffect(() => {
    const dateKey = format(selectedDate, 'yyyy-MM-dd');
    const localStorageKey = 'lifeboard_hourly_plan';

    try {
      const existingData = localStorage.getItem(localStorageKey);
      const existingPlans = existingData ? JSON.parse(existingData) : {};
      const updatedPlans = { ...existingPlans, [dateKey]: hourlyPlan };
      localStorage.setItem(localStorageKey, JSON.stringify(updatedPlans));
    } catch (lsErr) {
      console.error('Failed saving hourly plan to localStorage:', lsErr);
    }

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

        try {
          const prefs = await getUserPreferencesClient();
          if (prefs && prefs.hourly_plan) {
            savedPlan = prefs.hourly_plan[dateKey];
          }
        } catch (supabaseError) {
          console.warn('Could not load hourly plan from Supabase:', supabaseError);
        }

        if (!savedPlan) {
          const localStorageKey = 'lifeboard_hourly_plan';
          const localData = localStorage.getItem(localStorageKey);
          if (localData) {
            const localPlans = JSON.parse(localData);
            savedPlan = localPlans[dateKey];
          }
        }

        if (savedPlan) {
          const obj: Record<string, any[]> = {};
          hours.forEach((h) => {
            obj[h] = savedPlan[h] || [];
          });
          setHourlyPlan(obj);
        } else {
          const obj: Record<string, any[]> = {};
          hours.forEach((h) => {
            obj[h] = [];
          });
          setHourlyPlan(obj);
        }
      } catch (error) {
        console.error('Failed to load hourly plan:', error);
        const obj: Record<string, any[]> = {};
        hours.forEach((h) => {
          obj[h] = [];
        });
        setHourlyPlan(obj);
      }
    };

    loadHourlyPlan();
  }, [selectedDate, hours]);

  return {
    hourlyPlan,
    setHourlyPlan,
    hours,
    currentTime,
    currentHourDisplay,
    plannerRef,
    resizingTask,
    startResize,
    HOUR_HEIGHT,
  };
}
