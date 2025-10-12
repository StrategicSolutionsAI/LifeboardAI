"use client";

import * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { differenceInCalendarDays, format, parseISO, isValid } from "date-fns";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Plus, CheckCircle2, CalendarDays, Clock3, MoreHorizontal, GripVertical } from "lucide-react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";

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

function formatDueDate(due?: string | null) {
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
  if (diff < 0) return { label: `Overdue`, tone: "destructive" as const };
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
  if (sameDay) {
    return format(start, "MMM d");
  }

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

  if (endDiff < 0) {
    return "destructive" as const;
  }
  if (startDiff <= 0 && endDiff >= 0) {
    return "accent" as const;
  }
  if (startDiff <= 3) {
    return "accent" as const;
  }
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
  return formatDueDate(fallbackDate);
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
  const [showBucketDropdown, setShowBucketDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const dateBadge = useMemo(
    () => formatTaskDateBadge(task),
    [task.dueDate, task.startDate, task.endDate]
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowBucketDropdown(false);
      }
    }

    if (showBucketDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showBucketDropdown]);

  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={cn(
            "group relative rounded-2xl border border-border/70 bg-background/70 p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md",
            snapshot.isDragging && "rotate-2 shadow-lg scale-105 ring-2 ring-primary/40 bg-background",
            showBucketDropdown && "z-[9998]"
          )}
        >
      <div className="flex items-start gap-3">
        {/* Drag Handle */}
        <div
          {...provided.dragHandleProps}
          className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing pt-1"
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>

        {/* Task Content - Click to expand in future */}
        <div
          className="min-w-0 flex-1 cursor-pointer"
          onClick={() => { onOpen?.(task.id); }}
        >
          <div
            className={cn(
              "text-sm font-medium leading-5 line-clamp-2 group-hover:text-primary transition-colors",
              task.status === "done" ? "text-muted-foreground line-through" : "text-foreground"
            )}
            title={task.title.length > 50 ? task.title : undefined}
          >
            {task.title}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {dateBadge && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium border",
                  dateBadge.tone === "destructive" && "border-destructive/40 bg-destructive/5 text-destructive",
                  dateBadge.tone === "accent" && "border-primary/40 bg-primary/5 text-primary",
                  dateBadge.tone === "default" && "border-border bg-muted/50 text-muted-foreground"
                )}
              >
                <CalendarDays className="h-3 w-3" />
                {dateBadge.label}
              </span>
            )}
            {!!task.tags?.length && task.tags.map((tag) => (
              <span key={tag} className="rounded-full border border-border bg-background px-2 py-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Checkbox moved to right as action */}
        <Checkbox
          checked={task.status === "done"}
          disabled={isLoading}
          onCheckedChange={(value) => {
            const isChecked = value === true;
            onToggle?.(task.id, isChecked);
          }}
          className={cn("flex-shrink-0 mt-1", isLoading && "animate-pulse opacity-50")}
          aria-label={`${task.status === "done" ? "Mark incomplete" : "Mark complete"} ${task.title}`}
        />

        <div className="flex items-center gap-1">
          {/* Bucket Dropdown - Always visible for accessibility */}
          <div className="relative" ref={dropdownRef}>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-muted-foreground hover:text-foreground hover:bg-muted"
              aria-label="Task actions"
              onClick={(e) => {
                e.stopPropagation();
                setShowBucketDropdown(!showBucketDropdown);
              }}
              type="button"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
            
            {showBucketDropdown && (
              <div
                className="absolute top-10 right-0 z-[9999] min-w-[180px] rounded-lg border border-border bg-background shadow-xl"
                onClick={(e) => e.stopPropagation()}
                role="menu"
                aria-label="Move task to bucket"
              >
                <div className="p-2">
                  <div className="text-xs font-semibold text-muted-foreground px-3 py-2 border-b border-border mb-1">
                    Move to bucket
                  </div>

                  {/* No bucket option */}
                  <button
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted rounded-md text-foreground transition-colors flex items-center gap-2"
                    onClick={() => {
                      onBucketChange?.(task.id, '__unassigned');
                      setShowBucketDropdown(false);
                    }}
                    role="menuitem"
                  >
                    <span className="w-3 h-3 rounded-full bg-muted-foreground/30" />
                    No bucket
                  </button>

                  {/* Available buckets */}
                  {availableBuckets.map((bucket) => (
                    <button
                      key={bucket.id}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted rounded-md flex items-center gap-2 transition-colors"
                      onClick={() => {
                        onBucketChange?.(task.id, bucket.id);
                        setShowBucketDropdown(false);
                      }}
                      role="menuitem"
                    >
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: bucket.color ?? "var(--primary)" }}
                      />
                      <span className="flex-1 text-foreground">{bucket.name}</span>
                      {task.bucketId === bucket.id && (
                        <span className="text-primary font-semibold">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
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
  const bucketMetricLabel = isCompletedView ? `${tasks.length} done` : `${tasks.length} open`;

  const handleSubmit = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    onAddTask?.(bucket.id, trimmed);
    setDraft("");
    setIsAdding(false);
  };

  const handleStartAdd = () => {
    setIsAdding(true);
  };

  return (
    <Card className="relative flex h-full flex-col snap-start border-none bg-card/70 shadow-lg ring-1 ring-black/5">
      <CardHeader className="sticky top-0 z-10 border-b border-border/60 bg-card/85 backdrop-blur supports-[backdrop-filter]:bg-card/70 pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="inline-block h-2 w-2 flex-shrink-0 rounded-full"
              style={{ background: bucket.color ?? "var(--primary)" }}
              aria-hidden
            />
            <p className="truncate text-sm font-semibold text-foreground" title={bucket.name}>
              {bucket.name}
            </p>
            {!isCompletedView && dueSoonCount > 0 && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                <Clock3 className="h-2.5 w-2.5" />
                {dueSoonCount}
              </span>
            )}
          </div>
          <span className="text-xs text-muted-foreground shrink-0">
            {tasks.length}
          </span>
        </div>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
        <Droppable droppableId={bucket.id}>
          {(provided, snapshot) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={cn(
                "flex-1 space-y-3 rounded-lg transition-all relative",
                snapshot.isDraggingOver && "bg-primary/10 ring-2 ring-primary ring-offset-2",
                snapshot.draggingFromThisWith && "opacity-50"
              )}
            >
              {snapshot.isDraggingOver && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10">
                  <div className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium shadow-lg">
                    Drop task in {bucket.name}
                  </div>
                </div>
              )}
              {tasks.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-muted-foreground/30 bg-muted/30 p-8 text-center min-h-[200px]">
                  {isCompletedView ? (
                    <>
                      <CheckCircle2 className="h-12 w-12 text-muted-foreground/40 mb-4" />
                      <p className="text-base font-medium text-foreground">No completed tasks yet</p>
                      <p className="mt-2 text-sm text-muted-foreground max-w-xs">
                        Tasks you check off in {bucket.name} will appear here.
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                        <Plus className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <p className="text-base font-medium text-foreground">Welcome to {bucket.name}</p>
                      <p className="mt-2 text-sm text-muted-foreground max-w-xs">
                        Start capturing tasks to stay organized. Add your first task below.
                      </p>
                    </>
                  )}
                </div>
              ) : (
                tasks.map((task, index) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    index={index}
                    onToggle={onToggleTask}
                    availableBuckets={availableBuckets}
                    onBucketChange={onBucketChange}
                    isLoading={loadingTasks.has(task.id)}
                    onOpen={onTaskOpen}
                  />
                ))
              )}
              {provided.placeholder}
            </div>
          )}
        </Droppable>

        <div className="mt-2 rounded-2xl border border-dashed border-border/60 bg-background/70 p-3">
          {isAdding ? (
            <div className="flex items-center gap-2">
              <Input
                autoFocus
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={`Add task in ${bucket.name}`}
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
              <Button size="sm" onClick={handleSubmit} type="button">
                Add
              </Button>
            </div>
          ) : (
            <Button variant="ghost" className="w-full justify-start gap-2 text-sm text-muted-foreground" onClick={handleStartAdd} type="button">
              <Plus className="h-4 w-4" />
              Add task
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
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
    { id: "b1", name: "Health", color: "#7C4DFF" },
    { id: "b2", name: "Work", color: "#4F46E5" },
    { id: "b3", name: "Household", color: "#10B981" },
    { id: "b4", name: "Kids", color: "#F59E0B" },
    { id: "b5", name: "Finance", color: "#EF4444" },
    { id: "b6", name: "Errands", color: "#06B6D4" },
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
  const totalDueSoon = useMemo(
    () => (viewMode === "open" ? tasks.filter((task) => isDateSoon(task.dueDate)).length : 0),
    [tasks, viewMode]
  );

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
    
    // If dropped in the same position, do nothing
    if (source.droppableId === destination.droppableId && source.index === destination.index) {
      return;
    }
    
    // If moved to a different bucket, call onMoveTask
    if (source.droppableId !== destination.droppableId) {
      onMoveTask?.(draggableId, destination.droppableId);
    }
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
    <div className="flex h-full w-full flex-col gap-3">
      {/* Simplified bucket navigation - smaller and cleaner */}
      <div className="flex items-center justify-between gap-3">
        <div
          tabIndex={-1}
          className="flex items-center gap-1.5 overflow-x-auto pb-1 focus-visible:outline-none"
          aria-label="Buckets"
        >
          {buckets.map((bucket) => (
            <Button
              key={bucket.id}
              variant={activeBucket === bucket.id ? "default" : "ghost"}
              size="sm"
              className={cn(
                "h-7 rounded-lg px-3 text-xs font-medium shrink-0",
                activeBucket === bucket.id ? "shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => handleJump(bucket.id)}
              type="button"
            >
              <span className="flex items-center gap-1.5">
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{ background: bucket.color ?? "var(--primary)" }}
                />
                {bucket.name}
                <span className="ml-1 opacity-60 text-[10px]">
                  {summaries[bucket.id]?.tasks.length ?? 0}
                </span>
              </span>
            </Button>
          ))}
        </div>

        <div className="hidden items-center gap-0.5 md:flex shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            type="button"
            onClick={() => {
              if (wrapperRef.current) {
                wrapperRef.current.scrollBy({ left: -360, behavior: "smooth" });
              }
            }}
            aria-label="Scroll left"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            type="button"
            onClick={() => {
              if (wrapperRef.current) {
                wrapperRef.current.scrollBy({ left: 360, behavior: "smooth" });
              }
            }}
            aria-label="Scroll right"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div
        ref={wrapperRef}
        className="relative grow snap-x snap-mandatory overflow-x-auto pb-4"
      >
        <div className="grid auto-cols-[320px] grid-flow-col gap-4 pr-6" style={{ minHeight: "520px" }}>
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
