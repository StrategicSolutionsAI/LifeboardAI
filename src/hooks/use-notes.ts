import { useCallback } from "react";
import { useDataCache } from "@/hooks/use-data-cache";

export interface Note {
  id: string;
  title: string;
  body: string;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CreateNoteInput {
  title?: string;
  body?: string;
}

interface UpdateNoteInput {
  title?: string;
  body?: string;
  isPinned?: boolean;
}

export const NOTES_CACHE_KEY = "notes";

/** Shared by useNotes and prefetchNotes so both fill the same cache entry. */
export async function fetchNotes(): Promise<Note[]> {
  const response = await fetch("/api/notes", {
    method: "GET",
    credentials: "same-origin",
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const json = await response.json();
  return Array.isArray(json?.notes) ? json.notes : [];
}

export function useNotes() {
  const { data, loading, error, refetch, updateOptimistically } =
    useDataCache<Note[]>(NOTES_CACHE_KEY, fetchNotes);

  const notes = data ?? [];

  const reload = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const createNote = useCallback(
    async (input?: CreateNoteInput) => {
      const payload = {
        title: input?.title ?? "",
        body: input?.body ?? "",
      };

      // Optimistic: add a temporary note at the top
      const tempId = `temp-${Date.now()}`;
      const tempNote: Note = {
        id: tempId,
        title: payload.title,
        body: payload.body,
        isPinned: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      updateOptimistically((prev) => [tempNote, ...(prev ?? [])]);

      try {
        const response = await fetch("/api/notes", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw new Error(await response.text());
        }

        const json = await response.json();
        if (json?.note) {
          updateOptimistically((prev) =>
            (prev ?? []).map((n) => (n.id === tempId ? (json.note as Note) : n))
          );
          return json.note as Note;
        }
        // Remove temp if no note returned
        updateOptimistically((prev) =>
          (prev ?? []).filter((n) => n.id !== tempId)
        );
        return undefined;
      } catch {
        // Rollback optimistic insert
        updateOptimistically((prev) =>
          (prev ?? []).filter((n) => n.id !== tempId)
        );
        throw new Error("Failed to create note");
      }
    },
    [updateOptimistically]
  );

  const updateNote = useCallback(
    async (id: string, updates: UpdateNoteInput) => {
      // Optimistic update
      updateOptimistically((prev) =>
        (prev ?? []).map((n) =>
          n.id === id
            ? { ...n, ...updates, updatedAt: new Date().toISOString() }
            : n
        )
      );

      try {
        const response = await fetch("/api/notes", {
          method: "PATCH",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, ...updates }),
        });

        if (!response.ok) {
          throw new Error(await response.text());
        }

        const json = await response.json();
        if (json?.note) {
          updateOptimistically((prev) =>
            (prev ?? []).map((n) => (n.id === id ? (json.note as Note) : n))
          );
        }
        return json?.note as Note | undefined;
      } catch {
        // Reload to restore correct state
        await refetch();
        return undefined;
      }
    },
    [updateOptimistically, refetch]
  );

  const deleteNote = useCallback(
    async (id: string) => {
      // Optimistic removal
      let removed: Note | undefined;
      updateOptimistically((prev) => {
        const list = prev ?? [];
        removed = list.find((n) => n.id === id);
        return list.filter((n) => n.id !== id);
      });

      try {
        const response = await fetch("/api/notes", {
          method: "DELETE",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });

        if (!response.ok) {
          throw new Error(await response.text());
        }
      } catch {
        // Rollback optimistic removal
        if (removed) {
          updateOptimistically((prev) => [...(prev ?? []), removed!]);
        }
      }
    },
    [updateOptimistically]
  );

  return {
    notes,
    loading,
    error: error ? "Failed to load notes." : null,
    reload,
    createNote,
    updateNote,
    deleteNote,
  };
}
