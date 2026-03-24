import React from "react";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import type { WidgetInstance } from "@/types/widgets";
import type { ProgressEntry } from "@/features/dashboard/types";
import { getWidgetColorStyles, todayStrGlobal } from "@/lib/dashboard-utils";
import { getDateKey, calculateStreak, getLast7Days } from "@/lib/habit-utils";
import { progress as progressStyles } from "@/lib/styles";
import { Flame, Check, Circle } from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────

export type WidgetColorStyles = ReturnType<typeof getWidgetColorStyles>;

export interface CardBodyRenderProps {
  widget: WidgetInstance;
  styles: WidgetColorStyles;
  todayVal: number;
  pct: number;
  progressEntry: ProgressEntry | undefined;
  onIncrementProgress: (w: WidgetInstance) => void;
  onHabitToggle: (w: WidgetInstance, completed: boolean) => void;
}

export interface WidgetCardEntry {
  /** Card body render function. If absent, falls back to default progress bar. */
  renderBody?: (props: CardBodyRenderProps) => React.ReactNode;
  /** Custom title resolver. If absent or returns null, falls back to widget.name. */
  getTitle?: (widget: WidgetInstance) => string | null;
  /** Whether to show the "+" increment button. Default: true. */
  showIncrement?: boolean;
  /** Hide the convert-to-task button and goal-met badge. For informational widgets like family_members. */
  hideTaskConvert?: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────

/** Returns the semantic progress fill class based on completion percentage */
export function getProgressFillClass(pct: number): string {
  if (pct >= 100) return progressStyles.fill.complete;
  if (pct >= 75) return progressStyles.fill.brand;
  if (pct >= 50) return progressStyles.fill.high;
  if (pct >= 25) return progressStyles.fill.medium;
  return progressStyles.fill.low;
}

// ── Dynamic imports ─────────────────────────────────────────────────────

const NutritionSummaryWidget = dynamic(
  () =>
    import("./components/nutrition-summary-widget").then(
      (m) => m.NutritionSummaryWidget
    ),
  { loading: () => <Skeleton className="h-24 w-full" /> }
);

const BudgetWidgetCard = dynamic(
  () =>
    import("./components/budget-widget-card").then(
      (m) => m.BudgetWidgetCard
    ),
  { loading: () => <Skeleton className="h-24 w-full" /> }
);

// ── Countdown widgets ───────────────────────────────────────────────────

function renderBirthdayBody({ widget: w }: CardBodyRenderProps) {
  if (w.birthdayData && w.birthdayData.birthDate) {
    // Parse manually to avoid UTC interpretation of date-only strings
    const [, bdMonth, bdDay] = w.birthdayData.birthDate.split('-').map(Number);
    const today = new Date();
    const currentYear = today.getFullYear();
    const todayDate = new Date(currentYear, today.getMonth(), today.getDate());
    const thisYearBirthday = new Date(currentYear, bdMonth - 1, bdDay);
    const nextBirthday =
      thisYearBirthday < todayDate
        ? new Date(currentYear + 1, bdMonth - 1, bdDay)
        : thisYearBirthday;
    const daysUntil = Math.round(
      (nextBirthday.getTime() - todayDate.getTime()) / 86400000
    );
    return (
      <div className="mt-2">
        <div className="text-xs text-theme-text-tertiary">
          {new Date(currentYear, bdMonth - 1, bdDay).toLocaleDateString("en-US", {
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
      <div className="text-xs text-theme-text-tertiary italic">
        Tap to add a friend&apos;s birthday
      </div>
    </div>
  );
}

function renderSocialEventsBody({ widget: w }: CardBodyRenderProps) {
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
      <div className="text-xs text-theme-text-tertiary italic">
        Tap to add an upcoming event
      </div>
    </div>
  );
}

function renderHolidaysBody({ widget: w }: CardBodyRenderProps) {
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
      <div className="text-xs text-theme-text-tertiary italic">
        Tap to add a holiday countdown
      </div>
    </div>
  );
}

// ── Tracker widgets ─────────────────────────────────────────────────────

function renderMoodBody({ widget: w }: CardBodyRenderProps) {
  const moodEmojis = [
    "\uD83D\uDE22",
    "\uD83D\uDE15",
    "\uD83D\uDE10",
    "\uD83D\uDE0A",
    "\uD83D\uDE01",
  ];
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
        <div className="text-xs text-theme-text-tertiary">Tap to log mood</div>
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

function renderJournalBody({ widget: w }: CardBodyRenderProps) {
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

function renderGratitudeBody({ widget: w }: CardBodyRenderProps) {
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
                <span className="text-theme-text-primary mt-0.5">
                  {"\u2022"}
                </span>
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

function renderWeightBody({ widget: w }: CardBodyRenderProps) {
  if (w.weightData && w.weightData.currentWeight !== undefined) {
    return (
      <div className="mt-3 space-y-1">
        <div className="flex items-center gap-1">
          <span className="text-xs">{"\u2696\uFE0F"}</span>
          <p className="text-xs font-medium text-theme-text-body">
            Current Weight
          </p>
        </div>
        <p className="text-lg font-bold text-theme-text-primary">
          {w.weightData.currentWeight}{" "}
          {w.weightData.unit || w.unit || "lbs"}
        </p>
        {w.weightData.startingWeight !== undefined && (
          <div className="flex items-center gap-1">
            <span className="text-xs">{"\uD83D\uDCC8"}</span>
            <p className="text-xs text-theme-text-secondary">
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
      <div className="text-xs text-theme-text-tertiary italic">
        Tap to start tracking
      </div>
    </div>
  );
}

// ── Habit / Streak widgets ──────────────────────────────────────────────

function renderQuitHabitBody({ widget: w }: CardBodyRenderProps) {
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
          <span className="text-2xl font-bold text-theme-text-primary">
            {daysSince}
          </span>
          <span className="text-sm font-medium text-theme-text-primary">
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
            <span className="font-medium text-theme-text-primary">
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
      <div className="text-xs text-theme-text-tertiary italic">
        Tap to start your journey
      </div>
    </div>
  );
}

function renderHabitTrackerBody({
  widget: w,
  onHabitToggle,
}: CardBodyRenderProps) {
  const habitData = w.habitTrackerData;
  if (habitData && habitData.habitName) {
    const completionSet = new Set(habitData.completionHistory || []);
    const todayKey = getDateKey(new Date());
    const isCompletedToday = completionSet.has(todayKey);

    // Determine which days of the week are scheduled
    const schedule = w.schedule as boolean[] | undefined;

    const streak = calculateStreak(habitData.completionHistory || [], schedule);

    // Last 7 day dots
    const last7Days = getLast7Days();
    const last7 = last7Days.map((key) => completionSet.has(key));

    const dayLabels = ["S", "M", "T", "W", "T", "F", "S"];

    return (
      <div className="mt-2 space-y-2">
        {/* Streak / zero-state */}
        {streak === 0 ? (
          <div className="flex items-baseline gap-1">
            <span className="text-sm font-medium text-theme-text-secondary">
              {(habitData.totalCompletions || 0) > 0
                ? "Ready to restart"
                : "Start your streak"}
            </span>
          </div>
        ) : (
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-theme-text-primary">
              {streak}
            </span>
            <span className="text-sm font-medium text-theme-text-primary">
              day streak
            </span>
            <Flame className="h-3.5 w-3.5 text-orange-500" />
          </div>
        )}

        {/* 7-day dots with day labels */}
        <div className="flex gap-1.5">
          {last7Days.map((key, i) => {
            const done = last7[i];
            const dayOfWeek = new Date(key + "T12:00:00").getDay();
            const isScheduled = !schedule || schedule[dayOfWeek];
            return (
              <div key={i} className="flex flex-col items-center gap-0.5">
                <div
                  className={`h-3.5 w-3.5 rounded-full ${
                    done
                      ? "bg-theme-secondary"
                      : isScheduled
                        ? "bg-theme-progress-track"
                        : "bg-theme-neutral-200 opacity-40"
                  }`}
                />
                <span className="text-3xs text-theme-text-tertiary leading-none">
                  {dayLabels[dayOfWeek]}
                </span>
              </div>
            );
          })}
        </div>

        {/* Full-width Log/Done button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onHabitToggle(w, isCompletedToday);
          }}
          className={`w-full flex items-center justify-center gap-1 text-xs font-medium px-2 py-1.5 rounded-full transition-colors ${
            isCompletedToday
              ? "bg-theme-secondary/15 text-theme-secondary"
              : "bg-theme-surface-alt text-theme-text-subtle hover:bg-theme-brand-tint-light"
          }`}
        >
          {isCompletedToday ? <Check className="h-3 w-3" /> : <Circle className="h-3 w-3" />}{" "}
          {isCompletedToday ? "Done" : "Log"}
        </button>
      </div>
    );
  }
  return (
    <div className="mt-2 text-center">
      <div className="text-2xl mb-2">{"\uD83C\uDFAF"}</div>
      <div className="text-xs text-theme-text-subtle mb-1">No habit set</div>
      <div className="text-xs text-theme-text-tertiary italic">
        Tap to set up a habit
      </div>
    </div>
  );
}

// ── Health widgets ──────────────────────────────────────────────────────

function renderSleepBody({ widget: w, styles: wStyles }: CardBodyRenderProps) {
  const entries = w.sleepData?.entries || [];
  const today = new Date().toISOString().split("T")[0];
  const todayEntry = entries.find((e) => e.date === today);
  const lastEntry = entries.length > 0 ? entries[entries.length - 1] : null;
  const displayEntry = todayEntry || lastEntry;

  if (displayEntry) {
    const stars =
      "\u2605".repeat(displayEntry.quality) +
      "\u2606".repeat(5 - displayEntry.quality);
    return (
      <div className="mt-3 space-y-1.5">
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold text-theme-text-primary">
            {displayEntry.duration}
          </span>
          <span className="text-sm font-medium text-theme-text-primary">
            hrs
          </span>
        </div>
        <div className="text-xs text-theme-text-primary">{stars}</div>
        {w.sleepData?.currentStreak && w.sleepData.currentStreak >= 2 && (
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-medium text-theme-text-primary"
            style={{ backgroundColor: wStyles.tint }}
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
      <div className="text-xs text-theme-text-tertiary italic">
        Tap to log last night
      </div>
    </div>
  );
}

function renderMeditationBody({
  widget: w,
  styles: wStyles,
}: CardBodyRenderProps) {
  const data = w.meditationData;
  const sessions = data?.completedSessions || 0;

  if (data?.isActive) {
    return (
      <div className="mt-3 space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span
              className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
              style={{ backgroundColor: wStyles.solid }}
            />
            <span
              className="relative inline-flex rounded-full h-2.5 w-2.5"
              style={{ backgroundColor: wStyles.solid }}
            />
          </span>
          <span className="text-xs font-medium text-theme-text-primary">
            In Session
          </span>
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
          <span className="text-2xl font-bold text-theme-text-primary">
            {data?.totalMinutes || 0}
          </span>
          <span className="text-sm font-medium text-theme-text-primary">
            min
          </span>
        </div>
        <div className="text-xs text-theme-text-tertiary">
          {sessions} sessions total
        </div>
        {data?.currentStreak && data.currentStreak >= 2 && (
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-medium text-theme-text-primary"
            style={{ backgroundColor: wStyles.tint }}
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
      <div className="text-xs text-theme-text-subtle mb-1">
        Ready to meditate
      </div>
      <div className="text-xs text-theme-text-tertiary italic">
        Tap to start a session
      </div>
    </div>
  );
}

function renderBreathworkBody({
  widget: w,
  styles: wStyles,
}: CardBodyRenderProps) {
  const data = w.breathworkData;
  const patternNames: Record<string, string> = {
    "4-7-8": "Relaxation",
    "4-4-4-4": "Box Breathing",
    "4-2-6": "Energize",
  };
  const patternName = data?.currentPattern
    ? patternNames[data.currentPattern] || data.currentPattern
    : null;

  if (data?.isActive) {
    return (
      <div className="mt-3 space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span
              className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
              style={{ backgroundColor: wStyles.solid }}
            />
            <span
              className="relative inline-flex rounded-full h-2.5 w-2.5"
              style={{ backgroundColor: wStyles.solid }}
            />
          </span>
          <span className="text-xs font-medium text-theme-text-primary">
            Breathing
          </span>
        </div>
        <div className="text-xs text-theme-text-tertiary">
          {patternName || "Active session"}
        </div>
      </div>
    );
  }

  if (data?.totalSessions && data.totalSessions > 0) {
    return (
      <div className="mt-3 space-y-1.5">
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold text-theme-text-primary">
            {data.totalSessions}
          </span>
          <span className="text-sm font-medium text-theme-text-primary">
            sessions
          </span>
        </div>
        <div className="text-xs text-theme-text-tertiary">
          {data.totalMinutes || 0} min total
        </div>
        {data.currentStreak && data.currentStreak >= 2 && (
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-medium text-theme-text-primary"
            style={{ backgroundColor: wStyles.tint }}
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
      <div className="text-xs text-theme-text-tertiary italic">
        Tap to start breathing
      </div>
    </div>
  );
}

function renderCycleTrackingBody({
  widget: w,
  styles: wStyles,
}: CardBodyRenderProps) {
  const cycleEntries = w.cycleData?.entries || [];
  const todayEntry = cycleEntries.find((e) => e.date === todayStrGlobal);
  const periodStarts = cycleEntries
    .filter((e) => e.periodStart)
    .map((e) => e.date)
    .sort();
  const lastStart = periodStarts.length
    ? periodStarts[periodStarts.length - 1]
    : null;
  const cycleDay = lastStart
    ? Math.round(
        (Date.now() - new Date(lastStart + "T12:00:00").getTime()) / 86400000
      ) + 1
    : null;

  // Compute average cycle length for prediction
  let nextPeriodLabel: string | null = null;
  if (periodStarts.length >= 2) {
    const gaps: number[] = [];
    for (let i = 1; i < periodStarts.length; i++) {
      const diff = Math.round(
        (new Date(periodStarts[i] + "T12:00:00").getTime() -
          new Date(periodStarts[i - 1] + "T12:00:00").getTime()) /
          86400000
      );
      if (diff >= 15 && diff <= 60) gaps.push(diff);
    }
    if (gaps.length && lastStart) {
      const avg = Math.round(
        gaps.reduce((a, b) => a + b, 0) / gaps.length
      );
      const nextDate = new Date(lastStart + "T12:00:00");
      nextDate.setDate(nextDate.getDate() + avg);
      nextPeriodLabel = nextDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    }
  }

  const flowColors: Record<string, string> = {
    light: "#f9a8d4",
    medium: "#f472b6",
    heavy: "#ec4899",
  };

  if (todayEntry) {
    const flowColor =
      flowColors[todayEntry.flowIntensity] || wStyles.solid;
    return (
      <div className="mt-3 space-y-2">
        <div className="flex items-center gap-2">
          {todayEntry.flowIntensity !== "none" && (
            <span
              className="inline-block h-2.5 w-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: flowColor }}
            />
          )}
          <span className="text-sm font-medium text-theme-text-primary capitalize">
            {todayEntry.flowIntensity === "none"
              ? "Logged"
              : `${todayEntry.flowIntensity} flow`}
          </span>
          {todayEntry.periodStart && (
            <span className="text-3xs font-medium text-pink-600 bg-pink-100 rounded-full px-1.5 py-0.5">
              Start
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-2xs text-theme-text-tertiary">
          {cycleDay && <span>Day {cycleDay}</span>}
          {nextPeriodLabel && <span>Next: {nextPeriodLabel}</span>}
        </div>
        {todayEntry.symptoms.length > 0 && (
          <div className="text-2xs text-theme-text-tertiary truncate">
            {todayEntry.symptoms.slice(0, 3).join(", ")}
            {todayEntry.symptoms.length > 3 &&
              ` +${todayEntry.symptoms.length - 3}`}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center gap-3 text-xs text-theme-text-secondary">
        {cycleDay && (
          <span className="font-medium">Day {cycleDay}</span>
        )}
        {nextPeriodLabel && <span>Next: {nextPeriodLabel}</span>}
      </div>
      {!cycleDay && !nextPeriodLabel && (
        <div className="text-center">
          <div className="text-xs text-theme-text-tertiary">
            Tap to log today
          </div>
        </div>
      )}
    </div>
  );
}

// ── Dashboard widgets ───────────────────────────────────────────────────

function renderNutritionBody({ styles: wStyles }: CardBodyRenderProps) {
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

function renderExerciseBody(_props: CardBodyRenderProps) {
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

function renderHomeProjectsBody({
  widget: w,
  styles: wStyles,
}: CardBodyRenderProps) {
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
    return (
      (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3)
    );
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
          <div className="text-sm font-semibold text-theme-text-primary">
            {urgentProjects.length}
          </div>
          <div className="text-xs text-theme-text-tertiary">Urgent</div>
        </div>
        <div>
          <div className="text-sm font-semibold text-theme-text-primary">
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

function renderFamilyMembersBody({ widget: w }: CardBodyRenderProps) {
  const members = w.familyMembersData?.members || [];

  if (members.length === 0) {
    return (
      <div className="mt-3 text-center">
        <div className="text-2xl mb-2">
          {"\uD83D\uDC68\u200D\uD83D\uDC69\u200D\uD83D\uDC67\u200D\uD83D\uDC66"}
        </div>
        <div className="text-xs text-theme-text-subtle mb-1">
          Family Members
        </div>
        <div className="text-xs text-theme-text-tertiary">
          Tap to add family members
        </div>
      </div>
    );
  }

  // Find next upcoming birthday
  const now = new Date();
  const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const membersWithBirthday = members
    .filter((m) => m.birthday)
    .map((m) => {
      // Parse manually to avoid UTC interpretation of date-only strings
      const [, bdMonth, bdDay] = m.birthday!.split('-').map(Number);
      const thisYear = new Date(now.getFullYear(), bdMonth - 1, bdDay);
      const next =
        thisYear < todayDate
          ? new Date(now.getFullYear() + 1, bdMonth - 1, bdDay)
          : thisYear;
      return {
        ...m,
        daysUntil: Math.round(
          (next.getTime() - todayDate.getTime()) / 86400000
        ),
      };
    })
    .sort((a, b) => a.daysUntil - b.daysUntil);

  const nextBirthday = membersWithBirthday[0];

  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs text-theme-text-tertiary">
          {members.length} member{members.length !== 1 ? "s" : ""}
        </div>
      </div>
      <div className="flex -space-x-2">
        {members.slice(0, 3).map((m) => {
          const initials = m.name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .slice(0, 2)
            .toUpperCase();
          return (
            <div
              key={m.id}
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold border-2 border-white dark:border-warm-900"
              style={{ backgroundColor: m.avatarColor }}
            >
              {initials}
            </div>
          );
        })}
        {members.length > 3 && (
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold bg-theme-surface-alt text-theme-text-secondary border-2 border-white dark:border-warm-900">
            +{members.length - 3}
          </div>
        )}
      </div>
      {nextBirthday && (
        <div className="border-t border-theme-neutral-300/60 pt-2">
          <div className="text-xs text-theme-text-tertiary">
            {nextBirthday.daysUntil === 0
              ? `\uD83C\uDF82 ${nextBirthday.name}'s birthday today!`
              : `\uD83C\uDF82 ${nextBirthday.name} in ${nextBirthday.daysUntil}d`}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Linked Task Widget ──────────────────────────────────────────────────

function renderLinkedTaskBody({ widget, styles }: CardBodyRenderProps) {
  const config = widget.linkedTaskConfig as
    | { dueDate?: string; title?: string }
    | undefined;
  const dueDate = config?.dueDate;
  const dueParts = dueDate ? dueDate.split("-") : null;
  const dueLabel = dueParts
    ? `${dueParts[1]}/${dueParts[2]}/${dueParts[0]}`
    : null;

  return (
    <div className="flex flex-col gap-1.5 px-1">
      <div className="flex items-center gap-1.5 text-xs text-theme-text-secondary">
        <Check size={12} style={{ color: styles.solid }} />
        <span className="truncate">{widget.linkedTaskTitle || widget.name}</span>
      </div>
      {dueLabel && (
        <div className="text-[11px] text-theme-text-tertiary">
          Due {dueLabel}
        </div>
      )}
    </div>
  );
}

// ── Registry ────────────────────────────────────────────────────────────

export const WIDGET_CARD_REGISTRY: Record<string, WidgetCardEntry> = {
  // Countdown widgets
  birthdays: {
    renderBody: renderBirthdayBody,
    getTitle: (w) => w.birthdayData?.friendName || null,
    showIncrement: false,
  },
  social_events: {
    renderBody: renderSocialEventsBody,
    getTitle: (w) => w.eventData?.eventName || null,
    showIncrement: false,
  },
  holidays: {
    renderBody: renderHolidaysBody,
    getTitle: (w) => w.holidayData?.holidayName || null,
    showIncrement: false,
  },
  // Tracker widgets
  mood: { renderBody: renderMoodBody, showIncrement: false },
  journal: { renderBody: renderJournalBody, showIncrement: false },
  gratitude: { renderBody: renderGratitudeBody, showIncrement: false },
  weight: { renderBody: renderWeightBody, showIncrement: false },
  // Habit / Streak widgets
  quit_habit: {
    renderBody: renderQuitHabitBody,
    getTitle: (w) => w.quitHabitData?.habitName || null,
  },
  habit_tracker: {
    renderBody: renderHabitTrackerBody,
    getTitle: (w) => w.habitTrackerData?.habitName || null,
    showIncrement: false,
    hideTaskConvert: true,
  },
  // Health widgets
  sleep: { renderBody: renderSleepBody, showIncrement: false },
  meditation: { renderBody: renderMeditationBody, showIncrement: false },
  breathwork: { renderBody: renderBreathworkBody, showIncrement: false },
  cycle_tracking: { renderBody: renderCycleTrackingBody, showIncrement: false },
  // Dashboard widgets
  nutrition: { renderBody: renderNutritionBody, showIncrement: false },
  exercise: { renderBody: renderExerciseBody, showIncrement: false },
  home_projects: { renderBody: renderHomeProjectsBody },
  family_members: { renderBody: renderFamilyMembersBody, showIncrement: false, hideTaskConvert: true },
  // Linked task widgets
  linked_task: {
    renderBody: renderLinkedTaskBody,
    getTitle: (w) => w.linkedTaskTitle || null,
    showIncrement: false,
    hideTaskConvert: true,
  },
  // Finance widgets
  finance_budget: {
    renderBody: ({ widget }) =>
      React.createElement(BudgetWidgetCard, { widget }),
    showIncrement: false,
    hideTaskConvert: true,
  },
  // Metadata-only entries (use default progress bar, but hide "+" button)
  medication: { showIncrement: false },
  water: { showIncrement: false },
  steps: { showIncrement: false },
  heartrate: { showIncrement: false },
  caffeine: { showIncrement: false },
};

// ── Default fallback ────────────────────────────────────────────────────

export function renderDefaultProgressBar({
  widget: w,
  styles: wStyles,
  todayVal,
  pct,
  progressEntry,
}: CardBodyRenderProps): React.ReactNode {
  const prog = progressEntry;
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
        {prog && prog.streak >= 2 && (
          <span
            className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium text-theme-text-primary"
            style={{ backgroundColor: wStyles.tint }}
          >
            {"\uD83D\uDD25"} {prog.streak}
          </span>
        )}
      </div>
      <div className={progressStyles.track + " mt-2"}>
        <div
          className={getProgressFillClass(pct)}
          style={{ width: `${pct}%` }}
        />
      </div>
      {(w.dataSource === "fitbit" || w.dataSource === "googlefit") && (
        <div className="text-right mt-1 mb-1">
          {w.dataSource === "fitbit" && (
            <span className="text-xs text-theme-text-tertiary">Fitbit</span>
          )}
          {w.dataSource === "googlefit" && (
            <span className="text-xs text-theme-text-tertiary">
              Google Fit
            </span>
          )}
        </div>
      )}
    </div>
  );
}
