import { useState, useMemo, useCallback } from "react";
import React from "react";
import { reorderChannel, type ReorderDetail } from "@/features/calendar/hooks/calendar-reorder-channel";

interface UseTaskOrderingOptions {
  todayTasks: any[];
  openTasksBase: any[];
  todayStr: string;
  batchUpdateTasks: (updates: { taskId: string; updates: any }[]) => Promise<any>;
}

/**
 * Encapsulates local task ordering logic for both today-tasks (localStorage-persisted)
 * and open-tasks (position-based). Also registers reorder channel listeners.
 */
export function useTaskOrdering({
  todayTasks,
  openTasksBase,
  todayStr,
  batchUpdateTasks,
}: UseTaskOrderingOptions) {
  const todayOrderKey = `daily-order-${todayStr}`;

  // Force re-render trigger for today tasks
  const [todayTasksRenderKey, setTodayTasksRenderKey] = useState(0);

  const todayTasksOrdered = useMemo(() => {
    try {
      if (typeof window === 'undefined') return todayTasks;
      const raw = window.localStorage.getItem(todayOrderKey);
      const idOrder: string[] = raw ? JSON.parse(raw) : [];
      const map = new Map(todayTasks.map(t => [t.id.toString(), t]));
      const ordered: any[] = [];
      idOrder.forEach(id => {
        if (map.has(id)) {
          ordered.push(map.get(id)!);
          map.delete(id);
        }
      });
      // Append any new tasks not yet in the stored order
      ordered.push(...Array.from(map.values()));
      return ordered;
    } catch {
      return todayTasks;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayTasks, todayOrderKey, todayTasksRenderKey]);

  // ── Open tasks local ordering ──
  const [openTasksLocal, setOpenTasksLocal] = useState<any[]>([]);
  const [isReordering, setIsReordering] = React.useState(false);

  // Sync local list when membership changes, but don't override order on metadata updates
  React.useEffect(() => {
    if (isReordering) return;

    const baseMap = new Map(openTasksBase.map(t => [t.id.toString(), t]));
    const localIds = new Set(openTasksLocal.map(t => t.id.toString()));

    const hasPositions = openTasksBase.some(t => t.position !== undefined);

    if (hasPositions) {
      const currentOrder = openTasksLocal.map(t => t.id.toString()).join(',');
      const baseOrder = openTasksBase.map(t => t.id.toString()).join(',');
      if (currentOrder !== baseOrder) {
        setOpenTasksLocal(openTasksBase);
      }
      return;
    }

    let changed = false;
    const next = openTasksLocal.filter(t => baseMap.has(t.id.toString()));
    if (next.length !== openTasksLocal.length) changed = true;
    openTasksBase.forEach(t => {
      const id = t.id.toString();
      if (!localIds.has(id)) {
        next.push(t);
        changed = true;
      }
    });
    if (changed || openTasksLocal.length === 0) {
      const nextOrder = next.map(t => t.id.toString()).join(',');
      const currentOrder = openTasksLocal.map(t => t.id.toString()).join(',');
      if (nextOrder !== currentOrder) {
        setOpenTasksLocal(next);
      }
    }
  }, [openTasksBase, openTasksLocal, isReordering]);

  const openTasksToShow = useMemo(() => {
    return openTasksLocal.length ? openTasksLocal : openTasksBase;
  }, [openTasksLocal, openTasksBase]);

  // ── Reorder channel listeners ──
  React.useEffect(() => {
    const handleReorderOpenTasks = (detail: ReorderDetail) => {
      const { source, destination } = detail;

      setIsReordering(true);

      const list = [...openTasksToShow];
      const [moved] = list.splice(source.index, 1);
      list.splice(destination.index, 0, moved);

      setOpenTasksLocal(list);

      const updates = list.map((t, idx) => ({ taskId: t.id.toString(), updates: { position: idx } }));

      batchUpdateTasks(updates)
        .then(() => {
          setTimeout(() => setIsReordering(false), 1000);
        })
        .catch(err => {
          console.error('Failed to persist order', err);
          setIsReordering(false);
        });
    };

    const reorderTodayList = (detail: ReorderDetail) => {
      const { source, destination } = detail;

      const list = [...todayTasksOrdered];
      const [moved] = list.splice(source.index, 1);
      list.splice(destination.index, 0, moved);

      if (typeof window !== 'undefined') {
        const newOrder = list.map(t => t.id.toString());
        try {
          window.localStorage.setItem(todayOrderKey, JSON.stringify(newOrder));
          reorderChannel.emit("todayTasksReordered");
        } catch { }
      }
    };

    const handleTodayTasksReordered = () => {
      setTodayTasksRenderKey(prev => prev + 1);
    };

    reorderChannel.on('reorderOpenTasks', handleReorderOpenTasks);
    reorderChannel.on('reorderDailyTasks', reorderTodayList);
    reorderChannel.on('reorderMasterTodayTasks', reorderTodayList);
    reorderChannel.on('todayTasksReordered', handleTodayTasksReordered);

    return () => {
      reorderChannel.off('reorderOpenTasks', handleReorderOpenTasks);
      reorderChannel.off('reorderDailyTasks', reorderTodayList);
      reorderChannel.off('reorderMasterTodayTasks', reorderTodayList);
      reorderChannel.off('todayTasksReordered', handleTodayTasksReordered);
    };
  }, [openTasksToShow, todayTasksOrdered, todayOrderKey, batchUpdateTasks]);

  return { todayTasksOrdered, openTasksToShow };
}
