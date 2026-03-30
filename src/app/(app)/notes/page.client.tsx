"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  StickyNote,
  Search,
  Plus,
  Pin,
  PinOff,
  Trash2,
  MoreVertical,
  ArrowLeft,
} from "lucide-react"
import { useNotes, Note } from "@/hooks/use-notes"
import { debounce } from "@/lib/dashboard-utils"
import { interactive } from "@/lib/styles"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"

type MobileView = "list" | "editor"
type SaveStatus = "idle" | "saving" | "saved" | "failed"

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHr = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHr / 24)

  if (diffMin < 1) return "Just now"
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHr < 24) return `${diffHr}h ago`
  if (diffDay < 7) return `${diffDay}d ago`
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

function getPreview(body: string, maxLen = 80): string {
  const line = body.replace(/\n/g, " ").trim()
  if (!line) return ""
  return line.length > maxLen ? line.slice(0, maxLen) + "..." : line
}

export default function NotesPageClient() {
  const { notes, loading, createNote, updateNote, deleteNote } = useNotes()

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mobileView, setMobileView] = useState<MobileView>("list")
  const [searchQuery, setSearchQuery] = useState("")
  const [deleteTarget, setDeleteTarget] = useState<Note | null>(null)

  // Editor local state
  const [editTitle, setEditTitle] = useState("")
  const [editBody, setEditBody] = useState("")
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle")
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const selectedNote = useMemo(
    () => notes.find((n) => n.id === selectedId) ?? null,
    [notes, selectedId]
  )

  // Sorted & filtered notes: pinned first, then by updated_at desc
  const filteredNotes = useMemo(() => {
    let list = notes
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.body.toLowerCase().includes(q)
      )
    }
    // Already sorted from API (pinned first, then updated_at desc)
    return list
  }, [notes, searchQuery])

  const pinnedNotes = useMemo(
    () => filteredNotes.filter((n) => n.isPinned),
    [filteredNotes]
  )
  const unpinnedNotes = useMemo(
    () => filteredNotes.filter((n) => !n.isPinned),
    [filteredNotes]
  )

  // Debounced save
  const debouncedSave = useRef(
    debounce((id: string, title: string, body: string) => {
      setSaveStatus("saving")
      updateNote(id, { title, body })
        .then(() => {
          setSaveStatus("saved")
          if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
          savedTimerRef.current = setTimeout(() => setSaveStatus("idle"), 2000)
        })
        .catch(() => {
          setSaveStatus("failed")
        })
    }, 1000)
  ).current

  // Flush on unmount
  useEffect(() => {
    return () => {
      debouncedSave.flush()
    }
  }, [debouncedSave])

  // Flush on beforeunload
  useEffect(() => {
    const handler = () => debouncedSave.flush()
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [debouncedSave])

  // Sync editor state when selected note changes
  useEffect(() => {
    if (selectedNote) {
      setEditTitle(selectedNote.title)
      setEditBody(selectedNote.body)
      setSaveStatus("idle")
    }
  }, [selectedId]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectNote = useCallback(
    (note: Note) => {
      // Flush any pending save for current note
      debouncedSave.flush()
      setSelectedId(note.id)
      setMobileView("editor")
    },
    [debouncedSave]
  )

  const handleBackToList = useCallback(() => {
    debouncedSave.flush()
    setMobileView("list")
  }, [debouncedSave])

  const handleCreateNote = useCallback(async () => {
    debouncedSave.flush()
    const note = await createNote()
    if (note) {
      setSelectedId(note.id)
      setEditTitle(note.title)
      setEditBody(note.body)
      setSaveStatus("idle")
      setMobileView("editor")
    }
  }, [createNote, debouncedSave])

  const handleTitleChange = useCallback(
    (value: string) => {
      setEditTitle(value)
      if (selectedId) {
        debouncedSave(selectedId, value, editBody)
      }
    },
    [selectedId, editBody, debouncedSave]
  )

  const handleBodyChange = useCallback(
    (value: string) => {
      setEditBody(value)
      if (selectedId) {
        debouncedSave(selectedId, editTitle, value)
      }
    },
    [selectedId, editTitle, debouncedSave]
  )

  const handleTogglePin = useCallback(
    async (note: Note) => {
      await updateNote(note.id, { isPinned: !note.isPinned })
    },
    [updateNote]
  )

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return
    const id = deleteTarget.id
    setDeleteTarget(null)
    if (selectedId === id) {
      setSelectedId(null)
      setMobileView("list")
    }
    await deleteNote(id)
  }, [deleteTarget, deleteNote, selectedId])

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-theme-primary border-t-transparent" />
      </div>
    )
  }

  // Empty state — no notes at all
  if (notes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100dvh-280px)] text-center px-4">
        <div className="w-14 h-14 rounded-2xl bg-theme-brand-tint-light flex items-center justify-center mb-4">
          <StickyNote className="h-7 w-7 text-theme-primary" />
        </div>
        <h2 className="text-lg font-semibold text-theme-text-primary mb-1">
          No notes yet
        </h2>
        <p className="text-sm text-theme-text-secondary mb-6 max-w-xs">
          Capture ideas, lists, and brainstorms.
        </p>
        <Button onClick={handleCreateNote} className="gap-2">
          <Plus className="h-4 w-4" />
          New note
        </Button>
      </div>
    )
  }

  const noteListContent = (
    <>
      {/* Search */}
      <div className="p-3 border-b border-theme-neutral-300/50">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-theme-text-tertiary" />
          <input
            type="text"
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-theme-neutral-300/80 bg-theme-surface-base pl-8 pr-3 py-2 text-sm text-theme-text-primary placeholder:text-theme-text-tertiary focus:outline-none focus:ring-2 focus:ring-theme-primary/30 focus:border-theme-primary/40"
          />
        </div>
      </div>

      {/* New note button */}
      <div className="px-3 py-2 border-b border-theme-neutral-300/50">
        <button
          onClick={handleCreateNote}
          className={`flex items-center gap-2 w-full rounded-lg px-3 py-2 text-sm font-medium text-theme-primary hover:bg-theme-brand-tint-light ${interactive.transitionFast}`}
        >
          <Plus className="h-4 w-4" />
          New note
        </button>
      </div>

      {/* Note list */}
      <div className="flex-1 overflow-y-auto">
        {filteredNotes.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-theme-text-tertiary">
            No notes match your search.
          </div>
        ) : (
          <>
            {pinnedNotes.length > 0 && (
              <>
                {pinnedNotes.map((note) => (
                  <NoteListItem
                    key={note.id}
                    note={note}
                    isSelected={selectedId === note.id}
                    onSelect={handleSelectNote}
                    onTogglePin={handleTogglePin}
                    onDelete={setDeleteTarget}
                  />
                ))}
                {unpinnedNotes.length > 0 && (
                  <div className="border-b border-theme-neutral-300/50 mx-3" />
                )}
              </>
            )}
            {unpinnedNotes.map((note) => (
              <NoteListItem
                key={note.id}
                note={note}
                isSelected={selectedId === note.id}
                onSelect={handleSelectNote}
                onTogglePin={handleTogglePin}
                onDelete={setDeleteTarget}
              />
            ))}
          </>
        )}
      </div>
    </>
  )

  const editorContent = selectedNote ? (
    <div className="flex flex-1 flex-col h-full">
      {/* Mobile back button */}
      <div className="flex items-center gap-2 px-4 py-2 md:hidden border-b border-theme-neutral-300/50">
        <button
          onClick={handleBackToList}
          className={`p-1.5 rounded-lg hover:bg-theme-brand-tint-light ${interactive.transitionFast}`}
        >
          <ArrowLeft className="h-5 w-5 text-theme-text-primary" />
        </button>
        <span className="text-sm text-theme-text-secondary">Notes</span>
        <div className="ml-auto">
          <SaveIndicator status={saveStatus} />
        </div>
      </div>

      <div className="flex-1 flex flex-col px-4 md:px-6 py-3 md:py-4 overflow-y-auto">
        {/* Save indicator - desktop */}
        <div className="hidden md:flex justify-end mb-1">
          <SaveIndicator status={saveStatus} />
        </div>

        {/* Title */}
        <input
          type="text"
          value={editTitle}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="Untitled"
          className="w-full text-lg font-semibold text-theme-text-primary placeholder:text-theme-text-tertiary bg-transparent border-none outline-none mb-3"
        />

        {/* Body */}
        <textarea
          value={editBody}
          onChange={(e) => handleBodyChange(e.target.value)}
          placeholder="Start typing..."
          className="w-full flex-1 text-base leading-relaxed text-theme-text-primary placeholder:text-theme-text-tertiary bg-transparent border-none outline-none resize-none min-h-[200px]"
        />
      </div>
    </div>
  ) : (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
      <StickyNote className="h-10 w-10 text-theme-text-tertiary/40 mb-3" />
      <p className="text-sm text-theme-text-tertiary">
        Select a note or create a new one
      </p>
    </div>
  )

  return (
    <>
      {/* Desktop: two-panel */}
      <div className="hidden md:flex h-[calc(100dvh-200px)] rounded-xl border border-theme-neutral-300/80 bg-white overflow-hidden">
        {/* Left panel */}
        <div className="flex flex-col w-72 border-r border-theme-neutral-300/80 bg-white">
          {noteListContent}
        </div>

        {/* Right panel */}
        <div className="flex-1 flex flex-col">{editorContent}</div>
      </div>

      {/* Mobile: single panel */}
      <div className="md:hidden -mx-6 sm:-mx-8">
        {mobileView === "list" ? (
          <div className="flex flex-col h-[calc(100dvh-200px)]">
            {noteListContent}
          </div>
        ) : (
          <div className="flex flex-col h-[calc(100dvh-200px)]">
            {editorContent}
          </div>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete note</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;
              {deleteTarget?.title || "Untitled"}&rdquo;? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// --- Sub-components ---

function NoteListItem({
  note,
  isSelected,
  onSelect,
  onTogglePin,
  onDelete,
}: {
  note: Note
  isSelected: boolean
  onSelect: (note: Note) => void
  onTogglePin: (note: Note) => void
  onDelete: (note: Note) => void
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(note)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onSelect(note)
        }
      }}
      className={`group relative flex items-start gap-2 px-3 py-3 mx-1 rounded-lg cursor-pointer ${interactive.transitionFast} ${
        isSelected
          ? "bg-theme-surface-selected border-l-2 border-l-theme-primary"
          : "hover:bg-theme-brand-tint-light"
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {note.isPinned && (
            <Pin className="h-3 w-3 text-theme-primary shrink-0" />
          )}
          <span
            className={`text-sm font-medium truncate ${
              note.title
                ? "text-theme-text-primary"
                : "text-theme-text-tertiary italic"
            }`}
          >
            {note.title || "Untitled"}
          </span>
        </div>
        {note.body && (
          <p className="text-xs text-theme-text-secondary truncate mt-0.5">
            {getPreview(note.body)}
          </p>
        )}
        <p className="text-[10px] text-theme-text-tertiary mt-1">
          {formatRelativeTime(note.updatedAt)}
        </p>
      </div>

      {/* Three-dot menu */}
      <div className="shrink-0 opacity-0 group-hover:opacity-100 md:opacity-0 md:group-hover:opacity-100 max-md:opacity-100">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              onClick={(e) => e.stopPropagation()}
              className={`p-1 rounded-md hover:bg-theme-brand-tint ${interactive.transitionFast}`}
            >
              <MoreVertical className="h-4 w-4 text-theme-text-tertiary" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36">
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation()
                onTogglePin(note)
              }}
            >
              {note.isPinned ? (
                <>
                  <PinOff className="h-4 w-4 mr-2" />
                  Unpin
                </>
              ) : (
                <>
                  <Pin className="h-4 w-4 mr-2" />
                  Pin
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation()
                onDelete(note)
              }}
              className="text-red-600 focus:text-red-600"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === "idle") return null

  return (
    <span
      className={`text-xs ${
        status === "saving"
          ? "text-theme-text-tertiary"
          : status === "saved"
            ? "text-green-600"
            : "text-red-500"
      }`}
    >
      {status === "saving"
        ? "Saving..."
        : status === "saved"
          ? "Saved"
          : "Save failed"}
    </span>
  )
}
