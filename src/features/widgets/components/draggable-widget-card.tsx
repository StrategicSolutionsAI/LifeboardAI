"use client";

import React from "react";
import { format, parseISO } from "date-fns";
import {
  X,
  Settings as SettingsIcon,
  ListChecks,
  GripVertical,
  Check,
} from "lucide-react";
import type { WidgetInstance } from "@/types/widgets";
import type { ProgressEntry } from "@/features/dashboard/types";
import {
  getIconComponent,
  getWidgetColorStyles,
  todayStrGlobal,
} from "@/lib/dashboard-utils";
import { Draggable } from "@hello-pangea/dnd";
import { motion, AnimatePresence } from "framer-motion";
import {
  WIDGET_CARD_REGISTRY,
  renderDefaultProgressBar,
} from "../widget-card-registry";

interface DraggableWidgetCardProps {
  widget: WidgetInstance;
  index: number;
  activeBucket: string;
  bucketHex: string;
  progressEntry: ProgressEntry | undefined;
  /** Pre-resolved linked task data — avoids O(tasks) .find() per widget per render */
  linkedTaskData: { completed?: boolean; content?: string; dueDate?: string } | null;
  /** Pre-resolved integration value for this widget (avoids passing full map) */
  integrationValue: number | undefined;
  onCardClick: (widget: WidgetInstance) => void;
  onEditSettings: (widget: WidgetInstance) => void;
  onConvertToTask: (widget: WidgetInstance, bucket: string) => void;
  onRemove: (widget: WidgetInstance) => void;
  onIncrementProgress: (widget: WidgetInstance) => void;
  onToggleTaskCompletion: (taskId: string) => void;
  onHabitToggle: (widget: WidgetInstance, completed: boolean) => void;
}

export const DraggableWidgetCard = React.memo(function DraggableWidgetCard({
  widget: w,
  index,
  activeBucket,
  bucketHex,
  progressEntry,
  linkedTaskData,
  integrationValue,
  onCardClick,
  onEditSettings,
  onConvertToTask,
  onRemove,
  onIncrementProgress,
  onToggleTaskCompletion,
  onHabitToggle,
}: DraggableWidgetCardProps) {
  // Linked task resolution — uses pre-computed data instead of allTasks.find()
  const isLinkedTask = Boolean(w.linkedTaskId);
  const linkedTaskCompleted = Boolean(linkedTaskData?.completed);
  const linkedTaskContent =
    linkedTaskData?.content ?? w.linkedTaskTitle ?? w.name;
  const linkedTaskDueDisplay = (() => {
    const linkedTaskDueRaw = linkedTaskData?.dueDate ?? null;
    if (!linkedTaskDueRaw) return null;
    try {
      const parsed =
        linkedTaskDueRaw.length === 10
          ? parseISO(`${linkedTaskDueRaw}T00:00:00`)
          : parseISO(linkedTaskDueRaw);
      return format(parsed, "MMM d");
    } catch {
      return null;
    }
  })();

  // Today's progress value
  let todayVal = 0;
  if (isLinkedTask) {
    todayVal = linkedTaskCompleted ? (w.target || 1) : 0;
  } else if (integrationValue !== undefined) {
    todayVal = integrationValue;
  } else if (w.id === "water" && w.waterData?.entries?.length) {
    const today = todayStrGlobal;
    todayVal = w.waterData.entries
      .filter((e: { date: string; amount: number }) => e.date === today)
      .reduce((sum: number, e: { date: string; amount: number }) => sum + e.amount, 0);
  } else if (w.id === "steps" && w.stepsData?.entries?.length) {
    const today = todayStrGlobal;
    todayVal = w.stepsData.entries
      .filter((e: { date: string; steps: number }) => e.date === today)
      .reduce((sum: number, e: { date: string; steps: number }) => sum + e.steps, 0);
  } else if (w.id === "heartrate" && w.heartRateData?.entries?.length) {
    const today = todayStrGlobal;
    const todayReadings = w.heartRateData.entries.filter((e: { date: string }) => e.date === today);
    todayVal = todayReadings.length > 0 ? 1 : 0; // target is 1 reading per day
  } else if (w.id === "caffeine" && w.caffeineData?.entries?.length) {
    const today = todayStrGlobal;
    todayVal = w.caffeineData.entries
      .filter((e: { date: string; cups: number }) => e.date === today)
      .reduce((sum: number, e: { date: string; cups: number }) => sum + e.cups, 0);
  } else if (w.id === "cycle_tracking" && w.cycleData?.entries?.length) {
    todayVal = w.cycleData.entries.some((e) => e.date === todayStrGlobal) ? 1 : 0;
  } else {
    todayVal = progressEntry && progressEntry.date === todayStrGlobal ? progressEntry.value : 0;
  }

  const normalizedTarget = w.target && w.target > 0 ? w.target : 1;
  const pct = isLinkedTask
    ? linkedTaskCompleted
      ? 100
      : 0
    : Math.min(100, Math.round((todayVal / normalizedTarget) * 100));
  const goalMet = isLinkedTask ? linkedTaskCompleted : pct >= 100;

  const wStyles = getWidgetColorStyles(bucketHex);

  // Show "+" increment button for standard progress widgets
  const cardEntry = WIDGET_CARD_REGISTRY[w.id];
  const showIncrement =
    cardEntry?.showIncrement !== false && !isLinkedTask;

  return (
    <Draggable draggableId={w.instanceId} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={`widget-card-size rounded-xl border border-theme-neutral-300 bg-theme-surface-raised p-4 shadow-warm-sm hover:shadow-warm-lg hover:scale-[1.02] hover:-translate-y-0.5 relative group cursor-pointer transition-all duration-200 ease-out min-w-0 ${
            snapshot.isDragging
              ? "opacity-60 shadow-warm-lg border-theme-primary/40 z-50"
              : ""
          }`}
          style={{
            ...(goalMet ? { backgroundColor: wStyles.tint } : undefined),
            ...provided.draggableProps.style,
          }}
          onClick={() => onCardClick(w)}
        >
          {/* Goal completion badge */}
          <AnimatePresence>
            {goalMet && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 25 }}
                className="absolute top-2 right-2 z-20 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center shadow-sm"
              >
                <Check className="h-3 w-3 text-white" strokeWidth={3} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Drag handle */}
          <div
            {...provided.dragHandleProps}
            className="absolute top-1.5 left-1.5 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-30 drag-handle-touch transition-opacity z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical size={14} className="text-theme-text-secondary" />
          </div>

          {/* Action buttons (top-right) */}
          <div className={`flex absolute top-1 right-1 gap-1 opacity-0 group-hover:opacity-100 transition-opacity ${goalMet ? "right-8" : ""}`}>
            {w.id === "nutrition" && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEditSettings(w);
                }}
                className="rounded-full bg-theme-surface-alt hover:bg-theme-hover p-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-theme-primary/40 transition"
                aria-label="Edit widget settings"
                title="Edit settings"
              >
                <SettingsIcon className="h-3 w-3 text-theme-text-secondary" />
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onConvertToTask(w, activeBucket);
              }}
              className={`rounded-full p-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-theme-primary/40 transition ${
                w.linkedTaskId
                  ? "bg-theme-primary hover:bg-theme-primary-600"
                  : "bg-theme-brand-tint hover:bg-theme-primary/20"
              }`}
              aria-label={
                w.linkedTaskId ? "Remove from Tasks" : "Show in Tasks"
              }
              title={
                w.linkedTaskId
                  ? "Remove from Tasks tab"
                  : "Show in Tasks tab"
              }
            >
              <ListChecks
                className={`h-3 w-3 ${
                  w.linkedTaskId ? "text-white" : "text-theme-primary"
                }`}
              />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove(w);
              }}
              className="rounded-full bg-theme-surface-alt hover:bg-red-100 p-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-red-500 transition"
              aria-label="Delete widget"
              title="Delete widget"
            >
              <X className="h-3 w-3 text-theme-text-tertiary hover:text-red-600" />
            </button>
          </div>

          {/* Icon + Title */}
          <div className="flex items-center gap-2">
            {(() => {
              let IconComponent: any = null;
              if (typeof w.icon === "string") {
                const key = w.icon.replace(/^Lucide/, "");
                IconComponent =
                  getIconComponent(key) || getIconComponent(w.icon);
              } else if (typeof w.icon === "function") {
                IconComponent = w.icon;
              }
              if (!IconComponent || typeof IconComponent !== "function") {
                IconComponent = getIconComponent(w.id);
              }
              if (!IconComponent)
                return (
                  <div className="h-5 w-5 bg-theme-neutral-300 rounded" />
                );
              return (
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: wStyles.iconTint }}
                >
                  <IconComponent
                    className="h-5 w-5"
                    style={{ color: wStyles.text }}
                  />
                </div>
              );
            })()}
            <span className="text-sm font-medium truncate">
              {cardEntry?.getTitle?.(w) || w.name}
            </span>
          </div>

          {/* Linked task section */}
          {isLinkedTask && (
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm text-theme-text-body">
                  <ListChecks className="h-4 w-4 text-theme-primary" />
                  <span className="truncate">{linkedTaskContent}</span>
                </div>
                <button
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (!w.linkedTaskId) return;
                    onToggleTaskCompletion(w.linkedTaskId);
                  }}
                  disabled={!linkedTaskData}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    linkedTaskCompleted
                      ? ""
                      : "border-theme-neutral-300 text-theme-text-subtle hover:bg-theme-brand-tint-light"
                  } ${!linkedTaskData ? "opacity-60 cursor-not-allowed" : ""}`}
                  style={
                    linkedTaskCompleted
                      ? {
                          borderColor: wStyles.solid,
                          backgroundColor: wStyles.tint,
                        }
                      : undefined
                  }
                >
                  {linkedTaskCompleted ? "Undo" : "Mark done"}
                </button>
              </div>
              {linkedTaskDueDisplay ? (
                <p className="text-xs text-theme-text-tertiary">
                  Due {linkedTaskDueDisplay}
                </p>
              ) : null}
            </div>
          )}

          {/* Widget-specific body content */}
          {(() => {
            const bodyProps = { widget: w, styles: wStyles, todayVal, pct, progressEntry, onIncrementProgress, onHabitToggle };
            return cardEntry?.renderBody
              ? cardEntry.renderBody(bodyProps)
              : renderDefaultProgressBar(bodyProps);
          })()}

          {/* "+" increment button */}
          {showIncrement && (
            <button
              aria-label="Add one"
              onClick={(e) => {
                e.stopPropagation();
                onIncrementProgress(w);
              }}
              className="absolute bottom-2 right-2 text-xl font-bold leading-none hover:scale-110 transition-transform text-theme-text-primary"
            >
              +
            </button>
          )}
        </div>
      )}
    </Draggable>
  );
});

/** Shimmer skeleton placeholder shown while widgets are loading */
export function WidgetCardSkeleton({ index }: { index: number }) {
  return (
    <div
      className="widget-card-size rounded-xl border border-theme-neutral-300 bg-theme-surface-raised p-4 min-w-0"
      style={{ animationDelay: `${index * 100}ms` }}
    >
      {/* Icon + title row */}
      <div className="flex items-center gap-2 mb-3">
        <div className="h-8 w-8 rounded-lg animate-shimmer-loading" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3 w-3/5 rounded animate-shimmer-loading" />
          <div className="h-2 w-2/5 rounded animate-shimmer-loading" />
        </div>
      </div>
      {/* Value area */}
      <div className="space-y-2 mt-4">
        <div className="h-6 w-1/3 rounded animate-shimmer-loading" />
        <div className="h-2 w-full rounded-full animate-shimmer-loading" />
      </div>
    </div>
  );
}
