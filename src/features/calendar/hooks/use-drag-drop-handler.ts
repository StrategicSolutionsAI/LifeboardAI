import { useCallback } from "react";
import { addDays, format } from "date-fns";
import type { DropResult } from "@hello-pangea/dnd";
import { useOccurrencePrompt } from "@/contexts/tasks-occurrence-prompt-context";
import type { Task, RepeatOption } from "@/types/tasks";
import { toDayKey, hourSlotToISO, type CalendarTaskMovedDetail } from "@/features/calendar/types";
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

type BatchUpdateOptions = { occurrenceDecision?: "all" | "single" };
type BatchUpdateWithOptionsFn = (updates: BatchUpdateItem[], options?: BatchUpdateOptions) => Promise<any>;

export interface HabitDropPayload {
  instanceId: string;
  bucketName: string;
  targetDate: string;
  hourSlot?: string | null;
  allDay?: boolean;
}

interface UseDragDropHandlerOptions {
  selectedDateStr: string;
  allTasks: Task[];
  batchUpdateTasks: BatchUpdateWithOptionsFn;
  setIsDragging: (v: boolean) => void;
  onHabitDrop?: (payload: HabitDropPayload) => void;
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

export function resolveHabitDropPayload(
  draggableId: string,
  destinationDroppableId: string,
  selectedDateStr: string,
): HabitDropPayload | null {
  if (!draggableId.startsWith("habit::")) return null;

  const dst = classifyZone(destinationDroppableId);
  const parts = draggableId.split("::");
  const instanceId = parts[1] ?? "";
  const bucketName = decodeURIComponent(parts[2] ?? "");

  if (!instanceId || !bucketName) return null;

  if (dst.type === "calendar-day") {
    return {
      instanceId,
      bucketName,
      targetDate: dst.dateStr,
      allDay: true,
    };
  }

  if (dst.type === "allday-strip") {
    return {
      instanceId,
      bucketName,
      targetDate: selectedDateStr,
      allDay: true,
    };
  }

  if (dst.type === "hour") {
    return {
      instanceId,
      bucketName,
      targetDate: selectedDateStr,
      hourSlot: dst.id,
      allDay: false,
    };
  }

  return null;
}

function shiftDateString(dateStr: string, deltaDays: number): string {
  return toDayKey(addDays(new Date(`${dateStr}T00:00:00`), deltaDays));
}

export interface CalendarDayMovePlan {
  updates: TaskDragUpdate;
  detail: CalendarTaskMovedDetail;
  requiresSeriesConfirmation: boolean;
}

export function buildCalendarDayMovePlan(
  taskId: string,
  task: Pick<Task, "content" | "hourSlot" | "duration" | "repeatRule" | "startDate" | "endDate"> | undefined,
  sourceDate: string,
  destinationDate: string,
): CalendarDayMovePlan {
  const sourceMs = new Date(`${sourceDate}T00:00:00`).getTime();
  const destinationMs = new Date(`${destinationDate}T00:00:00`).getTime();
  const deltaDays = Math.round((destinationMs - sourceMs) / (24 * 60 * 60 * 1000));

  const updates: TaskDragUpdate = {
    due: { date: destinationDate },
    hourSlot: task?.hourSlot ?? null,
  };

  if (task?.startDate && task?.endDate && task.startDate !== task.endDate) {
    updates.startDate = shiftDateString(task.startDate, deltaDays);
    updates.endDate = shiftDateString(task.endDate, deltaDays);
  } else {
    updates.startDate = destinationDate;
    updates.endDate = destinationDate;
  }

  return {
    updates,
    detail: {
      taskId,
      fromDate: sourceDate,
      toDate: destinationDate,
      title: task?.content ?? "",
      time: hourSlotToISO(task?.hourSlot ?? null, destinationDate),
      hourSlot: task?.hourSlot ?? null,
      allDay: !task?.hourSlot,
      duration: task?.duration,
      repeatRule: (task?.repeatRule ?? null) as RepeatOption | null,
    },
    requiresSeriesConfirmation: Boolean(task?.repeatRule),
  };
}

/* ─── Shared helpers ─── */

function resolveUpcomingDate(groupKey: string): string | undefined {
  const today = new Date();
  switch (groupKey) {
    case "today": return toDayKey(today);
    case "tomorrow": return toDayKey(addDays(today, 1));
    case "thisWeek": return toDayKey(addDays(today, 3));
    case "nextWeek": return toDayKey(addDays(today, 7));
    case "later": return toDayKey(addDays(today, 14));
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
      const todayStr = toDayKey(new Date());
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
  allTasks,
  batchUpdateTasks,
  setIsDragging,
  onHabitDrop,
}: UseDragDropHandlerOptions) {
  const promptOccurrenceDecision = useOccurrencePrompt();

  const dispatchCalendarTaskMoved = useCallback((detail: CalendarTaskMovedDetail) => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(
      new CustomEvent("lifeboard:calendar-task-moved", {
        detail,
      }),
    );
  }, []);

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

      // ── Habit drag handling ──
      if (draggableId.startsWith("habit::")) {
        const habitDrop = resolveHabitDropPayload(
          draggableId,
          destination.droppableId,
          selectedDateStr,
        );
        if (habitDrop && onHabitDrop) {
          onHabitDrop(habitDrop);
        }
        // All other zones: no-op (snap back)
        return;
      }

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
        const movePlan = buildCalendarDayMovePlan(calTaskId, task, src.dateStr, dst.dateStr);
        const applyMove = (options?: BatchUpdateOptions) => {
          batchUpdateTasks(
            [{ taskId: calTaskId, updates: movePlan.updates as Partial<Task>, occurrenceDate: dst.dateStr }],
            options,
          ).catch((error) => {
            console.error("Calendar drag-drop update failed:", error);
          });
          dispatchCalendarTaskMoved(movePlan.detail);
        };

        if (movePlan.requiresSeriesConfirmation) {
          void (async () => {
            const destinationLabel = format(new Date(`${dst.dateStr}T00:00:00`), "MMMM d, yyyy");
            const decision = await promptOccurrenceDecision({
              actionDescription: `Move this repeating task to ${destinationLabel}. Dragging a repeating task to a new day updates the entire series`,
              taskTitle: task?.content,
              allowSingle: false,
            });
            if (decision !== "all") return;
            applyMove({ occurrenceDecision: "all" });
          })();
          return;
        }

        applyMove();
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
    [selectedDateStr, allTasks, batchUpdateTasks, setIsDragging, onHabitDrop, promptOccurrenceDecision, dispatchCalendarTaskMoved],
  );

  return handleDragEnd;
}
