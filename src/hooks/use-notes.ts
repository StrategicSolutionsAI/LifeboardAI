import { useCallback, useEffect, useState } from "react";

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

export function useNotes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadNotes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/notes", {
        method: "GET",
        credentials: "same-origin",
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const json = await response.json();
      const fetched: Note[] = Array.isArray(json?.notes) ? json.notes : [];
      setNotes(fetched);
    } catch (err: any) {
      console.error("Failed to load notes", err);
      setError("Failed to load notes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  const createNote = useCallback(async (input?: CreateNoteInput) => {
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
    setNotes((prev) => [tempNote, ...prev]);

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
        setNotes((prev) =>
          prev.map((n) => (n.id === tempId ? (json.note as Note) : n))
        );
        return json.note as Note;
      }
      // Remove temp if no note returned
      setNotes((prev) => prev.filter((n) => n.id !== tempId));
      return undefined;
    } catch {
      // Rollback optimistic insert
      setNotes((prev) => prev.filter((n) => n.id !== tempId));
      throw new Error("Failed to create note");
    }
  }, []);

  const updateNote = useCallback(async (id: string, updates: UpdateNoteInput) => {
    // Optimistic update
    setNotes((prev) =>
      prev.map((n) =>
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
        setNotes((prev) =>
          prev.map((n) => (n.id === id ? (json.note as Note) : n))
        );
      }
      return json?.note as Note | undefined;
    } catch {
      // Reload to restore correct state
      await loadNotes();
      return undefined;
    }
  }, [loadNotes]);

  const deleteNote = useCallback(async (id: string) => {
    // Optimistic removal
    let removed: Note | undefined;
    setNotes((prev) => {
      removed = prev.find((n) => n.id === id);
      return prev.filter((n) => n.id !== id);
    });

    try {
      const response = await fetch("/api/notes", {
        method: "DELETE",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      if (!response.ok) {
        // Rollback
        if (removed) {
          setNotes((prev) => [...prev, removed!]);
        }
        throw new Error(await response.text());
      }
    } catch {
      if (removed) {
        setNotes((prev) => [...prev, removed!]);
      }
    }
  }, []);

  return {
    notes,
    loading,
    error,
    reload: loadNotes,
    createNote,
    updateNote,
    deleteNote,
  };
}
