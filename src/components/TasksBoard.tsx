"use client";

import * as React from "react";
import { useMemo, useRef, useState } from "react";
import { differenceInCalendarDays, format, parseISO, isValid } from "date-fns";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Plus, CheckCircle2, CalendarDays, Clock3, MoreHorizontal } from "lucide-react";
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
  createdAt?: string | null;
};

type BucketSummary = {
  tasks: Task[];
  dueSoonCount: number;
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
    if (task.status !== "open") continue;
    if (!map[task.bucketId]) {
      map[task.bucketId] = { tasks: [], dueSoonCount: 0 };
    }
    map[task.bucketId].tasks.push(task);
    if (isDateSoon(task.dueDate)) {
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

function TaskCard({ 
  task, 
  index, 
  onToggle, 
  availableBuckets = [], 
  onBucketChange 
}: { 
  task: Task; 
  index: number; 
  onToggle?: (id: string, checked: boolean) => void;
  availableBuckets?: Bucket[];
  onBucketChange?: (taskId: string, newBucketId: string) => void;
}) {
  const [checked, setChecked] = useState(false);
  const [showBucketDropdown, setShowBucketDropdown] = useState(false);
  const due = useMemo(() => formatDueDate(task.dueDate), [task.dueDate]);

  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided, snapshot) => (
        <div 
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`group relative rounded-2xl border border-border/70 bg-background/70 p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${
            snapshot.isDragging ? 'rotate-2 shadow-lg scale-105' : ''
          } ${showBucketDropdown ? 'z-[9998]' : ''}`}
        >
      <div className="flex items-start gap-3">
        <Checkbox
          checked={checked}
          onCheckedChange={(value) => {
            const isChecked = value === true;
            setChecked(isChecked);
            if (isChecked) {
              onToggle?.(task.id, true);
            }
          }}
          className="mt-1"
          aria-label={`Complete ${task.title}`}
        />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium leading-5 text-foreground line-clamp-2 pr-6">
            {task.title}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {due && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium border",
                  due.tone === "destructive" && "border-destructive/40 text-destructive",
                  due.tone === "accent" && "border-primary/40 text-primary",
                  due.tone === "default" && "border-muted text-muted-foreground"
                )}
              >
                <CalendarDays className="h-3.5 w-3.5" />
                {due.label}
              </span>
            )}
            {!!task.tags?.length && task.tags.map((tag) => (
              <span key={tag} className="rounded-full border border-muted px-2 py-0.5 text-[11px] uppercase tracking-wide">
                {tag}
              </span>
            ))}
          </div>
        </div>
        <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-primary"
            aria-label="Mark complete"
            onClick={() => onToggle?.(task.id, true)}
            type="button"
          >
            <CheckCircle2 className="h-4 w-4" />
          </Button>
          
          {/* Bucket Dropdown */}
          <div className="relative">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7 text-muted-foreground hover:text-primary" 
              aria-label="Change bucket"
              onMouseEnter={() => setShowBucketDropdown(true)}
              onMouseLeave={() => setShowBucketDropdown(false)}
              type="button"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
            
            {showBucketDropdown && (
              <div 
                className="absolute top-8 right-0 z-[9999] min-w-[140px] rounded-lg border border-border bg-background shadow-lg"
                onMouseEnter={() => setShowBucketDropdown(true)}
                onMouseLeave={() => setShowBucketDropdown(false)}
              >
                <div className="p-1">
                  <div className="text-xs font-medium text-muted-foreground px-2 py-1 border-b border-border mb-1">
                    Move to bucket
                  </div>
                  
                  {/* No bucket option */}
                  <button
                    className="w-full text-left px-2 py-1 text-sm hover:bg-muted rounded text-muted-foreground"
                    onClick={() => {
                      onBucketChange?.(task.id, '__unassigned');
                      setShowBucketDropdown(false);
                    }}
                  >
                    No bucket
                  </button>
                  
                  {/* Available buckets */}
                  {availableBuckets.map((bucket) => (
                    <button
                      key={bucket.id}
                      className="w-full text-left px-2 py-1 text-sm hover:bg-muted rounded flex items-center gap-2"
                      onClick={() => {
                        onBucketChange?.(task.id, bucket.id);
                        setShowBucketDropdown(false);
                      }}
                    >
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: bucket.color ?? "var(--primary)" }}
                      />
                      {bucket.name}
                      {task.bucketId === bucket.id && (
                        <span className="ml-auto text-xs text-primary">✓</span>
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
}: {
  bucket: Bucket;
  summary: BucketSummary;
  onAddTask?: (bucketId: string, title: string) => void;
  onToggleTask?: (id: string, checked: boolean) => void;
  availableBuckets?: Bucket[];
  onBucketChange?: (taskId: string, newBucketId: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const { tasks, dueSoonCount } = summary;

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
      <CardHeader className="sticky top-0 z-10 space-y-3 border-b border-border/60 bg-card/85 backdrop-blur supports-[backdrop-filter]:bg-card/70">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 truncate">
            <span
              className="mt-1 inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full"
              style={{ background: bucket.color ?? "var(--primary)" }}
              aria-hidden
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground" title={bucket.name}>
                {bucket.name}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>{tasks.length} open</span>
                {dueSoonCount > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">
                    <Clock3 className="h-3.5 w-3.5" />
                    {dueSoonCount} due soon
                  </span>
                )}
              </div>
            </div>
          </div>
          <Badge variant="secondary" className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            {tasks.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
        <Droppable droppableId={bucket.id}>
          {(provided, snapshot) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={`flex-1 space-y-3 ${snapshot.isDraggingOver ? 'bg-primary/5 rounded-lg' : ''}`}
            >
              {tasks.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-muted-foreground/30 bg-muted/30 p-6 text-center text-sm text-muted-foreground min-h-[200px]">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                    <Plus className="h-4 w-4" />
                  </div>
                  <p className="font-medium text-foreground">No tasks yet</p>
                  <p className="mt-1 text-xs text-muted-foreground">Add something you want to tackle next in {bucket.name}.</p>
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

export default function TasksBoard({
  buckets: bucketsProp,
  tasks: tasksProp,
  onCompleteTask,
  onAddTask,
  onMoveTask,
}: {
  buckets?: Bucket[];
  tasks?: Task[];
  onCompleteTask?: (id: string) => void;
  onAddTask?: (bucketId: string, title: string) => void;
  onMoveTask?: (taskId: string, newBucketId: string) => void;
}) {
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
  const totalDueSoon = useMemo(() => tasks.filter((task) => isDateSoon(task.dueDate)).length, [tasks]);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const columnRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [activeBucket, setActiveBucket] = useState<string | null>(null);

  const handleJump = (bucketId: string) => {
    setActiveBucket(bucketId);
    const element = columnRefs.current[bucketId];
    if (element) {
      element.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
    }
  };

  const totalOpen = tasks.filter((task) => task.status === "open").length;

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
    <div className="flex h-full w-full flex-col gap-4">
      <div className="flex items-center justify-between gap-2 rounded-2xl border border-border/60 bg-card/60 px-4 py-3 text-xs uppercase tracking-wide text-muted-foreground">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1 text-[11px] font-semibold">
            Open Tasks
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary text-[11px] font-semibold normal-case">{totalOpen}</span>
          </span>
          <span className="hidden items-center gap-1 text-[11px] font-semibold md:flex">
            Due soon
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700 text-[11px] font-semibold normal-case">{totalDueSoon}</span>
          </span>
        </div>
        <div className="hidden items-center gap-1 md:flex">
          <Button
            variant="ghost"
            size="icon"
            type="button"
            onClick={() => {
              if (wrapperRef.current) {
                wrapperRef.current.scrollBy({ left: -360, behavior: "smooth" });
              }
            }}
            aria-label="Scroll left"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            type="button"
            onClick={() => {
              if (wrapperRef.current) {
                wrapperRef.current.scrollBy({ left: 360, behavior: "smooth" });
              }
            }}
            aria-label="Scroll right"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="-mx-4 overflow-x-auto px-4 pb-1">
        <div className="flex w-max items-center gap-2 rounded-full bg-muted/40 p-1">
          {buckets.map((bucket) => (
            <Button
              key={bucket.id}
              variant={activeBucket === bucket.id ? "default" : "ghost"}
              className={cn(
                "h-8 rounded-full px-4 text-sm font-medium",
                activeBucket === bucket.id ? "shadow" : "text-muted-foreground"
              )}
              onClick={() => handleJump(bucket.id)}
              type="button"
            >
              <span className="flex items-center gap-2">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: bucket.color ?? "var(--primary)" }}
                />
                {bucket.name}
              </span>
            </Button>
          ))}
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
                  if (checked) onCompleteTask?.(id);
                }}
                availableBuckets={buckets}
                onBucketChange={onMoveTask}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
    </DragDropContext>
  );
}
