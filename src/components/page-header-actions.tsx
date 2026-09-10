"use client"

import { createContext, useContext, type ReactNode } from "react"
import { createPortal } from "react-dom"

const HeaderActionsTarget = createContext<HTMLElement | null | undefined>(undefined)

export function PageHeaderActionsProvider({ target, children }: { target: HTMLElement | null; children: ReactNode }) {
  return <HeaderActionsTarget.Provider value={target}>{children}</HeaderActionsTarget.Provider>
}

/** Keep action state in the page while rendering its controls beside the page title. */
export function PageHeaderActions({ children }: { children: ReactNode }) {
  const target = useContext(HeaderActionsTarget)

  // Standalone page renders (including tests) still expose their actions.
  if (target === undefined) return <div className="flex items-center gap-2">{children}</div>
  return target ? createPortal(children, target) : null
}
