import type { DestructiveConfirmState } from '@/lib/dashboard-utils'

interface ConfirmDialogProps {
  state: DestructiveConfirmState
  onCancel: () => void
  onConfirm: () => void
}

export function ConfirmDialog({ state, onCancel, onConfirm }: ConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={state.title}
        className="w-full max-w-md rounded-xl border border-theme-neutral-300 bg-white p-5 shadow-xl"
      >
        <h3 className="text-base font-semibold text-theme-text-primary">{state.title}</h3>
        <p className="mt-2 text-sm text-theme-text-subtle">{state.description}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-theme-neutral-300 px-3 py-2 text-sm text-theme-text-body hover:bg-theme-surface-alt"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-md bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-700"
          >
            {state.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
