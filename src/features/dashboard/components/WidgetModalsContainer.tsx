"use client"

import React, { useCallback, useRef } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import type { WidgetInstance } from '@/types/widgets'
import { WIDGET_MODAL_REGISTRY, computeProgress } from '@/features/widgets/widget-modal-registry'
import type { ProgressEntry } from '@/features/dashboard/types'

// ── Types ────────────────────────────────────────────────────────────────

interface WidgetModalsContainerProps {
  /** Which modal is currently open (widget ID), or null */
  openModalId: string | null
  onClose: () => void
  /** The active widget instance (for stateful modals) */
  activeWidget: WidgetInstance | null
  setActiveWidget: React.Dispatch<React.SetStateAction<WidgetInstance | null>>
  /** Callback when a widget's onUpdate fires */
  onWidgetUpdate: (widget: WidgetInstance, updates: Partial<WidgetInstance>) => void
  /** Progress entry for the active widget */
  progressEntry: ProgressEntry | undefined
  /** Callback for incrementing progress */
  onIncrementProgress: (widget: WidgetInstance) => void
}

// ── Component ────────────────────────────────────────────────────────────

export function WidgetModalsContainer({
  openModalId,
  onClose,
  activeWidget,
  setActiveWidget,
  onWidgetUpdate,
  progressEntry,
  onIncrementProgress,
}: WidgetModalsContainerProps) {
  const entry = openModalId ? WIDGET_MODAL_REGISTRY[openModalId] : null
  const entryRef = useRef(entry)
  entryRef.current = entry

  /** Shared onUpdate handler for stateful modals */
  const makeOnUpdate = useCallback(
    (widget: WidgetInstance) => (updates: Partial<WidgetInstance>) => {
      const merged = { ...widget, ...updates }
      setActiveWidget(merged)
      onWidgetUpdate(widget, updates)
    },
    [setActiveWidget, onWidgetUpdate],
  )

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        onClose()
        entryRef.current?.onCloseEffect?.()
      }
    },
    [onClose],
  )

  return (
    <Sheet open={!!entry} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="w-full sm:w-[600px] md:w-[700px] overflow-y-auto">
        {entry && (
          <>
            <SheetHeader>
              <SheetTitle className="text-theme-text-primary">
                {entry.title}
              </SheetTitle>
            </SheetHeader>
            <div className={entry.contentMargin || 'mt-2'}>
              {entry.render({
                widget: activeWidget,
                onUpdate: activeWidget ? makeOnUpdate(activeWidget) : () => {},
                progress: activeWidget
                  ? computeProgress(progressEntry)
                  : { value: 0, streak: 0, isToday: false },
                onComplete: activeWidget
                  ? () => onIncrementProgress(activeWidget)
                  : () => {},
                onClose,
              })}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
