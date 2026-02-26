"use client";

import * as React from "react";
import { useMemo, useState } from "react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { Plus, CalendarDays, GripVertical, LayoutGrid, Activity, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { differenceInCalendarDays, format, parseISO, isValid } from "date-fns";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { KanbanStatus } from "@/hooks/use-tasks";

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
}

interface TaskKanbanBoardProps {
  tasks: KanbanTask[];
  onStatusChange: (taskId: string, newStatus: KanbanStatus) => void;
  onAddTask: (title: string, status: KanbanStatus) => void;
  onTaskOpen?: (taskId: string) => void;
  bucketColors?: Record<string, string>;
  loadingTasks?: Set<string>;
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

function KanbanCard({
  task,
  index,
  bucketColors,
  isLoading,
  onOpen,
}: {
  task: KanbanTask;
  index: number;
  bucketColors?: Record<string, string>;
  isLoading?: boolean;
  onOpen?: (id: string) => void;
}) {
  const dateBadge = useMemo(() => formatDue(task.dueDate, task.isRecurring), [task.dueDate, task.isRecurring]);
  const bucketColor = task.bucket ? (bucketColors?.[task.bucket] ?? "#bb9e7b") : null;
  const isDone = task.kanbanStatus === "done";

  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={cn(
            "group bg-white rounded-xl border border-[#dbd6cf]/80 p-3.5 transition-all cursor-default",
            "hover:border-[rgba(177,145,106,0.35)] hover:shadow-[0px_2px_8px_rgba(163,133,96,0.08)]",
            snapshot.isDragging && "opacity-40 shadow-warm-lg border-[#B1916A]/40",
            isLoading && "opacity-60 pointer-events-none"
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

            {/* Content */}
            <div className="flex-1 min-w-0">
              <button
                onClick={() => onOpen?.(task.id)}
                className={cn(
                  "text-[13px] text-[#314158] text-left hover:text-[#B1916A] transition-colors cursor-pointer leading-snug w-full",
                  isDone && "line-through text-[#8e99a8]"
                )}
              >
                {task.title}
              </button>

              {/* Bucket dot + Date badge */}
              {(bucketColor || dateBadge) && (
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  {bucketColor && task.bucket && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[rgba(0,0,0,0.03)]">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: bucketColor }}
                      />
                      <span className="text-[10px] text-[#596881] font-medium">{task.bucket}</span>
                    </span>
                  )}
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
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
}

/* ─── Kanban Column ─── */

function KanbanColumn({
  column,
  tasks,
  onAddTask,
  onTaskOpen,
  bucketColors,
  loadingTasks,
}: {
  column: (typeof COLUMNS)[number];
  tasks: KanbanTask[];
  onAddTask: (title: string, status: KanbanStatus) => void;
  onTaskOpen?: (id: string) => void;
  bucketColors?: Record<string, string>;
  loadingTasks?: Set<string>;
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
    <div className="flex flex-col h-full rounded-xl border border-[#dbd6cf]/80 bg-[rgba(252,250,248,0.5)] overflow-hidden">
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
            <span className="text-[13px] text-[#314158] font-semibold truncate">
              {column.label}
            </span>
            <span className="text-[11px] text-[#8e99a8]">
              {tasks.length} {tasks.length === 1 ? "task" : "tasks"}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsAdding(true)}
          aria-label={`Add task to ${column.label}`}
          className="p-1.5 hover:bg-[rgba(177,145,106,0.06)] rounded-lg transition-colors"
        >
          <Plus size={16} className="text-[#bb9e7b]" />
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
                snapshot.isDraggingOver && "bg-[rgba(177,145,106,0.08)] ring-2 ring-[rgba(177,145,106,0.35)] ring-inset"
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
                <div className="flex flex-col items-center justify-center py-12 rounded-xl bg-[rgba(177,145,106,0.03)]">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-lg mb-3"
                    style={{ backgroundColor: colStyles.iconTint }}
                  >
                    <span style={{ color: colStyles.text, opacity: 0.6 }}>{column.icon}</span>
                  </div>
                  <span className="text-[13px] text-[#8e99a8] mb-1">No tasks</span>
                  <span className="text-[11px] text-[#b5b0a8]">
                    Drag tasks here or add a new one
                  </span>
                </div>
              )}

              {tasks.map((task, index) => (
                <div key={task.id} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <KanbanCard
                    task={task}
                    index={index}
                    bucketColors={bucketColors}
                    isLoading={loadingTasks?.has(task.id)}
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
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Task name..."
              className="flex-1 border-0 focus-visible:ring-0 h-7 text-[13px] text-[#314158] placeholder:text-[#b5b0a8]"
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

/* ─── Main Kanban Board ─── */

export function TaskKanbanBoard({
  tasks,
  onStatusChange,
  onAddTask,
  onTaskOpen,
  bucketColors,
  loadingTasks,
}: TaskKanbanBoardProps) {
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
            bucketColors={bucketColors}
            loadingTasks={loadingTasks}
          />
        ))}
      </div>
    </DragDropContext>
  );
}
