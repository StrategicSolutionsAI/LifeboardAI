"use client";

import { useMemo, useState } from "react";
import {
  Plus,
  MoreHorizontal,
  CalendarDays,
  ClipboardList,
  Pencil,
  Trash2,
  GripVertical,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { differenceInCalendarDays, parseISO, isValid, format } from "date-fns";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";

type TaskStatus = "todo" | "in_progress" | "done";

export interface ListTask {
  id: string;
  title: string;
  completed: boolean;
  bucket?: string | null;
  dueDate?: string | null;
  isRecurring?: boolean;
  position?: number | null;
  kanbanStatus?: TaskStatus;
}

interface TaskListViewProps {
  tasks: ListTask[];
  onToggleTask: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onEditTask: (id: string) => void;
  onAddTask: (title: string, bucket?: string) => void;
  onStatusChange?: (taskId: string, newStatus: TaskStatus) => void;
  loadingTasks?: Set<string>;
  bucketColors?: Record<string, string>;
  searchQuery?: string;
  isSelectMode?: boolean;
  selectedTasks?: Set<string>;
  onToggleSelection?: (taskId: string) => void;
  onReorder?: (reorderedIds: string[]) => void;
}

const STATUS_CONFIG = {
  todo: { label: "To Do", color: "#B1916A" },
  in_progress: { label: "In Progress", color: "#4AADE0" },
  done: { label: "Done", color: "#48B882" },
} as const;

function HighlightText({ text, query }: { text: string; query?: string }) {
  if (!query || !query.trim()) return <>{text}</>;
  const q = query.trim();
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-[rgba(177,145,106,0.2)] text-[#314158] rounded-sm px-0.5">{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </>
  );
}

function formatDue(dueDate?: string | null, isRecurring?: boolean) {
  if (!dueDate) return null;
  let parsed: Date;
  try {
    parsed = dueDate.length === 10 ? parseISO(`${dueDate}T00:00:00`) : parseISO(dueDate);
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

function getTaskStatus(task: ListTask): TaskStatus {
  return task.kanbanStatus ?? (task.completed ? "done" : "todo");
}

/* ─── StatusBadge ─── */

function StatusBadge({
  taskId,
  status,
  onStatusChange,
}: {
  taskId: string;
  status: TaskStatus;
  onStatusChange?: (taskId: string, newStatus: TaskStatus) => void;
}) {
  const config = STATUS_CONFIG[status];
  const otherStatuses = (["todo", "in_progress", "done"] as TaskStatus[]).filter((s) => s !== status);

  if (!onStatusChange) {
    return (
      <span
        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium"
        style={{ backgroundColor: `${config.color}15`, color: config.color }}
      >
        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: config.color }} />
        {config.label}
      </span>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium transition-opacity hover:opacity-80 cursor-pointer"
          style={{ backgroundColor: `${config.color}15`, color: config.color }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: config.color }} />
          {config.label}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-36">
        {otherStatuses.map((s) => {
          const c = STATUS_CONFIG[s];
          return (
            <DropdownMenuItem key={s} onClick={() => onStatusChange(taskId, s)}>
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
              {c.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ─── Main TaskListView ─── */

export function TaskListView({
  tasks,
  onToggleTask,
  onDeleteTask,
  onEditTask,
  onAddTask,
  onStatusChange,
  loadingTasks = new Set(),
  bucketColors = {},
  searchQuery,
  isSelectMode = false,
  selectedTasks = new Set(),
  onToggleSelection,
  onReorder,
}: TaskListViewProps) {
  const todoTasks = useMemo(() => tasks.filter((t) => getTaskStatus(t) === "todo"), [tasks]);
  const inProgressTasks = useMemo(() => tasks.filter((t) => getTaskStatus(t) === "in_progress"), [tasks]);
  const doneTasks = useMemo(() => tasks.filter((t) => getTaskStatus(t) === "done"), [tasks]);

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const { source, destination, draggableId } = result;

    // Cross-section drag = status change
    if (source.droppableId !== destination.droppableId) {
      const newStatus = destination.droppableId as TaskStatus;
      onStatusChange?.(draggableId, newStatus);
      return;
    }

    // Same-section reorder
    if (source.index === destination.index) return;
    const sectionId = source.droppableId as TaskStatus;
    const sectionTasks =
      sectionId === "todo" ? todoTasks : sectionId === "in_progress" ? inProgressTasks : doneTasks;
    const reordered = [...sectionTasks];
    const [moved] = reordered.splice(source.index, 1);
    reordered.splice(destination.index, 0, moved);
    onReorder?.(reordered.map((t) => t.id));
  };

  const sharedProps = {
    onToggleTask,
    onDeleteTask,
    onEditTask,
    onAddTask,
    onStatusChange,
    loadingTasks,
    bucketColors,
    searchQuery,
    isSelectMode,
    selectedTasks,
    onToggleSelection,
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex flex-col gap-5">
        <TaskSection sectionStatus="todo" tasks={todoTasks} {...sharedProps} />
        <TaskSection sectionStatus="in_progress" tasks={inProgressTasks} {...sharedProps} />
        <TaskSection sectionStatus="done" tasks={doneTasks} {...sharedProps} />
      </div>
    </DragDropContext>
  );
}

/* ─── TaskSection ─── */

interface TaskSectionProps {
  sectionStatus: TaskStatus;
  tasks: ListTask[];
  onToggleTask: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onEditTask: (id: string) => void;
  onAddTask: (title: string, bucket?: string) => void;
  onStatusChange?: (taskId: string, newStatus: TaskStatus) => void;
  loadingTasks: Set<string>;
  bucketColors: Record<string, string>;
  searchQuery?: string;
  isSelectMode?: boolean;
  selectedTasks?: Set<string>;
  onToggleSelection?: (taskId: string) => void;
}

function TaskSection({
  sectionStatus,
  tasks,
  onToggleTask,
  onDeleteTask,
  onEditTask,
  onAddTask,
  onStatusChange,
  loadingTasks,
  bucketColors,
  searchQuery,
  isSelectMode = false,
  selectedTasks = new Set(),
  onToggleSelection,
}: TaskSectionProps) {
  const config = STATUS_CONFIG[sectionStatus];
  const count = tasks.length;
  const isDone = sectionStatus === "done";
  const [addingTask, setAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [isExpanded, setIsExpanded] = useState(!isDone);

  const handleSubmitNew = () => {
    const trimmed = newTaskTitle.trim();
    if (!trimmed) return;
    onAddTask(trimmed);
    setNewTaskTitle("");
    setAddingTask(false);
  };

  return (
    <div
      className={cn(
        "rounded-xl border overflow-hidden w-full transition-all",
        !isDone
          ? "bg-white border-[#dbd6cf] shadow-[0px_1px_3px_rgba(163,133,96,0.04)]"
          : "bg-[rgba(252,250,248,0.6)] border-[#dbd6cf]/60"
      )}
    >
      {/* Section Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "flex items-center justify-between px-4 py-3 w-full text-left cursor-pointer transition-colors",
          isDone ? "hover:bg-[rgba(252,250,248,0.8)]" : "hover:bg-[rgba(252,250,248,0.6)]"
        )}
      >
        <div className="flex items-center gap-2.5">
          {isExpanded ? (
            <ChevronDown size={14} className="text-[#8e99a8]" />
          ) : (
            <ChevronRight size={14} className="text-[#8e99a8]" />
          )}
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: config.color }} />
          <span
            className={cn(
              "text-[13px] tracking-[0.5px] uppercase font-medium",
              !isDone ? "text-[#314158]" : "text-[#8e99a8]"
            )}
          >
            {config.label}
          </span>
          <span
            className="text-[13px] font-semibold rounded-md px-1.5 py-0.5 leading-none"
            style={{ color: config.color, backgroundColor: `${config.color}15` }}
          >
            {count}
          </span>
        </div>
        {!isDone && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setAddingTask(true);
            }}
            aria-label={`Add ${config.label.toLowerCase()} task`}
            className="p-1 hover:bg-[rgba(177,145,106,0.08)] rounded-lg transition-colors"
          >
            <Plus size={18} style={{ color: config.color }} />
          </button>
        )}
      </button>

      {/* Empty State (To Do / In Progress only) */}
      {!isDone && isExpanded && count === 0 && !addingTask && (
        <div className="flex items-center gap-4 px-5 py-8 border-t border-[rgba(219,214,207,0.4)]">
          <div
            className="w-10 h-10 rounded-xl border border-[#dbd6cf]/60 flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${config.color}10` }}
          >
            <ClipboardList size={18} style={{ color: config.color }} />
          </div>
          <div>
            <span className="text-[14px] font-medium text-[#314158] block">
              No {config.label.toLowerCase()} tasks
            </span>
            <span className="text-[12px] text-[#8e99a8]">
              {sectionStatus === "todo"
                ? "Press + or type in the quick-add bar above"
                : "Drag tasks here or use the status menu"}
            </span>
          </div>
        </div>
      )}

      {/* Table for expanded sections */}
      {isExpanded && count > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-t border-[rgba(219,214,207,0.5)]">
                <th className="w-8">
                  {isSelectMode && (
                    <div className="flex items-center justify-center pl-3">
                      <button
                        type="button"
                        onClick={() => {
                          const allSelected = tasks.every((t) => selectedTasks.has(t.id));
                          if (allSelected) {
                            tasks.forEach((t) => onToggleSelection?.(t.id));
                          } else {
                            tasks
                              .filter((t) => !selectedTasks.has(t.id))
                              .forEach((t) => onToggleSelection?.(t.id));
                          }
                        }}
                        className={cn(
                          "w-[16px] h-[16px] rounded-[4px] transition-all flex items-center justify-center",
                          tasks.every((t) => selectedTasks.has(t.id)) && tasks.length > 0
                            ? "bg-[#B1916A]"
                            : "bg-white border-[1.5px] border-[rgba(219,214,207,0.8)] hover:border-[#bb9e7b]"
                        )}
                      >
                        {tasks.every((t) => selectedTasks.has(t.id)) && tasks.length > 0 && (
                          <svg width="8" height="6" viewBox="0 0 10 8" fill="none">
                            <path
                              d="M1 4L3.5 6.5L9 1"
                              stroke="white"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        )}
                      </button>
                    </div>
                  )}
                </th>
                <th className="text-left py-2.5 pl-2 pr-4 min-w-[200px]">
                  <span className="text-[11px] font-medium tracking-[0.6px] uppercase text-[#8e99a8]">Task</span>
                </th>
                <th className="text-left py-2.5 px-4 border-l border-[rgba(219,214,207,0.4)] min-w-[110px]">
                  <span className="text-[11px] font-medium tracking-[0.6px] uppercase text-[#8e99a8]">Status</span>
                </th>
                <th className="text-left py-2.5 px-4 border-l border-[rgba(219,214,207,0.4)] min-w-[120px]">
                  <span className="text-[11px] font-medium tracking-[0.6px] uppercase text-[#8e99a8]">Bucket</span>
                </th>
                <th className="text-left py-2.5 px-4 border-l border-[rgba(219,214,207,0.4)] min-w-[100px]">
                  <span className="text-[11px] font-medium tracking-[0.6px] uppercase text-[#8e99a8]">Due</span>
                </th>
                <th className="w-12 border-l border-[rgba(219,214,207,0.4)]" />
              </tr>
            </thead>
            <Droppable droppableId={sectionStatus} type="TASK">
              {(provided) => (
                <tbody ref={provided.innerRef} {...provided.droppableProps}>
                  {tasks.map((task, index) => (
                    <TaskTableRow
                      key={task.id}
                      task={task}
                      index={index}
                      isLast={index === tasks.length - 1}
                      isDoneSection={isDone}
                      onToggleTask={onToggleTask}
                      onDeleteTask={onDeleteTask}
                      onEditTask={onEditTask}
                      onStatusChange={onStatusChange}
                      isLoading={loadingTasks.has(task.id)}
                      bucketColors={bucketColors}
                      searchQuery={searchQuery}
                      isSelectMode={isSelectMode}
                      isSelected={selectedTasks.has(task.id)}
                      onToggleSelection={onToggleSelection}
                    />
                  ))}
                  {provided.placeholder}
                </tbody>
              )}
            </Droppable>
          </table>
        </div>
      )}

      {/* Add Task Input */}
      {!isDone && isExpanded && addingTask && (
        <div className="flex items-center gap-2 px-4 py-3 border-t border-[rgba(219,214,207,0.4)]">
          <Input
            autoFocus
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            placeholder="Task name..."
            className="flex-1 border-0 focus-visible:ring-0 h-8 text-sm text-[#314158] placeholder:text-[#b5b0a8]"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSubmitNew();
              }
              if (e.key === "Escape") {
                setAddingTask(false);
                setNewTaskTitle("");
              }
            }}
          />
          <Button size="sm" onClick={handleSubmitNew} className="h-7 px-3 text-xs bg-[#B1916A] hover:bg-[#96784f]">
            Add
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setAddingTask(false);
              setNewTaskTitle("");
            }}
            className="h-7 px-2 text-xs text-[#8e99a8] hover:text-[#596881]"
          >
            Cancel
          </Button>
        </div>
      )}

      {/* Inline add task row */}
      {!isDone && isExpanded && !addingTask && count > 0 && (
        <button
          onClick={() => setAddingTask(true)}
          className="flex items-center gap-3 pl-[52px] pr-4 h-11 w-full hover:bg-[rgba(177,145,106,0.04)] transition-colors border-t border-[rgba(219,214,207,0.4)]"
        >
          <Plus size={14} style={{ color: config.color }} />
          <span className="text-[13px] text-[#8e99a8]">Add task</span>
        </button>
      )}
    </div>
  );
}

/* ─── TaskTableRow ─── */

function TaskTableRow({
  task,
  index,
  isLast,
  isDoneSection,
  onToggleTask,
  onDeleteTask,
  onEditTask,
  onStatusChange,
  isLoading,
  bucketColors,
  searchQuery,
  isSelectMode = false,
  isSelected = false,
  onToggleSelection,
}: {
  task: ListTask;
  index: number;
  isLast: boolean;
  isDoneSection: boolean;
  onToggleTask: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onEditTask: (id: string) => void;
  onStatusChange?: (taskId: string, newStatus: TaskStatus) => void;
  isLoading: boolean;
  bucketColors: Record<string, string>;
  searchQuery?: string;
  isSelectMode?: boolean;
  isSelected?: boolean;
  onToggleSelection?: (taskId: string) => void;
}) {
  const dateBadge = useMemo(() => formatDue(task.dueDate, task.isRecurring), [task.dueDate, task.isRecurring]);
  const bucketColor = task.bucket ? (bucketColors[task.bucket] ?? "#bb9e7b") : "#bb9e7b";
  const isOverdue = dateBadge?.tone === "destructive";
  const currentStatus = getTaskStatus(task);

  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided, snapshot) => (
        <tr
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={cn(
            "group transition-all duration-150",
            "hover:bg-[rgba(177,145,106,0.04)]",
            isOverdue && !isDoneSection && "bg-red-50/40",
            isSelected && "bg-[rgba(177,145,106,0.08)]",
            !isLast && "border-b border-[rgba(219,214,207,0.35)]",
            snapshot.isDragging && "opacity-40 bg-white shadow-warm-lg"
          )}
        >
          {/* Drag / Select */}
          <td className="py-3 pl-3 pr-0 w-8">
            {isSelectMode ? (
              <button
                type="button"
                onClick={() => onToggleSelection?.(task.id)}
                className="flex items-center justify-center w-5 h-5"
              >
                <div
                  className={cn(
                    "w-[18px] h-[18px] rounded-[5px] transition-all flex items-center justify-center",
                    isSelected
                      ? "bg-[#B1916A]"
                      : "bg-white border-[1.5px] border-[rgba(219,214,207,0.8)] hover:border-[#bb9e7b]"
                  )}
                >
                  {isSelected && (
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                      <path
                        d="M1 4L3.5 6.5L9 1"
                        stroke="white"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </div>
              </button>
            ) : (
              <div
                {...provided.dragHandleProps}
                className="cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-30 transition-opacity"
              >
                <GripVertical size={14} className="text-[#596881]" />
              </div>
            )}
          </td>

          {/* Task */}
          <td className="py-3 pl-2 pr-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => onToggleTask(task.id)}
                disabled={isLoading}
                aria-label={task.completed ? `Mark "${task.title}" not completed` : `Mark "${task.title}" completed`}
                className={cn(
                  "w-[18px] h-[18px] rounded-[5px] shrink-0 transition-all flex items-center justify-center",
                  task.completed
                    ? "bg-[#48B882] border-[#48B882]"
                    : "bg-white border-[1.5px] border-[rgba(219,214,207,0.8)] hover:border-[#bb9e7b]",
                  isLoading && "animate-pulse opacity-50"
                )}
              >
                {task.completed && (
                  <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                    <path
                      d="M1 4L3.5 6.5L9 1"
                      stroke="white"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </button>
              <button
                onClick={() => (isSelectMode ? onToggleSelection?.(task.id) : onEditTask(task.id))}
                className={cn(
                  "text-[14px] text-[#314158] text-left hover:text-[#B1916A] transition-colors cursor-pointer leading-snug",
                  isDoneSection && "line-through opacity-50"
                )}
              >
                <HighlightText text={task.title} query={searchQuery} />
              </button>
            </div>
          </td>

          {/* Status */}
          <td className="py-3 px-4 border-l border-[rgba(219,214,207,0.3)]">
            <StatusBadge taskId={task.id} status={currentStatus} onStatusChange={onStatusChange} />
          </td>

          {/* Bucket */}
          <td className="py-3 px-4 border-l border-[rgba(219,214,207,0.3)]">
            {task.bucket ? (
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: bucketColor }} />
                <span className="text-[12px] text-[#596881] truncate">{task.bucket}</span>
              </div>
            ) : (
              <span className="text-[11px] text-[#b5b0a8]">--</span>
            )}
          </td>

          {/* Due */}
          <td className="py-3 px-4 border-l border-[rgba(219,214,207,0.3)]">
            {dateBadge ? (
              <span
                className={cn(
                  "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium",
                  dateBadge.tone === "destructive" && "bg-red-50 text-red-600",
                  dateBadge.tone === "accent" && "bg-[rgba(177,145,106,0.08)] text-[#96784f]",
                  dateBadge.tone === "default" && "bg-[#f4f6f8] text-[#596881]"
                )}
              >
                <CalendarDays size={10} />
                {dateBadge.label}
              </span>
            ) : (
              <span className="text-[11px] text-[#c5c0b8]">--</span>
            )}
          </td>

          {/* Actions */}
          <td className="py-3 px-2 border-l border-[rgba(219,214,207,0.3)]">
            <TaskRowDropdown taskId={task.id} onDelete={onDeleteTask} onEdit={onEditTask} />
          </td>
        </tr>
      )}
    </Draggable>
  );
}

/* ─── TaskRowDropdown ─── */

function TaskRowDropdown({
  taskId,
  onDelete,
  onEdit,
}: {
  taskId: string;
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Task actions"
          className="p-1 rounded hover:bg-[#f5f0eb] opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <MoreHorizontal size={16} className="text-[#596881]" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36">
        <DropdownMenuItem onClick={() => onEdit(taskId)}>
          <Pencil size={14} />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onClick={() => onDelete(taskId)}>
          <Trash2 size={14} />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
