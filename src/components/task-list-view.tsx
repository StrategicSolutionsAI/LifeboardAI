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
  CheckCircle,
  Circle,
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

export interface ListTask {
  id: string;
  title: string;
  completed: boolean;
  bucket?: string | null;
  dueDate?: string | null;
  isRecurring?: boolean;
  position?: number | null;
}

interface TaskListViewProps {
  tasks: ListTask[];
  onToggleTask: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onEditTask: (id: string) => void;
  onAddTask: (title: string, bucket?: string) => void;
  onMoveTask?: (taskId: string, newBucket: string) => void;
  loadingTasks?: Set<string>;
  bucketColors?: Record<string, string>;
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

export function TaskListView({
  tasks,
  onToggleTask,
  onDeleteTask,
  onEditTask,
  onAddTask,
  loadingTasks = new Set(),
  bucketColors = {},
}: TaskListViewProps) {
  const openTasks = useMemo(() => tasks.filter((t) => !t.completed), [tasks]);
  const completedTasks = useMemo(() => tasks.filter((t) => t.completed), [tasks]);

  const handleDragEnd = (result: DropResult) => {
    // For now, just handle visual reordering - no persistence
    if (!result.destination) return;
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex flex-col gap-5">
        {/* Open Tasks Section */}
        <TaskSection
          status="open"
          label="Open"
          dotColor="bg-[#bb9e7b]"
          tasks={openTasks}
          onToggleTask={onToggleTask}
          onDeleteTask={onDeleteTask}
          onEditTask={onEditTask}
          onAddTask={onAddTask}
          loadingTasks={loadingTasks}
          bucketColors={bucketColors}
        />

        {/* Completed Tasks Section */}
        <TaskSection
          status="completed"
          label="Completed"
          dotColor="bg-[#7f43ea]"
          tasks={completedTasks}
          onToggleTask={onToggleTask}
          onDeleteTask={onDeleteTask}
          onEditTask={onEditTask}
          onAddTask={onAddTask}
          loadingTasks={loadingTasks}
          bucketColors={bucketColors}
        />
      </div>
    </DragDropContext>
  );
}

interface TaskSectionProps {
  status: "open" | "completed";
  label: string;
  dotColor: string;
  tasks: ListTask[];
  onToggleTask: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onEditTask: (id: string) => void;
  onAddTask: (title: string, bucket?: string) => void;
  loadingTasks: Set<string>;
  bucketColors: Record<string, string>;
}

function TaskSection({
  status,
  label,
  dotColor,
  tasks,
  onToggleTask,
  onDeleteTask,
  onEditTask,
  onAddTask,
  loadingTasks,
  bucketColors,
}: TaskSectionProps) {
  const count = tasks.length;
  const isOpen = status === "open";
  const [addingTask, setAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");

  const handleSubmitNew = () => {
    const trimmed = newTaskTitle.trim();
    if (!trimmed) return;
    onAddTask(trimmed);
    setNewTaskTitle("");
    setAddingTask(false);
  };

  return (
    <div className="bg-white rounded-xl border border-[#dbd6cf] overflow-hidden w-full transition-all">
      {/* Section Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className={`w-2.5 h-2.5 rounded-full ${dotColor}`} />
          <span className="text-[14px] tracking-[0.6px] uppercase text-[#bb9e7b] font-medium">
            {label}
          </span>
          <span className="text-[22px] tracking-[0.88px] text-[#bb9e7b] leading-none">
            {count}
          </span>
        </div>
        {isOpen && (
          <button
            type="button"
            onClick={() => setAddingTask(true)}
            aria-label={`Add ${label.toLowerCase()} task`}
            className="p-0.5 hover:bg-[#faf8f5] rounded transition-colors"
          >
            <Plus size={20} className="text-[#BFA483]" />
          </button>
        )}
      </div>

      {/* Empty State */}
      {count === 0 && !addingTask && (
        <div className="flex flex-col items-center justify-center gap-3 px-5 py-12 border-t border-[rgba(219,214,207,0.5)] bg-[rgba(252,250,248,0.5)]">
          <div className="w-12 h-12 rounded-xl bg-white border border-[#dbd6cf] shadow-[0px_4px_16px_rgba(163,133,96,0.06)] flex items-center justify-center shrink-0">
            <ClipboardList size={20} className="text-[#bb9e7b]" />
          </div>
          <div className="text-center">
            <span className="text-[14px] font-medium text-[#314158] block mb-1">
              No {label.toLowerCase()} tasks
            </span>
            <span className="text-[13px] text-[#8e99a8]">
              {isOpen ? "Click + to add your first task" : "Tasks you complete will appear here"}
            </span>
          </div>
        </div>
      )}

      {/* Full Table for Open Tasks */}
      {isOpen && count > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-t border-b border-[rgba(219,214,207,0.7)]">
                <th className="w-8" />
                <th className="text-left py-3 pl-2 pr-4 min-w-[280px]">
                  <div className="flex items-center gap-2">
                    <Circle size={14} className="text-[#bb9e7b]" />
                    <span className="text-[12px] font-medium tracking-[0.5px] uppercase text-[#8e99a8]">Task</span>
                  </div>
                </th>
                <th className="text-left py-3 px-4 border-l border-[rgba(219,214,207,0.7)] min-w-[140px]">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-[rgba(177,145,106,0.3)]" />
                    <span className="text-[12px] font-medium tracking-[0.5px] uppercase text-[#8e99a8]">Bucket</span>
                  </div>
                </th>
                <th className="text-left py-3 px-4 border-l border-[rgba(219,214,207,0.7)] min-w-[120px]">
                  <div className="flex items-center gap-2">
                    <CalendarDays size={14} className="text-[#bb9e7b]" />
                    <span className="text-[12px] font-medium tracking-[0.5px] uppercase text-[#8e99a8]">Due Date</span>
                  </div>
                </th>
                <th className="w-14 border-l border-[rgba(219,214,207,0.7)]" />
              </tr>
            </thead>
            <Droppable droppableId="open-tasks" type="TASK">
              {(provided) => (
                <tbody ref={provided.innerRef} {...provided.droppableProps}>
                  {tasks.map((task, index) => (
                    <TaskTableRow
                      key={task.id}
                      task={task}
                      index={index}
                      isLast={index === tasks.length - 1}
                      onToggleTask={onToggleTask}
                      onDeleteTask={onDeleteTask}
                      onEditTask={onEditTask}
                      isLoading={loadingTasks.has(task.id)}
                      bucketColors={bucketColors}
                    />
                  ))}
                  {provided.placeholder}
                </tbody>
              )}
            </Droppable>
          </table>
        </div>
      )}

      {/* Simple list for Completed */}
      {!isOpen && count > 0 && (
        <div>
          <div className="flex items-center gap-2 pl-10 pr-4 py-2 border-t border-b border-[rgba(219,214,207,0.7)]">
            <CheckCircle size={14} className="text-[#596881]" />
            <span className="text-[12px] text-[#596881]">Task</span>
          </div>

          {tasks.map((task) => (
            <TaskSimpleRow
              key={task.id}
              task={task}
              onToggleTask={onToggleTask}
              onDeleteTask={onDeleteTask}
              onEditTask={onEditTask}
              isLoading={loadingTasks.has(task.id)}
              bucketColors={bucketColors}
            />
          ))}
        </div>
      )}

      {/* Add Task Input */}
      {isOpen && addingTask && (
        <div className="flex items-center gap-2 px-4 py-3 border-t border-[rgba(219,214,207,0.7)]">
          <Input
            autoFocus
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            placeholder="Add a new task..."
            className="flex-1 border-0 focus-visible:ring-0 h-8 text-sm"
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
          <Button size="sm" onClick={handleSubmitNew} className="h-8 px-3 text-xs">
            Add
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setAddingTask(false); setNewTaskTitle(""); }}
            className="h-8 px-2 text-xs text-muted-foreground"
          >
            Cancel
          </Button>
        </div>
      )}

      {/* Add Task Button (bottom of section) */}
      {isOpen && !addingTask && count > 0 && (
        <button
          onClick={() => setAddingTask(true)}
          className="flex items-center gap-3 pl-10 pr-4 h-12 w-full hover:bg-[rgba(252,250,248,0.5)] transition-colors border-t border-[#dbd6cf]"
        >
          <div className="w-4 h-4 rounded border border-[rgba(219,214,207,0.7)] bg-white shadow-[0px_1px_2px_rgba(6,27,22,0.06)]" />
          <span className="text-[14px] text-[#314158]">+ Add Task</span>
        </button>
      )}
    </div>
  );
}

function TaskTableRow({
  task,
  index,
  isLast,
  onToggleTask,
  onDeleteTask,
  onEditTask,
  isLoading,
  bucketColors,
}: {
  task: ListTask;
  index: number;
  isLast: boolean;
  onToggleTask: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onEditTask: (id: string) => void;
  isLoading: boolean;
  bucketColors: Record<string, string>;
}) {
  const dateBadge = useMemo(() => formatDue(task.dueDate, task.isRecurring), [task.dueDate, task.isRecurring]);
  const bucketColor = task.bucket ? (bucketColors[task.bucket] ?? "#bb9e7b") : "#bb9e7b";

  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided, snapshot) => (
        <tr
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={cn(
            "group hover:bg-[rgba(252,250,248,0.5)] transition-colors",
            !isLast && "border-b border-[rgba(219,214,207,0.7)]",
            snapshot.isDragging && "opacity-40 bg-white shadow-warm-lg"
          )}
        >
          <td className="py-3.5 pl-3 pr-0 w-8">
            <div
              {...provided.dragHandleProps}
              className="cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-40 transition-opacity"
            >
              <GripVertical size={14} className="text-[#596881]" />
            </div>
          </td>
          <td className="py-3.5 pl-2 pr-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => onToggleTask(task.id)}
                disabled={isLoading}
                aria-label={task.completed ? `Mark "${task.title}" not completed` : `Mark "${task.title}" completed`}
                className={cn(
                  "w-4 h-4 rounded shrink-0 transition-all flex items-center justify-center",
                  task.completed
                    ? "bg-[#bb9e7b] border-[#bb9e7b]"
                    : "bg-white border border-[rgba(219,214,207,0.7)] shadow-[0px_1px_2px_rgba(6,27,22,0.06)]",
                  isLoading && "animate-pulse opacity-50"
                )}
              >
                {task.completed && (
                  <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                    <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
              <button
                onClick={() => onEditTask(task.id)}
                className={cn(
                  "text-[14px] text-[#314158] text-left hover:text-[#bb9e7b] transition-colors cursor-pointer",
                  task.completed && "line-through opacity-50"
                )}
              >
                {task.title}
              </button>
            </div>
          </td>
          <td className="py-3.5 px-4 border-l border-[rgba(219,214,207,0.7)]">
            {task.bucket && (
              <div className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: bucketColor }}
                />
                <span className="text-[13px] text-[rgba(49,65,88,0.8)] truncate">
                  {task.bucket}
                </span>
              </div>
            )}
            {!task.bucket && (
              <span className="text-[12px] text-[#b5b0a8] italic">Unsorted</span>
            )}
          </td>
          <td className="py-3.5 px-4 border-l border-[rgba(219,214,207,0.7)]">
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
              <span className="text-[12px] text-[#b5b0a8]">No date</span>
            )}
          </td>
          <td className="py-3.5 px-3 border-l border-[rgba(219,214,207,0.7)]">
            <TaskRowDropdown
              taskId={task.id}
              onDelete={onDeleteTask}
              onEdit={onEditTask}
            />
          </td>
        </tr>
      )}
    </Draggable>
  );
}

function TaskSimpleRow({
  task,
  onToggleTask,
  onDeleteTask,
  onEditTask,
  isLoading,
  bucketColors,
}: {
  task: ListTask;
  onToggleTask: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onEditTask: (id: string) => void;
  isLoading: boolean;
  bucketColors: Record<string, string>;
}) {
  const bucketColor = task.bucket ? (bucketColors[task.bucket] ?? "#bb9e7b") : undefined;

  return (
    <div className="group flex items-center gap-3 pl-3 pr-4 h-14 border-b border-[#dbd6cf] hover:bg-[rgba(252,250,248,0.5)] transition-colors">
      <div className="w-5 shrink-0" />
      <button
        type="button"
        onClick={() => onToggleTask(task.id)}
        disabled={isLoading}
        aria-label={`Mark "${task.title}" not completed`}
        className={cn(
          "w-4 h-4 rounded shrink-0 transition-all flex items-center justify-center bg-[#bb9e7b] border-[#bb9e7b]",
          isLoading && "animate-pulse opacity-50"
        )}
      >
        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
          <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <button
        onClick={() => onEditTask(task.id)}
        className="text-[14px] text-[#314158] flex-1 text-left hover:text-[#bb9e7b] transition-colors cursor-pointer line-through opacity-50"
      >
        {task.title}
      </button>
      {task.bucket && bucketColor && (
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: bucketColor }}
          />
          <span className="text-[11px] text-[#8e99a8]">{task.bucket}</span>
        </div>
      )}
      <TaskRowDropdown
        taskId={task.id}
        onDelete={onDeleteTask}
        onEdit={onEditTask}
      />
    </div>
  );
}

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
