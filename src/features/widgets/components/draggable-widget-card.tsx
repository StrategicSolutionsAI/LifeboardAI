"use client";

import React from "react";
import { format, parseISO } from "date-fns";
import {
  X,
  Settings as SettingsIcon,
  ListChecks,
  GripVertical,
  Check,
} from "lucide-react";
import type { WidgetInstance } from "@/types/widgets";
import type { Task } from "@/types/tasks";
import {
  getIconComponent,
  getWidgetColorStyles,
  todayStrGlobal,
} from "@/lib/dashboard-utils";
import { progress as progressStyles } from "@/lib/styles";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import { Draggable } from "@hello-pangea/dnd";
import { motion, AnimatePresence } from "framer-motion";

/** Returns the semantic progress fill class based on completion percentage */
function getProgressFillClass(pct: number): string {
  if (pct >= 100) return progressStyles.fill.complete;
  if (pct >= 75) return progressStyles.fill.brand;
  if (pct >= 50) return progressStyles.fill.high;
  if (pct >= 25) return progressStyles.fill.medium;
  return progressStyles.fill.low;
}

const NutritionSummaryWidget = dynamic(
  () =>
    import("./nutrition-summary-widget").then((m) => m.NutritionSummaryWidget),
  { loading: () => <Skeleton className="h-24 w-full" /> }
);

export interface ProgressEntry {
  value: number;
  date: string;
  streak: number;
  lastCompleted: string;
}

interface DraggableWidgetCardProps {
  widget: WidgetInstance;
  index: number;
  activeBucket: string;
  bucketHex: string;
  progressByWidget: Record<string, ProgressEntry>;
  allTasks: Task[];
  fitbitData: Record<string, number>;
  googleFitData: Record<string, number>;
  onCardClick: (widget: WidgetInstance) => void;
  onEditSettings: (widget: WidgetInstance) => void;
  onConvertToTask: (widget: WidgetInstance, bucket: string) => void;
  onRemove: (widget: WidgetInstance) => void;
  onIncrementProgress: (widget: WidgetInstance) => void;
  onToggleTaskCompletion: (taskId: string) => void;
  onHabitToggle: (widget: WidgetInstance, completed: boolean) => void;
}

export function DraggableWidgetCard({
  widget: w,
  index,
  activeBucket,
  bucketHex,
  progressByWidget,
  allTasks,
  fitbitData,
  googleFitData,
  onCardClick,
  onEditSettings,
  onConvertToTask,
  onRemove,
  onIncrementProgress,
  onToggleTaskCompletion,
  onHabitToggle,
}: DraggableWidgetCardProps) {
  // Linked task resolution
  const isLinkedTask = Boolean(w.linkedTaskId);
  const linkedTask = isLinkedTask
    ? allTasks.find((task) => task.id?.toString?.() === w.linkedTaskId)
    : undefined;
  const linkedTaskCompleted = Boolean(linkedTask?.completed);
  const linkedTaskContent =
    linkedTask?.content ?? w.linkedTaskTitle ?? w.name;
  const linkedTaskDueDisplay = (() => {
    const linkedTaskDueRaw =
      linkedTask?.due?.date ?? linkedTask?.due?.datetime ?? null;
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

  // Today's progress value
  let todayVal = 0;
  if (isLinkedTask) {
    todayVal = linkedTaskCompleted ? (w.target || 1) : 0;
  } else if (
    w.id === "water" &&
    w.dataSource === "fitbit" &&
    fitbitData.water !== undefined
  ) {
    todayVal = fitbitData.water;
  } else if (
    w.id === "steps" &&
    w.dataSource === "fitbit" &&
    fitbitData.steps !== undefined
  ) {
    todayVal = fitbitData.steps;
  } else if (
    w.id === "water" &&
    w.dataSource === "googlefit" &&
    googleFitData.water !== undefined
  ) {
    todayVal = googleFitData.water;
  } else if (
    w.id === "steps" &&
    w.dataSource === "googlefit" &&
    googleFitData.steps !== undefined
  ) {
    todayVal = googleFitData.steps;
  } else if (w.id === "water" && w.waterData?.entries?.length) {
    const today = todayStrGlobal;
    todayVal = w.waterData.entries
      .filter((e: { date: string; amount: number }) => e.date === today)
      .reduce((sum: number, e: { date: string; amount: number }) => sum + e.amount, 0);
  } else if (w.id === "steps" && w.stepsData?.entries?.length) {
    const today = todayStrGlobal;
    todayVal = w.stepsData.entries
      .filter((e: { date: string; steps: number }) => e.date === today)
      .reduce((sum: number, e: { date: string; steps: number }) => sum + e.steps, 0);
  } else if (w.id === "heartrate" && w.heartRateData?.entries?.length) {
    const today = todayStrGlobal;
    const todayReadings = w.heartRateData.entries.filter((e: { date: string }) => e.date === today);
    todayVal = todayReadings.length > 0 ? 1 : 0; // target is 1 reading per day
  } else if (w.id === "caffeine" && w.caffeineData?.entries?.length) {
    const today = todayStrGlobal;
    todayVal = w.caffeineData.entries
      .filter((e: { date: string; cups: number }) => e.date === today)
      .reduce((sum: number, e: { date: string; cups: number }) => sum + e.cups, 0);
  } else {
    const prog = progressByWidget[w.instanceId];
    todayVal = prog && prog.date === todayStrGlobal ? prog.value : 0;
  }

  const normalizedTarget = w.target && w.target > 0 ? w.target : 1;
  const pct = isLinkedTask
    ? linkedTaskCompleted
      ? 100
      : 0
    : Math.min(100, Math.round((todayVal / normalizedTarget) * 100));
  const goalMet = isLinkedTask ? linkedTaskCompleted : pct >= 100;

  const wStyles = getWidgetColorStyles(bucketHex);

  // Show "+" increment button for standard progress widgets
  const showIncrement =
    !(
      ["water", "steps"].includes(w.id) &&
      (w.dataSource === "fitbit" || w.dataSource === "googlefit")
    ) &&
    ![
      "birthdays",
      "social_events",
      "holidays",
      "mood",
      "journal",
      "gratitude",
      "weight",
      "exercise",
      "nutrition",
      "medication",
      "habit_tracker",
      "sleep",
      "meditation",
      "breathwork",
      "water",
      "steps",
      "heartrate",
      "caffeine",
    ].includes(w.id) &&
    !isLinkedTask;

  return (
    <Draggable draggableId={w.instanceId} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={`widget-card-size rounded-xl border border-theme-neutral-300 bg-theme-surface-raised p-4 shadow-warm-sm hover:shadow-warm-lg hover:scale-[1.02] hover:-translate-y-0.5 relative group cursor-pointer transition-all duration-200 ease-out min-w-0 ${
            snapshot.isDragging
              ? "opacity-60 shadow-warm-lg border-theme-primary/40 z-50"
              : ""
          }`}
          style={{
            ...(goalMet ? { backgroundColor: wStyles.tint } : undefined),
            ...provided.draggableProps.style,
          }}
          onClick={() => onCardClick(w)}
        >
          {/* Goal completion badge */}
          <AnimatePresence>
            {goalMet && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 25 }}
                className="absolute top-2 right-2 z-20 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center shadow-sm"
              >
                <Check className="h-3 w-3 text-white" strokeWidth={3} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Drag handle */}
          <div
            {...provided.dragHandleProps}
            className="absolute top-1.5 left-1.5 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-30 drag-handle-touch transition-opacity z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical size={14} className="text-theme-text-secondary" />
          </div>

          {/* Action buttons (top-right) */}
          <div className={`flex absolute top-1 right-1 gap-1 opacity-0 group-hover:opacity-100 transition-opacity ${goalMet ? "right-8" : ""}`}>
            {w.id === "nutrition" && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEditSettings(w);
                }}
                className="rounded-full bg-theme-surface-alt hover:bg-theme-hover p-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-theme-primary/40 transition"
                aria-label="Edit widget settings"
                title="Edit settings"
              >
                <SettingsIcon className="h-3 w-3 text-theme-text-secondary" />
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onConvertToTask(w, activeBucket);
              }}
              className={`rounded-full p-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-theme-primary/40 transition ${
                w.linkedTaskId
                  ? "bg-theme-primary hover:bg-theme-primary-600"
                  : "bg-theme-brand-tint hover:bg-theme-primary/20"
              }`}
              aria-label={
                w.linkedTaskId ? "Remove from Tasks" : "Show in Tasks"
              }
              title={
                w.linkedTaskId
                  ? "Remove from Tasks tab"
                  : "Show in Tasks tab"
              }
            >
              <ListChecks
                className={`h-3 w-3 ${
                  w.linkedTaskId ? "text-white" : "text-theme-primary"
                }`}
              />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove(w);
              }}
              className="rounded-full bg-theme-surface-alt hover:bg-red-100 p-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-red-500 transition"
              aria-label="Delete widget"
              title="Delete widget"
            >
              <X className="h-3 w-3 text-theme-text-tertiary hover:text-red-600" />
            </button>
          </div>

          {/* Icon + Title */}
          <div className="flex items-center gap-2">
            {(() => {
              let IconComponent: any = null;
              if (typeof w.icon === "string") {
                const key = w.icon.replace(/^Lucide/, "");
                IconComponent =
                  getIconComponent(key) || getIconComponent(w.icon);
              } else if (typeof w.icon === "function") {
                IconComponent = w.icon;
              }
              if (!IconComponent || typeof IconComponent !== "function") {
                IconComponent = getIconComponent(w.id);
              }
              if (!IconComponent)
                return (
                  <div className="h-5 w-5 bg-theme-neutral-300 rounded" />
                );
              return (
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: wStyles.iconTint }}
                >
                  <IconComponent
                    className="h-5 w-5"
                    style={{ color: wStyles.text }}
                  />
                </div>
              );
            })()}
            {w.id === "birthdays" &&
            w.birthdayData &&
            w.birthdayData.friendName ? (
              <span className="text-sm font-medium truncate">
                {w.birthdayData.friendName}
              </span>
            ) : w.id === "social_events" && w.eventData ? (
              <span className="text-sm font-medium truncate">
                {w.eventData.eventName}
              </span>
            ) : w.id === "holidays" &&
              w.holidayData &&
              w.holidayData.holidayName ? (
              <span className="text-sm font-medium truncate">
                {w.holidayData.holidayName}
              </span>
            ) : w.id === "quit_habit" &&
              w.quitHabitData &&
              w.quitHabitData.habitName ? (
              <span className="text-sm font-medium truncate">
                {w.quitHabitData.habitName}
              </span>
            ) : (
              <span className="text-sm font-medium truncate">{w.name}</span>
            )}
          </div>

          {/* Linked task section */}
          {isLinkedTask && (
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm text-theme-text-body">
                  <ListChecks className="h-4 w-4 text-theme-primary" />
                  <span className="truncate">{linkedTaskContent}</span>
                </div>
                <button
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (!linkedTask) return;
                    onToggleTaskCompletion(linkedTask.id.toString());
                  }}
                  disabled={!linkedTask}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    linkedTaskCompleted
                      ? ""
                      : "border-theme-neutral-300 text-theme-text-subtle hover:bg-theme-brand-tint-light"
                  } ${!linkedTask ? "opacity-60 cursor-not-allowed" : ""}`}
                  style={
                    linkedTaskCompleted
                      ? {
                          borderColor: wStyles.solid,
                          color: wStyles.text,
                          backgroundColor: wStyles.tint,
                        }
                      : undefined
                  }
                >
                  {linkedTaskCompleted ? "Undo" : "Mark done"}
                </button>
              </div>
              {linkedTaskDueDisplay ? (
                <p className="text-xs text-theme-text-tertiary">
                  Due {linkedTaskDueDisplay}
                </p>
              ) : null}
            </div>
          )}

          {/* Widget-specific body content */}
          {renderWidgetBody(w, wStyles, todayVal, pct, progressByWidget, onIncrementProgress, onHabitToggle)}

          {/* "+" increment button */}
          {showIncrement && (
            <button
              aria-label="Add one"
              onClick={(e) => {
                e.stopPropagation();
                onIncrementProgress(w);
              }}
              className="absolute bottom-2 right-2 text-xl font-bold leading-none hover:scale-110 transition-transform"
              style={{ color: wStyles.text }}
            >
              +
            </button>
          )}
        </div>
      )}
    </Draggable>
  );
}

// ---------------------------------------------------------------------------
// Widget body renderer — handles all widget-type-specific content
// ---------------------------------------------------------------------------
function renderWidgetBody(
  w: WidgetInstance,
  wStyles: ReturnType<typeof getWidgetColorStyles>,
  todayVal: number,
  pct: number,
  progressByWidget: Record<string, ProgressEntry>,
  onIncrementProgress: (w: WidgetInstance) => void,
  onHabitToggle: (w: WidgetInstance, completed: boolean) => void,
) {
  // Birthday widget
  if (w.id === "birthdays") {
    if (w.birthdayData && w.birthdayData.birthDate) {
      const birthDate = new Date(w.birthdayData.birthDate);
      const today = new Date();
      const currentYear = today.getFullYear();
      const thisYearBirthday = new Date(
        currentYear,
        birthDate.getMonth(),
        birthDate.getDate()
      );
      const nextBirthday =
        thisYearBirthday < today
          ? new Date(
              currentYear + 1,
              birthDate.getMonth(),
              birthDate.getDate()
            )
          : thisYearBirthday;
      const daysUntil = Math.ceil(
        (nextBirthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );
      return (
        <div className="mt-2">
          <div className="text-xs text-theme-text-tertiary">
            {birthDate.toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
            })}
          </div>
          <div className="text-xs text-theme-text-subtle mt-1">
            {daysUntil === 0
              ? "\uD83C\uDF89 Today!"
              : daysUntil === 1
              ? "\uD83C\uDF82 Tomorrow"
              : `\uD83D\uDDD3\uFE0F ${daysUntil} days`}
          </div>
        </div>
      );
    }
    return (
      <div className="mt-3 text-center">
        <div className="text-2xl mb-2">{"\uD83C\uDF82"}</div>
        <div className="text-xs text-theme-text-subtle mb-1">No birthday set</div>
        <div className="text-xs text-theme-text-tertiary italic">Tap to add a friend&apos;s birthday</div>
      </div>
    );
  }

  // Events widget
  if (w.id === "social_events") {
    if (w.eventData && w.eventData.eventDate) {
      const eventDate = new Date(w.eventData.eventDate);
      const today = new Date();
      const daysUntil = Math.ceil(
        (eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );
      return (
        <div className="mt-2">
          {w.eventData.description && (
            <div className="text-xs text-theme-text-subtle">
              {w.eventData.description}
            </div>
          )}
          <div className="text-xs text-theme-text-tertiary">
            {eventDate.toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </div>
          <div className="text-xs text-theme-text-subtle mt-1">
            {daysUntil === 0
              ? "\uD83C\uDF89 Today!"
              : daysUntil === 1
              ? "\uD83D\uDCC5 Tomorrow"
              : daysUntil < 0
              ? "\u2705 Past event"
              : `\uD83D\uDCC6 ${daysUntil} days`}
          </div>
        </div>
      );
    }
    return (
      <div className="mt-3 text-center">
        <div className="text-2xl mb-2">{"\uD83D\uDCC5"}</div>
        <div className="text-xs text-theme-text-subtle mb-1">No event set</div>
        <div className="text-xs text-theme-text-tertiary italic">Tap to add an upcoming event</div>
      </div>
    );
  }

  // Holidays widget
  if (w.id === "holidays") {
    if (w.holidayData && w.holidayData.holidayDate) {
      const holidayDate = new Date(w.holidayData.holidayDate);
      const today = new Date();
      const currentYear = today.getFullYear();
      const thisYearHoliday = new Date(
        currentYear,
        holidayDate.getMonth(),
        holidayDate.getDate()
      );
      const nextHoliday =
        thisYearHoliday < today
          ? new Date(
              currentYear + 1,
              holidayDate.getMonth(),
              holidayDate.getDate()
            )
          : thisYearHoliday;
      const daysUntil = Math.ceil(
        (nextHoliday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );
      return (
        <div className="mt-2">
          <div className="text-xs text-theme-text-tertiary">
            {holidayDate.toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
            })}
          </div>
          <div className="text-xs text-theme-text-subtle mt-1">
            {daysUntil === 0
              ? "\uD83C\uDF84 Today!"
              : daysUntil === 1
              ? "\uD83C\uDF81 Tomorrow"
              : `\uD83D\uDDD3\uFE0F ${daysUntil} days`}
          </div>
        </div>
      );
    }
    return (
      <div className="mt-3 text-center">
        <div className="text-2xl mb-2">{"\uD83C\uDF84"}</div>
        <div className="text-xs text-theme-text-subtle mb-1">No holiday set</div>
        <div className="text-xs text-theme-text-tertiary italic">Tap to add a holiday countdown</div>
      </div>
    );
  }

  // Mood tracker
  if (w.id === "mood") {
    const moodEmojis = ["\uD83D\uDE22", "\uD83D\uDE15", "\uD83D\uDE10", "\uD83D\uDE0A", "\uD83D\uDE01"];
    const moodLabels = ["Very Poor", "Poor", "Neutral", "Good", "Excellent"];
    if (w.moodData?.currentMood) {
      const moodIndex = w.moodData.currentMood - 1;
      const emoji = moodEmojis[moodIndex];
      const label = moodLabels[moodIndex];
      return (
        <div className="mt-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{emoji}</span>
            <div>
              <div className="text-sm font-medium text-theme-text-primary">
                {label}
              </div>
              <div className="text-xs text-theme-text-tertiary">
                Today&apos;s mood
              </div>
            </div>
          </div>
          {w.moodData.moodNote && (
            <div className="text-xs text-theme-text-subtle mt-2 italic">
              &quot;{w.moodData.moodNote}&quot;
            </div>
          )}
          <div className="flex gap-1 mt-2">
            {moodEmojis.map((e, i) => (
              <span
                key={i}
                className={`text-xs ${
                  i === moodIndex ? "opacity-100" : "opacity-30"
                }`}
              >
                {e}
              </span>
            ))}
          </div>
        </div>
      );
    }
    return (
      <div className="mt-3">
        <div className="text-center">
          <div className="text-2xl mb-2">{"\uD83D\uDE10"}</div>
          <div className="text-xs text-theme-text-tertiary">
            Tap to log mood
          </div>
        </div>
        <div className="flex gap-1 mt-2 justify-center">
          {moodEmojis.map((e, i) => (
            <span key={i} className="text-xs opacity-50">
              {e}
            </span>
          ))}
        </div>
      </div>
    );
  }

  // Journal
  if (w.id === "journal") {
    const today = new Date().toISOString().split("T")[0];
    const hasEntryToday = w.journalData?.lastEntryDate === today;
    const entryPreview = w.journalData?.todaysEntry
      ? w.journalData.todaysEntry.substring(0, 100) +
        (w.journalData.todaysEntry.length > 100 ? "..." : "")
      : "";

    if (hasEntryToday && w.journalData?.todaysEntry) {
      const wordCount = w.journalData.todaysEntry
        .split(" ")
        .filter((word) => word.length > 0).length;
      return (
        <div className="mt-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">{"\uD83D\uDCD6"}</span>
            <div>
              <div className="text-sm font-medium text-theme-text-primary">
                Today&apos;s Entry
              </div>
              <div className="text-xs text-theme-text-tertiary">
                {wordCount} words
              </div>
            </div>
          </div>
          <div className="text-xs text-theme-text-body italic bg-theme-surface-alt p-2 rounded">
            &quot;{entryPreview}&quot;
          </div>
          {w.journalData.entryCount && w.journalData.entryCount > 1 && (
            <div className="text-xs text-theme-text-tertiary mt-2">
              {"\uD83D\uDCDA"} {w.journalData.entryCount} total entries
            </div>
          )}
        </div>
      );
    }
    const prompts = [
      "What are you grateful for today?",
      "How are you feeling right now?",
      "What did you learn today?",
      "What's on your mind?",
      "Describe your day in three words.",
    ];
    const randomPrompt = prompts[Math.floor(Math.random() * prompts.length)];
    return (
      <div className="mt-3">
        <div className="text-center">
          <div className="text-2xl mb-2">{"\uD83D\uDCDD"}</div>
          <div className="text-xs text-theme-text-tertiary mb-2">
            No entry today
          </div>
          <div className="text-xs text-theme-text-subtle italic px-2">
            &quot;{randomPrompt}&quot;
          </div>
          {w.journalData?.entryCount && (
            <div className="text-xs text-theme-text-tertiary mt-2">
              {"\uD83D\uDCDA"} {w.journalData.entryCount} total entries
            </div>
          )}
        </div>
      </div>
    );
  }

  // Quit habit
  if (w.id === "quit_habit") {
    if (
      w.quitHabitData &&
      w.quitHabitData.habitName &&
      w.quitHabitData.quitDate
    ) {
      const quitDate = new Date(w.quitHabitData.quitDate);
      const today = new Date();
      const daysSince = Math.floor(
        (today.getTime() - quitDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      const milestones = [
        { days: 1, emoji: "\uD83C\uDF1F", label: "First Day!" },
        { days: 3, emoji: "\uD83D\uDCAA", label: "3 Days!" },
        { days: 7, emoji: "\uD83C\uDF89", label: "One Week!" },
        { days: 14, emoji: "\u2B50", label: "Two Weeks!" },
        { days: 30, emoji: "\uD83C\uDFC6", label: "One Month!" },
        { days: 90, emoji: "\uD83C\uDF8A", label: "3 Months!" },
        { days: 365, emoji: "\uD83D\uDC51", label: "One Year!" },
      ];
      const achieved = milestones.filter((m) => daysSince >= m.days);
      const latestMilestone = achieved.length
        ? achieved[achieved.length - 1]
        : null;
      return (
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-sm">{"\uD83D\uDEAB"}</span>
            <span className="font-medium text-theme-text-body">
              Quitting {w.quitHabitData.habitName}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-theme-text-subtle">
            <span className="text-sm">{"\uD83D\uDCC5"}</span>
            <span>Since {quitDate.toLocaleDateString()}</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span
              className="text-2xl font-bold"
              style={{ color: wStyles.text }}
            >
              {daysSince}
            </span>
            <span
              className="text-sm font-medium"
              style={{ color: wStyles.text }}
            >
              days clean
            </span>
          </div>
          {w.quitHabitData.costPerDay && w.quitHabitData.costPerDay > 0 && (
            <div className="flex items-center gap-2 text-xs text-theme-text-subtle">
              <span className="text-sm">{"\uD83D\uDCB0"}</span>
              <span>
                Daily savings: {w.quitHabitData.currency || "$"}
                {w.quitHabitData.costPerDay.toFixed(2)}
              </span>
            </div>
          )}
          {latestMilestone && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-sm">{latestMilestone.emoji}</span>
              <span
                className="font-medium"
                style={{ color: wStyles.text }}
              >
                {latestMilestone.label}
              </span>
            </div>
          )}
        </div>
      );
    }
    return (
      <div className="mt-3 text-center">
        <div className="text-2xl mb-2">{"\uD83D\uDEE1\uFE0F"}</div>
        <div className="text-xs text-theme-text-subtle mb-1">Ready to quit?</div>
        <div className="text-xs text-theme-text-tertiary italic">Tap to start your journey</div>
      </div>
    );
  }

  // Habit tracker
  if (w.id === "habit_tracker") {
    const habitData = w.habitTrackerData;
    if (habitData && habitData.habitName) {
      const completionSet = new Set(habitData.completionHistory || []);
      const todayKey = new Date().toISOString().split("T")[0];
      const isCompletedToday = completionSet.has(todayKey);

      // Calculate streak
      const sorted = Array.from(
        new Set(habitData.completionHistory || [])
      )
        .sort()
        .reverse();
      const yesterdayKey = new Date(Date.now() - 86400000)
        .toISOString()
        .split("T")[0];
      let streak = 0;
      if (
        sorted.length &&
        (sorted[0] === todayKey || sorted[0] === yesterdayKey)
      ) {
        let expected = sorted[0];
        for (const date of sorted) {
          if (date === expected) {
            streak++;
            const d = new Date(expected + "T12:00:00");
            d.setDate(d.getDate() - 1);
            expected = d.toISOString().split("T")[0];
          } else break;
        }
      }

      // Last 7 day dots
      const last7 = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(Date.now() - (6 - i) * 86400000);
        return completionSet.has(d.toISOString().split("T")[0]);
      });

      // Next milestone
      const milestones = habitData.milestones || [];
      const nextMilestone = milestones.find(
        (m) => !m.achieved && streak < m.days
      );

      return (
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-sm">{"\uD83C\uDFAF"}</span>
            <span className="font-medium text-theme-text-body">
              {habitData.habitName}
            </span>
          </div>
          <div className="flex items-baseline gap-1">
            <span
              className="text-2xl font-bold"
              style={{ color: wStyles.text }}
            >
              {streak}
            </span>
            <span
              className="text-sm font-medium"
              style={{ color: wStyles.text }}
            >
              day streak
            </span>
            {streak > 0 && (
              <span className="text-sm">{"\uD83D\uDD25"}</span>
            )}
          </div>
          <div className="flex gap-1">
            {last7.map((done, i) => (
              <div
                key={i}
                className={`h-2.5 w-2.5 rounded-full ${done ? "" : "bg-theme-progress-track"}`}
                style={done ? { backgroundColor: wStyles.solid } : undefined}
              />
            ))}
          </div>
          <div className="flex items-center justify-between">
            {nextMilestone && (
              <div className="text-[10px] text-theme-text-tertiary">
                {nextMilestone.emoji} {nextMilestone.label} in{" "}
                {nextMilestone.days - streak} days
              </div>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onHabitToggle(w, isCompletedToday);
              }}
              className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full transition-colors ${
                isCompletedToday
                  ? ""
                  : "bg-theme-surface-alt text-theme-text-subtle hover:bg-theme-brand-tint-light"
              }`}
              style={isCompletedToday ? { backgroundColor: wStyles.tint, color: wStyles.text } : undefined}
            >
              {isCompletedToday ? "\u2714" : "\u25CB"}{" "}
              {isCompletedToday ? "Done" : "Log"}
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="mt-3 text-center">
        <div className="text-2xl mb-2">{"\uD83C\uDFAF"}</div>
        <div className="text-xs text-theme-text-subtle mb-1">No habit set</div>
        <div className="text-xs text-theme-text-tertiary italic">Tap to build a new habit</div>
      </div>
    );
  }

  // Gratitude journal
  if (w.id === "gratitude") {
    const today = new Date().toISOString().split("T")[0];
    const hasEntryToday = w.gratitudeData?.lastEntryDate === today;
    if (hasEntryToday && w.gratitudeData?.gratitudeItems?.length) {
      return (
        <div className="mt-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">{"\u2728"}</span>
            <div>
              <div className="text-sm font-medium text-theme-text-primary">
                Today&apos;s Gratitude
              </div>
              <div className="text-xs text-theme-text-tertiary">
                {w.gratitudeData.gratitudeItems.length} items
              </div>
            </div>
          </div>
          <div className="space-y-1">
            {w.gratitudeData.gratitudeItems
              .slice(0, 2)
              .map((item, index) => (
                <div
                  key={index}
                  className="text-xs text-theme-text-body flex items-start gap-1"
                >
                  <span className="text-yellow-500 mt-0.5">{"\u2022"}</span>
                  <span className="italic">&quot;{item}&quot;</span>
                </div>
              ))}
            {w.gratitudeData.gratitudeItems.length > 2 && (
              <div className="text-xs text-theme-text-tertiary">
                +{w.gratitudeData.gratitudeItems.length - 2} more...
              </div>
            )}
          </div>
          {w.gratitudeData.entryCount && w.gratitudeData.entryCount > 1 && (
            <div className="text-xs text-theme-text-tertiary mt-2">
              {"\uD83D\uDE4F"} {w.gratitudeData.entryCount} grateful days
            </div>
          )}
        </div>
      );
    }
    return (
      <div className="mt-3">
        <div className="text-center">
          <div className="text-2xl mb-2">{"\uD83D\uDE4F"}</div>
          <div className="text-xs text-theme-text-tertiary mb-2">
            What are you grateful for?
          </div>
          <div className="text-xs text-theme-text-subtle italic">
            Tap to add today&apos;s gratitude
          </div>
          {w.gratitudeData?.entryCount && (
            <div className="text-xs text-theme-text-tertiary mt-2">
              {"\uD83D\uDE4F"} {w.gratitudeData.entryCount} grateful days
            </div>
          )}
        </div>
      </div>
    );
  }

  // Weight tracking
  if (w.id === "weight") {
    if (w.weightData && w.weightData.currentWeight !== undefined) {
      return (
        <div className="mt-3 space-y-1">
          <div className="flex items-center gap-1">
            <span className="text-xs">{"\u2696\uFE0F"}</span>
            <p className="text-xs font-medium text-theme-text-body">
              Current Weight
            </p>
          </div>
          <p className="text-lg font-bold" style={{ color: wStyles.text }}>
            {w.weightData.currentWeight}{" "}
            {w.weightData.unit || w.unit || "lbs"}
          </p>
          {w.weightData.startingWeight !== undefined && (
            <div className="flex items-center gap-1">
              <span className="text-xs">{"\uD83D\uDCC8"}</span>
              <p className="text-xs" style={{ color: wStyles.text }}>
                {w.weightData.currentWeight < w.weightData.startingWeight
                  ? "Lost"
                  : w.weightData.currentWeight > w.weightData.startingWeight
                  ? "Gained"
                  : "No change"}
                :{" "}
                {Math.abs(
                  w.weightData.currentWeight - w.weightData.startingWeight
                ).toFixed(1)}{" "}
                {w.weightData.unit || w.unit || "lbs"}
              </p>
            </div>
          )}
          {w.weightData.goalWeight !== undefined && (
            <div className="flex items-center gap-1">
              <span className="text-xs">{"\uD83C\uDFAF"}</span>
              <p className="text-xs text-theme-primary">
                Goal: {w.weightData.goalWeight}{" "}
                {w.weightData.unit || w.unit || "lbs"}
              </p>
            </div>
          )}
        </div>
      );
    }
    return (
      <div className="mt-3 text-center">
        <div className="text-2xl mb-2">{"\u2696\uFE0F"}</div>
        <div className="text-xs text-theme-text-subtle mb-1">No weight logged</div>
        <div className="text-xs text-theme-text-tertiary italic">Tap to start tracking</div>
      </div>
    );
  }

  // Nutrition
  if (w.id === "nutrition") {
    return (
      <div className="mt-3">
        <NutritionSummaryWidget
          variant="embedded"
          className="p-0"
          bucketColor={wStyles.solid}
        />
      </div>
    );
  }

  // Exercise
  if (w.id === "exercise") {
    return (
      <div className="mt-3 text-center">
        <div className="text-2xl mb-2">{"\uD83D\uDCAA"}</div>
        <div className="text-xs text-theme-text-subtle mb-1">
          Exercise Tracker
        </div>
        <div className="text-xs text-theme-text-tertiary italic">
          Tap to log a workout
        </div>
      </div>
    );
  }

  // Home projects
  if (w.id === "home_projects") {
    const projects = w.homeProjectsData?.projects || [];
    const activeProjects = projects.filter(
      (p) => p.status === "active" || p.status === "planning"
    );
    const urgentProjects = projects.filter(
      (p) =>
        (p.priority === "critical" || p.priority === "high") &&
        p.status !== "completed"
    );
    const completedProjects = projects.filter(
      (p) => p.status === "completed"
    );
    const completionRate =
      projects.length > 0
        ? Math.round((completedProjects.length / projects.length) * 100)
        : 0;

    if (projects.length === 0) {
      return (
        <div className="mt-3 text-center">
          <div className="text-2xl mb-2">{"\uD83D\uDD28"}</div>
          <div className="text-xs text-theme-text-subtle mb-1">
            Home Projects
          </div>
          <div className="text-xs text-theme-text-tertiary">
            Track household tasks & improvements
          </div>
        </div>
      );
    }

    const sortedActive = activeProjects.sort((a, b) => {
      const priorityOrder: Record<string, number> = {
        critical: 0,
        high: 1,
        medium: 2,
        low: 3,
      };
      return (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3);
    });
    const nextProject = sortedActive[0];

    return (
      <div className="mt-3 space-y-2">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-sm font-semibold text-theme-text-primary">
              {activeProjects.length}
            </div>
            <div className="text-xs text-theme-text-tertiary">Active</div>
          </div>
          <div>
            <div
              className="text-sm font-semibold"
              style={{ color: wStyles.text }}
            >
              {urgentProjects.length}
            </div>
            <div className="text-xs text-theme-text-tertiary">Urgent</div>
          </div>
          <div>
            <div
              className="text-sm font-semibold"
              style={{ color: wStyles.text }}
            >
              {completionRate}%
            </div>
            <div className="text-xs text-theme-text-tertiary">Done</div>
          </div>
        </div>
        {nextProject && (
          <div className="border-t border-theme-neutral-300/60 pt-2">
            <div className="text-xs text-theme-text-subtle mb-1">
              Next Priority:
            </div>
            <div className="flex items-center gap-1">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: wStyles.solid }}
              ></span>
              <span className="text-xs font-medium text-theme-text-primary truncate">
                {nextProject.title}
              </span>
            </div>
            {nextProject.room && (
              <div className="text-xs text-theme-text-tertiary capitalize mt-1">
                {"\uD83D\uDCCD"} {nextProject.room}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Sleep tracker
  if (w.id === "sleep") {
    const entries = w.sleepData?.entries || [];
    const today = new Date().toISOString().split("T")[0];
    const todayEntry = entries.find((e) => e.date === today);
    const lastEntry = entries.length > 0 ? entries[entries.length - 1] : null;
    const displayEntry = todayEntry || lastEntry;

    if (displayEntry) {
      const stars = "\u2605".repeat(displayEntry.quality) + "\u2606".repeat(5 - displayEntry.quality);
      return (
        <div className="mt-3 space-y-1.5">
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold" style={{ color: wStyles.text }}>
              {displayEntry.duration}
            </span>
            <span className="text-sm font-medium" style={{ color: wStyles.text }}>hrs</span>
          </div>
          <div className="text-xs text-amber-500">{stars}</div>
          {w.sleepData?.currentStreak && w.sleepData.currentStreak >= 2 && (
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium"
              style={{ backgroundColor: wStyles.tint, color: wStyles.text }}
            >
              {"\uD83D\uDD25"} {w.sleepData.currentStreak} day streak
            </span>
          )}
        </div>
      );
    }
    return (
      <div className="mt-3 text-center">
        <div className="text-2xl mb-2">{"\uD83C\uDF19"}</div>
        <div className="text-xs text-theme-text-subtle mb-1">No sleep logged</div>
        <div className="text-xs text-theme-text-tertiary italic">Tap to log last night</div>
      </div>
    );
  }

  // Meditation timer
  if (w.id === "meditation") {
    const data = w.meditationData;
    const sessions = data?.completedSessions || 0;

    if (data?.isActive) {
      return (
        <div className="mt-3 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: wStyles.solid }} />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ backgroundColor: wStyles.solid }} />
            </span>
            <span className="text-xs font-medium" style={{ color: wStyles.text }}>In Session</span>
          </div>
          <div className="text-xs text-theme-text-tertiary">
            {Math.round((data.duration || 600) / 60)} min session
          </div>
        </div>
      );
    }

    if (sessions > 0) {
      return (
        <div className="mt-3 space-y-1.5">
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold" style={{ color: wStyles.text }}>
              {data?.totalMinutes || 0}
            </span>
            <span className="text-sm font-medium" style={{ color: wStyles.text }}>min</span>
          </div>
          <div className="text-xs text-theme-text-tertiary">{sessions} sessions total</div>
          {data?.currentStreak && data.currentStreak >= 2 && (
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium"
              style={{ backgroundColor: wStyles.tint, color: wStyles.text }}
            >
              {"\uD83D\uDD25"} {data.currentStreak}
            </span>
          )}
        </div>
      );
    }
    return (
      <div className="mt-3 text-center">
        <div className="text-2xl mb-2">{"\uD83E\uDDD8"}</div>
        <div className="text-xs text-theme-text-subtle mb-1">Ready to meditate</div>
        <div className="text-xs text-theme-text-tertiary italic">Tap to start a session</div>
      </div>
    );
  }

  // Breathwork
  if (w.id === "breathwork") {
    const data = w.breathworkData;
    const patternNames: Record<string, string> = {
      "4-7-8": "Relaxation",
      "4-4-4-4": "Box Breathing",
      "4-2-6": "Energize",
    };
    const patternName = data?.currentPattern ? patternNames[data.currentPattern] || data.currentPattern : null;

    if (data?.isActive) {
      return (
        <div className="mt-3 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: wStyles.solid }} />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ backgroundColor: wStyles.solid }} />
            </span>
            <span className="text-xs font-medium" style={{ color: wStyles.text }}>Breathing</span>
          </div>
          <div className="text-xs text-theme-text-tertiary">{patternName || "Active session"}</div>
        </div>
      );
    }

    if (data?.totalSessions && data.totalSessions > 0) {
      return (
        <div className="mt-3 space-y-1.5">
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold" style={{ color: wStyles.text }}>
              {data.totalSessions}
            </span>
            <span className="text-sm font-medium" style={{ color: wStyles.text }}>sessions</span>
          </div>
          <div className="text-xs text-theme-text-tertiary">
            {data.totalMinutes || 0} min total
          </div>
          {data.currentStreak && data.currentStreak >= 2 && (
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium"
              style={{ backgroundColor: wStyles.tint, color: wStyles.text }}
            >
              {"\uD83D\uDD25"} {data.currentStreak}
            </span>
          )}
        </div>
      );
    }
    return (
      <div className="mt-3 text-center">
        <div className="text-2xl mb-2">{"\uD83C\uDF2C\uFE0F"}</div>
        <div className="text-xs text-theme-text-subtle mb-1">Breathwork</div>
        <div className="text-xs text-theme-text-tertiary italic">Tap to start breathing</div>
      </div>
    );
  }

  // Regular progress bar widget (default)
  const displayPct = pct;
  const prog = progressByWidget[w.instanceId];
  return (
    <div className="mt-2 mb-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-theme-text-primary">
            {todayVal}
          </span>
          <span className="text-sm text-theme-text-tertiary">
            / {w.target}
          </span>
        </div>
        {prog?.streak >= 2 && (
          <span
            className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
            style={{ backgroundColor: wStyles.tint, color: wStyles.text }}
          >
            {"\uD83D\uDD25"} {prog.streak}
          </span>
        )}
      </div>
      <div className={progressStyles.track + " mt-2"}>
        <div
          className={getProgressFillClass(displayPct)}
          style={{ width: `${displayPct}%` }}
        />
      </div>
      {(w.dataSource === "fitbit" || w.dataSource === "googlefit") && (
        <div className="text-right mt-1 mb-1">
          {w.dataSource === "fitbit" && (
            <span className="text-xs" style={{ color: wStyles.text }}>
              Fitbit
            </span>
          )}
          {w.dataSource === "googlefit" && (
            <span className="text-xs" style={{ color: wStyles.text }}>
              Google Fit
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/** Shimmer skeleton placeholder shown while widgets are loading */
export function WidgetCardSkeleton({ index }: { index: number }) {
  return (
    <div
      className="widget-card-size rounded-xl border border-theme-neutral-300 bg-theme-surface-raised p-4 min-w-0"
      style={{ animationDelay: `${index * 100}ms` }}
    >
      {/* Icon + title row */}
      <div className="flex items-center gap-2 mb-3">
        <div className="h-8 w-8 rounded-lg animate-shimmer-loading" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3 w-3/5 rounded animate-shimmer-loading" />
          <div className="h-2 w-2/5 rounded animate-shimmer-loading" />
        </div>
      </div>
      {/* Value area */}
      <div className="space-y-2 mt-4">
        <div className="h-6 w-1/3 rounded animate-shimmer-loading" />
        <div className="h-2 w-full rounded-full animate-shimmer-loading" />
      </div>
    </div>
  );
}
