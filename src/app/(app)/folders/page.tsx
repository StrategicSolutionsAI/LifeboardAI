"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Check, Plus, X } from "lucide-react"
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { CSSFolder } from "@/features/folders/components/css-folder"
import { useBuckets } from "@/hooks/use-buckets"
import { getBucketColorSync, BUCKET_COLOR_PALETTE } from "@/lib/bucket-colors"
import { getUserPreferencesClient, updateUserPreferenceFields } from "@/lib/user-preferences"

const COLOR_PALETTE = [
  "#B1916A", "#6B8AF7", "#48B882", "#D07AA4", "#4AADE0", "#C4A44E",
  "#8B7FD4", "#E28A5D", "#5E9B8C", "#bb9e7b", "#314158", "#8e99a8",
] as const

const SUGGESTED_COLORS: Record<string, string> = {
  health: "#48B882",
  wellness: "#5E9B8C",
  family: "#4AADE0",
  social: "#D07AA4",
  work: "#B1916A",
  personal: "#8B7FD4",
  projects: "#6B8AF7",
  home: "#5E9B8C",
  finance: "#C4A44E",
  fitness: "#E28A5D",
}

function suggestColor(name: string, existingColors: Record<string, string>): string {
  const key = name.toLowerCase().trim()
  if (SUGGESTED_COLORS[key]) return SUGGESTED_COLORS[key]
  const usedSet = new Set(Object.values(existingColors))
  const available = BUCKET_COLOR_PALETTE.find((c) => !usedSet.has(c))
  return available ?? "#B1916A"
}

async function saveBucketColors(
  updatedBuckets: string[] | null,
  nextColors: Record<string, string>,
) {
  if (typeof window !== "undefined") {
    localStorage.setItem("bucket_colors", JSON.stringify(nextColors))
    if (updatedBuckets) {
      localStorage.setItem("life_buckets", JSON.stringify(updatedBuckets))
      localStorage.setItem("life_buckets_saved_at", String(Date.now()))
      window.dispatchEvent(new CustomEvent("lifeBucketsChanged"))
    }
    window.dispatchEvent(new CustomEvent("bucketColorsChanged"))
  }

  try {
    const fields: Record<string, unknown> = { bucket_colors: nextColors }
    if (updatedBuckets) fields.life_buckets = updatedBuckets
    const ok = await updateUserPreferenceFields(fields as Parameters<typeof updateUserPreferenceFields>[0])
    if (ok && typeof window !== "undefined") {
      localStorage.setItem("life_buckets_synced_at", String(Date.now()))
    }
  } catch (err) {
    console.error("Failed to save to Supabase:", err)
  }
}

/* ── Sortable folder item ── */
function SortableFolder({
  name,
  color,
  empty,
  isEditing,
  onToggleEdit,
  onChangeColor,
  bucketColors,
}: {
  name: string
  color: string
  empty: boolean
  isEditing: boolean
  onToggleEdit: () => void
  onChangeColor: (color: string) => void
  bucketColors: Record<string, string>
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: name })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : undefined,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="flex flex-col items-center cursor-grab active:cursor-grabbing"
    >
      <CSSFolder
        label={name}
        color={color}
        empty={empty}
        onClick={onToggleEdit}
      />
      {isEditing && !isDragging && (
        <div className="flex items-center gap-1.5 mt-3 p-2 rounded-xl border border-theme-neutral-300/80 bg-white shadow-warm-sm">
          {COLOR_PALETTE.map((c) => {
            const current = getBucketColorSync(name, bucketColors)
            const isActive = current.toLowerCase() === c.toLowerCase()
            return (
              <button
                key={c}
                type="button"
                onClick={() => onChangeColor(c)}
                className="relative w-5 h-5 rounded-full border-2 transition-transform hover:scale-110"
                style={{
                  backgroundColor: c,
                  borderColor: isActive ? "white" : "transparent",
                  boxShadow: isActive ? `0 0 0 2px ${c}` : "none",
                }}
                aria-label={`Set ${name} color to ${c}`}
              >
                {isActive && (
                  <Check className="absolute inset-0 m-auto w-3 h-3 text-white drop-shadow-sm" />
                )}
              </button>
            )
          })}
          <label
            className="relative inline-flex items-center gap-1 cursor-pointer rounded-md border border-theme-neutral-300 px-1.5 h-5 text-[10px] font-medium text-theme-text-secondary hover:bg-theme-surface-alt transition-colors"
            title="Pick custom color"
          >
            <span
              className="w-3 h-3 rounded-full shrink-0 border border-theme-neutral-300"
              style={{ backgroundColor: getBucketColorSync(name, bucketColors) }}
            />
            Custom
            <input
              type="color"
              value={getBucketColorSync(name, bucketColors)}
              onChange={(e) => onChangeColor(e.target.value)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              aria-label={`Custom color for ${name}`}
            />
          </label>
        </div>
      )}
    </div>
  )
}

/* ── Main page ── */
export default function FoldersPage() {
  const { buckets, loading } = useBuckets()
  const [localBuckets, setLocalBuckets] = useState<string[]>(buckets)
  const [bucketColors, setBucketColors] = useState<Record<string, string>>(() => {
    if (typeof window === "undefined") return {}
    try {
      return JSON.parse(localStorage.getItem("bucket_colors") || "{}")
    } catch {
      return {}
    }
  })
  const [showModal, setShowModal] = useState(false)
  const [newName, setNewName] = useState("")
  const [selectedColor, setSelectedColor] = useState<string>(COLOR_PALETTE[0])
  const [colorsLoaded, setColorsLoaded] = useState<boolean>(() => {
    if (typeof window === "undefined") return false
    try {
      return localStorage.getItem("bucket_colors") !== null
    } catch {
      return false
    }
  })
  const [editingFolder, setEditingFolder] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Track which buckets have content (tasks or widgets)
  const [taskCountByBucket, setTaskCountByBucket] = useState<Record<string, number>>({})
  const [widgetsByBucket, setWidgetsByBucket] = useState<Record<string, unknown[]>>({})

  // Require 8px movement before activating drag — prevents accidental drags on click
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  // Sync local order when buckets load from hook
  useEffect(() => {
    if (buckets.length > 0) setLocalBuckets(buckets)
  }, [buckets])

  useEffect(() => {
    getUserPreferencesClient().then((prefs) => {
      setBucketColors(prefs?.bucket_colors || {})
      setWidgetsByBucket(prefs?.widgets_by_bucket || {})
      setColorsLoaded(true)
    })
  }, [])

  // Fetch task counts per bucket
  useEffect(() => {
    fetch("/api/tasks?all=true", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : []))
      .then((json) => {
        const tasks: { bucket?: string; completed?: boolean }[] = Array.isArray(json) ? json : json.tasks ?? []
        const counts: Record<string, number> = {}
        for (const t of tasks) {
          if (!t.completed && t.bucket) {
            counts[t.bucket] = (counts[t.bucket] || 0) + 1
          }
        }
        setTaskCountByBucket(counts)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (showModal) {
      const t = setTimeout(() => inputRef.current?.focus(), 50)
      return () => clearTimeout(t)
    }
  }, [showModal])

  const openAddMode = () => {
    setNewName("")
    setSelectedColor(suggestColor("", bucketColors))
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setNewName("")
  }

  const handleAdd = async () => {
    const name = newName.trim()
    if (!name || localBuckets.includes(name)) return

    const updated = [...localBuckets, name]
    const nextColors = { ...bucketColors, [name]: selectedColor }

    setLocalBuckets(updated)
    setBucketColors(nextColors)
    closeModal()

    await saveBucketColors(updated, nextColors)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    setEditingFolder(null)
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = localBuckets.indexOf(active.id as string)
    const newIndex = localBuckets.indexOf(over.id as string)
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = Array.from(localBuckets)
    const [moved] = reordered.splice(oldIndex, 1)
    reordered.splice(newIndex, 0, moved)

    setLocalBuckets(reordered)
    await saveBucketColors(reordered, bucketColors)
  }

  const handleChangeColor = async (bucket: string, color: string) => {
    const nextColors = { ...bucketColors, [bucket]: color }
    setBucketColors(nextColors)
    setEditingFolder(null)
    await saveBucketColors(null, nextColors)
  }

  const isBucketEmpty = useCallback((name: string) => {
    const taskCount = taskCountByBucket[name] || 0
    const widgetCount = (widgetsByBucket[name] || []).length
    return taskCount === 0 && widgetCount === 0
  }, [taskCountByBucket, widgetsByBucket])

  const isDuplicate = localBuckets.includes(newName.trim())
  const canAdd = newName.trim().length > 0 && !isDuplicate

  return (
    <div className="flex w-full flex-col pb-24">
      <div className="flex items-center -mt-12 mb-8">
        <button
          type="button"
          onClick={openAddMode}
          className="ml-auto shrink-0 inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-theme-primary text-white text-[13px] font-medium hover:bg-theme-primary-600 transition-colors shadow-warm-sm"
        >
          <Plus size={15} />
          <span className="hidden sm:inline">Add Folder</span>
        </button>
      </div>

      {/* Add Folder Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal()
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Add Folder"
            className="w-full max-w-sm rounded-2xl border border-theme-neutral-300 bg-white p-6 shadow-xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-theme-text-primary">New Folder</h3>
              <button
                type="button"
                onClick={closeModal}
                className="p-1.5 rounded-lg text-theme-text-tertiary hover:bg-theme-surface-alt transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Name input */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-theme-text-body mb-1.5">
                Name
              </label>
              <input
                ref={inputRef}
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && canAdd) handleAdd()
                  if (e.key === "Escape") closeModal()
                }}
                placeholder="e.g. Side Projects"
                className="w-full h-10 px-3 rounded-lg border border-theme-neutral-300 bg-white text-sm text-theme-text-primary placeholder:text-theme-text-tertiary focus:outline-none focus:ring-2 focus:ring-theme-primary/30 focus:border-theme-primary transition-colors"
              />
              {isDuplicate && newName.trim() && (
                <p className="mt-1.5 text-xs text-red-500">A folder with this name already exists</p>
              )}
            </div>

            {/* Preview */}
            <div className="flex justify-center mb-5">
              <CSSFolder
                label={newName.trim() || "Preview"}
                color={selectedColor}
              />
            </div>

            {/* Color picker */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-theme-text-body mb-2">
                Color
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                {COLOR_PALETTE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setSelectedColor(c)}
                    className="relative w-7 h-7 rounded-full border-2 transition-all hover:scale-110"
                    style={{
                      backgroundColor: c,
                      borderColor: selectedColor === c ? "white" : "transparent",
                      boxShadow: selectedColor === c ? `0 0 0 2.5px ${c}` : "none",
                    }}
                    aria-label={`Select color ${c}`}
                  >
                    {selectedColor === c && (
                      <Check className="absolute inset-0 m-auto w-3.5 h-3.5 text-white drop-shadow-sm" />
                    )}
                  </button>
                ))}
                <label
                  className="relative inline-flex items-center gap-1 cursor-pointer rounded-lg border border-theme-neutral-300 px-2.5 h-7 text-xs font-medium text-theme-text-secondary hover:bg-theme-surface-alt transition-colors"
                  title="Pick custom color"
                >
                  <span
                    className="w-3.5 h-3.5 rounded-full shrink-0 border border-theme-neutral-300"
                    style={{ backgroundColor: selectedColor }}
                  />
                  Custom
                  <input
                    type="color"
                    value={selectedColor}
                    onChange={(e) => setSelectedColor(e.target.value)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    aria-label="Pick a custom color"
                  />
                </label>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg border border-theme-neutral-300 px-4 py-2 text-sm text-theme-text-body hover:bg-theme-surface-alt transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAdd}
                disabled={!canAdd}
                className="rounded-lg bg-theme-primary px-4 py-2 text-sm font-medium text-white hover:bg-theme-primary-600 transition-colors shadow-warm-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Folder
              </button>
            </div>
          </div>
        </div>
      )}

      {loading || !colorsLoaded ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-16 gap-y-20 pt-6 pb-8 justify-items-center">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="w-[140px] h-[140px] rounded-lg bg-theme-skeleton animate-pulse" />
          ))}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={localBuckets} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-16 gap-y-20 pt-6 pb-8 justify-items-center">
              {localBuckets.map((name) => (
                <SortableFolder
                  key={name}
                  name={name}
                  color={getBucketColorSync(name, bucketColors)}
                  empty={isBucketEmpty(name)}
                  isEditing={editingFolder === name}
                  onToggleEdit={() =>
                    setEditingFolder(editingFolder === name ? null : name)
                  }
                  onChangeColor={(c) => handleChangeColor(name, c)}
                  bucketColors={bucketColors}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  )
}
