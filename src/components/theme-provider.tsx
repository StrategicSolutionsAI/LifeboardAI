"use client"

import React, { createContext, useContext, useEffect, useState, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { ThemeColor, getUserTheme, applyTheme, themeColors } from '@/lib/theme'
import { getUserPreferencesClient, updateUserPreferenceFields } from '@/lib/user-preferences'

interface ThemeContextType {
  theme: ThemeColor
  setTheme: (theme: ThemeColor) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeColor>(() => getUserTheme())
  const pathname = usePathname()
  const hasSyncedRef = useRef(false)

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

    // Fire-and-forget sync to Supabase
    void updateUserPreferenceFields({ selected_theme: newTheme })
  }

  // Theme CSS vars are already applied by the inline <script> in layout.tsx
  // before React hydrates, so no blocking render needed. This effect keeps
  // the CSS vars in sync when the theme or page changes after mount.
  useEffect(() => {
    if (!isLandingPage) {
      applyTheme(theme)
    }
  }, [theme, isLandingPage])

  // On mount: fetch theme from Supabase for cross-device sync.
  // localStorage is used for instant load; Supabase is the source of truth.
  useEffect(() => {
    if (hasSyncedRef.current) return
    hasSyncedRef.current = true

    ;(async () => {
      try {
        const prefs = await getUserPreferencesClient()
        if (!prefs) return

        // Sync custom themes from DB → localStorage
        if (prefs.custom_themes && Array.isArray(prefs.custom_themes) && prefs.custom_themes.length > 0) {
          localStorage.setItem('custom_themes', JSON.stringify(prefs.custom_themes))
        }

        // Sync selected theme from DB → local state + localStorage
        if (prefs.selected_theme && typeof prefs.selected_theme === 'object' && prefs.selected_theme.id) {
          const dbTheme = prefs.selected_theme as unknown as ThemeColor
          const currentLocal = getUserTheme()

          // Only update if DB theme differs from what we loaded locally
          if (dbTheme.id !== currentLocal.id) {
            localStorage.setItem('user_theme', dbTheme.id)
            localStorage.setItem('theme_colors', JSON.stringify(dbTheme))
            setThemeState(dbTheme)
            if (!isLandingPage) {
              applyTheme(dbTheme)
            }
          }
        }
      } catch (err) {
        // Non-critical — user still has their local theme
        console.error('Failed to sync theme from Supabase:', err)
      }
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
