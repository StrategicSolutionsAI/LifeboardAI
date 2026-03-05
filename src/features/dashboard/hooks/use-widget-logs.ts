"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import type { WidgetInstance } from "@/types/widgets";
import type { ProgressEntry } from "@/features/dashboard/types";
import { type WidgetLogEntry, todayStrGlobal } from "@/lib/dashboard-utils";

interface UseWidgetLogsOptions {
  user: { id: string } | null;
  activeSubTab: string;
  activeWidgets: WidgetInstance[];
  activeWidgetMap: Map<string, WidgetInstance>;
  progressByWidget: Record<string, ProgressEntry>;
  fitbitData: Record<string, number>;
  googleFitData: Record<string, number>;
  linkedTaskDataByWidgetId: Record<string, { content?: string; completed?: boolean; dueDate?: string } | undefined>;
}

export function useWidgetLogs({
  user,
  activeSubTab,
  activeWidgets,
  activeWidgetMap,
  progressByWidget,
  fitbitData,
  googleFitData,
  linkedTaskDataByWidgetId,
}: UseWidgetLogsOptions) {
  // ------------------------------------------------------------------
  // State
  // ------------------------------------------------------------------
  const [selectedLogsWidget, setSelectedLogsWidget] = useState<string | 'all'>('all');
  const [selectedSettingsWidget, setSelectedSettingsWidget] = useState<string | 'all'>('all');
  const [widgetHistoryLogs, setWidgetHistoryLogs] = useState<WidgetLogEntry[]>([]);
  const [isWidgetLogsLoading, setIsWidgetLogsLoading] = useState(false);
  const [widgetLogsError, setWidgetLogsError] = useState<string | null>(null);

  // ------------------------------------------------------------------
  // Local widget logs — generated from current widget state
  // ------------------------------------------------------------------
  const localWidgetLogs = useMemo<WidgetLogEntry[]>(() => {
    // Skip expensive log generation when the Logs tab isn't active
    if (activeSubTab !== 'Logs') return [];

    const logs: WidgetLogEntry[] = [];

    activeWidgets.forEach((widget) => {
      const progress = progressByWidget[widget.instanceId];
      if (progress?.date) {
        const reachedTarget = progress.value >= (widget.target || 1);
        logs.push({
          id: `local-progress-${widget.instanceId}-${progress.date}`,
          widgetInstanceId: widget.instanceId,
          widgetName: widget.name,
          message: reachedTarget ? "Goal reached" : "Progress updated",
          details: `${progress.value.toLocaleString()} / ${(widget.target || 1).toLocaleString()} ${widget.unit || ""}`.trim(),
          occurredAt: `${progress.date}T20:00:00`,
          kind: "progress",
        });
      }

      if (widget.dataSource === "fitbit" || widget.dataSource === "googlefit") {
        let syncedValue: number | null = null;
        if (widget.id === "water") {
          syncedValue = widget.dataSource === "fitbit" ? (fitbitData.water ?? null) : (googleFitData.water ?? null);
        } else if (widget.id === "steps") {
          syncedValue = widget.dataSource === "fitbit" ? (fitbitData.steps ?? null) : (googleFitData.steps ?? null);
        }

        if (typeof syncedValue === "number") {
          logs.push({
            id: `integration-${widget.instanceId}-${todayStrGlobal}`,
            widgetInstanceId: widget.instanceId,
            widgetName: widget.name,
            message: `Synced from ${widget.dataSource === "fitbit" ? "Fitbit" : "Google Fit"}`,
            details: `${syncedValue.toLocaleString()} ${widget.unit || ""}`.trim(),
            occurredAt: `${todayStrGlobal}T12:00:00`,
            kind: "integration",
          });
        }
      }

      if (widget.moodData?.lastUpdated) {
        logs.push({
          id: `mood-${widget.instanceId}-${widget.moodData.lastUpdated}`,
          widgetInstanceId: widget.instanceId,
          widgetName: widget.name,
          message: "Mood logged",
          details: widget.moodData.currentMood ? `Mood ${widget.moodData.currentMood}/5` : undefined,
          occurredAt: widget.moodData.lastUpdated,
          kind: "entry",
        });
      }

      if (widget.journalData?.lastEntryDate) {
        const words = widget.journalData.todaysEntry?.trim().split(/\s+/).filter(Boolean).length;
        logs.push({
          id: `journal-${widget.instanceId}-${widget.journalData.lastEntryDate}`,
          widgetInstanceId: widget.instanceId,
          widgetName: widget.name,
          message: "Journal entry saved",
          details: words ? `${words} words` : undefined,
          occurredAt: `${widget.journalData.lastEntryDate}T20:00:00`,
          kind: "entry",
        });
      }

      if (widget.gratitudeData?.lastEntryDate) {
        const count = widget.gratitudeData.gratitudeItems?.filter((item) => item.trim().length > 0).length;
        logs.push({
          id: `gratitude-${widget.instanceId}-${widget.gratitudeData.lastEntryDate}`,
          widgetInstanceId: widget.instanceId,
          widgetName: widget.name,
          message: "Gratitude entry updated",
          details: count ? `${count} items` : undefined,
          occurredAt: `${widget.gratitudeData.lastEntryDate}T20:00:00`,
          kind: "entry",
        });
      }

      if (widget.weightData?.lastEntryDate && typeof widget.weightData.currentWeight === "number") {
        logs.push({
          id: `weight-${widget.instanceId}-${widget.weightData.lastEntryDate}`,
          widgetInstanceId: widget.instanceId,
          widgetName: widget.name,
          message: "Weight logged",
          details: `${widget.weightData.currentWeight} ${widget.weightData.unit || widget.unit || "lbs"}`,
          occurredAt: `${widget.weightData.lastEntryDate}T20:00:00`,
          kind: "entry",
        });
      }

      if (widget.homeProjectsData?.lastUpdated) {
        logs.push({
          id: `home-projects-${widget.instanceId}-${widget.homeProjectsData.lastUpdated}`,
          widgetInstanceId: widget.instanceId,
          widgetName: widget.name,
          message: "Projects updated",
          details: widget.homeProjectsData.totalProjects
            ? `${widget.homeProjectsData.totalProjects} total projects`
            : undefined,
          occurredAt: widget.homeProjectsData.lastUpdated,
          kind: "entry",
        });
      }

      if (widget.linkedTaskId) {
        const linkedTask = linkedTaskDataByWidgetId[widget.linkedTaskId];
        logs.push({
          id: `task-link-${widget.instanceId}-${widget.linkedTaskId}`,
          widgetInstanceId: widget.instanceId,
          widgetName: widget.name,
          message: linkedTask?.completed ? "Linked task completed" : "Linked to Tasks tab",
          details: linkedTask?.content || widget.linkedTaskTitle,
          occurredAt: linkedTask?.dueDate ? `${linkedTask.dueDate}T09:00:00` : widget.createdAt,
          kind: "task",
        });
      }

      logs.push({
        id: `widget-created-${widget.instanceId}`,
        widgetInstanceId: widget.instanceId,
        widgetName: widget.name,
        message: "Widget created",
        occurredAt: widget.createdAt,
        kind: "system",
      });
    });

    return logs;
  }, [activeSubTab, activeWidgets, progressByWidget, fitbitData, googleFitData, linkedTaskDataByWidgetId]);

  // ------------------------------------------------------------------
  // Combined + filtered logs
  // ------------------------------------------------------------------
  const combinedWidgetLogs = useMemo(() => {
    const merged = [...widgetHistoryLogs, ...localWidgetLogs];
    const deduped = new Map<string, WidgetLogEntry>();

    merged.forEach((entry) => {
      const key = `${entry.widgetInstanceId}|${entry.message}|${entry.occurredAt.slice(0, 10)}|${entry.details ?? ""}`;
      if (!deduped.has(key)) {
        deduped.set(key, entry);
      }
    });

    return Array.from(deduped.values()).sort((a, b) => {
      const aTime = Date.parse(a.occurredAt);
      const bTime = Date.parse(b.occurredAt);
      if (Number.isNaN(aTime) || Number.isNaN(bTime)) {
        return b.occurredAt.localeCompare(a.occurredAt);
      }
      return bTime - aTime;
    });
  }, [widgetHistoryLogs, localWidgetLogs]);

  const filteredWidgetLogs = useMemo(() => {
    if (selectedLogsWidget === "all") return combinedWidgetLogs;
    return combinedWidgetLogs.filter((entry) => entry.widgetInstanceId === selectedLogsWidget);
  }, [combinedWidgetLogs, selectedLogsWidget]);

  const selectedSettingsWidgets = useMemo(() => {
    if (selectedSettingsWidget === "all") return activeWidgets;
    return activeWidgets.filter((widget) => widget.instanceId === selectedSettingsWidget);
  }, [activeWidgets, selectedSettingsWidget]);

  // ------------------------------------------------------------------
  // Load history logs from API
  // ------------------------------------------------------------------
  const loadWidgetHistoryLogs = useCallback(async () => {
    if (!user || activeWidgets.length === 0) {
      setWidgetHistoryLogs([]);
      setWidgetLogsError(null);
      return;
    }

    setIsWidgetLogsLoading(true);
    setWidgetLogsError(null);

    try {
      const widgetIds = activeWidgets.map((widget) => widget.instanceId);
      const res = await fetch(`/api/widgets/progress?widgetIds=${widgetIds.join(',')}`, { credentials: 'same-origin' });
      if (!res.ok) throw new Error('Failed to load widget logs');
      const { logs: data } = await res.json();

      const historyLogs: WidgetLogEntry[] = (data ?? []).map((row: any) => {
        const widget = activeWidgetMap.get(row.widget_instance_id);
        const target = widget?.target && widget.target > 0 ? widget.target : 1;
        const value = Number(row.value ?? 0);

        return {
          id: `history-${row.widget_instance_id}-${row.date}`,
          widgetInstanceId: row.widget_instance_id,
          widgetName: widget?.name ?? "Widget",
          message: value >= target ? "Goal reached" : "Progress logged",
          details: `${value.toLocaleString()} / ${target.toLocaleString()} ${widget?.unit || ""}`.trim(),
          occurredAt: row.created_at ?? `${row.date}T12:00:00`,
          kind: "progress",
        };
      });

      setWidgetHistoryLogs(historyLogs);
    } catch (error: any) {
      setWidgetHistoryLogs([]);
      setWidgetLogsError(error?.message || "Unable to load widget logs");
    } finally {
      setIsWidgetLogsLoading(false);
    }
  }, [activeWidgetMap, activeWidgets, user]);

  // ------------------------------------------------------------------
  // Effects
  // ------------------------------------------------------------------

  // Sync selected widget filters when widgets are removed
  useEffect(() => {
    if (selectedLogsWidget !== "all" && !activeWidgetMap.has(selectedLogsWidget)) {
      setSelectedLogsWidget("all");
    }
    if (selectedSettingsWidget !== "all" && !activeWidgetMap.has(selectedSettingsWidget)) {
      setSelectedSettingsWidget("all");
    }
  }, [activeWidgetMap, selectedLogsWidget, selectedSettingsWidget]);

  // Load history logs when the Logs tab is activated
  useEffect(() => {
    if (activeSubTab !== "Logs") return;
    void loadWidgetHistoryLogs();
  }, [activeSubTab, loadWidgetHistoryLogs]);

  // ------------------------------------------------------------------
  // Return
  // ------------------------------------------------------------------
  return {
    // Logs state
    selectedLogsWidget, setSelectedLogsWidget,
    selectedSettingsWidget, setSelectedSettingsWidget,
    isWidgetLogsLoading,
    widgetLogsError,

    // Computed
    filteredWidgetLogs,
    selectedSettingsWidgets,

    // Functions
    loadWidgetHistoryLogs,
  };
}
