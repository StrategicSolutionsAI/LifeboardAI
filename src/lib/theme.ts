export interface ThemeColor {
  id: string
  name: string
  primary: string
  secondary: string
  accent: string
  description: string
  isCustom?: boolean
}

export const themeColors: ThemeColor[] = [
  {
    id: "indigo",
    name: "Indigo Wave",
    primary: "#5271F8",
    secondary: "#7482FE", 
    accent: "#909CFF",
    description: "Classic professional blue"
  },
  {
    id: "emerald",
    name: "Forest Green",
    primary: "#059669",
    secondary: "#10b981",
    accent: "#34d399",
    description: "Fresh and natural"
  },
  {
    id: "purple",
    name: "Royal Purple",
    primary: "#7c3aed",
    secondary: "#8b5cf6",
    accent: "#a78bfa",
    description: "Creative and bold"
  },
  {
    id: "rose",
    name: "Sunset Rose",
    primary: "#e11d48",
    secondary: "#f43f5e",
    accent: "#fb7185",
    description: "Warm and energetic"
  },
  {
    id: "amber",
    name: "Golden Hour",
    primary: "#d97706",
    secondary: "#f59e0b",
    accent: "#fbbf24",
    description: "Bright and optimistic"
  },
  {
    id: "teal",
    name: "Ocean Breeze",
    primary: "#0d9488",
    secondary: "#14b8a6",
    accent: "#5eead4",
    description: "Calm and focused"
  },
  {
    id: "orange",
    name: "Citrus Burst",
    primary: "#ea580c",
    secondary: "#f97316",
    accent: "#fb923c",
    description: "Vibrant and fun"
  },
  {
    id: "violet",
    name: "Lavender Dream",
    primary: "#7c2d12",
    secondary: "#a21caf",
    accent: "#c084fc",
    description: "Elegant and sophisticated"
  }
]

export function getThemeColors(themeId: string = "indigo"): ThemeColor {
  return themeColors.find(theme => theme.id === themeId) || themeColors[0]
}

export function applyTheme(theme: ThemeColor) {
  if (typeof window === 'undefined') return
  
  const root = document.documentElement
  
  // Legacy properties for backwards compatibility
  root.style.setProperty('--theme-primary', theme.primary)
  root.style.setProperty('--theme-secondary', theme.secondary)
  root.style.setProperty('--theme-accent', theme.accent)
  
  // Update the full primary color scale based on the main primary color
  // Generate lighter and darker shades from the primary color
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null
  }
  
  const rgbToHex = (r: number, g: number, b: number) => {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)
  }
  
  const lighten = (color: string, amount: number) => {
    const rgb = hexToRgb(color)
    if (!rgb) return color
    const factor = 1 + amount
    return rgbToHex(
      Math.min(255, Math.round(rgb.r + (255 - rgb.r) * amount)),
      Math.min(255, Math.round(rgb.g + (255 - rgb.g) * amount)),
      Math.min(255, Math.round(rgb.b + (255 - rgb.b) * amount))
    )
  }
  
  const darken = (color: string, amount: number) => {
    const rgb = hexToRgb(color)
    if (!rgb) return color
    return rgbToHex(
      Math.max(0, Math.round(rgb.r * (1 - amount))),
      Math.max(0, Math.round(rgb.g * (1 - amount))),
      Math.max(0, Math.round(rgb.b * (1 - amount)))
    )
  }
  
  // Set primary color scale
  root.style.setProperty('--theme-primary-50', lighten(theme.primary, 0.9))
  root.style.setProperty('--theme-primary-100', lighten(theme.primary, 0.8))
  root.style.setProperty('--theme-primary-200', lighten(theme.primary, 0.6))
  root.style.setProperty('--theme-primary-300', lighten(theme.primary, 0.4))
  root.style.setProperty('--theme-primary-400', lighten(theme.primary, 0.2))
  root.style.setProperty('--theme-primary-500', theme.primary)
  root.style.setProperty('--theme-primary-600', darken(theme.primary, 0.1))
  root.style.setProperty('--theme-primary-700', darken(theme.primary, 0.2))
  root.style.setProperty('--theme-primary-800', darken(theme.primary, 0.3))
  root.style.setProperty('--theme-primary-900', darken(theme.primary, 0.4))
  root.style.setProperty('--theme-primary-950', darken(theme.primary, 0.5))
  
  // Set secondary color scale
  root.style.setProperty('--theme-secondary-50', lighten(theme.secondary, 0.9))
  root.style.setProperty('--theme-secondary-100', lighten(theme.secondary, 0.8))
  root.style.setProperty('--theme-secondary-200', lighten(theme.secondary, 0.6))
  root.style.setProperty('--theme-secondary-300', lighten(theme.secondary, 0.4))
  root.style.setProperty('--theme-secondary-400', lighten(theme.secondary, 0.2))
  root.style.setProperty('--theme-secondary-500', theme.secondary)
  root.style.setProperty('--theme-secondary-600', darken(theme.secondary, 0.1))
  root.style.setProperty('--theme-secondary-700', darken(theme.secondary, 0.2))
  root.style.setProperty('--theme-secondary-800', darken(theme.secondary, 0.3))
  root.style.setProperty('--theme-secondary-900', darken(theme.secondary, 0.4))
  root.style.setProperty('--theme-secondary-950', darken(theme.secondary, 0.5))
}

export function createCustomTheme(name: string, primary: string, secondary: string, accent: string): ThemeColor {
  return {
    id: `custom-${Date.now()}`,
    name,
    primary,
    secondary,
    accent,
    description: "Custom theme",
    isCustom: true
  }
}

export function saveCustomTheme(theme: ThemeColor) {
  if (typeof window === 'undefined') return
  
  try {
    const existingCustomThemes = getCustomThemes()
    const updatedThemes = [...existingCustomThemes, theme]
    localStorage.setItem('custom_themes', JSON.stringify(updatedThemes))
    localStorage.setItem('theme_colors', JSON.stringify(theme))
    localStorage.setItem('user_theme', theme.id)
  } catch (error) {
    console.error('Error saving custom theme:', error)
  }
}

export function getCustomThemes(): ThemeColor[] {
  if (typeof window === 'undefined') return []
  
  try {
    const stored = localStorage.getItem('custom_themes')
    return stored ? JSON.parse(stored) : []
  } catch (error) {
    console.error('Error loading custom themes:', error)
    return []
  }
}

export function getAllThemes(): ThemeColor[] {
  return [...themeColors, ...getCustomThemes()]
}

export function updateCustomTheme(themeId: string, updatedTheme: Partial<Pick<ThemeColor, 'name' | 'primary' | 'secondary' | 'accent' | 'description'>>) {
  if (typeof window === 'undefined') return null
  
  try {
    const existingCustomThemes = getCustomThemes()
    const themeIndex = existingCustomThemes.findIndex(theme => theme.id === themeId)
    
    if (themeIndex === -1) {
      console.error('Custom theme not found:', themeId)
      return null
    }
    
    // Update the theme
    const updatedThemeData = {
      ...existingCustomThemes[themeIndex],
      ...updatedTheme
    }
    
    existingCustomThemes[themeIndex] = updatedThemeData
    localStorage.setItem('custom_themes', JSON.stringify(existingCustomThemes))
    
    // If this is the currently active theme, update it
    const currentTheme = localStorage.getItem('user_theme')
    if (currentTheme === themeId) {
      localStorage.setItem('theme_colors', JSON.stringify(updatedThemeData))
      applyTheme(updatedThemeData)
    }
    
    return updatedThemeData
  } catch (error) {
    console.error('Error updating custom theme:', error)
    return null
  }
}

export function deleteCustomTheme(themeId: string) {
  if (typeof window === 'undefined') return
  
  try {
    const existingCustomThemes = getCustomThemes()
    const updatedThemes = existingCustomThemes.filter(theme => theme.id !== themeId)
    localStorage.setItem('custom_themes', JSON.stringify(updatedThemes))
    
    // If the deleted theme was active, switch to default
    const currentTheme = localStorage.getItem('user_theme')
    if (currentTheme === themeId) {
      const defaultTheme = themeColors[0]
      localStorage.setItem('user_theme', defaultTheme.id)
      localStorage.setItem('theme_colors', JSON.stringify(defaultTheme))
      applyTheme(defaultTheme)
    }
  } catch (error) {
    console.error('Error deleting custom theme:', error)
  }
}

export function getUserTheme(): ThemeColor {
  if (typeof window === 'undefined') return themeColors[0]
  
  try {
    const storedTheme = localStorage.getItem('theme_colors')
    if (storedTheme) {
      const parsed = JSON.parse(storedTheme)
      return parsed
    }
    
    const themeId = localStorage.getItem('user_theme')
    if (themeId) {
      const allThemes = getAllThemes()
      return allThemes.find(theme => theme.id === themeId) || themeColors[0]
    }
  } catch (error) {
    console.error('Error loading user theme:', error)
  }
  
  return themeColors[0] // Default to indigo
}