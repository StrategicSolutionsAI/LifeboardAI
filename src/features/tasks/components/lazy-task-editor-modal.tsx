"use client";

import dynamic from "next/dynamic";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type {
  TaskEditorModalHandle,
  TaskEditorModalProps,
} from "./task-editor-modal";

/**
 * Lazy stand-in for TaskEditorModal.
 *
 * The editor is ~22 kB parsed and rendered `null` until something calls its
 * ref, yet it was imported at module scope by /tasks and /calendar — the two
 * heaviest routes — so both paid for it in First Load JS on every visit.
 *
 * Deferring it is not just `dynamic()`: the modal is driven imperatively
 * (`taskEditorRef.current.openWithTask(...)`), and a component that has not
 * loaded yet has no handle to call. So this wrapper keeps the same handle
 * contract, mounts the real modal on the first imperative call, and replays
 * that call once the handle attaches. The chunk is also warmed on idle after
 * hydration, so in practice it is already loaded before the first click.
 */
const TaskEditorModalImpl = dynamic(
  () => import("./task-editor-modal").then((m) => m.TaskEditorModalWithInnerRef),
  { ssr: false }
);

type PendingCall = (handle: TaskEditorModalHandle) => void;

const LazyTaskEditorModal = forwardRef<
  TaskEditorModalHandle,
  TaskEditorModalProps
>(function LazyTaskEditorModal(props, ref) {
  const [mounted, setMounted] = useState(false);
  const handleRef = useRef<TaskEditorModalHandle | null>(null);
  const pendingRef = useRef<PendingCall | null>(null);

  // Warm the chunk once the browser is idle so the first open is instant.
  useEffect(() => {
    let cancelled = false;
    const warm = () => {
      if (!cancelled) void import("./task-editor-modal");
    };
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(warm, { timeout: 3000 });
      return () => {
        cancelled = true;
        window.cancelIdleCallback?.(id);
      };
    }
    const id = window.setTimeout(warm, 1500);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, []);

  // Run now if the real modal is mounted; otherwise mount it and queue the call.
  const run = useCallback((call: PendingCall) => {
    if (handleRef.current) {
      call(handleRef.current);
      return;
    }
    pendingRef.current = call;
    setMounted(true);
  }, []);

  // Callback ref: fires in the commit phase once the real modal exposes its
  // handle, which is where a queued open gets replayed.
  const attach = useCallback((handle: TaskEditorModalHandle | null) => {
    handleRef.current = handle;
    if (handle && pendingRef.current) {
      const call = pendingRef.current;
      pendingRef.current = null;
      call(handle);
    }
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      openWithTask: (task, dateStr, options) =>
        run((h) => h.openWithTask(task, dateStr, options)),
      openByTaskId: (taskId, metadata) =>
        run((h) => h.openByTaskId(taskId, metadata)),
      openNew: (dateStr, options) => run((h) => h.openNew(dateStr, options)),
      // Nothing to close if it was never opened.
      close: () => handleRef.current?.close(),
    }),
    [run]
  );

  if (!mounted) return null;
  return <TaskEditorModalImpl {...props} innerRef={attach} />;
});

export default LazyTaskEditorModal;
