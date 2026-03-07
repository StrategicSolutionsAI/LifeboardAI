"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Check, ListChecks, LayoutGrid, ShoppingCart, Calendar, Plus, Trash2, X } from "lucide-react"
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd"
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
  index,
  color,
  empty,
  onEdit,
  stats,
  visibleStatTypes,
}: {
  name: string
  index: number
  color: string
  empty: boolean
  onEdit: () => void
  stats?: BucketStatsData
  visibleStatTypes?: Set<keyof BucketStatsData>
}) {
  return (
    <Draggable draggableId={name} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          style={{
            ...provided.draggableProps.style,
            opacity: snapshot.isDragging ? 0.4 : 1,
          }}
          className="flex flex-col items-center cursor-grab active:cursor-grabbing w-[140px] sm:w-[170px] lg:w-[200px]"
        >
          <CSSFolder
            label={name}
            color={color}
            empty={empty}
            onClick={onEdit}
            stats={stats}
            visibleStatTypes={visibleStatTypes}
          />
        </div>
      )}
    </Draggable>
  )
}

/* ── Stats row for edit modal ── */
const STAT_CONFIG = [
  { key: "tasks" as const, icon: ListChecks, label: "Tasks" },
  { key: "widgets" as const, icon: LayoutGrid, label: "Widgets" },
  { key: "shopping" as const, icon: ShoppingCart, label: "Shopping" },
  { key: "calendar" as const, icon: Calendar, label: "Events" },
]

/* ── Folder edit modal ── */
function FolderEditModal({
  folderName,
  bucketColors,
  stats,
  allBuckets,
  onChangeColor,
  onRename,
  onDelete,
  onClose,
}: {
  folderName: string
  bucketColors: Record<string, string>
  stats: BucketStatsData
  allBuckets: string[]
  onChangeColor: (color: string) => void
  onRename: (oldName: string, newName: string) => void
  onDelete: (name: string) => void
  onClose: () => void
}) {
  const color = getBucketColorSync(folderName, bucketColors)
  const [editName, setEditName] = useState(folderName)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)

  const trimmed = editName.trim()
  const isDuplicate = trimmed !== folderName && allBuckets.includes(trimmed)
  const canSaveName = trimmed.length > 0 && !isDuplicate && trimmed !== folderName

  const commitRename = () => {
    if (canSaveName) onRename(folderName, trimmed)
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [onClose])

  const hasAnyStats = stats.tasks > 0 || stats.widgets > 0 || stats.shopping > 0 || stats.calendar > 0

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Edit ${folderName}`}
        className="w-full max-w-sm rounded-2xl border border-theme-neutral-300 bg-white p-4 sm:p-6 shadow-xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-theme-text-primary">Edit Folder</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-theme-text-tertiary hover:bg-theme-surface-alt transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Live preview */}
        <div className="flex justify-center mb-5">
          <CSSFolder
            label={trimmed || folderName}
            color={color}
          />
        </div>

        {/* Name input */}
        <div className="mb-5">
          <label className="block text-sm font-medium text-theme-text-body mb-1.5">
            Name
          </label>
          <input
            ref={nameInputRef}
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                commitRename()
                nameInputRef.current?.blur()
              }
            }}
            className="w-full h-10 px-3 rounded-lg border border-theme-neutral-300 bg-white text-sm text-theme-text-primary placeholder:text-theme-text-tertiary focus:outline-none focus:ring-2 focus:ring-theme-primary/30 focus:border-theme-primary transition-colors"
          />
          {isDuplicate && trimmed && (
            <p className="mt-1.5 text-xs text-red-500">A folder with this name already exists</p>
          )}
        </div>

        {/* Color picker */}
        <div className="mb-5">
          <label className="block text-sm font-medium text-theme-text-body mb-2">
            Color
          </label>
          <ColorGrid
            selected={color}
            onSelect={onChangeColor}
          />
        </div>

        {/* Stats row */}
        {hasAnyStats && (
          <div className="mb-5">
            <label className="block text-sm font-medium text-theme-text-body mb-2">
              Contents
            </label>
            <div className="flex flex-wrap gap-2">
              {STAT_CONFIG.map(({ key, icon: Icon, label }) => {
                const count = stats[key]
                if (count === 0) return null
                return (
                  <div
                    key={key}
                    className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 bg-theme-surface-alt text-theme-text-secondary text-xs font-medium"
                  >
                    <Icon className="w-3.5 h-3.5" strokeWidth={2} />
                    <span>{count} {label}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Delete section */}
        <div className="pt-4 border-t border-theme-neutral-300/60">
          {!confirmDelete ? (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-600 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete Folder
            </button>
          ) : (
            <div className="space-y-2.5">
              <p className="text-sm text-red-600 font-medium">
                Delete &ldquo;{folderName}&rdquo;? All tasks, widgets, and items in this folder will be removed.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="rounded-lg border border-theme-neutral-300 px-3 py-1.5 text-sm text-theme-text-body hover:bg-theme-surface-alt transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(folderName)}
                  className="rounded-lg bg-red-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-600 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
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

  // DnD drag handler

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

  const handleDragEnd = async (result: DropResult) => {
    setEditingFolder(null)
    if (!result.destination || result.source.index === result.destination.index) return

    const oldIndex = result.source.index
    const newIndex = result.destination.index

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

  const handleRename = async (oldName: string, newName: string) => {
    if (oldName === newName || localBuckets.includes(newName)) return
    const updated = localBuckets.map((b) => (b === oldName ? newName : b))
    const nextColors = { ...bucketColors }
    nextColors[newName] = nextColors[oldName] ?? getBucketColorSync(oldName, bucketColors)
    delete nextColors[oldName]

    setLocalBuckets(updated)
    setBucketColors(nextColors)
    setEditingFolder(newName)

    // Migrate stats key
    setBucketStats((prev) => {
      const next = { ...prev }
      if (next[oldName]) {
        next[newName] = next[oldName]
        delete next[oldName]
      }
      return next
    })

    await saveBucketColors(updated, nextColors)
  }

  const handleDeleteFolder = async (name: string) => {
    const updated = localBuckets.filter((b) => b !== name)
    const nextColors = { ...bucketColors }
    delete nextColors[name]

    setLocalBuckets(updated)
    setBucketColors(nextColors)
    setEditingFolder(null)

    await saveBucketColors(updated, nextColors)

    // Cascade delete server-side
    try {
      await fetch("/api/user/bucket-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ bucket: name }),
      })
    } catch (err) {
      console.error("Failed to cascade-delete bucket:", err)
    }
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

  const isDuplicate = localBuckets.includes(newName.trim())
  const canAdd = newName.trim().length > 0 && !isDuplicate

  return (
    <div className="flex w-full flex-col pb-24">
      {/* Edit Folder Modal */}
      {editingFolder && (
        <FolderEditModal
          folderName={editingFolder}
          bucketColors={bucketColors}
          stats={bucketStats[editingFolder] ?? { tasks: 0, widgets: 0, shopping: 0, calendar: 0 }}
          allBuckets={localBuckets}
          onChangeColor={(c) => handleChangeColor(editingFolder, c)}
          onRename={handleRename}
          onDelete={handleDeleteFolder}
          onClose={() => setEditingFolder(null)}
        />
      )}

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
            className="w-full max-w-sm rounded-2xl border border-theme-neutral-300 bg-white p-4 sm:p-6 shadow-xl"
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
        {localBuckets.length > 0 && !loading && colorsLoaded && (
          <div className="flex justify-end mb-2">
            <button
              type="button"
              onClick={openAddMode}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-theme-primary text-white text-[13px] font-medium hover:bg-theme-primary-600 transition-colors shadow-warm-sm"
            >
              <Plus size={15} />
              <span className="hidden sm:inline">Add Folder</span>
            </button>
          </div>
        )}
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
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="folders" direction="horizontal">
              {(provided) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className="grid grid-cols-[repeat(2,auto)] sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 justify-center sm:justify-items-center gap-x-6 sm:gap-x-0 gap-y-8 sm:gap-y-10 md:gap-y-12 lg:gap-y-14 pt-8 sm:pt-10 pb-4 sm:pb-6"
                >
                  {localBuckets.map((name, index) => (
                    <SortableFolder
                      key={name}
                      name={name}
                      index={index}
                      color={getBucketColorSync(name, bucketColors)}
                      empty={isBucketEmpty(name)}
                      stats={bucketStats[name] ?? { tasks: 0, widgets: 0, shopping: 0, calendar: 0 }}
                      visibleStatTypes={visibleStatTypes}
                      onEdit={() => setEditingFolder(name)}
                    />
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        )}
      </div>
    </div>
  )
}
