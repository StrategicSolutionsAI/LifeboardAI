"use client";

import { useCallback, useEffect } from "react";
import type { WidgetInstance } from "@/types/widgets";
import type { ProgressEntry } from "@/features/dashboard/types";
import { dateStr } from "@/lib/dashboard-utils";

interface UseDailyResetOptions {
  selectedDate: Date;
  progressByWidgetRef: React.MutableRefObject<Record<string, ProgressEntry>>;
  widgetsByBucketRef: React.MutableRefObject<Record<string, WidgetInstance[]>>;
  setProgressByWidget: React.Dispatch<React.SetStateAction<Record<string, ProgressEntry>>>;
  saveWidgets: (widgets: Record<string, WidgetInstance[]>, progress?: Record<string, ProgressEntry>) => Promise<void>;
  fetchIntegrationsData: () => Promise<void>;
}

export function useDailyReset({
  selectedDate,
  progressByWidgetRef,
  widgetsByBucketRef,
  setProgressByWidget,
  saveWidgets,
  fetchIntegrationsData,
}: UseDailyResetOptions) {
  const checkAndResetWidgets = useCallback(() => {
    const today = dateStr(new Date());
    const prevProgress = progressByWidgetRef.current;
    const updatedProgress: Record<string, ProgressEntry> = { ...prevProgress };
    const toArchive: Array<[string, ProgressEntry]> = [];

    Object.entries(prevProgress).forEach(([instanceId, entry]) => {
      if (entry.date !== today) {
        toArchive.push([instanceId, entry]);
        updatedProgress[instanceId] = {
          ...entry,
          date: today,
          value: 0,
        };
      }
    });

    const archiveNeeded = toArchive.length > 0;
    if (!archiveNeeded) return;

    // Archive in progress history API (fire-and-forget)
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

    // Update local state and persistence
    setProgressByWidget(updatedProgress);

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('widget_progress', JSON.stringify(updatedProgress));
      } catch (err) {
        console.error('Failed to persist reset progress to localStorage', err);
      }
    }

    saveWidgets(widgetsByBucketRef.current, updatedProgress);

    // Clear integration caches and trigger fresh integration fetch
    if (typeof window !== 'undefined') {
      localStorage.removeItem('todoist_all_tasks');
      localStorage.removeItem('fitbit_metrics');
      localStorage.removeItem('googlefit_metrics');
    }
    fetchIntegrationsData();
  }, [saveWidgets, fetchIntegrationsData, progressByWidgetRef, widgetsByBucketRef, setProgressByWidget]);

  // Consolidated: check for widget resets on mount, date change,
  // visibility change, and hourly interval
  useEffect(() => {
    checkAndResetWidgets();

    const intervalId = setInterval(checkAndResetWidgets, 60 * 60 * 1000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkAndResetWidgets();
      }
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      clearInterval(intervalId);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkAndResetWidgets, selectedDate]);
}
