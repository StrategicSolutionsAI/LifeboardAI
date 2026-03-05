"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import type { WidgetInstance } from "@/types/widgets";
import type { ProgressEntry } from "@/features/dashboard/types";
import { todayStrGlobal, yesterdayStrGlobal } from "@/lib/dashboard-utils";
import type { DropResult } from "@hello-pangea/dnd";

interface UseIntegrationsOptions {
  user: { id: string } | null;
  selectedDate: Date;
  isWidgetLoadComplete: boolean;
  widgetsByBucketRef: React.MutableRefObject<Record<string, WidgetInstance[]>>;
  progressByWidgetRef: React.MutableRefObject<Record<string, ProgressEntry>>;
  setWidgetsByBucket: React.Dispatch<React.SetStateAction<Record<string, WidgetInstance[]>>>;
  setProgressByWidget: React.Dispatch<React.SetStateAction<Record<string, ProgressEntry>>>;
  saveWidgets: (widgets: Record<string, WidgetInstance[]>, progress?: Record<string, ProgressEntry>) => Promise<void>;
  batchUpdateTasks: (updates: Array<{ taskId: string; updates: Record<string, any>; occurrenceDate?: string }>) => Promise<void>;
}

export function useIntegrations({
  user,
  selectedDate,
  isWidgetLoadComplete,
  widgetsByBucketRef,
  progressByWidgetRef,
  setWidgetsByBucket,
  setProgressByWidget,
  saveWidgets,
  batchUpdateTasks,
}: UseIntegrationsOptions) {
  // ------------------------------------------------------------------
  // State
  // ------------------------------------------------------------------

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
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Todoist task state
  const [todoistTasks, setTodoistTasks] = useState<any[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [allTodoistTasks, setAllTodoistTasks] = useState<any[]>([]);
  const [isLoadingAllTasks, setIsLoadingAllTasks] = useState(false);
  const [isCompletingTask, setIsCompletingTask] = useState<Record<string, boolean>>({});

  // New task input state
  const [newDailyTask, setNewDailyTask] = useState('');
  const [newOpenTask, setNewOpenTask] = useState('');

  // Collapse states
  const [isPlannerCollapsed, setIsPlannerCollapsed] = useState(false);
  const [isNext7DaysCollapsed, setIsNext7DaysCollapsed] = useState(false);
  const [isNext2WeeksCollapsed, setIsNext2WeeksCollapsed] = useState(false);
  const [isLaterCollapsed, setIsLaterCollapsed] = useState(false);
  const [isNoDueDateCollapsed, setIsNoDueDateCollapsed] = useState(true);

  // ------------------------------------------------------------------
  // Refs
  // ------------------------------------------------------------------
  const fetchedYesterdayRef = useRef(false);
  const hasFetchedIntegrationsRef = useRef(false);
  const hasLoadedTodoistRef = useRef(false);

  // ------------------------------------------------------------------
  // fetchIntegrationsData — the mega-function that syncs Todoist, Fitbit,
  // Google Fit, and Withings data, updating widgets and progress.
  // ------------------------------------------------------------------
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
              if (resW.status === 400) return; // Withings not connected — expected
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, selectedDate]);

  // ------------------------------------------------------------------
  // fetchTodoistTasks — fetch tasks for a specific date
  // ------------------------------------------------------------------
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

  // ------------------------------------------------------------------
  // fetchAllTodoistTasks — fetch all tasks with 1-minute client cache
  // ------------------------------------------------------------------
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

  // ------------------------------------------------------------------
  // Computed values
  // ------------------------------------------------------------------
  const selectedDateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;

  const openTasksToShow = allTodoistTasks.filter((t: any) => t.due?.date !== selectedDateStr);

  const upcomingTaskGroups = useMemo(() => {
    const todayMs = new Date(todayStrGlobal + 'T00:00:00').getTime();
    const upcoming = allTodoistTasks.filter((t: any) => t.due?.date && t.due.date > todayStrGlobal);
    const groups = {
      next7Days: [] as any[],
      next2Weeks: [] as any[],
      later: [] as any[],
      noDueDate: allTodoistTasks.filter((t: any) => !t.due?.date)
    };

    upcoming.forEach((task: any) => {
      const dueMs = new Date(task.due.date + 'T00:00:00').getTime();
      const diffDays = Math.ceil((dueMs - todayMs) / 86400000);
      if (diffDays <= 7) {
        groups.next7Days.push(task);
      } else if (diffDays <= 14) {
        groups.next2Weeks.push(task);
      } else {
        groups.later.push(task);
      }
    });

    return groups;
  }, [allTodoistTasks]);

  // ------------------------------------------------------------------
  // updateTaskDueDate / updateTaskDuration
  // ------------------------------------------------------------------
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

  // ------------------------------------------------------------------
  // Drag & Drop handling between dailyTasks and openTasks
  // ------------------------------------------------------------------
  const isHour = (id: string) => id.startsWith('hour-');
  const hourKey = (id: string) => id.replace('hour-', '');

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

    if (source.droppableId === 'dailyTasks' && isHour(destination.droppableId)) {
      // Daily -> Hour slot - schedule the task
      const moved = todoistTasks[source.index];
      if (!moved) {
        return;
      }

      const dstHour = hourKey(destination.droppableId);

      try {
        await batchUpdateTasks([{
          taskId: draggableId,
          updates: { hourSlot: dstHour, duration: 60 },
          occurrenceDate: selectedDateStr,
        }]);
      } catch (error) {
        console.error('Failed to schedule task:', error);
      }
      return;
    }

    if (source.droppableId === 'openTasks' && isHour(destination.droppableId)) {
      // Open list -> Hour slot - schedule the task and set due date
      const openVisible = allTodoistTasks.filter(
        (t: any) => t.due?.date !== selectedDateStr
      );
      const moved = openVisible[source.index];
      if (!moved) return;

      const dstHour = hourKey(destination.droppableId);

      try {
        await batchUpdateTasks([{
          taskId: draggableId,
          updates: {
            hourSlot: dstHour,
            duration: 60
          },
          occurrenceDate: selectedDateStr,
        }]);

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

    // ------------------------------------------------------------------
    // 2) Existing logic (daily <-> open etc.)
    // ------------------------------------------------------------------
    if (source.droppableId === 'dailyTasks' && destination.droppableId === 'openTasks') {
      const moved = todoistTasks[source.index];
      if (!moved) return;

      setTodoistTasks((prev) => {
        const next = [...prev];
        next.splice(source.index, 1);
        return next;
      });

      setAllTodoistTasks((prev) => {
        const clearedDue = moved.due ? { ...moved.due, date: null } : { date: null };
        const cleared = { ...moved, due: clearedDue };

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
    } else if (source.droppableId === 'openTasks' && destination.droppableId === 'dailyTasks') {
      const openVisible = allTodoistTasks.filter(
        (t: any) => t.due?.date !== selectedDateStr
      );
      const moved = openVisible[source.index];
      if (!moved) return;

      const updatedDue = moved.due ? { ...moved.due, date: selectedDateStr } : { date: selectedDateStr };
      const updated = { ...moved, due: updatedDue };

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

        datedSubset.push(updated);

        return [...openSubset, ...datedSubset];
      });

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
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
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
  };

  // ------------------------------------------------------------------
  // Effects
  // ------------------------------------------------------------------

  // Defer the first integration sync until widgets are loaded and visible,
  // so it doesn't compete with the critical rendering path.
  // After the first run, repeat every 30 minutes to stay current.
  useEffect(() => {
    if (!isWidgetLoadComplete || hasFetchedIntegrationsRef.current) return;
    hasFetchedIntegrationsRef.current = true;

    const timeout = setTimeout(fetchIntegrationsData, 1500);
    const int = setInterval(fetchIntegrationsData, 30 * 60 * 1000); // 30 min
    return () => {
      clearTimeout(timeout);
      clearInterval(int);
    };
  }, [isWidgetLoadComplete, fetchIntegrationsData]);

  // Fetch tasks whenever date changes (single consolidated request).
  // Skip the initial mount call — fetchIntegrationsData already handles it.
  useEffect(() => {
    if (!hasLoadedTodoistRef.current) {
      hasLoadedTodoistRef.current = true;
      return; // fetchIntegrationsData handles the first load
    }
    fetchAllTodoistTasks(selectedDate);
  }, [selectedDate, fetchAllTodoistTasks]);

  // ------------------------------------------------------------------
  // Return
  // ------------------------------------------------------------------
  return {
    // Fitbit / Google Fit / Withings
    fitbitData,
    googleFitData,
    withingsData,
    isLoadingFitbit,
    isRefreshing,

    // Todoist
    todoistTasks, setTodoistTasks,
    allTodoistTasks, setAllTodoistTasks,
    isLoadingTasks,
    isLoadingAllTasks,
    isCompletingTask, setIsCompletingTask,

    // Task input
    newDailyTask, setNewDailyTask,
    newOpenTask, setNewOpenTask,

    // Collapse states
    isPlannerCollapsed, setIsPlannerCollapsed,
    isNext7DaysCollapsed, setIsNext7DaysCollapsed,
    isNext2WeeksCollapsed, setIsNext2WeeksCollapsed,
    isLaterCollapsed, setIsLaterCollapsed,
    isNoDueDateCollapsed, setIsNoDueDateCollapsed,

    // Computed
    selectedDateStr,
    openTasksToShow,
    upcomingTaskGroups,

    // Functions
    fetchIntegrationsData,
    fetchTodoistTasks,
    fetchAllTodoistTasks,
    updateTaskDueDate,
    updateTaskDuration,
    handleDragEnd,
  };
}
