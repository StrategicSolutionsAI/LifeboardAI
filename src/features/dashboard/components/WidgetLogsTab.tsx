"use client"

import { RotateCw, ClipboardList, Plus } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import WidgetSelector from "@/features/widgets/components/widget-selector"
import { LOG_KIND_DOT_CLASS, type WidgetLogEntry } from "@/lib/dashboard-utils"
import type { WidgetInstance } from "@/types/widgets"

interface WidgetLogsTabProps {
  activeWidgets: WidgetInstance[]
  filteredWidgetLogs: WidgetLogEntry[]
  isLoading: boolean
  error: string | null
  selectedWidget: string
  onSelectedWidgetChange: (id: string) => void
  onRefresh: () => void
  onAddWidget: () => void
}

function formatLogTimestamp(timestamp: string) {
  const parsed = Date.parse(timestamp)
  if (Number.isNaN(parsed)) return "Unknown"
  return formatDistanceToNow(parsed, { addSuffix: true })
}

export function WidgetLogsTab({
  activeWidgets,
  filteredWidgetLogs,
  isLoading,
  error,
  selectedWidget,
  onSelectedWidgetChange,
  onRefresh,
  onAddWidget,
}: WidgetLogsTabProps) {
  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="section-label-sm">Widget Logs</h2>
          <p className=" text-[13px] text-theme-text-tertiary mt-1">
            Recent syncs, entries, and progress updates for this bucket.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            disabled={isLoading || activeWidgets.length === 0}
            className="inline-flex h-9 items-center justify-center rounded-md border border-theme-neutral-300 px-3 text-sm text-theme-text-subtle transition hover:bg-theme-surface-alt disabled:cursor-not-allowed disabled:opacity-60"
            title="Refresh widget logs"
            aria-label="Refresh widget logs"
          >
            <RotateCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
          <WidgetSelector
            widgets={activeWidgets}
            selectedWidget={selectedWidget}
            onWidgetChange={onSelectedWidgetChange}
            showAllOption={true}
            className="w-56"
          />
        </div>
      </div>

      <div className="space-y-4">
        {error ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Unable to load full history. Showing local activity only.
          </div>
        ) : null}
        {activeWidgets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center rounded-xl border border-dashed border-theme-neutral-300 bg-white">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-theme-brand-tint-light mb-3">
              <ClipboardList className="h-6 w-6 text-theme-primary" />
            </div>
            <p className=" text-sm font-medium text-theme-text-primary">No activity yet</p>
            <p className=" text-xs text-theme-text-tertiary mt-1 max-w-xs">Add widgets to this bucket to start tracking activity and see your logs here.</p>
            <button onClick={onAddWidget} className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-theme-neutral-300 bg-white px-4 py-2  text-[13px] font-medium text-theme-text-primary shadow-[0px_1px_1.5px_0.1px_rgba(22,25,36,0.05)] hover:bg-[rgba(252,250,248,0.5)] transition-colors">
              <Plus className="h-3.5 w-3.5 text-theme-primary" />
              Add Widget
            </button>
          </div>
        ) : filteredWidgetLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 px-4 text-center rounded-xl border border-dashed border-theme-neutral-300 bg-white">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-theme-brand-tint-light mb-3">
              <ClipboardList className="h-5 w-5 text-theme-primary" />
            </div>
            <p className=" text-[13px] font-medium text-theme-text-primary">No activity yet</p>
            <p className=" text-xs text-theme-text-tertiary mt-1">Track progress or update a widget to start building logs.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-theme-neutral-300 shadow-warm-sm overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-[rgba(219,214,207,0.7)]">
              <ClipboardList className="h-4 w-4 text-theme-primary" />
              <h3 className=" text-sm tracking-[0.6px] uppercase text-theme-secondary">
                {selectedWidget === 'all' ? 'All Widget Activity' :
                  `${activeWidgets.find(w => w.instanceId === selectedWidget)?.name || 'Widget'} Activity`}
              </h3>
              <span className=" text-[11px] text-theme-text-tertiary">
                ({filteredWidgetLogs.length})
              </span>
            </div>
            <div className="max-h-[480px] overflow-y-auto">
              {filteredWidgetLogs.slice(0, 80).map((entry) => (
                <div key={entry.id} className="flex items-start gap-4 px-5 py-3 border-b border-theme-neutral-300/50 last:border-b-0 hover:bg-[rgba(252,250,248,0.5)] transition-colors">
                  <div className={`mt-1.5 h-2 w-2 rounded-full ${LOG_KIND_DOT_CLASS[entry.kind]}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-theme-text-primary">{entry.message}</p>
                    <p className="truncate text-xs text-theme-text-tertiary">
                      {entry.widgetName}
                      {entry.details ? ` • ${entry.details}` : ""}
                    </p>
                  </div>
                  <p className="whitespace-nowrap text-xs text-theme-text-tertiary/70">
                    {formatLogTimestamp(entry.occurredAt)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
