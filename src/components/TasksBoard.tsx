"use client";

import * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
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
            "group bg-white rounded-xl border border-[#dbd6cf] p-4 hover:shadow-[0px_4px_12px_rgba(163,133,96,0.08)] transition-all cursor-default",
            snapshot.isDragging && "opacity-40 shadow-warm-lg"
          )}
        >
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              {/* Drag Handle */}
              <div
                {...provided.dragHandleProps}
                className="cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-40 transition-opacity shrink-0"
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
                  "w-4 h-4 rounded shrink-0 transition-all flex items-center justify-center",
                  task.status === "done"
                    ? "bg-[#bb9e7b] border-[#bb9e7b]"
                    : "bg-white border border-[rgba(219,214,207,0.7)] shadow-[0px_1px_2px_rgba(6,27,22,0.06)]",
                  isLoading && "animate-pulse opacity-50"
                )}
              >
                {task.status === "done" && (
                  <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                    <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>

              {/* Title */}
              <button
                onClick={() => onOpen?.(task.id)}
                className={cn(
                  "text-[14px] text-[#314158] text-left hover:text-[#bb9e7b] transition-colors cursor-pointer",
                  task.status === "done" && "line-through opacity-50"
                )}
              >
                {task.title}
              </button>
            </div>

            {/* Actions Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Task actions"
                  className="p-0.5 rounded hover:bg-[#f5f0eb] opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                >
                  <MoreHorizontal size={16} className="text-[#596881]" />
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

          {/* Date Badge */}
          <div className="flex items-center justify-between mt-3">
            {dateBadge ? (
              <span
                className={cn(
                  "inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] border",
                  dateBadge.tone === "destructive" && "border-red-200 bg-red-50 text-red-600",
                  dateBadge.tone === "accent" && "border-[rgba(177,145,106,0.3)] bg-[rgba(177,145,106,0.06)] text-[#96784f]",
                  dateBadge.tone === "default" && "border-[#e2e8f0] bg-[#f8fafc] text-[#596881]"
                )}
              >
                <CalendarDays size={10} />
                {dateBadge.label}
              </span>
            ) : (
              <span />
            )}
            {!!task.tags?.length && (
              <div className="flex items-center gap-1">
                {task.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-[#e2e8f0] bg-[#f8fafc] px-2 py-0.5 text-[10px] uppercase tracking-wide text-[#8e99a8]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
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

  const handleSubmit = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    onAddTask?.(bucket.id, trimmed);
    setDraft("");
    setIsAdding(false);
  };

  return (
    <div className="flex flex-col h-full rounded-xl border border-[#dbd6cf] bg-white overflow-hidden">
      {/* Column Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(219,214,207,0.5)]">
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full"
            style={{ background: bucket.color ?? "#bb9e7b" }}
            aria-hidden
          />
          <span className="text-[14px] tracking-[0.6px] uppercase text-[#bb9e7b] font-medium truncate">
            {bucket.name}
          </span>
          <span className="text-[22px] tracking-[0.88px] text-[#bb9e7b] leading-none">
            {tasks.length}
          </span>
          {!isCompletedView && dueSoonCount > 0 && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-[rgba(177,145,106,0.12)] px-1.5 py-0.5 text-[10px] font-medium text-[#96784f]">
              <Clock3 className="h-2.5 w-2.5" />
              {dueSoonCount}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setIsAdding(true)}
          aria-label={`Add task in ${bucket.name}`}
          className="p-0.5 hover:bg-[#faf8f5] rounded transition-colors"
        >
          <Plus size={18} className="text-[#BFA483]" />
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
                snapshot.isDraggingOver && "bg-[rgba(177,145,106,0.06)] ring-2 ring-[rgba(177,145,106,0.3)]"
              )}
            >
              {snapshot.isDraggingOver && tasks.length === 0 && (
                <div className="flex items-center justify-center py-10 rounded-xl border border-dashed border-[#B1916A] bg-[rgba(177,145,106,0.04)]">
                  <span className="text-[13px] text-[#bb9e7b]">Drop here</span>
                </div>
              )}

              {tasks.length === 0 && !snapshot.isDraggingOver && (
                <div className="flex flex-col items-center justify-center py-12 rounded-xl bg-[rgba(177,145,106,0.03)]">
                  <div className="w-10 h-10 rounded-lg bg-[rgba(177,145,106,0.08)] flex items-center justify-center mb-3">
                    {isCompletedView ? (
                      <CheckCircle2 size={18} className="text-[#bb9e7b]" />
                    ) : (
                      <ClipboardList size={18} className="text-[#bb9e7b]" />
                    )}
                  </div>
                  <span className="text-[13px] text-[#8e99a8] mb-1">
                    {isCompletedView ? "No completed tasks" : "No tasks yet"}
                  </span>
                  <span className="text-[11px] text-[#b5b0a8]">
                    {isCompletedView
                      ? `Completed tasks in ${bucket.name} appear here`
                      : "Add a task to get started"}
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
          <div className="flex items-center gap-2 p-2 rounded-xl border border-[#dbd6cf] bg-[rgba(252,250,248,0.5)]">
            <Input
              autoFocus
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={`Add task in ${bucket.name}`}
              className="flex-1 border-0 focus-visible:ring-0 h-8 text-[13px]"
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
            className="flex items-center justify-center gap-2 py-3 w-full rounded-xl border border-dashed border-[#dbd6cf] text-[#bb9e7b] hover:bg-[rgba(252,250,248,0.5)] transition-colors"
          >
            <Plus size={16} />
            <span className="text-[13px]">Add Task</span>
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
  const mockBuckets: Bucket[] = [
    { id: "b1", name: "Health", color: "#48B882" },
    { id: "b2", name: "Work", color: "#4AADE0" },
    { id: "b3", name: "Household", color: "#B1916A" },
    { id: "b4", name: "Kids", color: "#d97706" },
    { id: "b5", name: "Finance", color: "#8B7FD4" },
    { id: "b6", name: "Errands", color: "#7d6349" },
  ];
  const mockTasks: Task[] = [
    { id: "t1", title: "Supplements", bucketId: "b1", status: "open", tags: ["daily"] },
    { id: "t2", title: "Clean out fridge", bucketId: "b3", status: "open" },
    { id: "t3", title: "Business cards reorder", bucketId: "b2", status: "open", tags: ["print"] },
    { id: "t4", title: "Calendar to-dos for Dalit Designs", bucketId: "b2", status: "open" },
    { id: "t5", title: "Website audit", bucketId: "b2", status: "open", tags: ["SEO"] },
    { id: "t6", title: "Bon Bon", bucketId: "b4", status: "open" },
    { id: "t7", title: "Budget review", bucketId: "b5", status: "open" },
    { id: "t8", title: "Returns run", bucketId: "b6", status: "open" },
  ];

  const buckets = bucketsProp ?? mockBuckets;
  const tasks = tasksProp ?? mockTasks;
  const summaries = useMemo(() => groupByBucket(tasks), [tasks]);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const columnRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [activeBucket, setActiveBucket] = useState<string | null>(null);

  const handleJump = React.useCallback((bucketId: string) => {
    setActiveBucket(bucketId);
    const element = columnRefs.current[bucketId];
    if (element) {
      element.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
    }
  }, []);

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
        {/* Bucket navigation pills */}
        <div className="flex items-center justify-between gap-3">
          <div
            tabIndex={-1}
            className="flex items-center gap-1.5 overflow-x-auto pb-1 focus-visible:outline-none"
            aria-label="Buckets"
          >
            {buckets.map((bucket) => (
              <button
                key={bucket.id}
                onClick={() => handleJump(bucket.id)}
                type="button"
                className={cn(
                  "flex items-center gap-1.5 h-7 px-3 rounded-lg text-[12px] font-medium shrink-0 transition-colors",
                  activeBucket === bucket.id
                    ? "bg-[rgba(177,145,106,0.12)] border border-[rgba(177,145,106,0.35)] text-[#314158]"
                    : "text-[#596881] hover:bg-[rgba(177,145,106,0.06)] border border-transparent"
                )}
              >
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: bucket.color ?? "#bb9e7b" }}
                />
                {bucket.name}
                <span className="opacity-60 text-[10px]">
                  {summaries[bucket.id]?.tasks.length ?? 0}
                </span>
              </button>
            ))}
          </div>

          <div className="hidden items-center gap-0.5 md:flex shrink-0">
            <button
              type="button"
              className="h-7 w-7 flex items-center justify-center rounded hover:bg-[rgba(177,145,106,0.06)] transition-colors text-[#596881]"
              onClick={() => {
                if (wrapperRef.current) {
                  wrapperRef.current.scrollBy({ left: -360, behavior: "smooth" });
                }
              }}
              aria-label="Scroll left"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
            </button>
            <button
              type="button"
              className="h-7 w-7 flex items-center justify-center rounded hover:bg-[rgba(177,145,106,0.06)] transition-colors text-[#596881]"
              onClick={() => {
                if (wrapperRef.current) {
                  wrapperRef.current.scrollBy({ left: 360, behavior: "smooth" });
                }
              }}
              aria-label="Scroll right"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
            </button>
          </div>
        </div>

        {/* Columns */}
        <div
          ref={wrapperRef}
          className="relative grow snap-x snap-mandatory overflow-x-auto pb-4"
        >
          <div className="grid auto-cols-[300px] grid-flow-col gap-5 pr-6" style={{ minHeight: "520px" }}>
            {buckets.map((bucket) => (
              <div
                key={bucket.id}
                ref={(element) => {
                  columnRefs.current[bucket.id] = element;
                }}
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
