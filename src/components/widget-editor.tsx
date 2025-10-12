"use client";

import { WidgetInstance } from "@/types/widgets";
import { useState, useEffect, useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose } from "@/components/ui/sheet";
import { WidgetPreview } from "./widget-preview";
import { Button } from "@/components/ui/button";
import { useTasksContext } from "@/contexts/tasks-context";
import type { RepeatOption } from "@/hooks/use-tasks";
import { format } from "date-fns";

// Colour map reused
const COLORS = [
  "blue","green","red","orange","purple","indigo","amber","teal","rose","cyan","yellow","sky","emerald","violet","lime","fuchsia","gray","slate","stone",
];

const WEEKDAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

// Common holiday suggestions with current year
const getHolidaySuggestions = () => {
  const currentYear = new Date().getFullYear();
  return [
    { name: "New Year's Day", date: `${currentYear}-01-01` },
    { name: "Valentine's Day", date: `${currentYear}-02-14` },
    { name: "St. Patrick's Day", date: `${currentYear}-03-17` },
    { name: "Mother's Day", date: `${currentYear}-05-12` }, // 2nd Sunday in May (approx)
    { name: "Memorial Day", date: `${currentYear}-05-27` }, // Last Monday in May (approx)
    { name: "Father's Day", date: `${currentYear}-06-16` }, // 3rd Sunday in June (approx)
    { name: "Independence Day", date: `${currentYear}-07-04` },
    { name: "Labor Day", date: `${currentYear}-09-02` }, // 1st Monday in September (approx)
    { name: "Halloween", date: `${currentYear}-10-31` },
    { name: "Thanksgiving", date: `${currentYear}-11-28` }, // 4th Thursday in November (approx)
    { name: "Christmas Eve", date: `${currentYear}-12-24` },
    { name: "Christmas Day", date: `${currentYear}-12-25` },
    { name: "New Year's Eve", date: `${currentYear}-12-31` },
  ];
};

const getColorClass = (color: string): string => {
  const colorMap: Record<string, string> = {
    blue: "bg-blue-500", green: "bg-green-500", red: "bg-red-500", orange: "bg-orange-500", purple: "bg-purple-500", indigo: "bg-indigo-500", amber: "bg-amber-500", teal: "bg-teal-500", rose: "bg-rose-500", cyan: "bg-cyan-500", yellow: "bg-yellow-500", sky: "bg-sky-500", emerald: "bg-emerald-500", violet: "bg-violet-500", lime: "bg-lime-500", fuchsia: "bg-fuchsia-500", gray: "bg-gray-500", slate: "bg-slate-500", stone: "bg-stone-500"
  }
  return colorMap[color] || "bg-gray-500"
}

interface WidgetEditorProps {
  widget: WidgetInstance | null;
  open: boolean;
  onClose: () => void;
  onSave: (updated: WidgetInstance) => void;
  isNewWidget?: boolean;
  availableBuckets?: string[];
  defaultBucket?: string;
  selectedDate?: Date;
}

type WidgetTaskConfig = NonNullable<WidgetInstance["linkedTaskConfig"]>;

const DEFAULT_TASK_CONFIG: WidgetTaskConfig = {
  enabled: false,
  title: "",
  bucket: "",
  dueDate: undefined,
  startTime: "",
  endTime: "",
  allDay: true,
  repeat: "none",
};

const REPEAT_OPTIONS: { value: RepeatOption; label: string }[] = [
  { value: "none", label: "Does not repeat" },
  { value: "daily", label: "Daily" },
  { value: "weekdays", label: "Weekdays" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

const timeToHourSlot = (time?: string | null): string | undefined => {
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

const normalizeTaskConfig = (
  widgetInstance: WidgetInstance,
  defaults: { title: string; bucket?: string; dueDate?: string },
): WidgetTaskConfig => {
  const base = widgetInstance.linkedTaskConfig ?? {};
  return {
    enabled: base.enabled ?? Boolean(widgetInstance.linkedTaskId),
    title: base.title ?? widgetInstance.linkedTaskTitle ?? widgetInstance.name,
    bucket: base.bucket ?? defaults.bucket ?? "",
    dueDate: base.dueDate ?? defaults.dueDate,
    startTime: base.startTime ?? "",
    endTime: base.endTime ?? "",
    allDay: base.allDay ?? true,
    repeat: base.repeat ?? "none",
  };
};

export default function WidgetEditorSheet({
  widget,
  open,
  onClose,
  onSave,
  isNewWidget = false,
  availableBuckets = [],
  defaultBucket,
  selectedDate,
}: WidgetEditorProps) {
  const [draft, setDraft] = useState<WidgetInstance | null>(widget);
  const [isFitbitConnected, setIsFitbitConnected] = useState(false);
  const [isGoogleFitConnected, setIsGoogleFitConnected] = useState(false);
  const [isWithingsConnected, setIsWithingsConnected] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const { createTask, batchUpdateTasks, deleteTask } = useTasksContext();

  // Check if Fitbit or Google Fit is connected
  useEffect(() => {
    const checkConnections = async () => {
      try {
        // Fitbit
        const fitbitRes = await fetch('/api/integrations/status?provider=fitbit');
        const fitbitData = await fitbitRes.json();
        setIsFitbitConnected(fitbitData.connected);

        // Google Fit
        const gfRes = await fetch('/api/integrations/status?provider=google-fit');
        const gfData = await gfRes.json();
        setIsGoogleFitConnected(gfData.connected);

        // Withings
        const wRes = await fetch('/api/integrations/status?provider=withings');
        const wData = await wRes.json();
        setIsWithingsConnected(wData.connected);
      } catch (error) {
        console.error('Error checking integration connections:', error);
      }
    };
    checkConnections();
  }, []);

  useEffect(() => {
    if (widget && draft?.instanceId !== widget.instanceId) {
      setDraft(widget);
    }
  }, [widget, draft?.instanceId]);

  const defaultDueDate = useMemo(() => {
    if (!selectedDate) return undefined;
    return format(selectedDate, "yyyy-MM-dd");
  }, [selectedDate]);

  useEffect(() => {
    setDraft(prev => {
      if (!prev) return prev;
      const normalized = normalizeTaskConfig(prev, {
        title: prev.linkedTaskTitle ?? prev.name,
        bucket: defaultBucket,
        dueDate: defaultDueDate,
      });
      if (JSON.stringify(prev.linkedTaskConfig) === JSON.stringify(normalized)) {
        return prev;
      }
      return {
        ...prev,
        linkedTaskConfig: normalized,
      };
    });
  }, [defaultBucket, defaultDueDate]);

  const taskConfig = useMemo(() => draft?.linkedTaskConfig ?? DEFAULT_TASK_CONFIG, [draft]);
  const derivedBuckets = useMemo(() => {
    const set = new Set<string>();
    availableBuckets.forEach(b => {
      if (b) set.add(b);
    });
    if (defaultBucket) set.add(defaultBucket);
    if (taskConfig.bucket) set.add(taskConfig.bucket);
    return Array.from(set).filter(Boolean).sort((a, b) => a.localeCompare(b));
  }, [availableBuckets, defaultBucket, taskConfig.bucket]);

  if (!draft) return null;

  const updateTaskConfig = (updates: Partial<WidgetTaskConfig>) => {
    setDraft(prev => {
      if (!prev) return prev;
      const merged = {
        ...normalizeTaskConfig(prev, {
          title: prev.linkedTaskTitle ?? prev.name,
          bucket: defaultBucket,
          dueDate: defaultDueDate,
        }),
        ...updates,
      };
      return {
        ...prev,
        linkedTaskConfig: merged,
      };
    });
  };

  const handleSave = async () => {
    if (!draft) return;
    setIsSaving(true);
    setSaveError(null);

    let updatedDraft: WidgetInstance = { ...draft };
    const config = normalizeTaskConfig(updatedDraft, {
      title: updatedDraft.linkedTaskTitle ?? updatedDraft.name,
      bucket: defaultBucket,
      dueDate: defaultDueDate,
    });
    const enabled = config.enabled ?? false;
    const content = (config.title || updatedDraft.name || "Widget Task").trim();
    const bucketName = config.bucket?.trim() || undefined;
    const dueDate = config.dueDate?.trim() || null;
    const repeatRule: RepeatOption = config.repeat ?? "none";
    const hourSlot = config.allDay ? undefined : timeToHourSlot(config.startTime);
    const endHourSlot = config.allDay ? undefined : timeToHourSlot(config.endTime);
    const allDay = config.allDay ?? true;

    try {
      if (enabled) {
        if (updatedDraft.linkedTaskId) {
          const updates: Record<string, any> = {
            content,
            bucket: bucketName,
            allDay,
            repeatRule: repeatRule === "none" ? null as any : repeatRule,
          };

          if (dueDate) {
            updates.due = { date: dueDate };
            updates.startDate = dueDate;
            updates.endDate = dueDate;
          } else {
            updates.due = null as any;
            updates.startDate = null as any;
            updates.endDate = null as any;
          }

          if (allDay) {
            updates.hourSlot = null as any;
            updates.endHourSlot = null as any;
          } else {
            updates.hourSlot = hourSlot ?? null;
            updates.endHourSlot = endHourSlot ?? null;
          }

          await batchUpdateTasks([{
            taskId: updatedDraft.linkedTaskId,
            updates,
            occurrenceDate: dueDate ?? undefined,
          }]);

          const nextConfig: WidgetTaskConfig = {
            ...config,
            enabled: true,
            bucket: bucketName,
            dueDate: dueDate ?? undefined,
            startTime: config.startTime,
            endTime: config.endTime,
            allDay,
            repeat: repeatRule,
          };

          updatedDraft = {
            ...updatedDraft,
            linkedTaskTitle: content,
            linkedTaskConfig: nextConfig,
          };
        } else {
          const createdTask = await createTask(
            content,
            dueDate,
            hourSlot,
            bucketName,
            repeatRule,
            {
              endHourSlot,
              allDay,
              endDate: dueDate,
            },
          );

          if (!createdTask) {
            throw new Error("Unable to create task from widget details");
          }

          const nextConfig: WidgetTaskConfig = {
            ...config,
            enabled: true,
            bucket: bucketName,
            dueDate: dueDate ?? undefined,
            startTime: config.startTime,
            endTime: config.endTime,
            allDay,
            repeat: repeatRule,
          };

          updatedDraft = {
            ...updatedDraft,
            linkedTaskId: createdTask.id?.toString?.() ?? createdTask.id,
            linkedTaskSource: createdTask.source,
            linkedTaskAutoCreated: true,
            linkedTaskTitle: createdTask.content,
            linkedTaskConfig: nextConfig,
          };
        }
      } else {
        if (updatedDraft.linkedTaskId && updatedDraft.linkedTaskAutoCreated) {
          try {
            await deleteTask(updatedDraft.linkedTaskId);
          } catch (error) {
            console.warn("Failed to delete linked task during unlink", error);
          }
        }

        updatedDraft = {
          ...updatedDraft,
          linkedTaskId: enabled ? updatedDraft.linkedTaskId : undefined,
          linkedTaskAutoCreated: enabled ? updatedDraft.linkedTaskAutoCreated : false,
          linkedTaskTitle: enabled ? updatedDraft.linkedTaskTitle : undefined,
          linkedTaskConfig: {
            ...config,
            enabled: false,
          },
        };
      }

      setDraft(updatedDraft);
      onSave(updatedDraft);
      onClose();
    } catch (error) {
      console.error("Failed to save widget task details", error);
      setSaveError(error instanceof Error ? error.message : "Unable to save task details");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-full sm:w-80">
        <SheetHeader>
          <SheetTitle>{isNewWidget ? 'Add Widget' : 'Edit Widget'}</SheetTitle>
        </SheetHeader>

        <div className="py-4 space-y-4 overflow-y-auto h-[calc(100vh-100px)]">
          <WidgetPreview widget={draft} />

          {/* Birthday, Events, and Holiday specific fields */}
          {draft.id === 'birthdays' ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-600">Friend's Name</p>
                <input
                  type="text"
                  value={draft.birthdayData?.friendName || ''}
                  onChange={e => setDraft(p => p ? {
                    ...p,
                    birthdayData: {
                      ...p.birthdayData,
                      friendName: e.target.value,
                      birthDate: p.birthdayData?.birthDate || ''
                    }
                  } : p)}
                  placeholder="Enter friend's name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-600">Birth Date</p>
                <input
                  type="date"
                  value={draft.birthdayData?.birthDate || ''}
                  onChange={e => setDraft(p => p ? {
                    ...p,
                    birthdayData: {
                      ...p.birthdayData,
                      friendName: p.birthdayData?.friendName || '',
                      birthDate: e.target.value
                    }
                  } : p)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
            </div>
          ) : draft.id === 'social_events' ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-600">Event Name</p>
                <input
                  type="text"
                  value={draft.eventData?.eventName || ''}
                  onChange={e => setDraft(p => p ? {
                    ...p,
                    eventData: {
                      ...p.eventData,
                      eventName: e.target.value,
                      eventDate: p.eventData?.eventDate || '',
                      description: p.eventData?.description || ''
                    }
                  } : p)}
                  placeholder="Enter event name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-600">Event Date</p>
                <input
                  type="date"
                  value={draft.eventData?.eventDate || ''}
                  onChange={e => setDraft(p => p ? {
                    ...p,
                    eventData: {
                      ...p.eventData,
                      eventName: p.eventData?.eventName || '',
                      eventDate: e.target.value,
                      description: p.eventData?.description || ''
                    }
                  } : p)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-600">Description (Optional)</p>
                <textarea
                  value={draft.eventData?.description || ''}
                  onChange={e => setDraft(p => p ? {
                    ...p,
                    eventData: {
                      ...p.eventData,
                      eventName: p.eventData?.eventName || '',
                      eventDate: p.eventData?.eventDate || '',
                      description: e.target.value
                    }
                  } : p)}
                  placeholder="Enter event description"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm h-20 resize-none"
                />
              </div>
            </div>
          ) : draft.id === 'holidays' ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-600">Holiday Name</p>
                <input
                  type="text"
                  value={draft.holidayData?.holidayName || ''}
                  onChange={e => setDraft(p => p ? {
                    ...p,
                    holidayData: {
                      ...p.holidayData,
                      holidayName: e.target.value,
                      holidayDate: p.holidayData?.holidayDate || ''
                    }
                  } : p)}
                  placeholder="Enter holiday name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-600">Holiday Date</p>
                <input
                  type="date"
                  value={draft.holidayData?.holidayDate || ''}
                  onChange={e => setDraft(p => p ? {
                    ...p,
                    holidayData: {
                      ...p.holidayData,
                      holidayName: p.holidayData?.holidayName || '',
                      holidayDate: e.target.value
                    }
                  } : p)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              
              {/* Holiday Suggestions */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-600">Popular Holidays</p>
                <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                  {getHolidaySuggestions().map((holiday) => (
                    <button
                      key={holiday.name}
                      type="button"
                      onClick={() => setDraft(p => p ? {
                        ...p,
                        holidayData: {
                          holidayName: holiday.name,
                          holidayDate: holiday.date
                        }
                      } : p)}
                      className="text-left px-2 py-1 text-xs bg-gray-50 hover:bg-gray-100 rounded border border-gray-200 transition-colors"
                    >
                      {holiday.name}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-400">Click a suggestion to auto-fill</p>
              </div>
            </div>
          ) : draft.id === 'mood' ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-600">How are you feeling today?</p>
                <div className="grid grid-cols-5 gap-2">
                  {[
                    { emoji: '😢', label: 'Very Poor', value: 1 },
                    { emoji: '😕', label: 'Poor', value: 2 },
                    { emoji: '😐', label: 'Neutral', value: 3 },
                    { emoji: '😊', label: 'Good', value: 4 },
                    { emoji: '😁', label: 'Excellent', value: 5 }
                  ].map((mood) => (
                    <button
                      key={mood.value}
                      type="button"
                      onClick={() => setDraft(p => p ? {
                        ...p,
                        moodData: {
                          ...p.moodData,
                          currentMood: mood.value,
                          lastUpdated: new Date().toISOString(),
                          moodNote: p.moodData?.moodNote || ''
                        }
                      } : p)}
                      className={`flex flex-col items-center p-2 rounded-lg border transition-all ${
                        draft.moodData?.currentMood === mood.value 
                          ? 'border-indigo-500 bg-indigo-50' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <span className="text-xl mb-1">{mood.emoji}</span>
                      <span className="text-xs text-center">{mood.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-600">Mood Note (Optional)</p>
                <textarea
                  value={draft.moodData?.moodNote || ''}
                  onChange={e => setDraft(p => p ? {
                    ...p,
                    moodData: {
                      ...p.moodData,
                      currentMood: p.moodData?.currentMood || 3,
                      lastUpdated: p.moodData?.lastUpdated || new Date().toISOString(),
                      moodNote: e.target.value
                    }
                  } : p)}
                  placeholder="What's affecting your mood today?"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm h-16 resize-none"
                />
              </div>
              
              {draft.moodData?.currentMood && (
                <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
                  Current mood: {['😢 Very Poor', '😕 Poor', '😐 Neutral', '😊 Good', '😁 Excellent'][draft.moodData.currentMood - 1]}
                </div>
              )}
            </div>
          ) : draft.id === 'journal' ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-600">Today's Journal Entry</p>
                <textarea
                  value={draft.journalData?.todaysEntry || ''}
                  onChange={e => {
                    const today = new Date().toISOString().split('T')[0];
                    setDraft(p => p ? {
                      ...p,
                      journalData: {
                        ...p.journalData,
                        todaysEntry: e.target.value,
                        lastEntryDate: e.target.value.trim() ? today : p.journalData?.lastEntryDate,
                        entryCount: p.journalData?.entryCount || 1
                      }
                    } : p);
                  }}
                  placeholder="What's on your mind today? How are you feeling? What happened that was meaningful?"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm h-32 resize-none"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>
                    {draft.journalData?.todaysEntry ? 
                      `${draft.journalData.todaysEntry.split(' ').filter(word => word.length > 0).length} words` : 
                      '0 words'
                    }
                  </span>
                  <span>{new Date().toLocaleDateString()}</span>
                </div>
              </div>
              
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-600">Writing Prompts</p>
                <div className="grid grid-cols-1 gap-1">
                  {[
                    "What are three things that went well today?",
                    "How did I grow or learn something today?", 
                    "What challenged me today and how did I handle it?",
                    "What am I looking forward to tomorrow?",
                    "Who or what am I grateful for right now?"
                  ].map((prompt, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => {
                        const currentEntry = draft.journalData?.todaysEntry || '';
                        const newEntry = currentEntry + (currentEntry ? '\n\n' : '') + prompt + '\n';
                        const today = new Date().toISOString().split('T')[0];
                        setDraft(p => p ? {
                          ...p,
                          journalData: {
                            ...p.journalData,
                            todaysEntry: newEntry,
                            lastEntryDate: today,
                            entryCount: p.journalData?.entryCount || 1
                          }
                        } : p);
                      }}
                      className="text-left px-2 py-1 text-xs bg-gray-50 hover:bg-gray-100 rounded border border-gray-200 transition-colors"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-400">Click a prompt to add it to your entry</p>
              </div>
            </div>
          ) : draft.id === 'gratitude' ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-600">What are you grateful for today?</p>
                {(draft.gratitudeData?.gratitudeItems || []).map((item, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={item}
                      onChange={e => {
                        const newItems = [...(draft.gratitudeData?.gratitudeItems || [])];
                        newItems[index] = e.target.value;
                        setDraft(p => p ? {
                          ...p,
                          gratitudeData: {
                            ...p.gratitudeData,
                            gratitudeItems: newItems,
                            lastEntryDate: new Date().toISOString().split('T')[0],
                            entryCount: p.gratitudeData?.entryCount || 1
                          }
                        } : p);
                      }}
                      placeholder={`Gratitude item ${index + 1}`}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const newItems = (draft.gratitudeData?.gratitudeItems || []).filter((_, i) => i !== index);
                        setDraft(p => p ? {
                          ...p,
                          gratitudeData: {
                            ...p.gratitudeData,
                            gratitudeItems: newItems,
                            lastEntryDate: newItems.length > 0 ? new Date().toISOString().split('T')[0] : p.gratitudeData?.lastEntryDate,
                            entryCount: p.gratitudeData?.entryCount || 1
                          }
                        } : p);
                      }}
                      className="px-2 py-2 text-red-500 hover:bg-red-50 rounded"
                    >
                      ×
                    </button>
                  </div>
                ))}
                
                <button
                  type="button"
                  onClick={() => {
                    const currentItems = draft.gratitudeData?.gratitudeItems || [];
                    if (currentItems.length < 5) {
                      setDraft(p => p ? {
                        ...p,
                        gratitudeData: {
                          ...p.gratitudeData,
                          gratitudeItems: [...currentItems, ''],
                          lastEntryDate: new Date().toISOString().split('T')[0],
                          entryCount: p.gratitudeData?.entryCount || 1
                        }
                      } : p);
                    }
                  }}
                  className="w-full px-3 py-2 border border-dashed border-gray-300 text-gray-500 hover:border-gray-400 hover:text-gray-600 rounded-md text-sm transition-colors"
                >
                  + Add gratitude item
                </button>
                
                <div className="text-xs text-gray-500">
                  {draft.gratitudeData?.gratitudeItems?.length || 0} / 5 items
                </div>
              </div>
            </div>
          ) : draft.id === 'quit_habit' ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-600">What habit are you quitting?</p>
                <input
                  type="text"
                  value={draft.quitHabitData?.habitName || ''}
                  onChange={e => setDraft(p => p ? {
                    ...p,
                    quitHabitData: {
                      ...p.quitHabitData,
                      habitName: e.target.value,
                      quitDate: p.quitHabitData?.quitDate || '',
                      costPerDay: p.quitHabitData?.costPerDay || 0,
                      currency: p.quitHabitData?.currency || '$',
                      relapses: p.quitHabitData?.relapses || [],
                      milestones: p.quitHabitData?.milestones || [],
                      motivationalNote: p.quitHabitData?.motivationalNote || ''
                    }
                  } : p)}
                  placeholder="e.g., smoking, drinking, social media"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-600">Quit Date</p>
                <input
                  type="date"
                  value={draft.quitHabitData?.quitDate || ''}
                  onChange={e => setDraft(p => p ? {
                    ...p,
                    quitHabitData: {
                      ...p.quitHabitData,
                      habitName: p.quitHabitData?.habitName || '',
                      quitDate: e.target.value,
                      costPerDay: p.quitHabitData?.costPerDay || 0,
                      currency: p.quitHabitData?.currency || '$',
                      relapses: p.quitHabitData?.relapses || [],
                      milestones: p.quitHabitData?.milestones || [],
                      motivationalNote: p.quitHabitData?.motivationalNote || ''
                    }
                  } : p)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-600">Daily Cost (Optional)</p>
                <div className="flex gap-2">
                  <select 
                    value={draft.quitHabitData?.currency || '$'}
                    onChange={e => setDraft(p => p ? {
                      ...p,
                      quitHabitData: {
                        ...p.quitHabitData,
                        currency: e.target.value
                      }
                    } : p)}
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm w-16"
                  >
                    <option value="$">$</option>
                    <option value="€">€</option>
                    <option value="£">£</option>
                  </select>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={draft.quitHabitData?.costPerDay || ''}
                    onChange={e => setDraft(p => p ? {
                      ...p,
                      quitHabitData: {
                        ...p.quitHabitData,
                        costPerDay: parseFloat(e.target.value) || 0
                      }
                    } : p)}
                    placeholder="0.00"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>
                <p className="text-xs text-gray-400">How much did you spend per day on this habit?</p>
              </div>
              
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-600">Motivation (Optional)</p>
                <textarea
                  value={draft.quitHabitData?.motivationalNote || ''}
                  onChange={e => setDraft(p => p ? {
                    ...p,
                    quitHabitData: {
                      ...p.quitHabitData,
                      motivationalNote: e.target.value
                    }
                  } : p)}
                  placeholder="Why are you quitting? What motivates you to stay clean?"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm h-20 resize-none"
                />
              </div>

              {draft.quitHabitData?.quitDate && draft.quitHabitData?.habitName && (
                <div className="space-y-3">
                  <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded">
                    <div className="font-medium mb-1">Preview:</div>
                    <div>🚭 Quitting {draft.quitHabitData.habitName}</div>
                    <div>📅 Since {new Date(draft.quitHabitData.quitDate).toLocaleDateString()}</div>
                    <div className="text-green-600 font-medium">
                      {(() => {
                        const quitDate = new Date(draft.quitHabitData.quitDate);
                        const today = new Date();
                        const daysSince = Math.floor((today.getTime() - quitDate.getTime()) / (1000 * 60 * 60 * 24));
                        return `${daysSince} days clean`;
                      })()}
                    </div>
                    {draft.quitHabitData?.costPerDay && draft.quitHabitData.costPerDay > 0 && (
                      <div>💰 Daily savings: {draft.quitHabitData.currency}{draft.quitHabitData.costPerDay}</div>
                    )}
                  </div>
                  
                  <div className="border-t pt-3 space-y-3">
                    <div>
                      <p className="text-xs font-medium text-gray-600 mb-2">Daily Check-in</p>
                      <button
                        type="button"
                        onClick={() => {
                          const today = new Date().toISOString().split('T')[0];
                          const quitDate = new Date(draft.quitHabitData?.quitDate || '');
                          const daysSince = Math.floor((new Date().getTime() - quitDate.getTime()) / (1000 * 60 * 60 * 24));
                          
                          // Add check-in milestone
                          setDraft(p => p ? {
                            ...p,
                            quitHabitData: {
                              ...p.quitHabitData,
                              milestones: [
                                ...(p.quitHabitData?.milestones || []),
                                {
                                  days: daysSince,
                                  label: `Day ${daysSince} Check-in`,
                                  achieved: true,
                                  achievedDate: today
                                }
                              ]
                            }
                          } : p);
                          
                          // Show success message
                          alert(`✅ Great job! You've successfully stayed clean for ${daysSince} days. Keep it up!`);
                        }}
                        className="text-xs px-4 py-2 bg-green-100 text-green-700 rounded border border-green-200 hover:bg-green-200 transition-colors font-medium"
                      >
                        ✅ Check In for Today
                      </button>
                      <p className="text-xs text-gray-400 mt-1">Mark your progress for today and celebrate your commitment</p>
                    </div>
                    
                    <div>
                      <p className="text-xs font-medium text-gray-600 mb-2">Reset Options</p>
                      <button
                        type="button"
                        onClick={() => {
                          const today = new Date().toISOString().split('T')[0];
                          const confirmed = window.confirm('Reset your quit date to today? This will start your counter over.');
                          if (confirmed) {
                            setDraft(p => p ? {
                              ...p,
                              quitHabitData: {
                                ...p.quitHabitData,
                                quitDate: today,
                                relapses: [
                                  ...(p.quitHabitData?.relapses || []),
                                  {
                                    date: today,
                                    note: 'Reset from widget editor'
                                  }
                                ]
                              }
                            } : p);
                          }
                        }}
                        className="text-xs px-3 py-1 bg-orange-100 text-orange-700 rounded border border-orange-200 hover:bg-orange-200 transition-colors"
                      >
                        🔄 Reset to Today
                      </button>
                      <p className="text-xs text-gray-400 mt-1">Use if you had a setback and want to start fresh</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : draft.id === 'weight' ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-600">Current Weight</p>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={draft.weightData?.currentWeight || ''}
                    disabled={draft.dataSource === 'withings'}
                    onChange={e => setDraft(p => p ? {
                      ...p,
                      weightData: {
                        ...p.weightData,
                        currentWeight: parseFloat(e.target.value) || 0,
                        unit: p.weightData?.unit || draft.unit || 'lbs'
                      }
                    } : p)}
                    placeholder="Enter current weight"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                  <select 
                    value={draft.weightData?.unit || draft.unit || 'lbs'}
                    onChange={e => setDraft(p => p ? {
                      ...p,
                      unit: e.target.value,
                      weightData: {
                        ...p.weightData,
                        unit: e.target.value
                      }
                    } : p)}
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm w-20"
                  >
                    <option value="lbs">lbs</option>
                    <option value="kg">kg</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-600">Starting Weight (Optional)</p>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={draft.weightData?.startingWeight || ''}
                  onChange={e => setDraft(p => p ? {
                    ...p,
                    weightData: {
                      ...p.weightData,
                      startingWeight: parseFloat(e.target.value) || 0
                    }
                  } : p)}
                  placeholder="Starting weight for progress tracking"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-600">Goal Weight (Optional)</p>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={draft.weightData?.goalWeight || ''}
                  onChange={e => setDraft(p => p ? {
                    ...p,
                    weightData: {
                      ...p.weightData,
                      goalWeight: parseFloat(e.target.value) || 0
                    }
                  } : p)}
                  placeholder="Target weight goal"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>

              {/* Data Source Selector */}
              <div className="space-y-2 border-t pt-3">
                <p className="text-xs font-medium text-gray-600">Data Source</p>
                <div className="space-y-2">
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      name="weightDataSource"
                      value="manual"
                      checked={draft.dataSource === 'manual' || !draft.dataSource}
                      onChange={() => setDraft(prev => prev ? { ...prev, dataSource: 'manual' } : prev)}
                    />
                    <span className="text-xs">Manual</span>
                  </label>
                  {isWithingsConnected && (
                    <label className="flex items-center space-x-2">
                      <input
                        type="radio"
                        name="weightDataSource"
                        value="withings"
                        checked={draft.dataSource === 'withings'}
                        onChange={() => setDraft(prev => prev ? { ...prev, dataSource: 'withings' } : prev)}
                      />
                      <span className="text-xs">Withings (Automatic)</span>
                    </label>
                  )}
                  {!isWithingsConnected && (
                    <p className="text-[10px] text-gray-400 ml-5">Connect Withings to enable automatic sync</p>
                  )}
                </div>
              </div>

              {/* Quick Log Entry */}
              <div className="space-y-2 border-t pt-3">
                <p className="text-xs font-medium text-gray-600">Quick Log Entry</p>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    placeholder="Weight"
                    disabled={draft.dataSource === 'withings'}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                    id="quick-weight-input"
                  />
                  <button
                    type="button"
                    disabled={draft.dataSource === 'withings'}
                    onClick={() => {
                      const input = document.getElementById('quick-weight-input') as HTMLInputElement;
                      const weight = parseFloat(input.value);
                      if (weight > 0) {
                        const today = new Date().toISOString().split('T')[0];
                        setDraft(p => p ? {
                          ...p,
                          weightData: {
                            ...p.weightData,
                            currentWeight: weight,
                            entries: [
                              ...(p.weightData?.entries || []),
                              {
                                date: today,
                                weight: weight,
                                note: 'Quick log entry'
                              }
                            ],
                            lastEntryDate: today
                          }
                        } : p);
                        input.value = '';
                        alert(`Weight logged: ${weight} ${draft.weightData?.unit || draft.unit || 'lbs'}`);
                      }
                    }}
                    className="px-4 py-2 bg-blue-100 text-blue-700 rounded-md text-sm border border-blue-200 hover:bg-blue-200 transition-colors"
                  >
                    Log
                  </button>
                </div>
                <p className="text-xs text-gray-400">Enter today's weight measurement</p>
              </div>

              {/* Weight Progress Display */}
              {draft.weightData && (draft.weightData.currentWeight || draft.weightData.entries?.length) && (
                <div className="space-y-3 border-t pt-3">
                  <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded">
                    <div className="font-medium mb-1">Weight Tracking Preview:</div>
                    
                    {draft.weightData.currentWeight && (
                      <div>📊 Current: {draft.weightData.currentWeight} {draft.weightData.unit || draft.unit || 'lbs'}</div>
                    )}
                    
                    {draft.weightData.startingWeight && draft.weightData.currentWeight && (
                      <div className={
                        draft.weightData.currentWeight < draft.weightData.startingWeight 
                          ? "text-green-600" 
                          : draft.weightData.currentWeight > draft.weightData.startingWeight 
                          ? "text-orange-600" 
                          : "text-gray-600"
                      }>
                        📈 Change: {(draft.weightData.currentWeight - draft.weightData.startingWeight > 0 ? '+' : '')}{(draft.weightData.currentWeight - draft.weightData.startingWeight).toFixed(1)} {draft.weightData.unit || draft.unit || 'lbs'}
                      </div>
                    )}
                    
                    {draft.weightData.goalWeight && draft.weightData.currentWeight && (
                      <div className="text-blue-600">
                        🎯 To Goal: {(draft.weightData.goalWeight - draft.weightData.currentWeight > 0 ? '+' : '')}{(draft.weightData.goalWeight - draft.weightData.currentWeight).toFixed(1)} {draft.weightData.unit || draft.unit || 'lbs'}
                      </div>
                    )}
                    
                    {draft.weightData.entries && draft.weightData.entries.length > 0 && (
                      <div>📅 Entries: {draft.weightData.entries.length} logged</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Target */
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-600">Daily target</p>
              <div className="flex items-center gap-2">
                <button aria-label="Decrease target" className="px-2 py-1 rounded bg-gray-100" onClick={() => setDraft(p => p ? { ...p, target: Math.max(0,p.target-1)}:p)}>-</button>
                <input aria-label="Target value" type="number" value={draft.target} onChange={e=>setDraft(p=>p?{...p,target:Number(e.target.value)}:p)} className="w-16 text-center border rounded" />
                <span className="text-sm text-gray-600">{draft.unit}</span>
                <button className="px-2 py-1 rounded bg-gray-100" onClick={() => setDraft(p => p ? { ...p, target: p.target+1}:p)}>+</button>
              </div>
            </div>
          )}

          {/* Data Source Selector - Only for water widget with Fitbit connected */}
          {['water','steps'].includes(draft.id) && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-600">Data Source</p>
              <div className="space-y-2">
                <label className="flex items-center space-x-2">
                  <input
                    type="radio"
                    name="dataSource"
                    value="manual"
                    checked={draft.dataSource === 'manual'}
                    onChange={() => setDraft(prev => prev ? { ...prev, dataSource: 'manual' } : prev)}
                    className="text-indigo-600"
                  />
                  <span className="text-sm">Manual tracking</span>
                </label>
                {isFitbitConnected && (
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      name="dataSource"
                      value="fitbit"
                      checked={draft.dataSource === 'fitbit'}
                      onChange={() => setDraft(prev => prev ? { ...prev, dataSource: 'fitbit' } : prev)}
                      className="text-indigo-600"
                    />
                    <span className="text-sm">Fitbit (automatic)</span>
                  </label>
                )}
                {isGoogleFitConnected && (
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      name="dataSource"
                      value="googlefit"
                      checked={draft.dataSource === 'googlefit'}
                      onChange={() => setDraft(prev => prev ? { ...prev, dataSource: 'googlefit' } : prev)}
                      className="text-indigo-600"
                    />
                    <span className="text-sm">Google Fit (automatic)</span>
                  </label>
                )}
              </div>
              {draft.dataSource === 'fitbit' && (
                <p className="text-xs text-gray-500 mt-1">
                  {draft.name} will sync automatically from your Fitbit device
                </p>
              )}
            </div>
          )}

          {/* Colour */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-600">Colour</p>
            <div className="flex flex-wrap gap-2">
              {COLORS.map(c => (
                <button key={c} aria-label={c} className={`w-6 h-6 rounded-full border-2 ${getColorClass(c)} ${draft.color===c?'ring-2 ring-indigo-500':'border-white'}`} onClick={()=>setDraft(p=>p?{...p,color:c}:p)} />
              ))}
            </div>
          </div>

          {/* Task / Event Details */}
          <div className="space-y-3 border-t border-gray-200 pt-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-gray-600">Task &amp; Event</p>
              <label className="inline-flex items-center gap-2 text-xs text-gray-600">
                <input
                  type="checkbox"
                  checked={Boolean(taskConfig.enabled)}
                  onChange={e => updateTaskConfig({ enabled: e.target.checked })}
                />
                Show in Tasks
              </label>
            </div>

            {taskConfig.enabled && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-600">Title</p>
                  <input
                    type="text"
                    value={taskConfig.title ?? ""}
                    onChange={e => updateTaskConfig({ title: e.target.value })}
                    placeholder="Task title"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-600">Bucket</p>
                  <select
                    value={taskConfig.bucket ?? ""}
                    onChange={e => updateTaskConfig({ bucket: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="">Select bucket</option>
                    {derivedBuckets.map(bucket => (
                      <option key={bucket} value={bucket}>{bucket}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-600">Due Date</p>
                  <input
                    type="date"
                    value={taskConfig.dueDate ?? ""}
                    onChange={e => updateTaskConfig({ dueDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>

                <div className="flex items-center justify-between text-xs text-gray-600">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={taskConfig.allDay ?? true}
                      onChange={e => updateTaskConfig({ allDay: e.target.checked })}
                    />
                    All-day
                  </label>
                  <span className="text-[11px] text-gray-500">
                    {draft.linkedTaskId ? "Updating linked task" : "Will create task"}
                  </span>
                </div>

                {!taskConfig.allDay && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-gray-600">Start Time</p>
                      <input
                        type="time"
                        value={taskConfig.startTime ?? ""}
                        onChange={e => updateTaskConfig({ startTime: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-gray-600">End Time</p>
                      <input
                        type="time"
                        value={taskConfig.endTime ?? ""}
                        onChange={e => updateTaskConfig({ endTime: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-600">Repeat</p>
                  <select
                    value={taskConfig.repeat ?? "none"}
                    onChange={e => updateTaskConfig({ repeat: e.target.value as RepeatOption })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    {REPEAT_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>

                {draft.linkedTaskId && (
                  <p className="text-[11px] text-gray-500">
                    Linked task ID: <span className="font-mono">{draft.linkedTaskId}</span>
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Schedule */}
          {draft.schedule && !['birthdays', 'social_events', 'holidays', 'mood', 'journal', 'gratitude', 'quit_habit', 'nutrition'].includes(draft.id) && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-600">Schedule</p>
              <div className="flex flex-wrap gap-2">
                {WEEKDAYS.map((d,idx)=>(
                  <button key={d} className={`w-8 h-8 text-[11px] rounded-full border ${draft.schedule[idx]?'bg-indigo-500 text-white':'bg-white text-gray-600'}`} onClick={()=>setDraft(p=>p?{...p,schedule:p.schedule.map((v,i)=>i===idx?!v:v) as boolean[]}:p)}>{d.charAt(0)}</button>
                ))}
              </div>
            </div>
          )}

          {saveError && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
              {saveError}
            </div>
          )}

          <div className="pt-4 flex gap-2">
            <Button className="flex-1" disabled={isSaving} onClick={handleSave}>
              {isSaving ? "Saving..." : "Save"}
            </Button>
            <SheetClose asChild>
              <Button variant="outline" className="flex-1">Cancel</Button>
            </SheetClose>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
} 
