/**
 * Typed reorder channel — replaces raw DOM CustomEvents for calendar task reordering.
 *
 * Producers (use-drag-drop-handler.ts) call `emit()`.
 * Consumers (calendar-task-list.tsx) call `on()` / `off()`.
 */

export interface ReorderDetail {
  source: { droppableId: string; index: number };
  destination: { droppableId: string; index: number };
  draggableId: string;
}

export type ReorderEvent =
  | "reorderOpenTasks"
  | "reorderDailyTasks"
  | "reorderMasterTodayTasks"
  | "reorderUpcomingTasks"
  | "todayTasksReordered";

type ReorderHandler = (detail: ReorderDetail) => void;
type VoidHandler = () => void;

const listeners = new Map<ReorderEvent, Set<ReorderHandler | VoidHandler>>();

function getListeners(event: ReorderEvent): Set<ReorderHandler | VoidHandler> {
  let set = listeners.get(event);
  if (!set) {
    set = new Set();
    listeners.set(event, set);
  }
  return set;
}

export const reorderChannel = {
  on(event: ReorderEvent, handler: ReorderHandler | VoidHandler) {
    getListeners(event).add(handler);
  },

  off(event: ReorderEvent, handler: ReorderHandler | VoidHandler) {
    getListeners(event).delete(handler);
  },

  emit(event: ReorderEvent, detail?: ReorderDetail) {
    const set = listeners.get(event);
    if (!set) return;
    set.forEach((handler) => {
      if (detail) {
        (handler as ReorderHandler)(detail);
      } else {
        (handler as VoidHandler)();
      }
    });
  },
};
