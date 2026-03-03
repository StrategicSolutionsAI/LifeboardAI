"use client"

import React from "react"
import { GripVertical, Check, X, Pencil } from "lucide-react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"

interface ManageTabsSheetProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  newBucket: string
  onNewBucketChange: (value: string) => void
  onAddBucket: () => void
  buckets: string[]
  suggestedToShow: string[]
  onAddBucketQuick: (name: string) => void
  activeBucket: string
  editingBucketName: string | null
  editingBucketNewName: string
  onEditingBucketNewNameChange: (value: string) => void
  onSaveEditBucket: () => void
  onCancelEditBucket: () => void
  onStartEditBucket: (name: string) => void
  onRemoveBucket: (name: string) => void
  onBucketColorChange: (bucket: string, color: string) => void
  bucketColors: Record<string, string>
  getSuggestedColorForBucket: (name: string) => string
  getBucketColor: (bucket: string) => string
  draggedBucketIndex: number | null
  onBucketDragStart: (index: number) => void
  onBucketDragOver: (e: React.DragEvent, index: number) => void
  onBucketDragEnd: () => void
}

export function ManageTabsSheet({
  isOpen,
  onOpenChange,
  newBucket,
  onNewBucketChange,
  onAddBucket,
  buckets,
  suggestedToShow,
  onAddBucketQuick,
  activeBucket,
  editingBucketName,
  editingBucketNewName,
  onEditingBucketNewNameChange,
  onSaveEditBucket,
  onCancelEditBucket,
  onStartEditBucket,
  onRemoveBucket,
  onBucketColorChange,
  bucketColors,
  getSuggestedColorForBucket,
  getBucketColor,
  draggedBucketIndex,
  onBucketDragStart,
  onBucketDragOver,
  onBucketDragEnd,
}: ManageTabsSheetProps) {
  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:w-[520px] md:w-[560px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-theme-text-primary">Manage Tabs</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-theme-text-body mb-1">Add a new tab</label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Tab name (e.g., Side Projects)"
                value={newBucket}
                onChange={(e) => onNewBucketChange(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && onAddBucket()}
                className="flex-1 rounded-lg border border-theme-neutral-300 px-3 py-2 text-sm focus:border-theme-primary focus:ring-1 focus:ring-theme-primary/30 focus:outline-none transition-colors"
              />
              <button
                onClick={onAddBucket}
                disabled={!newBucket.trim() || buckets.includes(newBucket.trim())}
                className="px-3 py-2 text-sm rounded-lg bg-theme-primary text-white hover:bg-theme-primary-600 disabled:opacity-50 transition-colors"
              >
                Add
              </button>
            </div>
          </div>

          <div>
            <div className="text-sm font-medium text-theme-text-body mb-2">Suggested tabs</div>
            <div className="flex flex-wrap gap-2">
              {suggestedToShow.length > 0 ? (
                suggestedToShow.map((name) => (
                  <button
                    key={name}
                    onClick={() => onAddBucketQuick(name)}
                    className="px-3 py-1.5 rounded-full border border-theme-neutral-300 text-sm hover:bg-theme-surface-alt active:bg-theme-brand-tint-light"
                    aria-label={`Add ${name} tab`}
                  >
                    {name}
                  </button>
                ))
              ) : (
                <div className="text-xs text-theme-text-tertiary">All suggested tabs are already added</div>
              )}
            </div>
          </div>

          <div>
            <div className="text-sm font-medium text-theme-text-body mb-2">Existing tabs</div>
            <ul className="divide-y divide-theme-neutral-300 rounded-md border border-theme-neutral-300 overflow-hidden">
              {buckets.map((b, index) => (
                <li
                  key={b}
                  className={`px-3 py-3 bg-white ${draggedBucketIndex === index ? 'opacity-50' : ''}`}
                  draggable={editingBucketName !== b}
                  onDragStart={() => onBucketDragStart(index)}
                  onDragOver={(e) => onBucketDragOver(e, index)}
                  onDragEnd={onBucketDragEnd}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {editingBucketName !== b && (
                        <GripVertical className="w-4 h-4 text-theme-text-tertiary/70 cursor-grab active:cursor-grabbing" />
                      )}
                      <span
                        className="inline-block w-4 h-4 rounded-full border border-theme-neutral-300 flex-shrink-0"
                        style={{ backgroundColor: getBucketColor(b) }}
                        aria-hidden
                      />
                      {editingBucketName === b ? (
                        <input
                          type="text"
                          value={editingBucketNewName}
                          onChange={(e) => onEditingBucketNewNameChange(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') onSaveEditBucket()
                            if (e.key === 'Escape') onCancelEditBucket()
                          }}
                          className="flex-1 text-sm border border-theme-primary rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-theme-primary/30"
                          autoFocus
                        />
                      ) : (
                        <span className={`truncate text-sm ${b === activeBucket ? 'font-semibold text-theme-primary' : 'text-theme-text-body'}`}>{b}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {editingBucketName === b ? (
                        <>
                          <button
                            onClick={onSaveEditBucket}
                            className="text-xs p-1.5 rounded-md border border-green-200 text-green-600 hover:bg-green-50"
                            title="Save"
                            aria-label="Save bucket name"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={onCancelEditBucket}
                            className="text-xs p-1.5 rounded-md border border-theme-neutral-300 text-theme-text-subtle hover:bg-theme-surface-alt"
                            title="Cancel"
                            aria-label="Cancel bucket rename"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => onStartEditBucket(b)}
                            className="text-xs p-1.5 rounded-lg border border-theme-neutral-300 text-theme-primary hover:bg-theme-brand-tint-subtle"
                            title="Edit name"
                            aria-label="Edit bucket name"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onRemoveBucket(b)}
                            className="text-xs px-2 py-1 rounded-md border border-red-200 text-red-600 hover:bg-red-50"
                          >
                            Remove
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  {/* Custom color picker only (auto-assigned initially) */}
                  <div className="mt-3 flex items-center justify-end gap-3">
                    <label className="flex items-center gap-2 text-xs text-theme-text-tertiary">
                      <span>Custom</span>
                      <input
                        type="color"
                        value={(bucketColors[b] || getSuggestedColorForBucket(b)) as string}
                        onChange={(e) => onBucketColorChange(b, e.target.value)}
                        className="h-6 w-6 p-0 border rounded cursor-pointer"
                        aria-label={`Choose custom color for ${b}`}
                      />
                    </label>
                  </div>
                </li>
              ))}
              {buckets.length === 0 && (
                <li className="px-3 py-6 text-sm text-theme-text-tertiary text-center">No tabs yet</li>
              )}
            </ul>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
