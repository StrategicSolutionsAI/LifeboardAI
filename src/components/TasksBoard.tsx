"use client";

import * as React from "react";
import { useMemo, useRef, useState } from "react";
import { differenceInCalendarDays, format, parseISO, isValid } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Plus, CheckCircle2, CalendarDays, Clock3, MoreHorizontal, GripVertical, ClipboardList, Pencil, Trash2 } from "lucide-react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

export type Bucket = {
  id: string;
  name: string;
  color?: string | null;
};

export type Task = {
  id: string;
  title: string;
  bucketId: string;
  status: "open" | "done";
  tags?: string[];
  position?: number | null;
  dueDate?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  createdAt?: string | null;
  due?: {
    date?: string;
    datetime?: string;
    is_recurring?: boolean;
  } | null;
};

type BucketSummary = {
  tasks: Task[];
  dueSoonCount: number;
};

export type TasksBoardViewMode = "open" | "completed";

type TasksBoardProps = {
  buckets?: Bucket[];
  tasks?: Task[];
  onCompleteTask?: (id: string) => void;
  onUncompleteTask?: (id: string) => void;
  onAddTask?: (bucketId: string, title: string) => void;
  onMoveTask?: (taskId: string, newBucketId: string) => void;
  viewMode?: TasksBoardViewMode;
  loadingTasks?: Set<string>;
  onTaskOpen?: (taskId: string) => void;
};

/* ─── Calidora color helpers ─── */

function hexToRgb(hex: string) {
  const clean = hex.replace("#", "");
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

function getBucketStyles(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  return {
    iconTint: `rgba(${r}, ${g}, ${b}, 0.12)`,
    text: hex,
    ringActive: `rgba(${r}, ${g}, ${b}, 0.35)`,
    dropBg: `rgba(${r}, ${g}, ${b}, 0.06)`,
  };
}

function isDateSoon(dueDate?: string | null) {
  if (!dueDate) return false;
  let parsed: Date;
  try {
    parsed = dueDate.length === 10 ? parseISO(`${dueDate}T00:00:00`) : parseISO(dueDate);
  } catch {
    return false;
  }
  if (!isValid(parsed)) return false;
  const diff = differenceInCalendarDays(parsed, new Date());
  return diff >= 0 && diff <= 3;
}

function groupByBucket(tasks: Task[]) {
  const map: Record<string, BucketSummary> = {};
  for (const task of tasks) {
    if (!map[task.bucketId]) {
      map[task.bucketId] = { tasks: [], dueSoonCount: 0 };
    }
    map[task.bucketId].tasks.push(task);
    if (task.status === "open" && isDateSoon(task.dueDate)) {
      map[task.bucketId].dueSoonCount += 1;
    }
  }
  Object.values(map).forEach((summary) => {
    summary.tasks.sort((a, b) => {
      const posDiff = (a.position ?? Number.MAX_SAFE_INTEGER) - (b.position ?? Number.MAX_SAFE_INTEGER);
      if (posDiff !== 0) return posDiff;
      return a.title.localeCompare(b.title);
    });
  });
  return map;
}

function formatDueDate(due?: string | null, isRecurring?: boolean) {
  if (!due) return null;
  let parsed: Date;
  try {
    parsed = due.length === 10 ? parseISO(`${due}T00:00:00`) : parseISO(due);
  } catch {
    return null;
  }
  if (!isValid(parsed)) return null;
  const diff = differenceInCalendarDays(parsed, new Date());
  if (diff === 0) return { label: "Today", tone: "accent" as const };
  if (diff === 1) return { label: "Tomorrow", tone: "default" as const };
  if (diff < 0 && !isRecurring) return { label: `Overdue`, tone: "destructive" as const };
  return { label: format(parsed, "MMM d"), tone: diff <= 3 ? "accent" as const : "default" as const };
}

function parseTaskDate(value?: string | null) {
  if (!value) return null;
  try {
    const isoValue = value.length === 10 ? `${value}T00:00:00` : value;
    const parsed = parseISO(isoValue);
    return isValid(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function formatDateRangeLabel(start: Date, end: Date) {
  const sameDay = differenceInCalendarDays(end, start) === 0;
  if (sameDay) return format(start, "MMM d");

  const sameYear = start.getFullYear() === end.getFullYear();
  const sameMonth = sameYear && start.getMonth() === end.getMonth();
  const startFormat = sameYear ? "MMM d" : "MMM d, yyyy";
  const endFormat = sameMonth ? "d" : sameYear ? "MMM d" : "MMM d, yyyy";

  return `${format(start, startFormat)} - ${format(end, endFormat)}`;
}

function toneForDateRange(start: Date, end: Date) {
  const today = new Date();
  const startDiff = differenceInCalendarDays(start, today);
  const endDiff = differenceInCalendarDays(end, today);

  if (endDiff < 0) return "destructive" as const;
  if (startDiff <= 0 && endDiff >= 0) return "accent" as const;
  if (startDiff <= 3) return "accent" as const;
  return "default" as const;
}

function formatTaskDateBadge(task: Task) {
  const start = parseTaskDate(task.startDate ?? task.dueDate ?? null);
  const end = parseTaskDate(task.endDate ?? null);

  if (start && end) {
    const span = differenceInCalendarDays(end, start);
    if (span > 0) {
      return {
        label: formatDateRangeLabel(start, end),
        tone: toneForDateRange(start, end),
      };
    }
  }

  const fallbackDate = task.dueDate ?? task.startDate ?? task.endDate ?? null;
  const isRecurring = task.due?.is_recurring ?? false;
  return formatDueDate(fallbackDate, isRecurring);
}

function TaskCard({
  task,
  index,
  onToggle,
  availableBuckets = [],
  onBucketChange,
  isLoading = false,
  onOpen,
}: {
  task: Task;
  index: number;
  onToggle?: (id: string, checked: boolean) => void;
  availableBuckets?: Bucket[];
  onBucketChange?: (taskId: string, newBucketId: string) => void;
  isLoading?: boolean;
  onOpen?: (taskId: string) => void;
}) {
  const dateBadge = useMemo(
    () => formatTaskDateBadge(task),
    [task.dueDate, task.startDate, task.endDate]
  );

  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={cn(
            "group bg-white rounded-xl border border-[#dbd6cf]/80 p-3.5 transition-all cursor-default",
            "hover:border-[rgba(177,145,106,0.35)] hover:shadow-[0px_2px_8px_rgba(163,133,96,0.08)]",
            snapshot.isDragging && "opacity-40 shadow-warm-lg border-[#B1916A]/40"
          )}
        >
          <div className="flex items-start gap-2.5">
            {/* Drag Handle */}
            <div
              {...provided.dragHandleProps}
              className="cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-30 transition-opacity shrink-0 mt-0.5"
            >
              <GripVertical size={14} className="text-[#596881]" />
            </div>

            {/* Checkbox */}
            <button
              type="button"
              onClick={() => onToggle?.(task.id, task.status !== "done")}
              disabled={isLoading}
              aria-label={task.status === "done" ? `Mark "${task.title}" not completed` : `Mark "${task.title}" completed`}
              className={cn(
                "w-[18px] h-[18px] rounded-[5px] shrink-0 mt-0.5 transition-all flex items-center justify-center",
                task.status === "done"
                  ? "bg-[#48B882]"
                  : "bg-white border-[1.5px] border-[rgba(219,214,207,0.8)] hover:border-[#bb9e7b]",
                isLoading && "animate-pulse opacity-50"
              )}
            >
              {task.status === "done" && (
                <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                  <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <button
                onClick={() => onOpen?.(task.id)}
                className={cn(
                  "text-[13px] text-[#314158] text-left hover:text-[#B1916A] transition-colors cursor-pointer leading-snug w-full",
                  task.status === "done" && "line-through text-[#8e99a8]"
                )}
              >
                {task.title}
              </button>

              {/* Date Badge + Tags */}
              {(dateBadge || !!task.tags?.length) && (
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  {dateBadge && (
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium",
                        dateBadge.tone === "destructive" && "bg-red-50 text-red-600",
                        dateBadge.tone === "accent" && "bg-[rgba(177,145,106,0.08)] text-[#96784f]",
                        dateBadge.tone === "default" && "bg-[#f4f6f8] text-[#596881]"
                      )}
                    >
                      <CalendarDays size={9} />
                      {dateBadge.label}
                    </span>
                  )}
                  {task.tags?.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-md bg-[#f4f6f8] px-1.5 py-0.5 text-[10px] text-[#8e99a8]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Actions Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Task actions"
                  className="p-0.5 rounded hover:bg-[rgba(177,145,106,0.06)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                >
                  <MoreHorizontal size={15} className="text-[#8e99a8]" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={() => onOpen?.(task.id)}>
                  <Pencil size={14} />
                  Edit
                </DropdownMenuItem>
                {availableBuckets.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <div className="px-2 py-1.5 text-[11px] font-medium text-[#8e99a8] uppercase tracking-wide">
                      Move to
                    </div>
                    <DropdownMenuItem
                      onClick={() => onBucketChange?.(task.id, "__unassigned")}
                    >
                      <span className="w-2.5 h-2.5 rounded-full bg-[#b5b0a8]" />
                      No bucket
                    </DropdownMenuItem>
                    {availableBuckets.map((bucket) => (
                      <DropdownMenuItem
                        key={bucket.id}
                        onClick={() => onBucketChange?.(task.id, bucket.id)}
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: bucket.color ?? "#bb9e7b" }}
                        />
                        {bucket.name}
                        {task.bucketId === bucket.id && (
                          <span className="ml-auto text-[#B1916A] font-semibold text-xs">
                            current
                          </span>
                        )}
                      </DropdownMenuItem>
                    ))}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      )}
    </Draggable>
  );
}

function BucketColumn({
  bucket,
  summary,
  onAddTask,
  onToggleTask,
  availableBuckets = [],
  onBucketChange,
  viewMode,
  loadingTasks = new Set(),
  onTaskOpen,
}: {
  bucket: Bucket;
  summary: BucketSummary;
  onAddTask?: (bucketId: string, title: string) => void;
  onToggleTask?: (id: string, checked: boolean) => void;
  availableBuckets?: Bucket[];
  onBucketChange?: (taskId: string, newBucketId: string) => void;
  viewMode: TasksBoardViewMode;
  loadingTasks?: Set<string>;
  onTaskOpen?: (taskId: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const { tasks, dueSoonCount } = summary;
  const isCompletedView = viewMode === "completed";
  const color = bucket.color ?? "#bb9e7b";
  const styles = getBucketStyles(color);

  const handleSubmit = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    onAddTask?.(bucket.id, trimmed);
    setDraft("");
    setIsAdding(false);
  };

  return (
    <div className="flex flex-col h-full rounded-xl border border-[#dbd6cf]/80 bg-[rgba(252,250,248,0.5)] overflow-hidden">
      {/* Color accent bar */}
      <div className="h-[3px] shrink-0" style={{ backgroundColor: color }} />

      {/* Column Header — Calidora icon tint style */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-[rgba(219,214,207,0.4)] bg-white">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-lg shrink-0"
            style={{ backgroundColor: styles.iconTint }}
          >
            <ClipboardList size={18} style={{ color: styles.text }} />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[13px] text-[#314158] font-semibold truncate">
              {bucket.name}
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-[#8e99a8]">
                {tasks.length} {tasks.length === 1 ? "task" : "tasks"}
              </span>
              {!isCompletedView && dueSoonCount > 0 && (
                <span className="inline-flex items-center gap-0.5 rounded-md bg-[rgba(177,145,106,0.1)] px-1.5 py-0.5 text-[10px] font-medium text-[#96784f]">
                  <Clock3 className="h-2.5 w-2.5" />
                  {dueSoonCount} due soon
                </span>
              )}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsAdding(true)}
          aria-label={`Add task in ${bucket.name}`}
          className="p-1.5 hover:bg-[rgba(177,145,106,0.06)] rounded-lg transition-colors"
        >
          <Plus size={16} className="text-[#bb9e7b]" />
        </button>
      </div>

      {/* Task List */}
      <div className="flex-1 overflow-y-auto p-3">
        <Droppable droppableId={bucket.id}>
          {(provided, snapshot) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={cn(
                "flex-1 flex flex-col gap-2.5 rounded-lg transition-all relative min-h-[100px]",
              )}
              style={snapshot.isDraggingOver ? {
                backgroundColor: styles.dropBg,
                boxShadow: `inset 0 0 0 2px ${styles.ringActive}`,
                borderRadius: "0.5rem",
              } : undefined}
            >
              {snapshot.isDraggingOver && tasks.length === 0 && (
                <div
                  className="flex items-center justify-center py-10 rounded-xl border border-dashed"
                  style={{ borderColor: color, backgroundColor: styles.iconTint }}
                >
                  <span className="text-[13px]" style={{ color: styles.text }}>Drop here</span>
                </div>
              )}

              {tasks.length === 0 && !snapshot.isDraggingOver && (
                <div className="flex flex-col items-center justify-center py-12 rounded-xl bg-[rgba(177,145,106,0.03)]">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-lg mb-3"
                    style={{ backgroundColor: styles.iconTint }}
                  >
                    {isCompletedView ? (
                      <CheckCircle2 size={18} style={{ color: styles.text, opacity: 0.6 }} />
                    ) : (
                      <ClipboardList size={18} style={{ color: styles.text, opacity: 0.6 }} />
                    )}
                  </div>
                  <span className="text-[13px] text-[#8e99a8] mb-1">
                    {isCompletedView ? "No completed tasks" : "No tasks yet"}
                  </span>
                  <span className="text-[11px] text-[#b5b0a8]">
                    {isCompletedView
                      ? `Completed tasks in ${bucket.name} appear here`
                      : "Drag tasks here or add a new one"}
                  </span>
                </div>
              )}

              {tasks.map((task, index) => (
                <div key={task.id} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <TaskCard
                    task={task}
                    index={index}
                    onToggle={onToggleTask}
                    availableBuckets={availableBuckets}
                    onBucketChange={onBucketChange}
                    isLoading={loadingTasks.has(task.id)}
                    onOpen={onTaskOpen}
                  />
                </div>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </div>

      {/* Add Task */}
      <div className="p-3 pt-0">
        {isAdding ? (
          <div className="flex items-center gap-2 p-2 rounded-lg border border-[#dbd6cf]/80 bg-white">
            <Input
              autoFocus
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Task name..."
              className="flex-1 border-0 focus-visible:ring-0 h-7 text-[13px] text-[#314158] placeholder:text-[#b5b0a8]"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleSubmit();
                }
                if (event.key === "Escape") {
                  setIsAdding(false);
                  setDraft("");
                }
              }}
              aria-label={`Add task in ${bucket.name}`}
            />
            <Button
              size="sm"
              onClick={handleSubmit}
              type="button"
              className="h-7 px-3 text-xs bg-[#B1916A] hover:bg-[#96784f]"
            >
              Add
            </Button>
          </div>
        ) : (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center justify-center gap-1.5 py-2.5 w-full rounded-lg border border-dashed border-[rgba(219,214,207,0.6)] text-[#bb9e7b] hover:bg-[rgba(177,145,106,0.04)] hover:border-[rgba(177,145,106,0.3)] transition-all"
          >
            <Plus size={14} />
            <span className="text-[12px]">Add task</span>
          </button>
        )}
      </div>
    </div>
  );
}

function TasksBoard({
  buckets: bucketsProp,
  tasks: tasksProp,
  onCompleteTask,
  onUncompleteTask,
  onAddTask,
  onMoveTask,
  onTaskOpen,
  viewMode = "open",
  loadingTasks = new Set(),
}: TasksBoardProps) {
  const buckets = bucketsProp ?? [];
  const tasks = tasksProp ?? [];
  const summaries = useMemo(() => groupByBucket(tasks), [tasks]);

  const wrapperRef = useRef<HTMLDivElement>(null);

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const { source, destination, draggableId } = result;

    if (source.droppableId === destination.droppableId && source.index === destination.index) {
      return;
    }

    if (source.droppableId !== destination.droppableId) {
      onMoveTask?.(draggableId, destination.droppableId);
    }
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex h-full w-full flex-col gap-3">
        {/* Columns */}
        <div
          ref={wrapperRef}
          className="relative grow snap-x snap-mandatory overflow-x-auto pb-4"
        >
          <div className="grid auto-cols-[320px] grid-flow-col gap-4 pr-6" style={{ minHeight: "520px" }}>
            {buckets.map((bucket) => (
              <div
                key={bucket.id}
                className="snap-start"
              >
                <BucketColumn
                  bucket={bucket}
                  summary={summaries[bucket.id] ?? { tasks: [], dueSoonCount: 0 }}
                  onAddTask={onAddTask}
                  onToggleTask={(id, checked) => {
                    if (checked) {
                      onCompleteTask?.(id);
                    } else {
                      onUncompleteTask?.(id);
                    }
                  }}
                  availableBuckets={buckets}
                  onBucketChange={onMoveTask}
                  viewMode={viewMode}
                  loadingTasks={loadingTasks}
                  onTaskOpen={onTaskOpen}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </DragDropContext>
  );
}

export default TasksBoard;
