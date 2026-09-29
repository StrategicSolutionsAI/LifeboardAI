"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { addDays, differenceInCalendarDays, format, nextMonday, nextSaturday } from "date-fns";
import {
  CalendarClock,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Hash,
  Hourglass,
  Moon,
  Plus,
  Repeat,
  Sun,
  Sunrise,
  Sunset,
  X,
} from "lucide-react";
import type { Task } from "@/types/tasks";
import { useTaskData, useTaskActions } from "@/contexts/tasks-context";
import { useToast } from "@/components/ui/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { FamilyMemberOption } from "@/hooks/use-family-members";
import { cn } from "@/lib/utils";
import { card, text } from "@/lib/styles";
import { dateStr } from "@/lib/date-utils";
import { getBucketColorSync } from "@/lib/bucket-colors";
import { dateLabel, parseQuickAdd, type QuickAddMatchKind } from "@/lib/quick-add-parser";
import { buildTodayPlan, completesPerOccurrence, DAY_PARTS, isRecurring, startMinutes, type DayPart } from "@/features/tasks/today-plan";

interface TodayViewProps {
  /** The page's tasks after its search and filters. */
  tasks: Task[];
  buckets: string[];
  bucketColors: Record<string, string>;
  familyMembers: FamilyMemberOption[];
  /** Bucket / assignee new tasks inherit when the page is filtered to exactly one. */
  defaultBucket?: string;
  defaultAssigneeId?: string;
  onToggleTask: (taskId: string) => Promise<void>;
  onEditTask: (taskId: string) => void;
}

const PART_META: Record<DayPart, { label: string; icon: typeof Sun }> = {
  morning: { label: "Morning", icon: Sunrise },
  afternoon: { label: "Afternoon", icon: Sun },
  evening: { label: "Evening", icon: Moon },
};

const REPEAT_LABELS: Record<string, string> = {
  daily: "Daily",
  weekdays: "Weekdays",
  weekly: "Weekly",
  monthly: "Monthly",
};

const CHIP_ICONS: Record<QuickAddMatchKind, typeof Sun> = {
  date: CalendarDays,
  time: Clock,
  duration: Hourglass,
  repeat: Repeat,
  bucket: Hash,
};

// Checked rows stay in place, struck through, for a beat before they move to
// Completed — the moment of satisfaction Things and Todoist are loved for.
const SETTLE_MS = 450;
const EVENING_HOUR = 17;
const SUGGESTION_LIMIT = 4;
// Past this many, carried-over work would push today's plan below the fold.
const CARRIED_LIMIT = 3;

/** Re-renders each minute so "today", the Now badge and evening mode stay current. */
function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = () => setNow(new Date());
    const id = window.setInterval(tick, 60_000);
    window.addEventListener("focus", tick);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", tick);
    };
  }, []);
  return now;
}

function formatMinutes(total: number) {
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h && m) return `${h}h ${m}m`;
  return h ? `${h}h` : `${m}m`;
}

const clockLabel = (minutes: number) => format(new Date(2000, 0, 1, Math.floor(minutes / 60), minutes % 60), "h:mm a");

function ageLabel(due: string, now: Date) {
  const days = differenceInCalendarDays(now, new Date(`${due}T00:00:00`));
  if (days === 1) return "Yesterday";
  if (days < 14) return `${days} days ago`;
  return format(new Date(`${due}T00:00:00`), "MMM d");
}

const initialsOf = (name: string) =>
  name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

/* ─── Pieces ─── */

function CheckButton({ checked, label, onClick, disabled }: { checked: boolean; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-[1.5px] transition-all duration-200 ease-out",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-primary/40 disabled:cursor-progress",
        checked
          ? "scale-110 border-theme-primary bg-theme-primary text-white"
          : "border-theme-neutral-400 text-transparent hover:border-theme-primary hover:text-theme-primary/60",
      )}
    >
      <Check size={11} strokeWidth={3} />
    </button>
  );
}

function ProgressRing({ done, total }: { done: number; total: number }) {
  if (total === 0) {
    return (
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-theme-brand-tint-light text-theme-primary">
        <Sun size={20} />
      </div>
    );
  }
  const r = 18;
  const circumference = 2 * Math.PI * r;
  const pct = total > 0 ? done / total : 0;
  return (
    <div className="relative h-12 w-12 shrink-0" role="img" aria-label={`${done} of ${total} done today`}>
      <svg viewBox="0 0 44 44" className="h-12 w-12 -rotate-90">
        <circle cx="22" cy="22" r={r} fill="none" strokeWidth="3.5" className="stroke-theme-progress-track" />
        <circle
          cx="22" cy="22" r={r} fill="none" strokeWidth="3.5" strokeLinecap="round"
          className="stroke-theme-primary transition-[stroke-dashoffset] duration-700 ease-out"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct)}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold tabular-nums text-theme-text-primary">
        {done}/{total}
      </span>
    </div>
  );
}

function ReschedulePopover({ task, today, onMove, now }: {
  task: Task;
  today: string;
  now: Date;
  onMove: (tasks: Task[], date: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const due = task.due?.date;
  const options = [
    ...(due && due < today ? [{ label: "Today", date: today }] : []),
    { label: "Tomorrow", date: dateStr(addDays(now, 1)) },
    { label: "This weekend", date: dateStr(now.getDay() === 6 ? now : nextSaturday(now)) },
    { label: "Next week", date: dateStr(nextMonday(now)) },
  ];
  const pick = (date: string | null) => {
    setOpen(false);
    onMove([task], date);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Reschedule ${task.content}`}
          title="Reschedule"
          className="rounded-md p-1.5 text-theme-text-tertiary transition-colors hover:bg-theme-brand-tint-subtle hover:text-theme-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-primary/40"
        >
          <CalendarClock size={15} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-48 p-1.5">
        <div className="flex flex-col gap-0.5">
          {options.map((opt) => (
            <button
              key={opt.label}
              type="button"
              onClick={() => pick(opt.date)}
              className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-[12px] text-theme-text-secondary transition-colors hover:bg-theme-brand-tint-subtle"
            >
              <span className="flex items-center gap-2">
                <CalendarDays size={12} className="shrink-0" />
                {opt.label}
              </span>
              <span className="text-[11px] text-theme-text-tertiary">{format(new Date(`${opt.date}T00:00:00`), "EEE")}</span>
            </button>
          ))}
          <div className="my-1 border-t border-theme-neutral-300/50" />
          <div className="px-2.5 py-1.5">
            <input
              type="date"
              aria-label="Pick a date"
              min={today}
              // Typing a year reports partial values ("0002-10-05") — wait for a real date.
              onChange={(e) => e.target.value >= today && pick(e.target.value)}
              className="w-full cursor-pointer rounded-md border border-theme-neutral-300/60 bg-transparent px-2 py-1 text-[12px] text-theme-text-secondary focus:outline-none focus:ring-1 focus:ring-theme-primary/40"
            />
          </div>
          <button
            type="button"
            onClick={() => pick(null)}
            className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[12px] text-theme-text-tertiary transition-colors hover:bg-theme-brand-tint-subtle"
          >
            <X size={12} className="shrink-0" />
            Someday (no date)
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function SectionHeader({ icon: Icon, label, count, tone = "default", children }: {
  icon: typeof Sun;
  label: string;
  count: number;
  tone?: "default" | "warning";
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 px-4 pb-1.5 pt-3">
      <h3 className={cn("flex items-center gap-1.5 whitespace-nowrap", text.label, tone === "warning" && "text-theme-warning-700")}>
        <Icon size={13} className="shrink-0" />
        {label}
        <span className="font-medium normal-case tracking-normal text-theme-text-tertiary">{count}</span>
      </h3>
      {children}
    </div>
  );
}

/* ─── View ─── */

export function TodayView({
  tasks,
  buckets,
  bucketColors,
  familyMembers,
  defaultBucket,
  defaultAssigneeId,
  onToggleTask,
  onEditTask,
}: TodayViewProps) {
  const { occurrenceExceptionIndex } = useTaskData();
  const { createTask, batchUpdateTasks, setOccurrenceDone } = useTaskActions();
  const { toast } = useToast();
  const now = useNow();
  const today = dateStr(now);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const plan = useMemo(
    () => buildTodayPlan(tasks, today, occurrenceExceptionIndex),
    [tasks, today, occurrenceExceptionIndex],
  );

  const [settling, setSettling] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [showDone, setShowDone] = useState(false);
  const [showAllCarried, setShowAllCarried] = useState(false);
  const [expandedSuggestions, setExpandedSuggestions] = useState<Record<string, boolean>>({});
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const memberMap = useMemo(() => new Map(familyMembers.map((m) => [m.id, m])), [familyMembers]);
  const parsed = useMemo(() => (draft.trim() ? parseQuickAdd(draft, now, buckets) : null), [draft, now, buckets]);

  // "q" jumps to quick add from anywhere on the page, as in Todoist.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (e.target as HTMLElement)?.isContentEditable) return;
      if (e.key === "q" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const markBusy = (id: string, on: boolean) =>
    setBusy((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  // A repeating task is finished one day at a time; its series stays open.
  const setDone = useCallback(async (task: Task, done: boolean) => {
    if (completesPerOccurrence(task) && !task.completed) {
      markBusy(task.id, true);
      try {
        await setOccurrenceDone(task, today, done);
      } catch {
        toast({ title: "Couldn't update that task", description: "Please try again.", type: "error" });
      } finally {
        markBusy(task.id, false);
      }
      return;
    }
    await onToggleTask(task.id);
  }, [onToggleTask, setOccurrenceDone, toast, today]);

  const complete = (task: Task) => {
    if (settling.has(task.id)) return;
    setSettling((prev) => new Set(prev).add(task.id));
    window.setTimeout(async () => {
      await setDone(task, true);
      setSettling((prev) => {
        const next = new Set(prev);
        next.delete(task.id);
        return next;
      });
    }, SETTLE_MS);
  };

  const moveTasks = useCallback(async (list: Task[], date: string | null) => {
    if (list.length === 0) return;
    const previous = list.map((t) => ({ id: t.id, date: t.due?.date ?? null }));
    const apply = (entries: Array<{ id: string; date: string | null }>) =>
      batchUpdateTasks(entries.map((e) => ({
        taskId: e.id,
        // null, not { date: undefined }: the Todoist route only clears on null.
        updates: { due: e.date ? { date: e.date } : null, startDate: e.date },
      })));
    try {
      await apply(list.map((t) => ({ id: t.id, date })));
      const where = date ? dateLabel(date, now) : "Someday";
      toast({
        title: list.length === 1 ? `Moved to ${where}` : `${list.length} tasks moved to ${where}`,
        description: list.length === 1 ? list[0].content : undefined,
        type: "success",
        undoAction: () => void apply(previous),
      });
    } catch {
      toast({ title: "Couldn't move tasks", description: "Please try again.", type: "error" });
    }
  }, [batchUpdateTasks, now, toast]);

  const addFromDraft = async () => {
    if (!parsed?.title) return;
    const due = parsed.dueDate ?? today;
    setDraft("");
    try {
      await createTask(parsed.title, due, parsed.hourSlot, parsed.bucket ?? defaultBucket, parsed.repeat ?? "none", {
        duration: parsed.duration,
        assigneeId: defaultAssigneeId ?? null,
      });
      // It won't appear here, so say where it went.
      if (due !== today) toast({ title: `Added to ${dateLabel(due, now)}`, description: parsed.title, type: "success" });
    } catch {
      setDraft(draft);
      toast({ title: "Couldn't add task", description: "Please try again.", type: "error" });
    }
  };

  const doneCount = plan.done.length;
  const total = plan.openCount + doneCount;
  const isEvening = now.getHours() >= EVENING_HOUR;
  // Only one-off tasks roll over; a repeating task simply comes back tomorrow.
  const unfinishedToday = [...DAY_PARTS.flatMap((p) => plan.timed[p]), ...plan.anytime].filter(
    (t) => !isRecurring(t) && t.due?.date === today,
  );
  const suggestionGroups = [
    { key: "tomorrow", label: "Tomorrow", tasks: plan.suggestions.tomorrow },
    { key: "thisWeek", label: "Later this week", tasks: plan.suggestions.thisWeek },
    { key: "someday", label: "No date", tasks: plan.suggestions.someday },
  ].filter((g) => g.tasks.length > 0);

  const renderRow = (task: Task, opts: { done?: boolean; carried?: boolean } = {}) => {
    const checked = opts.done || settling.has(task.id);
    const repeating = isRecurring(task);
    const minutes = startMinutes(task);
    const isNow = !checked && minutes !== null && nowMinutes >= minutes && nowMinutes < minutes + (task.duration || 60);
    const member = task.assigneeId ? memberMap.get(task.assigneeId) : undefined;
    const bucketColor = task.bucket ? getBucketColorSync(task.bucket, bucketColors) : null;
    const meta: React.ReactNode[] = [];
    if (opts.carried && task.due?.date) meta.push(<span key="age" className="text-theme-warning-700">{ageLabel(task.due.date, now)}</span>);
    if (task.bucket && bucketColor) {
      meta.push(
        <span key="bucket" className="inline-flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: bucketColor }} />
          {task.bucket}
        </span>,
      );
    }
    if (repeating) meta.push(<span key="repeat" className="inline-flex items-center gap-1"><Repeat size={11} />{REPEAT_LABELS[task.repeatRule ?? ""] ?? "Repeats"}</span>);
    if (task.duration && task.duration > 0) meta.push(<span key="dur" className="inline-flex items-center gap-1"><Hourglass size={11} />{formatMinutes(task.duration)}</span>);

    return (
      <li
        key={task.id}
        className={cn(
          "group flex items-start gap-3 px-4 py-2.5 transition-colors duration-200 hover:bg-theme-surface-alt/60",
          settling.has(task.id) && "bg-theme-brand-tint-subtle",
        )}
      >
        <CheckButton
          checked={checked}
          disabled={busy.has(task.id)}
          label={checked ? `Mark "${task.content}" not done` : `Complete "${task.content}"`}
          onClick={() => (opts.done ? void setDone(task, false) : complete(task))}
        />
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => onEditTask(task.id)}
            className={cn(
              "block w-full rounded-sm text-left text-sm font-medium leading-snug transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-primary/40",
              checked ? "text-theme-text-tertiary line-through" : "text-theme-text-primary hover:text-theme-primary-600",
            )}
          >
            {task.content}
          </button>
          {meta.length > 0 && (
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-theme-text-tertiary">{meta}</div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {isNow && (
            <span className="rounded-full bg-theme-primary px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">Now</span>
          )}
          {minutes !== null && !opts.carried && (
            <span className={cn("text-xs tabular-nums", checked ? "text-theme-text-tertiary" : "text-theme-text-secondary")}>{clockLabel(minutes)}</span>
          )}
          {member && (
            <span
              className="flex h-5 w-5 items-center justify-center rounded-full text-3xs font-semibold text-white"
              style={{ backgroundColor: member.avatarColor }}
              title={member.name}
            >
              {initialsOf(member.name)}
            </span>
          )}
          {!opts.done && !repeating && (
            <div className="sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
              <ReschedulePopover task={task} today={today} now={now} onMove={moveTasks} />
            </div>
          )}
        </div>
      </li>
    );
  };

  const hasOpen = plan.openCount > 0;

  return (
    <div className="grid grid-cols-1 gap-4 pb-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="flex min-w-0 flex-col gap-3">
        {/* Day header + quick add */}
        <section className={cn(card.base, "p-4")}>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <ProgressRing done={doneCount} total={total} />
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold tracking-tight text-theme-text-primary">{format(now, "EEEE, MMMM d")}</h2>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-theme-text-tertiary">
                <span>{plan.openCount} to do · {doneCount} done</span>
                {plan.plannedMinutes > 0 && <span>· ~{formatMinutes(plan.plannedMinutes)} planned</span>}
                {plan.heavy && (
                  <span className="rounded-full bg-theme-warning-50 px-2 py-0.5 text-[11px] font-medium text-theme-warning-700">
                    Full day — consider moving something
                  </span>
                )}
              </p>
            </div>
            {isEvening && unfinishedToday.length > 0 && (
              <button
                type="button"
                onClick={() => void moveTasks(unfinishedToday, dateStr(addDays(now, 1)))}
                className="inline-flex w-full shrink-0 items-center justify-center gap-1.5 rounded-lg border border-theme-neutral-300 px-3 py-1.5 text-xs font-medium text-theme-text-secondary transition-colors hover:bg-theme-surface-alt sm:w-auto"
              >
                <Sunset size={14} />
                Move {unfinishedToday.length} unfinished to tomorrow
              </button>
            )}
          </div>

          <form
            className="mt-4"
            onSubmit={(e) => {
              e.preventDefault();
              void addFromDraft();
            }}
          >
            <div className="flex items-center gap-2 rounded-lg border border-theme-neutral-300 bg-theme-surface-raised px-3 focus-within:border-theme-secondary focus-within:ring-2 focus-within:ring-theme-primary/30">
              <Plus size={16} className="shrink-0 text-theme-text-tertiary" />
              <input
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setDraft("");
                    inputRef.current?.blur();
                  }
                }}
                aria-label="Add a task for today"
                placeholder='Add a task — try "Call mom 3pm for 30m" or "Trash every thursday"'
                className="h-10 min-w-0 flex-1 bg-transparent text-sm text-theme-text-primary placeholder:text-theme-text-tertiary focus:outline-none"
              />
              {draft.trim() ? (
                <button type="submit" className="h-7 shrink-0 rounded-md bg-theme-primary px-2.5 text-xs font-medium text-white transition-colors hover:bg-theme-primary-600">
                  Add
                </button>
              ) : (
                <kbd className="hidden shrink-0 rounded border border-theme-neutral-300 px-1.5 py-0.5 font-mono text-[11px] text-theme-text-tertiary sm:inline">q</kbd>
              )}
            </div>
            {parsed && parsed.matches.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5" aria-live="polite">
                {parsed.matches.map((m) => {
                  const Icon = CHIP_ICONS[m.kind];
                  return (
                    <span key={m.kind} className="inline-flex items-center gap-1 rounded-full bg-theme-brand-tint-light px-2 py-0.5 text-[11px] font-medium text-theme-primary-600">
                      <Icon size={11} />
                      {m.label}
                    </span>
                  );
                })}
              </div>
            )}
          </form>
        </section>

        {/* Carried over — neutral, not a red wall, with one move to clear it. */}
        {plan.overdue.length > 0 && (
          <section className={cn(card.base, "overflow-hidden")} aria-label="Carried over">
            <SectionHeader icon={CalendarClock} label="Carried over" count={plan.overdue.length} tone="warning">
              <div className="flex items-center gap-1 whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => void moveTasks(plan.overdue, today)}
                  className="rounded-md px-2 py-1 text-xs font-medium text-theme-primary-600 transition-colors hover:bg-theme-brand-tint-subtle"
                >
                  Move all to today
                </button>
                <button
                  type="button"
                  onClick={() => void moveTasks(plan.overdue, null)}
                  className="rounded-md px-2 py-1 text-xs font-medium text-theme-text-tertiary transition-colors hover:bg-theme-brand-tint-subtle"
                >
                  Someday
                </button>
              </div>
            </SectionHeader>
            <ul className="divide-y divide-theme-neutral-300/50 pb-1">
              {(showAllCarried ? plan.overdue : plan.overdue.slice(0, CARRIED_LIMIT)).map((t) => renderRow(t, { carried: true }))}
            </ul>
            {plan.overdue.length > CARRIED_LIMIT && (
              <button
                type="button"
                onClick={() => setShowAllCarried((v) => !v)}
                aria-expanded={showAllCarried}
                className="w-full border-t border-theme-neutral-300/50 px-4 py-2 text-left text-xs font-medium text-theme-text-tertiary transition-colors hover:text-theme-text-secondary"
              >
                {showAllCarried ? "Show fewer" : `Show all ${plan.overdue.length}`}
              </button>
            )}
          </section>
        )}

        {/* Today */}
        <section className={cn(card.base, "overflow-hidden")} aria-label="Today">
          {hasOpen ? (
            <>
              {plan.anytime.length > 0 && (
                <>
                  <SectionHeader icon={CalendarDays} label="Anytime" count={plan.anytime.length} />
                  <ul className="divide-y divide-theme-neutral-300/50">{plan.anytime.map((t) => renderRow(t))}</ul>
                </>
              )}
              {DAY_PARTS.filter((p) => plan.timed[p].length > 0).map((part) => (
                <React.Fragment key={part}>
                  <SectionHeader icon={PART_META[part].icon} label={PART_META[part].label} count={plan.timed[part].length} />
                  <ul className="divide-y divide-theme-neutral-300/50">{plan.timed[part].map((t) => renderRow(t))}</ul>
                </React.Fragment>
              ))}
              <div className="h-1.5" />
            </>
          ) : (
            <div className="flex flex-col items-center px-6 py-10 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-theme-brand-tint-light text-theme-primary">
                {doneCount > 0 ? <Check size={22} strokeWidth={2.5} /> : <Sun size={22} />}
              </div>
              <h3 className="text-base font-semibold text-theme-text-primary">
                {doneCount > 0 ? "All done for today" : "Nothing planned for today"}
              </h3>
              <p className="mt-1 max-w-sm text-sm text-theme-text-tertiary">
                {doneCount > 0
                  ? `You finished ${doneCount} ${doneCount === 1 ? "task" : "tasks"}. Enjoy the rest of your day.`
                  : suggestionGroups.length > 0
                    ? "Add a task above, or pull one in from Plan your day."
                    : "Add a task above to get started."}
              </p>
            </div>
          )}

          {doneCount > 0 && (
            <div className="border-t border-theme-neutral-300/60">
              <button
                type="button"
                onClick={() => setShowDone((v) => !v)}
                aria-expanded={showDone}
                className="flex w-full items-center gap-1.5 px-4 py-2.5 text-left text-xs font-medium text-theme-text-tertiary transition-colors hover:text-theme-text-secondary"
              >
                {showDone ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                Completed today · {doneCount}
              </button>
              {showDone && <ul className="divide-y divide-theme-neutral-300/50 pb-1">{plan.done.map((t) => renderRow(t, { done: true }))}</ul>}
            </div>
          )}
        </section>
      </div>

      {/* Plan your day — what's next, one click to pull into today (My Day suggestions). */}
      <aside className={cn(card.base, "h-fit p-4 lg:sticky lg:top-0")} aria-label="Plan your day">
        <h3 className="text-sm font-semibold text-theme-text-primary">Plan your day</h3>
        <p className="mt-0.5 text-xs text-theme-text-tertiary">Pull in what matters today.</p>
        {suggestionGroups.length === 0 ? (
          <p className="mt-4 text-sm text-theme-text-tertiary">Nothing waiting — you&apos;re ahead.</p>
        ) : (
          <div className="mt-3 flex flex-col gap-4">
            {suggestionGroups.map((group) => {
              const expanded = expandedSuggestions[group.key];
              const shown = expanded ? group.tasks : group.tasks.slice(0, SUGGESTION_LIMIT);
              return (
                <div key={group.key}>
                  <h4 className={cn(text.label, "mb-1")}>{group.label}</h4>
                  <ul className="flex flex-col">
                    {shown.map((task) => (
                      <li key={task.id} className="group flex items-center gap-2 rounded-lg py-1.5 pl-1 pr-0.5 hover:bg-theme-surface-alt/60">
                        <button
                          type="button"
                          onClick={() => onEditTask(task.id)}
                          className="min-w-0 flex-1 truncate text-left text-[13px] text-theme-text-secondary hover:text-theme-text-primary"
                        >
                          {task.content}
                        </button>
                        {group.key === "thisWeek" && task.due?.date && (
                          <span className="shrink-0 text-[11px] text-theme-text-tertiary">{format(new Date(`${task.due.date}T00:00:00`), "EEE")}</span>
                        )}
                        <button
                          type="button"
                          onClick={() => void moveTasks([task], today)}
                          aria-label={`Add "${task.content}" to today`}
                          className="inline-flex shrink-0 items-center gap-0.5 rounded-md px-1.5 py-1 text-[11px] font-medium text-theme-primary-600 transition-colors hover:bg-theme-brand-tint-light"
                        >
                          <Plus size={12} />
                          Today
                        </button>
                      </li>
                    ))}
                  </ul>
                  {group.tasks.length > SUGGESTION_LIMIT && (
                    <button
                      type="button"
                      onClick={() => setExpandedSuggestions((prev) => ({ ...prev, [group.key]: !expanded }))}
                      className="mt-1 pl-1 text-[11px] font-medium text-theme-text-tertiary hover:text-theme-text-secondary"
                    >
                      {expanded ? "Show less" : `Show ${group.tasks.length - SUGGESTION_LIMIT} more`}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </aside>
    </div>
  );
}
