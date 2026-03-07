import { useCallback } from "react";
import { format, addDays } from "date-fns";
import type { DropResult } from "@hello-pangea/dnd";
import type { Task, RepeatOption } from "@/types/tasks";
import { hourSlotToISO } from "@/features/calendar/types";
import { reorderChannel, type ReorderEvent } from "@/features/calendar/hooks/calendar-reorder-channel";

/* ─── Types ─── */

/** Typed subset of Task fields that drag-drop operations modify. */
interface TaskDragUpdate {
  due?: { date: string } | null;
  startDate?: string | null;
  endDate?: string | null;
  hourSlot?: string | null;
  endHourSlot?: string | null;
  allDay?: boolean;
}

interface BatchUpdateItem {
  taskId: string;
  updates: Partial<Task>;
  occurrenceDate?: string;
}

type BatchUpdateFn = (updates: BatchUpdateItem[]) => Promise<any>;

interface UseDragDropHandlerOptions {
  selectedDateStr: string;
  selectedDate: Date;
  allTasks: Task[];
  batchUpdateTasks: BatchUpdateFn;
  setIsDragging: (v: boolean) => void;
}

/* ─── Zone classification ─── */

type DropZone =
  | { type: "allday-strip" }
  | { type: "hour"; id: string }
  | { type: "calendar-day"; dateStr: string }
  | { type: "sidebar"; list: "dailyTasks" | "openTasks" | "masterTodayTasks" }
  | { type: "upcoming"; groupKey: string }
  | { type: "hourly-planner-drop" }
  | { type: "unknown"; id: string };

function classifyZone(droppableId: string): DropZone {
  if (droppableId === "allday-strip") return { type: "allday-strip" };
  if (droppableId === "hourly-planner-drop") return { type: "hourly-planner-drop" };
  if (droppableId.startsWith("hour-")) return { type: "hour", id: droppableId };
  if (droppableId.startsWith("calendar-day-"))
    return { type: "calendar-day", dateStr: droppableId.replace("calendar-day-", "") };
  if (droppableId === "dailyTasks" || droppableId === "openTasks" || droppableId === "masterTodayTasks")
    return { type: "sidebar", list: droppableId as "dailyTasks" | "openTasks" | "masterTodayTasks" };
  if (droppableId.startsWith("upcoming-"))
    return { type: "upcoming", groupKey: droppableId.replace("upcoming-", "") };
  return { type: "unknown", id: droppableId };
}

function extractTaskId(draggableId: string): string {
  if (draggableId.startsWith("allday::")) return draggableId.replace("allday::", "");
  if (draggableId.startsWith("lifeboard::")) return draggableId.split("::")[1] ?? draggableId;
  return draggableId;
}

/* ─── Shared helpers ─── */

function resolveUpcomingDate(groupKey: string): string | undefined {
  const today = new Date();
  switch (groupKey) {
    case "today": return format(today, "yyyy-MM-dd");
    case "tomorrow": return format(addDays(today, 1), "yyyy-MM-dd");
    case "thisWeek": return format(addDays(today, 3), "yyyy-MM-dd");
    case "nextWeek": return format(addDays(today, 7), "yyyy-MM-dd");
    case "later": return format(addDays(today, 14), "yyyy-MM-dd");
    default: return undefined;
  }
}

function buildSidebarUpdates(
  list: "dailyTasks" | "openTasks" | "masterTodayTasks",
  selectedDateStr: string,
): TaskDragUpdate {
  switch (list) {
    case "dailyTasks":
      return {
        hourSlot: null, endHourSlot: null,
        due: { date: selectedDateStr }, startDate: selectedDateStr, endDate: selectedDateStr, allDay: true,
      };
    case "masterTodayTasks": {
      const todayStr = format(new Date(), "yyyy-MM-dd");
      return {
        hourSlot: null, endHourSlot: null,
        due: { date: todayStr }, startDate: todayStr, endDate: todayStr, allDay: true,
      };
    }
    case "openTasks":
      return {
        hourSlot: null, endHourSlot: null,
        due: null, startDate: null, endDate: null, allDay: true,
      };
  }
}

function getDefaultHourSlot(): string {
  const now = new Date();
  const currentHour = now.getHours();
  const nextHour = currentHour < 7 ? 9 : currentHour < 21 ? currentHour + 1 : 9;
  const displayHour = nextHour % 12 || 12;
  const period = nextHour < 12 ? "AM" : "PM";
  return `hour-${displayHour}${period}`;
}

/* ─── Reorder event names ─── */

const REORDER_EVENT_MAP: Record<string, ReorderEvent> = {
  openTasks: "reorderOpenTasks",
  dailyTasks: "reorderDailyTasks",
  masterTodayTasks: "reorderMasterTodayTasks",
};

/* ─── Hook ─── */

export function useDragDropHandler({
  selectedDateStr,
  selectedDate,
  allTasks,
  batchUpdateTasks,
  setIsDragging,
}: UseDragDropHandlerOptions) {

  const handleDragEnd = useCallback(
    (result: DropResult) => {
      // Ignore drops if a resize operation is active
      if (typeof document !== "undefined" && document.body.classList.contains("lb-resizing")) {
        setIsDragging(false);
        return;
      }
      setIsDragging(false);

      if (!result.destination) return;

      const { source, destination, draggableId } = result;
      const src = classifyZone(source.droppableId);
      const dst = classifyZone(destination.droppableId);
      const taskId = extractTaskId(draggableId);

      const dispatch = (updates: TaskDragUpdate, occurrenceDate?: string) => {
        batchUpdateTasks([{ taskId, updates: updates as Partial<Task>, occurrenceDate }]).catch((error) => {
          console.error("Calendar drag-drop update failed:", error);
        });
      };

      // ── allday-strip → hour slot ──
      if (src.type === "allday-strip" && dst.type === "hour") {
        dispatch({ hourSlot: dst.id, allDay: false, due: { date: selectedDateStr } }, selectedDateStr);
        return;
      }

      // ── allday-strip → sidebar ──
      if (src.type === "allday-strip" && dst.type === "sidebar") {
        dispatch(buildSidebarUpdates(dst.list, selectedDateStr), selectedDateStr);
        return;
      }

      // ── allday-strip → upcoming ──
      if (src.type === "allday-strip" && dst.type === "upcoming") {
        const targetDate = resolveUpcomingDate(dst.groupKey);
        if (!targetDate) return;
        dispatch(
          { hourSlot: null, endHourSlot: null, due: { date: targetDate }, startDate: targetDate, endDate: targetDate, allDay: true },
          targetDate,
        );
        return;
      }

      // ── sidebar → hour slot ──
      if (src.type === "sidebar" && dst.type === "hour") {
        dispatch(
          { hourSlot: dst.id, allDay: false, due: { date: selectedDateStr }, startDate: selectedDateStr, endDate: selectedDateStr },
          selectedDateStr,
        );
        return;
      }

      // ── sidebar/allday → hourly-planner-drop (fallback) ──
      if ((src.type === "sidebar" || src.type === "allday-strip") && dst.type === "hourly-planner-drop") {
        dispatch(
          { hourSlot: getDefaultHourSlot(), allDay: false, due: { date: selectedDateStr }, startDate: selectedDateStr, endDate: selectedDateStr },
          selectedDateStr,
        );
        return;
      }

      // ── sidebar → calendar-day ──
      if (src.type === "sidebar" && dst.type === "calendar-day") {
        dispatch(
          { due: { date: dst.dateStr }, startDate: dst.dateStr, endDate: dst.dateStr, hourSlot: null, allDay: true },
          dst.dateStr,
        );
        return;
      }

      // ── hour → allday-strip ──
      if (src.type === "hour" && dst.type === "allday-strip") {
        dispatch({ hourSlot: null, allDay: true, due: { date: selectedDateStr } }, selectedDateStr);
        return;
      }

      // ── hour → sidebar ──
      if (src.type === "hour" && dst.type === "sidebar") {
        dispatch(buildSidebarUpdates(dst.list, selectedDateStr), selectedDateStr);
        return;
      }

      // ── hour → upcoming ──
      if (src.type === "hour" && dst.type === "upcoming") {
        const targetDate = resolveUpcomingDate(dst.groupKey);
        if (!targetDate) return;
        dispatch({ hourSlot: null, due: { date: targetDate } }, targetDate);
        return;
      }

      // ── hour → hour (reschedule within planner) ──
      if (src.type === "hour" && dst.type === "hour") {
        dispatch({ hourSlot: dst.id }, selectedDateStr);
        return;
      }

      // ── hour → hourly-planner-drop (fallback: keep current slot) ──
      if (src.type === "hour" && dst.type === "hourly-planner-drop") {
        // Dropped on the planner area but not a specific slot — no-op to avoid snap-back
        return;
      }

      // ── calendar-day → calendar-day (move between days) ──
      if (src.type === "calendar-day" && dst.type === "calendar-day") {
        if (src.dateStr === dst.dateStr) return;
        if (!draggableId.startsWith("lifeboard::")) return;
        const calTaskId = draggableId.split("::")[1];
        if (!calTaskId) return;

        const task = allTasks.find((t) => t.id?.toString?.() === calTaskId);
        const updates: TaskDragUpdate = { due: { date: dst.dateStr } };
        updates.hourSlot = task?.hourSlot ?? null;

        if (task?.startDate && task?.endDate && task.startDate !== task.endDate) {
          const srcMs = new Date(src.dateStr + "T00:00:00").getTime();
          const dstMs = new Date(dst.dateStr + "T00:00:00").getTime();
          const deltaMs = dstMs - srcMs;
          updates.startDate = format(new Date(new Date(task.startDate + "T00:00:00").getTime() + deltaMs), "yyyy-MM-dd");
          updates.endDate = format(new Date(new Date(task.endDate + "T00:00:00").getTime() + deltaMs), "yyyy-MM-dd");
        } else {
          updates.startDate = dst.dateStr;
          updates.endDate = dst.dateStr;
        }

        batchUpdateTasks([
          { taskId: calTaskId, updates: updates as Partial<Task>, occurrenceDate: dst.dateStr },
        ]).catch((error) => {
          console.error("Calendar drag-drop update failed:", error);
        });

        window.dispatchEvent(
          new CustomEvent("lifeboard:calendar-task-moved", {
            detail: {
              taskId: calTaskId,
              fromDate: src.dateStr,
              toDate: dst.dateStr,
              title: task?.content ?? "",
              time: hourSlotToISO(task?.hourSlot ?? null, dst.dateStr),
              hourSlot: task?.hourSlot ?? null,
              allDay: !task?.hourSlot,
              duration: task?.duration,
              repeatRule: (task?.repeatRule ?? null) as RepeatOption | null,
            },
          }),
        );
        return;
      }

      // ── calendar-day → sidebar ──
      if (src.type === "calendar-day" && dst.type === "sidebar") {
        if (!draggableId.startsWith("lifeboard::")) return;
        const calTaskId = draggableId.split("::")[1];
        if (!calTaskId) return;
        batchUpdateTasks([
          { taskId: calTaskId, updates: buildSidebarUpdates(dst.list, selectedDateStr) as Partial<Task>, occurrenceDate: selectedDateStr },
        ]).catch((error) => {
          console.error("Calendar drag-drop update failed:", error);
        });
        return;
      }

      // ── calendar-day → upcoming ──
      if (src.type === "calendar-day" && dst.type === "upcoming") {
        if (!draggableId.startsWith("lifeboard::")) return;
        const calTaskId = draggableId.split("::")[1];
        if (!calTaskId) return;
        const targetDate = resolveUpcomingDate(dst.groupKey);
        if (!targetDate) return;
        batchUpdateTasks([
          {
            taskId: calTaskId,
            updates: { hourSlot: null, endHourSlot: null, due: { date: targetDate }, startDate: targetDate, endDate: targetDate, allDay: true } as Partial<Task>,
            occurrenceDate: targetDate,
          },
        ]).catch((error) => {
          console.error("Calendar drag-drop update failed:", error);
        });
        return;
      }

      // ── Reorder within the same list ──
      if (source.droppableId === destination.droppableId && source.index !== destination.index) {
        const eventName = REORDER_EVENT_MAP[source.droppableId];
        if (eventName) {
          reorderChannel.emit(eventName, { source, destination, draggableId });
          return;
        }
        if (source.droppableId.startsWith("upcoming-")) {
          reorderChannel.emit("reorderUpcomingTasks", { source, destination, draggableId });
          return;
        }
      }

      // ── Sidebar list → sidebar list moves ──
      if (src.type === "sidebar" && dst.type === "sidebar") {
        if (dst.list === "dailyTasks") {
          dispatch({ due: { date: selectedDateStr } });
        } else if (dst.list === "masterTodayTasks") {
          dispatch({ due: { date: selectedDateStr }, hourSlot: null }, selectedDateStr);
        } else if (dst.list === "openTasks") {
          dispatch({ due: null, hourSlot: null }, selectedDateStr);
        }
        return;
      }

      // ── sidebar → upcoming ──
      if (src.type === "sidebar" && dst.type === "upcoming") {
        const targetDate = resolveUpcomingDate(dst.groupKey);
        if (!targetDate) return;
        dispatch(
          { hourSlot: null, endHourSlot: null, due: { date: targetDate }, startDate: targetDate, endDate: targetDate, allDay: true },
          targetDate,
        );
        return;
      }

      // ── upcoming → sidebar ──
      if (src.type === "upcoming" && dst.type === "sidebar") {
        dispatch(buildSidebarUpdates(dst.list, selectedDateStr));
        return;
      }

      // ── upcoming → upcoming (cross-group) ──
      if (src.type === "upcoming" && dst.type === "upcoming") {
        const targetDate = resolveUpcomingDate(dst.groupKey);
        if (!targetDate) return;
        dispatch(
          { hourSlot: null, endHourSlot: null, due: { date: targetDate }, startDate: targetDate, endDate: targetDate, allDay: true },
          targetDate,
        );
        return;
      }
    },
    [selectedDateStr, selectedDate, allTasks, batchUpdateTasks, setIsDragging],
  );

  return handleDragEnd;
}
