"use client"

import * as React from "react"

type ToastProps = {
  title?: string
  description?: string
  action?: React.ReactNode
  type?: "default" | "success" | "error" | "warning"
  duration?: number
  undoAction?: () => void
}

type InternalToast = ToastProps & { id: string; state: "open" | "closing" }

type ToastActionElement = React.ReactElement<unknown>

type ToastContextType = {
  toast: (props: ToastProps) => void
  dismiss: (toastId?: string) => void
}

const ToastContext = React.createContext<ToastContextType | undefined>(
  undefined
)

let toastIdCounter = 0

function ToastIcon({ type }: { type?: string }) {
  if (type === "success") {
    return (
      <svg className="h-5 w-5 shrink-0 text-emerald-500" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
      </svg>
    )
  }
  if (type === "error") {
    return (
      <svg className="h-5 w-5 shrink-0 text-red-500" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
      </svg>
    )
  }
  if (type === "warning") {
    return (
      <svg className="h-5 w-5 shrink-0 text-amber-500" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.168-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.457-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
      </svg>
    )
  }
  return null
}

export function ToastProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [toasts, setToasts] = React.useState<InternalToast[]>([])

  const dismiss = React.useCallback((toastId?: string) => {
    // Start closing animation
    setToasts((prev) =>
      prev.map((t) =>
        !toastId || t.id === toastId ? { ...t, state: "closing" as const } : t
      )
    )
    // Remove after animation completes
    setTimeout(() => {
      setToasts((prev) =>
        toastId ? prev.filter((t) => t.id !== toastId) : prev.slice(1)
      )
    }, 200)
  }, [])

  const toast = React.useCallback((props: ToastProps) => {
    const id = `toast-${++toastIdCounter}-${Date.now()}`
    setToasts((prev) => [...prev, { ...props, id, state: "open" }])

    const duration = props.duration ?? 5000
    setTimeout(() => {
      dismiss(id)
    }, duration)
  }, [dismiss])

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}

      {/* Toast container */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            data-state={t.state}
            className={`pointer-events-auto flex items-start gap-3 bg-theme-surface-raised shadow-warm-lg border rounded-xl p-4 max-w-sm ${
              t.state === "open" ? "toast-enter" : "toast-exit"
            } ${
              t.type === "error" ? "border-red-200" :
              t.type === "success" ? "border-emerald-200" :
              t.type === "warning" ? "border-amber-200" :
              "border-theme-neutral-300"
            }`}
          >
            <ToastIcon type={t.type} />
            <div className="flex-1 min-w-0">
              {t.title && <div className="font-medium text-sm text-theme-text-primary">{t.title}</div>}
              {t.description && <div className="text-sm text-theme-text-tertiary mt-0.5 truncate">{t.description}</div>}
              {t.action && <div className="mt-2">{t.action}</div>}
              {t.undoAction && (
                <button
                  onClick={() => {
                    t.undoAction?.()
                    dismiss(t.id)
                  }}
                  className="mt-1.5 text-sm font-medium text-theme-primary hover:underline transition-colors duration-150"
                >
                  Undo
                </button>
              )}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              className="shrink-0 text-theme-text-quaternary hover:text-theme-text-secondary transition-colors duration-150"
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => {
  const context = React.useContext(ToastContext)

  if (!context) {
    throw new Error("useToast must be used within a ToastProvider")
  }

  return context
}
