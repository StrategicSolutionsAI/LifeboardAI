"use client"

import type { ReactNode } from "react"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"

export default function MobileNavigationSheet({ children, onOpenChange, returnFocusTo }: {
  children: ReactNode
  onOpenChange: (open: boolean) => void
  returnFocusTo: HTMLButtonElement | null
}) {
  return (
    <Sheet open onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[calc(100dvh-1rem)] overflow-y-auto overscroll-contain pb-[max(1rem,env(safe-area-inset-bottom))]"
        onCloseAutoFocus={(event) => { event.preventDefault(); returnFocusTo?.focus() }}
      >
        <SheetHeader>
          <SheetTitle>Navigation</SheetTitle>
          <SheetDescription className="sr-only">Choose a workspace or manage your account.</SheetDescription>
        </SheetHeader>
        {children}
      </SheetContent>
    </Sheet>
  )
}
