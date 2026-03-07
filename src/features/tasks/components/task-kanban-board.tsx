"use client";

import * as React from "react";
import { useCallback, useMemo, useRef, useState } from "react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { Plus, CalendarDays, GripVertical, LayoutGrid, Activity, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { differenceInCalendarDays, format, parseISO, isValid } from "date-fns";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { KanbanStatus } from "@/types/tasks";

/* ─── Calidora color helpers ─── */

function hexToRgb(hex: string) {
  const clean = hex.replace("#", "");
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

function getColumnStyles(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  return {
    iconTint: `rgba(${r}, ${g}, ${b}, 0.15)`,
    text: hex,
  };
}

/* ─── Types ─── */

export interface KanbanTask {
  id: string;
  title: string;
  bucket: string | null;
  dueDate: string | null;
  isRecurring: boolean;
  kanbanStatus: KanbanStatus;
  completed: boolean;
  assigneeId?: string | null;
}

export interface KanbanFamilyMember {
  id: string;
  name: string;
  avatarColor: string;
}

interface TaskKanbanBoardProps {
  tasks: KanbanTask[];
  onStatusChange: (taskId: string, newStatus: KanbanStatus) => void;
  onAddTask: (title: string, status: KanbanStatus) => void;
  onTaskOpen?: (taskId: string) => void;
  bucketColors?: Record<string, string>;
  loadingTasks?: Set<string>;
  familyMembers?: KanbanFamilyMember[];
}

/* ─── Column Config ─── */

const COLUMNS: { id: KanbanStatus; label: string; color: string; icon: React.ReactNode }[] = [
  { id: "todo", label: "To Do", color: "#B1916A", icon: <LayoutGrid size={18} /> },
  { id: "in_progress", label: "In Progress", color: "#4AADE0", icon: <Activity size={18} /> },
  { id: "done", label: "Done", color: "#48B882", icon: <CheckCircle2 size={18} /> },
];

/* ─── Date formatting ─── */

function formatDue(due: string | null, isRecurring: boolean) {
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
  if (diff < 0 && !isRecurring) return { label: "Overdue", tone: "destructive" as const };
  return { label: format(parsed, "MMM d"), tone: diff <= 3 ? ("accent" as const) : ("default" as const) };
}

/* ─── Kanban Card ─── */

const KanbanCard = React.memo(function KanbanCard({
  task,
  index,
  columnId,
  bucketColors,
  isLoading,
  onOpen,
  onStatusChange,
  familyMembers,
}: {
  task: KanbanTask;
  index: number;
  columnId: KanbanStatus;
  bucketColors?: Record<string, string>;
  isLoading?: boolean;
  onOpen?: (id: string) => void;
  onStatusChange?: (taskId: string, newStatus: KanbanStatus) => void;
  familyMembers?: KanbanFamilyMember[];
}) {
  const dateBadge = useMemo(() => formatDue(task.dueDate, task.isRecurring), [task.dueDate, task.isRecurring]);
  const bucketColor = task.bucket ? (bucketColors?.[task.bucket] ?? "#bb9e7b") : null;
  const assignee = useMemo(() => task.assigneeId ? familyMembers?.find((m) => m.id === task.assigneeId) ?? null : null, [task.assigneeId, familyMembers]);
  const isDone = task.kanbanStatus === "done";
  const [justCompleted, setJustCompleted] = useState(false);
  const justCompletedTimer = useRef<ReturnType<typeof setTimeout>>();

  const handleToggle = useCallback(() => {
    if (columnId === "done") {
      onStatusChange?.(task.id, "in_progress");
    } else {
      setJustCompleted(true);
      clearTimeout(justCompletedTimer.current);
      justCompletedTimer.current = setTimeout(() => setJustCompleted(false), 600);
      onStatusChange?.(task.id, "done");
    }
  }, [task.id, columnId, onStatusChange]);

  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={cn(
            "group bg-white rounded-xl border border-theme-neutral-300/80 p-3.5 transition-all cursor-default",
            "hover:border-theme-primary/35 hover:shadow-warm-sm",
            snapshot.isDragging && "opacity-40 shadow-warm-lg border-theme-primary/40",
            isLoading && "opacity-60 pointer-events-none",
            justCompleted && "bg-emerald-50/60"
          )}
        >
          <div className="flex items-start gap-2.5">
            {/* Checkbox — In Progress (unchecked) & Done (checked) */}
            {(columnId === "in_progress" || columnId === "done") && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggle();
                }}
                disabled={isLoading}
                aria-label={isDone ? `Mark "${task.title}" not completed` : `Mark "${task.title}" completed`}
                className={cn(
                  "w-[18px] h-[18px] rounded-[5px] shrink-0 mt-0.5 transition-all flex items-center justify-center",
                  isDone || justCompleted
                    ? "bg-theme-success"
                    : "bg-white border-[1.5px] border-theme-neutral-300/80 hover:border-theme-secondary",
                  isLoading && "animate-pulse opacity-50",
                  justCompleted && "animate-check-pop"
                )}
              >
                {(isDone || justCompleted) && (
                  <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                    <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={justCompleted ? "animate-check-stroke" : ""} />
                  </svg>
                )}
              </button>
            )}

            {/* Drag Handle */}
            <div
              {...provided.dragHandleProps}
              className="cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-30 transition-opacity shrink-0 mt-0.5"
            >
              <GripVertical size={14} className="text-theme-text-secondary" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <button
                onClick={() => onOpen?.(task.id)}
                className={cn(
                  "text-[13px] text-theme-text-primary text-left hover:text-theme-primary transition-colors cursor-pointer leading-snug w-full",
                  isDone && "line-through text-theme-text-tertiary"
                )}
              >
                {task.title}
              </button>

              {/* Bucket dot + Date badge + Assignee */}
              {(bucketColor || dateBadge || assignee) && (
                <div className="flex items-center gap-1.5 flex-wrap mt-2">
                  {bucketColor && task.bucket && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[rgba(0,0,0,0.03)]">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: bucketColor }}
                      />
                      <span className="text-[10px] text-theme-text-secondary font-medium">{task.bucket}</span>
                    </span>
                  )}
                  {dateBadge && (
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium",
                        dateBadge.tone === "destructive" && "bg-red-50 text-red-600",
                        dateBadge.tone === "accent" && "bg-theme-brand-tint-light text-theme-primary-600",
                        dateBadge.tone === "default" && "bg-[#f4f6f8] text-theme-text-secondary"
                      )}
                    >
                      <CalendarDays size={9} />
                      {dateBadge.label}
                    </span>
                  )}
                  {assignee && (
                    <span
                      className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[9px] font-semibold text-white shrink-0 ml-auto"
                      style={{ backgroundColor: assignee.avatarColor }}
                      title={assignee.name}
                    >
                      {assignee.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
});

/* ─── Kanban Column ─── */

function KanbanColumn({
  column,
  tasks,
  onAddTask,
  onTaskOpen,
  onStatusChange,
  bucketColors,
  loadingTasks,
  justDroppedId,
  familyMembers,
}: {
  column: (typeof COLUMNS)[number];
  tasks: KanbanTask[];
  onAddTask: (title: string, status: KanbanStatus) => void;
  onTaskOpen?: (id: string) => void;
  onStatusChange?: (taskId: string, newStatus: KanbanStatus) => void;
  bucketColors?: Record<string, string>;
  loadingTasks?: Set<string>;
  justDroppedId?: string | null;
  familyMembers?: KanbanFamilyMember[];
}) {
  const [draft, setDraft] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const handleSubmit = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    onAddTask(trimmed, column.id);
    setDraft("");
    setIsAdding(false);
  };

  const colStyles = getColumnStyles(column.color);

  return (
    <div className="flex flex-col h-full rounded-xl border border-theme-neutral-300/80 bg-[rgba(252,250,248,0.5)] overflow-hidden">
      {/* Column Header — Calidora transparent icon tint style */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-[rgba(219,214,207,0.4)] bg-white">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-lg shrink-0"
            style={{ backgroundColor: colStyles.iconTint }}
          >
            <span style={{ color: colStyles.text }}>{column.icon}</span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[13px] text-theme-text-primary font-semibold truncate">
              {column.label}
            </span>
            <span className="text-[11px] text-theme-text-tertiary">
              {tasks.length} {tasks.length === 1 ? "task" : "tasks"}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsAdding(true)}
          aria-label={`Add task to ${column.label}`}
          className="p-1.5 hover:bg-theme-brand-tint-subtle rounded-lg transition-colors"
        >
          <Plus size={16} className="text-theme-secondary" />
        </button>
      </div>

      {/* Task List */}
      <div className="flex-1 overflow-y-auto p-3">
        <Droppable droppableId={column.id}>
          {(provided, snapshot) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={cn(
                "flex-1 flex flex-col gap-2.5 rounded-lg transition-all relative min-h-[100px]",
                snapshot.isDraggingOver && "bg-theme-brand-tint-light ring-2 ring-theme-primary/35 ring-inset"
              )}
            >
              {snapshot.isDraggingOver && tasks.length === 0 && (
                <div
                  className="flex items-center justify-center py-10 rounded-xl border border-dashed"
                  style={{ borderColor: column.color, backgroundColor: colStyles.iconTint }}
                >
                  <span className="text-[13px]" style={{ color: colStyles.text }}>Drop here</span>
                </div>
              )}

              {tasks.length === 0 && !snapshot.isDraggingOver && (
                <div className="flex flex-col items-center justify-center py-12 rounded-xl bg-theme-brand-tint-subtle">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-lg mb-3"
                    style={{ backgroundColor: colStyles.iconTint }}
                  >
                    <span style={{ color: colStyles.text, opacity: 0.6 }}>{column.icon}</span>
                  </div>
                  <span className="text-[13px] text-theme-text-tertiary mb-1">No tasks</span>
                  <span className="text-[11px] text-theme-neutral-400">
                    Drag tasks here or add a new one
                  </span>
                </div>
              )}

              {tasks.map((task, index) => (
                <div key={task.id} className={cn(
                  "animate-in fade-in slide-in-from-bottom-2 duration-300",
                  justDroppedId === task.id && "animate-drop-snap"
                )}>
                  <KanbanCard
                    task={task}
                    index={index}
                    columnId={column.id}
                    bucketColors={bucketColors}
                    isLoading={loadingTasks?.has(task.id)}
                    onOpen={onTaskOpen}
                    onStatusChange={onStatusChange}
                    familyMembers={familyMembers}
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
          <div className="flex items-center gap-2 p-2 rounded-lg border border-theme-neutral-300/80 bg-white">
            <Input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Task name..."
              className="flex-1 border-0 focus-visible:ring-0 h-7 text-[13px] text-theme-text-primary placeholder:text-theme-neutral-400"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSubmit();
                }
                if (e.key === "Escape") {
                  setIsAdding(false);
                  setDraft("");
                }
              }}
              aria-label={`Add task to ${column.label}`}
            />
            <Button
              size="sm"
              onClick={handleSubmit}
              type="button"
              className="h-7 px-3 text-xs bg-theme-primary hover:bg-theme-primary-600"
            >
              Add
            </Button>
          </div>
        ) : (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center justify-center gap-1.5 py-2.5 w-full rounded-lg border border-dashed border-[rgba(219,214,207,0.6)] text-theme-secondary hover:bg-theme-brand-tint-subtle hover:border-theme-primary/30 transition-all"
          >
            <Plus size={14} />
            <span className="text-xs">Add task</span>
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── Main Kanban Board ─── */

export function TaskKanbanBoard({
  tasks,
  onStatusChange,
  onAddTask,
  onTaskOpen,
  bucketColors,
  loadingTasks,
  familyMembers,
}: TaskKanbanBoardProps) {
  const [justDroppedId, setJustDroppedId] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const map: Record<KanbanStatus, KanbanTask[]> = {
      todo: [],
      in_progress: [],
      done: [],
    };
    for (const task of tasks) {
      const status = task.kanbanStatus ?? (task.completed ? "done" : "todo");
      map[status].push(task);
    }
    return map;
  }, [tasks]);

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const { source, destination, draggableId } = result;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const newStatus = destination.droppableId as KanbanStatus;
    if (source.droppableId !== destination.droppableId) {
      onStatusChange(draggableId, newStatus);
      setJustDroppedId(draggableId);
      setTimeout(() => setJustDroppedId(null), 300);
    }
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4" style={{ minHeight: "520px" }}>
        {COLUMNS.map((col) => (
          <KanbanColumn
            key={col.id}
            column={col}
            tasks={grouped[col.id]}
            onAddTask={onAddTask}
            onTaskOpen={onTaskOpen}
            onStatusChange={onStatusChange}
            bucketColors={bucketColors}
            loadingTasks={loadingTasks}
            justDroppedId={justDroppedId}
            familyMembers={familyMembers}
          />
        ))}
      </div>
    </DragDropContext>
  );
}
