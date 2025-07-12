"use client"

import React, { createContext, useContext, useEffect, useState } from 'react'
import { ThemeColor, getUserTheme, applyTheme } from '@/lib/theme'

interface ThemeContextType {
  theme: ThemeColor
  setTheme: (theme: ThemeColor) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeColor>(() => getUserTheme())

  const setTheme = (newTheme: ThemeColor) => {
    setThemeState(newTheme)
    applyTheme(newTheme)
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('user_theme', newTheme.id)
      localStorage.setItem('theme_colors', JSON.stringify(newTheme))
    }
  }

  useEffect(() => {
    // Apply theme on mount
    applyTheme(theme)
  }, [theme])

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