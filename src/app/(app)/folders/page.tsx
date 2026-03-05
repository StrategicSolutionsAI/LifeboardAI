"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
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
import type { BucketStatsData } from "@/features/folders/components/folder-stats"

const COLOR_PALETTE = [
  "#F29D9E", "#FFC6BD", "#FCC2CF", "#DEA2BF", "#E2C1F0",
  "#C3C0FF", "#B8CEFF", "#92BEFB", "#B6D8FB", "#85C9E0",
  "#B0DBD2", "#89BAA2", "#CCE0B5", "#E2ECA9", "#FFF9B2",
  "#FFE4A8", "#FFC688", "#D8A289", "#DDC4AE", "#C1CFD8",
  "#DEE2EE", "#A9B0C5",
] as const

const SUGGESTED_COLORS: Record<string, string> = {
  health: "#89BAA2",
  wellness: "#B0DBD2",
  family: "#92BEFB",
  social: "#DEA2BF",
  work: "#DDC4AE",
  personal: "#E2C1F0",
  projects: "#B8CEFF",
  home: "#CCE0B5",
  finance: "#FFE4A8",
  fitness: "#FFC688",
}

function suggestColor(name: string, existingColors: Record<string, string>): string {
  const key = name.toLowerCase().trim()
  if (SUGGESTED_COLORS[key]) return SUGGESTED_COLORS[key]
  const usedSet = new Set(Object.values(existingColors))
  const available = BUCKET_COLOR_PALETTE.find((c) => !usedSet.has(c))
  return available ?? "#C1CFD8"
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

/* ── Color grid shared by inline + modal pickers ── */
function ColorGrid({
  selected,
  onSelect,
}: {
  selected: string
  onSelect: (color: string) => void
}) {
  return (
    <div className="grid grid-cols-7 gap-2">
      {COLOR_PALETTE.map((c) => {
        const isActive = selected.toLowerCase() === c.toLowerCase()
        return (
          <button
            key={c}
            type="button"
            onClick={() => onSelect(c)}
            className="relative w-7 h-7 rounded-full border-2 transition-all hover:scale-110"
            style={{
              backgroundColor: c,
              borderColor: isActive ? "white" : "transparent",
              boxShadow: isActive ? `0 0 0 2.5px ${c}` : "none",
            }}
            aria-label={`Select color ${c}`}
          >
            {isActive && (
              <Check className="absolute inset-0 m-auto w-3.5 h-3.5 text-white drop-shadow-sm" />
            )}
          </button>
        )
      })}
      <label
        className="relative inline-flex items-center justify-center cursor-pointer w-7 h-7 rounded-full border-2 border-dashed border-theme-neutral-300 hover:border-theme-text-tertiary transition-colors"
        title="Pick custom color"
      >
        <Plus className="w-3.5 h-3.5 text-theme-text-tertiary" />
        <input
          type="color"
          value={selected}
          onChange={(e) => onSelect(e.target.value)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          aria-label="Pick a custom color"
        />
      </label>
    </div>
  )
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
  stats,
  visibleStatTypes,
}: {
  name: string
  color: string
  empty: boolean
  isEditing: boolean
  onToggleEdit: () => void
  onChangeColor: (color: string) => void
  bucketColors: Record<string, string>
  stats?: BucketStatsData
  visibleStatTypes?: Set<keyof BucketStatsData>
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
      data-folder-item
      className="flex flex-col items-center cursor-grab active:cursor-grabbing w-[140px] sm:w-[170px] lg:w-[200px]"
    >
      <CSSFolder
        label={name}
        color={color}
        empty={empty}
        onClick={onToggleEdit}
        stats={stats}
        visibleStatTypes={visibleStatTypes}
      />
      {isEditing && !isDragging && (
        <div
          data-color-picker
          className="mt-3 p-3 rounded-xl border border-theme-neutral-300/80 bg-white shadow-warm-sm"
        >
          <ColorGrid
            selected={getBucketColorSync(name, bucketColors)}
            onSelect={onChangeColor}
          />
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

  // Per-bucket stats (tasks, widgets, shopping, calendar)
  const [bucketStats, setBucketStats] = useState<Record<string, BucketStatsData>>({})

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
      setColorsLoaded(true)
    })
  }, [])

  // Fetch per-bucket stats (tasks, widgets, shopping, calendar)
  useEffect(() => {
    fetch("/api/folder-stats", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : { stats: {} }))
      .then((json) => setBucketStats(json.stats ?? {}))
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
    await saveBucketColors(null, nextColors)
  }

  const isBucketEmpty = useCallback((name: string) => {
    const s = bucketStats[name]
    if (!s) return true
    return s.tasks === 0 && s.widgets === 0 && s.shopping === 0 && s.calendar === 0
  }, [bucketStats])

  const visibleStatTypes = useMemo(() => {
    const types = new Set<keyof BucketStatsData>()
    for (const s of Object.values(bucketStats)) {
      if (s.tasks > 0) types.add("tasks")
      if (s.widgets > 0) types.add("widgets")
      if (s.shopping > 0) types.add("shopping")
      if (s.calendar > 0) types.add("calendar")
    }
    return types
  }, [bucketStats])

  // Close inline color picker when clicking outside
  useEffect(() => {
    if (!editingFolder) return
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.closest("[data-color-picker]") || target.closest("[data-folder-item]")) return
      setEditingFolder(null)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [editingFolder])

  const isDuplicate = localBuckets.includes(newName.trim())
  const canAdd = newName.trim().length > 0 && !isDuplicate

  return (
    <div className="flex w-full flex-col pb-24">
      <div className="flex items-center -mt-12 mb-10 sm:mb-14 md:mb-20">
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
              <ColorGrid
                selected={selectedColor}
                onSelect={setSelectedColor}
              />
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

      <div className="rounded-2xl border border-theme-neutral-300 bg-white p-4 sm:p-6 md:p-8 shadow-sm">
        {loading || !colorsLoaded ? (
          <div className="grid grid-cols-[repeat(2,auto)] sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 justify-center sm:justify-items-center gap-x-6 sm:gap-x-0 gap-y-8 sm:gap-y-10 md:gap-y-12 lg:gap-y-14 pt-8 sm:pt-10 pb-4 sm:pb-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="w-[110px] h-[110px] sm:w-[130px] sm:h-[130px] lg:w-[140px] lg:h-[140px] rounded-lg bg-theme-skeleton animate-pulse" />
            ))}
          </div>
        ) : localBuckets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="opacity-50 pointer-events-none">
              <CSSFolder label="" color="#C1CFD8" empty />
            </div>
            <h3 className="mt-6 text-base font-semibold text-theme-text-secondary">
              No folders yet
            </h3>
            <p className="mt-1.5 text-sm text-theme-text-tertiary text-center max-w-[260px]">
              Create folders to organize your tasks, widgets, and calendar events.
            </p>
            <button
              type="button"
              onClick={openAddMode}
              className="mt-5 inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-theme-primary text-white text-[13px] font-medium hover:bg-theme-primary-600 transition-colors shadow-warm-sm"
            >
              <Plus size={15} />
              Add Folder
            </button>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={localBuckets} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-[repeat(2,auto)] sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 justify-center sm:justify-items-center gap-x-6 sm:gap-x-0 gap-y-8 sm:gap-y-10 md:gap-y-12 lg:gap-y-14 pt-8 sm:pt-10 pb-4 sm:pb-6">
                {localBuckets.map((name) => (
                  <SortableFolder
                    key={name}
                    name={name}
                    color={getBucketColorSync(name, bucketColors)}
                    empty={isBucketEmpty(name)}
                    stats={bucketStats[name] ?? { tasks: 0, widgets: 0, shopping: 0, calendar: 0 }}
                    visibleStatTypes={visibleStatTypes}
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
    </div>
  )
}
