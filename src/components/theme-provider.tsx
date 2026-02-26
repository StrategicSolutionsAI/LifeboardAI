"use client"

import React, { createContext, useContext, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { ThemeColor, getUserTheme, applyTheme } from '@/lib/theme'

interface ThemeContextType {
  theme: ThemeColor
  setTheme: (theme: ThemeColor) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeColor>(() => getUserTheme())
  const pathname = usePathname()

  // Landing pages should not be affected by theme changes
  const isLandingPage = pathname === '/' || pathname === '/login' || pathname === '/signup'

  const setTheme = (newTheme: ThemeColor) => {
    setThemeState(newTheme)
    if (!isLandingPage) {
      applyTheme(newTheme)
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem('user_theme', newTheme.id)
      localStorage.setItem('theme_colors', JSON.stringify(newTheme))
    }
  }

  // Theme CSS vars are already applied by the inline <script> in layout.tsx
  // before React hydrates, so no blocking render needed. This effect keeps
  // the CSS vars in sync when the theme or page changes after mount.
  useEffect(() => {
    if (!isLandingPage) {
      applyTheme(theme)
    }
  }, [theme, isLandingPage])

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}