"use client"

import { Settings2, Plus, LayoutDashboard } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import WidgetSelector from "@/features/widgets/components/widget-selector"
import { getIconComponent } from "@/lib/dashboard-icons"
import { getWidgetColorStyles } from "@/lib/dashboard-utils"
import type { WidgetInstance } from "@/types/widgets"

interface WidgetSettingsTabProps {
  activeWidgets: WidgetInstance[]
  selectedSettingsWidget: string
  onSelectedSettingsWidgetChange: (id: string) => void
  selectedSettingsWidgets: WidgetInstance[]
  activeBucket: string
  getBucketColor: (bucket: string) => string
  onPatchWidget: (widgetId: string, updates: Partial<WidgetInstance>) => void
  onRefreshIntegrations: () => void
  onOpenEditor: (widget: WidgetInstance) => void
  onResetProgress: (widget: WidgetInstance) => void
  onRemoveWidget: (widget: WidgetInstance) => void
  onAddWidget: () => void
}

function resolveWidgetIcon(widget: WidgetInstance): LucideIcon | null {
  if (typeof widget.icon === "string") {
    const key = widget.icon.replace(/^Lucide/, "")
    return getIconComponent(key) || getIconComponent(widget.icon)
  }
  if (typeof widget.icon === "function") {
    return widget.icon
  }
  return getIconComponent(widget.id)
}

function getDataSourceOptions(widget: WidgetInstance): string[] {
  if (widget.id === "water" || widget.id === "steps") {
    return ["manual", "fitbit", "googlefit"]
  }
  if (widget.id === "weight") {
    return ["manual", "withings"]
  }
  return ["manual"]
}

export function WidgetSettingsTab({
  activeWidgets,
  selectedSettingsWidget,
  onSelectedSettingsWidgetChange,
  selectedSettingsWidgets,
  activeBucket,
  getBucketColor,
  onPatchWidget,
  onRefreshIntegrations,
  onOpenEditor,
  onResetProgress,
  onRemoveWidget,
  onAddWidget,
}: WidgetSettingsTabProps) {
  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="section-label-sm">Widget Settings</h2>
        <WidgetSelector
          widgets={activeWidgets}
          selectedWidget={selectedSettingsWidget}
          onWidgetChange={onSelectedSettingsWidgetChange}
          showAllOption={true}
          className="w-56"
        />
      </div>

      <div className="space-y-6">
        {activeWidgets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center rounded-xl border border-dashed border-theme-neutral-300 bg-white">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-theme-brand-tint-light mb-3">
              <Settings2 className="h-6 w-6 text-theme-primary" />
            </div>
            <p className=" text-sm font-medium text-theme-text-primary">No widgets to configure</p>
            <p className=" text-xs text-theme-text-tertiary mt-1 max-w-xs">Add widgets to this bucket to customize their targets, colors, and data sources.</p>
            <button onClick={onAddWidget} className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-theme-neutral-300 bg-white px-4 py-2  text-[13px] font-medium text-theme-text-primary shadow-[0px_1px_1.5px_0.1px_rgba(22,25,36,0.05)] hover:bg-[rgba(252,250,248,0.5)] transition-colors">
              <Plus className="h-3.5 w-3.5 text-theme-primary" />
              Add Widget
            </button>
          </div>
        ) : (
          <div className="grid gap-6">
            {selectedSettingsWidgets.map((widget) => {
              const IconComponent = resolveWidgetIcon(widget)
              const sourceOptions = getDataSourceOptions(widget)
              const activeDataSource = widget.dataSource || "manual"
              const selectedDataSource = sourceOptions.includes(activeDataSource)
                ? activeDataSource
                : sourceOptions[0]

              return (
                <div key={widget.instanceId} className="bg-white rounded-xl border border-theme-neutral-300 shadow-warm-sm overflow-hidden">
                  <div className="flex items-center gap-3 px-5 py-4 border-b border-[rgba(219,214,207,0.7)]">
                    {(() => {
                      const settingsBucketHex = getBucketColor(activeBucket)
                      const sStyles = getWidgetColorStyles(settingsBucketHex)
                      return (
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: sStyles.iconTint }}>
                          {IconComponent ? (
                            <IconComponent className="h-5 w-5" style={{ color: sStyles.text }} />
                          ) : (
                            <LayoutDashboard className="h-5 w-5" style={{ color: sStyles.text }} />
                          )}
                        </div>
                      )
                    })()}
                    <div>
                      <h3 className=" text-sm tracking-[0.6px] uppercase text-theme-secondary">{widget.name}</h3>
                      <p className=" text-[11px] text-theme-text-tertiary">{widget.id}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-5">
                    <div>
                      <label className="block  text-xs font-medium text-theme-text-tertiary uppercase tracking-wide mb-2">Daily target</label>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={widget.target || 1}
                        onChange={(event) => {
                          const parsed = Number.parseInt(event.target.value, 10)
                          if (Number.isNaN(parsed)) return
                          onPatchWidget(widget.instanceId, {
                            target: Math.max(1, parsed),
                          })
                        }}
                        className="w-full px-3 py-2 border border-theme-neutral-300 rounded-lg bg-white  text-[13px] text-theme-text-primary focus:outline-none focus:ring-2 focus:ring-theme-primary/30 focus:border-theme-primary transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block  text-xs font-medium text-theme-text-tertiary uppercase tracking-wide mb-2">Data source</label>
                      <select
                        value={selectedDataSource}
                        onChange={(event) => {
                          onPatchWidget(widget.instanceId, {
                            dataSource: event.target.value,
                          })
                          onRefreshIntegrations()
                        }}
                        className="w-full rounded-lg border border-theme-neutral-300 bg-white px-3 py-2  text-[13px] text-theme-text-primary capitalize focus:outline-none focus:ring-2 focus:ring-theme-primary/30 focus:border-theme-primary transition-colors"
                      >
                        {sourceOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block  text-xs font-medium text-theme-text-tertiary uppercase tracking-wide mb-2">Created</label>
                      <span className="text-sm text-theme-text-subtle">
                        {widget.createdAt
                          ? new Date(widget.createdAt).toLocaleDateString()
                          : "Unknown"}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 border-t border-[rgba(219,214,207,0.7)] px-5 py-4">
                    <button
                      onClick={() => onOpenEditor(widget)}
                      className="rounded-lg bg-theme-primary px-4 py-2  text-[13px] font-medium text-white shadow-[0px_1px_1.5px_0.1px_rgba(22,25,36,0.05)] hover:bg-theme-primary-600 transition-colors"
                    >
                      Open Editor
                    </button>
                    <button
                      onClick={() => onResetProgress(widget)}
                      className="rounded-lg border border-theme-neutral-300 px-4 py-2  text-[13px] font-medium text-theme-text-primary shadow-[0px_1px_1.5px_0.1px_rgba(22,25,36,0.05)] hover:bg-[rgba(252,250,248,0.5)] transition-colors"
                    >
                      Reset Today
                    </button>
                    <button
                      onClick={() => onRemoveWidget(widget)}
                      className="rounded-lg border border-red-200 px-4 py-2  text-[13px] font-medium text-red-600 hover:bg-red-50 transition-colors ml-auto"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
