import type { UndoState } from '@/lib/dashboard-utils'

interface UndoToastProps {
  state: UndoState
  onDismiss: () => void
  onUndo: () => void
}

export function UndoToast({ state, onDismiss, onUndo }: UndoToastProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-24 right-4 z-[110] w-[min(92vw,360px)] rounded-lg border border-theme-neutral-300 bg-white p-3 shadow-warm-lg"
    >
      <p className="text-sm text-theme-text-primary">{state.message}</p>
      <div className="mt-2 flex justify-end gap-2">
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-md border border-theme-neutral-300 px-2 py-1 text-xs text-theme-text-subtle hover:bg-theme-surface-alt"
        >
          Dismiss
        </button>
        <button
          type="button"
          onClick={onUndo}
          className="rounded-lg bg-theme-primary px-2 py-1 text-xs text-white hover:bg-theme-primary-600 transition-colors"
        >
          Undo
        </button>
      </div>
    </div>
  )
}
