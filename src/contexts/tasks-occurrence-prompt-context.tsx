"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

export type OccurrenceDecision = "single" | "all" | "future" | "cancel";

interface PromptOptions {
  actionDescription: string;
  taskTitle?: string;
  allowSingle?: boolean;
}

interface PromptState {
  actionDescription: string;
  taskTitle?: string;
  allowSingle: boolean;
}

interface OccurrencePromptContextValue {
  prompt: (options: PromptOptions) => Promise<OccurrenceDecision>;
}

const TasksOccurrencePromptContext = createContext<OccurrencePromptContextValue | null>(null);

export function TasksOccurrencePromptProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PromptState | null>(null);
  const resolverRef = useRef<((decision: OccurrenceDecision) => void) | null>(null);

  const cleanup = useCallback(() => {
    resolverRef.current = null;
    setState(null);
  }, []);

  const resolve = useCallback((decision: OccurrenceDecision) => {
    if (resolverRef.current) {
      resolverRef.current(decision);
    }
    cleanup();
  }, [cleanup]);

  const prompt = useCallback((options: PromptOptions) => {
    return new Promise<OccurrenceDecision>((resolvePromise) => {
      // Prevent overlapping prompts; resolve any existing one as cancel
      if (resolverRef.current) {
        resolverRef.current("cancel");
      }
      resolverRef.current = resolvePromise;
      setState({
        actionDescription: options.actionDescription,
        taskTitle: options.taskTitle,
        allowSingle: options.allowSingle !== false,
      });
    });
  }, []);

  useEffect(() => {
    if (!state) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        resolve("cancel");
      }
    };

    const previousOverflow = typeof document !== "undefined" && document.body ? document.body.style.overflow : undefined;

    if (typeof window !== "undefined") {
      window.addEventListener("keydown", onKeyDown);
      if (typeof document !== "undefined" && document.body) {
        document.body.style.overflow = "hidden";
      }
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("keydown", onKeyDown);
        if (typeof document !== "undefined" && document.body && previousOverflow !== undefined) {
          document.body.style.overflow = previousOverflow;
        }
      }
    };
  }, [state, resolve]);

  useEffect(() => {
    return () => {
      if (resolverRef.current) {
        resolverRef.current("cancel");
      }
    };
  }, []);

  const value = useMemo<OccurrencePromptContextValue>(() => ({ prompt }), [prompt]);

  const renderModal = () => {
    if (!state) return null;
    const { actionDescription, taskTitle, allowSingle } = state;
    const title = taskTitle ? `"${taskTitle}" repeats` : "This task repeats";

    return (
      <div
        className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
        aria-modal="true"
        role="dialog"
        aria-labelledby="occurrence-prompt-title"
        onClick={() => resolve("cancel")}
      >
        <div
          className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-theme-neutral-300"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="px-4 sm:px-6 pt-4 sm:pt-6">
            <h2 id="occurrence-prompt-title" className="text-lg font-semibold text-theme-text-primary">
              {title}
            </h2>
            <p className="mt-3 text-sm text-theme-text-subtle">
              {actionDescription}.
            </p>
            <p className="mt-2 text-sm text-theme-text-subtle">
              Would you like to apply this change to only this occurrence, all future occurrences, or the entire series?
            </p>
          </div>
          <div className="px-4 sm:px-6 pt-4 pb-4 sm:pb-6 flex flex-col gap-3">
            {allowSingle && (
              <button
                type="button"
                onClick={() => resolve("single")}
                className="w-full rounded-lg bg-warm-600 text-white px-4 py-2.5 text-sm font-medium shadow-sm hover:bg-warm-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-warm-600"
              >
                This occurrence only
              </button>
            )}
            <button
              type="button"
              onClick={() => resolve("future")}
              className="w-full rounded-lg border border-warm-200 bg-warm-50/60 text-warm-700 px-4 py-2.5 text-sm font-medium hover:bg-warm-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-warm-600"
            >
              All future occurrences
            </button>
            <button
              type="button"
              onClick={() => resolve("all")}
              className="w-full rounded-lg border border-warm-200 bg-warm-50/60 text-warm-700 px-4 py-2.5 text-sm font-medium hover:bg-warm-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-warm-600"
            >
              All occurrences
            </button>
            <button
              type="button"
              onClick={() => resolve("cancel")}
              className="w-full rounded-lg border border-transparent bg-white text-sm font-medium text-theme-text-tertiary hover:text-theme-text-body"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <TasksOccurrencePromptContext.Provider value={value}>
      {children}
      {renderModal()}
    </TasksOccurrencePromptContext.Provider>
  );
}

export function useOccurrencePrompt() {
  const ctx = useContext(TasksOccurrencePromptContext);
  const fallback = useCallback(async ({ actionDescription, taskTitle, allowSingle = true }: PromptOptions) => {
    if (typeof window !== "undefined") {
      const label = taskTitle ? `"${taskTitle}"` : "This repeating task";
      const message = `${label} repeats.\n\n${actionDescription}.\n\nSelect OK to update all occurrences. Select Cancel for more options.`;
      const confirmAll = window.confirm(message);
      if (confirmAll || !allowSingle) {
        return confirmAll ? "all" : "cancel";
      }
      const singleMessage = `Apply this change to just this occurrence?\n\nSelect OK to update only this date. Select Cancel to abort.`;
      const confirmSingle = window.confirm(singleMessage);
      return confirmSingle ? "single" : "cancel";
    }
    return "all" as OccurrenceDecision;
  }, []);

  if (!ctx) {
    return fallback;
  }
  return ctx.prompt;
}
