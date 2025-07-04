"use client"

import * as React from "react"

type ToastProps = {
  title?: string
  description?: string
  action?: React.ReactNode
  type?: "default" | "success" | "error" | "warning"
}

type ToastActionElement = React.ReactElement<unknown>

type ToastContextType = {
  toast: (props: ToastProps) => void
  dismiss: (toastId?: string) => void
}

const ToastContext = React.createContext<ToastContextType | undefined>(
  undefined
)

export function ToastProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [toasts, setToasts] = React.useState<ToastProps[]>([])

  const toast = React.useCallback((props: ToastProps) => {
    setToasts((prevToasts) => [...prevToasts, props])
    
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      setToasts((prevToasts) => prevToasts.slice(1))
    }, 5000)
  }, [])

  const dismiss = React.useCallback(() => {
    setToasts((prevToasts) => prevToasts.slice(1))
  }, [])

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}
      
      {/* Toast container */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((t, i) => (
          <div 
            key={i} 
            className={`bg-white shadow-lg rounded-md p-4 ${
              t.type === 'error' ? 'border-l-4 border-red-500' :
              t.type === 'success' ? 'border-l-4 border-green-500' :
              t.type === 'warning' ? 'border-l-4 border-yellow-500' :
              ''
            }`}
          >
            {t.title && <div className="font-medium">{t.title}</div>}
            {t.description && <div className="text-sm text-gray-500">{t.description}</div>}
            {t.action && <div className="mt-2">{t.action}</div>}
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
