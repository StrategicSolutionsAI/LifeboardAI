"use client"

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Settings, Check, AlertCircle, Palette, Plus, Trash2, Edit3, Square, ChevronDown, X, Download, Upload, Loader2, CheckCircle2 } from 'lucide-react'
import { ThemeColor, getAllThemes, createCustomTheme, saveCustomTheme, deleteCustomTheme, updateCustomTheme } from '@/lib/theme'
import { useTheme } from '@/components/theme-provider'
import { cn } from '@/lib/utils'
import { getUserPreferencesClient, saveUserPreferences, UserPreferences } from '@/lib/user-preferences'
import { invalidateBucketColorCache } from '@/lib/bucket-colors'

/** Curated palette from the Calidoraplanner-codex design system */
const PALETTE_COLORS = [
  { hex: '#B1916A', label: 'Warm Brown' },
  { hex: '#bb9e7b', label: 'Calidora Sand' },
  { hex: '#dbd6cf', label: 'Warm Border' },
  { hex: '#C4A44E', label: 'Golden' },
  { hex: '#d97706', label: 'Amber' },
  { hex: '#7d6349', label: 'Cedar' },
  { hex: '#48B882', label: 'Green' },
  { hex: '#4AADE0', label: 'Sky Blue' },
  { hex: '#596881', label: 'Slate' },
  { hex: '#8B7FD4', label: 'Plum' },
  { hex: '#D07AA4', label: 'Rose' },
  { hex: '#d62a9a', label: 'Magenta' },
  { hex: '#030213', label: 'Navy' },
  { hex: '#314158', label: 'Dark Slate' },
  { hex: '#8e99a8', label: 'Muted Gray' },
  { hex: '#faf8f5', label: 'Warm White' },
]

function PaletteSwatches({ value, onSelect }: { value: string; onSelect: (hex: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {PALETTE_COLORS.map(({ hex, label }) => (
        <button
          key={hex}
          type="button"
          title={`${label} (${hex})`}
          onClick={() => onSelect(hex)}
          className={cn(
            'w-8 h-8 rounded-full border-2 transition-all hover:scale-110',
            value.toLowerCase() === hex.toLowerCase()
              ? 'border-theme-primary ring-2 ring-theme-primary/30 scale-110'
              : 'border-theme-neutral-300 hover:border-theme-primary'
          )}
          style={{ backgroundColor: hex }}
        />
      ))}
    </div>
  )
}

/** Compact popover for picking a bucket color from the palette */
function BucketColorPicker({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  const [open, setOpen] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div className="relative" ref={popoverRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 border border-theme-neutral-300 rounded-lg bg-white hover:bg-theme-surface-alt transition-colors"
      >
        <div className="w-6 h-6 rounded-full border border-theme-neutral-300" style={{ backgroundColor: value }} />
        <span className="text-xs font-mono text-theme-text-secondary uppercase">{value}</span>
        <ChevronDown className={cn("w-3.5 h-3.5 text-theme-text-tertiary transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 bg-white rounded-xl border border-theme-neutral-300 shadow-[0px_8px_24px_rgba(163,133,96,0.12)] p-3 w-[220px]">
          <p className="text-[11px] font-medium text-theme-text-tertiary uppercase tracking-wider mb-2">Pick a Color</p>
          <div className="flex flex-wrap gap-2 mb-3">
            {PALETTE_COLORS.map(({ hex, label }) => (
              <button
                key={hex}
                type="button"
                title={`${label} (${hex})`}
                onClick={() => { onChange(hex); setOpen(false) }}
                className={cn(
                  'w-8 h-8 rounded-full border-2 transition-all hover:scale-110',
                  value.toLowerCase() === hex.toLowerCase()
                    ? 'border-theme-primary ring-2 ring-theme-primary/30 scale-110'
                    : 'border-theme-neutral-300 hover:border-theme-primary'
                )}
                style={{ backgroundColor: hex }}
              />
            ))}
          </div>
          <div className="flex gap-2 items-center border-t border-theme-neutral-300/50 pt-2">
            <input
              type="color"
              value={value}
              onChange={(e) => { onChange(e.target.value) }}
              className="w-8 h-8 border border-theme-neutral-300 rounded cursor-pointer shrink-0"
              title="Choose a custom color"
            />
            <input
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="#6B7280"
              className="flex-1 px-2 py-1 text-xs font-mono border border-theme-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-theme-primary focus:border-transparent"
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default function SettingsPageClient() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    const loadUserPreferences = async () => {
      const prefs = await getUserPreferencesClient()
      if (prefs) {
        setUserPreferences(prefs)
        setBucketColors(prefs.bucket_colors || {})
      }
    }
    if (mounted) {
      loadUserPreferences()
    }
    // Listen for cross-tab/dashboard updates to bucket colors
    const onBucketColorsChanged = async () => {
      const prefs = await getUserPreferencesClient()
      if (prefs) {
        setUserPreferences(prefs)
        setBucketColors(prefs.bucket_colors || {})
      }
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('bucketColorsChanged', onBucketColorsChanged)
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('bucketColorsChanged', onBucketColorsChanged)
      }
    }
  }, [mounted])

  const { theme, setTheme } = useTheme()
  const [showCustomColorForm, setShowCustomColorForm] = useState(false)
  const [editingTheme, setEditingTheme] = useState<ThemeColor | null>(null)
  const [customThemeName, setCustomThemeName] = useState('')
  const [customPrimary, setCustomPrimary] = useState('#B1916A')
  const [customSecondary, setCustomSecondary] = useState('#9CA3FF')
  const [customAccent, setCustomAccent] = useState('#B4BAFF')
  const [allThemes, setAllThemes] = useState<ThemeColor[]>(getAllThemes())
  const [userPreferences, setUserPreferences] = useState<UserPreferences | null>(null)
  const [bucketColors, setBucketColors] = useState<Record<string, string>>({})

  // Data backup state
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [backupStatus, setBackupStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [showImportConfirm, setShowImportConfirm] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleCreateCustomTheme = () => {
    if (!customThemeName.trim()) return
    const newTheme = createCustomTheme(customThemeName.trim(), customPrimary, customSecondary, customAccent)
    saveCustomTheme(newTheme)
    setTheme(newTheme)
    setAllThemes(getAllThemes())
    resetForm()
  }

  const handleDeleteCustomTheme = (themeId: string) => {
    deleteCustomTheme(themeId)
    setAllThemes(getAllThemes())
  }

  const handleEditTheme = (themeToEdit: ThemeColor) => {
    setEditingTheme(themeToEdit)
    setCustomThemeName(themeToEdit.name)
    setCustomPrimary(themeToEdit.primary)
    setCustomSecondary(themeToEdit.secondary)
    setCustomAccent(themeToEdit.accent)
    setShowCustomColorForm(true)
  }

  const handleUpdateCustomTheme = () => {
    if (!editingTheme || !customThemeName.trim()) return
    const updatedTheme = updateCustomTheme(editingTheme.id, {
      name: customThemeName.trim(),
      primary: customPrimary,
      secondary: customSecondary,
      accent: customAccent
    })
    if (updatedTheme) {
      setAllThemes(getAllThemes())
      if (theme.id === editingTheme.id) setTheme(updatedTheme)
    }
    resetForm()
  }

  const resetForm = () => {
    setCustomThemeName('')
    setCustomPrimary('#B1916A')
    setCustomSecondary('#9CA3FF')
    setCustomAccent('#B4BAFF')
    setShowCustomColorForm(false)
    setEditingTheme(null)
  }

  const handleFormSubmit = () => {
    if (editingTheme) handleUpdateCustomTheme()
    else handleCreateCustomTheme()
  }

  const handleBucketColorChange = async (bucketName: string, color: string) => {
    const newBucketColors = { ...bucketColors, [bucketName]: color }
    setBucketColors(newBucketColors)

    // Store in localStorage as backup
    localStorage.setItem('bucket_colors', JSON.stringify(newBucketColors))

    if (userPreferences) {
      const updatedPrefs = {
        ...userPreferences,
        bucket_colors: newBucketColors
      }
      try {
        await saveUserPreferences(updatedPrefs)
        setUserPreferences(updatedPrefs)
        // Invalidate cache so other components get fresh colors
        invalidateBucketColorCache()
        // Broadcast to live views (dashboard etc.)
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('bucketColorsChanged'))
        }
      } catch (error) {
      }
    }
  }

  const handleExport = useCallback(async () => {
    setIsExporting(true)
    setBackupStatus(null)
    try {
      const res = await fetch('/api/data-backup', { credentials: 'include' })
      if (!res.ok) {
        const err = await res.text().catch(() => '')
        console.error('Export failed:', res.status, err)
        throw new Error('Export failed')
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `lifeboard-backup-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setBackupStatus({ type: 'success', message: 'Backup downloaded successfully' })
    } catch {
      setBackupStatus({ type: 'error', message: 'Failed to export data. Please try again.' })
    } finally {
      setIsExporting(false)
    }
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPendingFile(file)
    setShowImportConfirm(true)
    // Reset input so the same file can be re-selected
    e.target.value = ''
  }, [])

  const handleImportConfirm = useCallback(async () => {
    if (!pendingFile) return
    setIsImporting(true)
    setShowImportConfirm(false)
    setBackupStatus(null)
    try {
      const text = await pendingFile.text()
      const json = JSON.parse(text)
      const res = await fetch('/api/data-backup', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(json),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Import failed')
      }
      const result = await res.json()
      const totalImported = Object.values(result.results as Record<string, { imported: number }>)
        .reduce((sum, r) => sum + r.imported, 0)
      setBackupStatus({ type: 'success', message: `Restored ${totalImported} records successfully` })
    } catch (err: any) {
      setBackupStatus({ type: 'error', message: err.message || 'Failed to import data. Please check the file format.' })
    } finally {
      setIsImporting(false)
      setPendingFile(null)
    }
  }, [pendingFile])

  const handleImportCancel = useCallback(() => {
    setShowImportConfirm(false)
    setPendingFile(null)
  }, [])

  const getDefaultBucketColor = () => '#6B7280'

  if (!mounted) return null

  return (
    <div className="max-w-4xl min-h-screen">
        {/* ── Page header ─────────────────────────────────── */}
        <div className="mb-6">
          <p className="text-sm text-theme-text-tertiary">Manage your preferences and account settings</p>
        </div>

        <div className="space-y-8">

          {/* ── Account ────────────────────────────────────── */}
          <div className="bg-white p-4 sm:p-6 rounded-xl shadow-warm-sm border border-theme-neutral-300">
            <h2 className="text-xl font-semibold mb-4">Account Settings</h2>
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 bg-theme-surface-alt rounded-lg">
                <div>
                  <h3 className="font-medium">Profile Information</h3>
                  <p className="text-sm text-theme-text-tertiary">Update your name, email, and other account details</p>
                </div>
                <button className="px-4 py-2 text-sm font-medium text-theme-text-primary border border-theme-neutral-300 bg-theme-surface-raised hover:bg-theme-surface-alt rounded-lg transition-colors shrink-0 w-full sm:w-auto text-center">Edit Profile</button>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 bg-theme-surface-alt rounded-lg">
                <div>
                  <h3 className="font-medium">Change Password</h3>
                  <p className="text-sm text-theme-text-tertiary">Update your account password</p>
                </div>
                <button className="px-4 py-2 text-sm font-medium text-theme-text-primary border border-theme-neutral-300 bg-theme-surface-raised hover:bg-theme-surface-alt rounded-lg transition-colors shrink-0 w-full sm:w-auto text-center">Change Password</button>
              </div>
            </div>
          </div>

          {/* ── Appearance ─────────────────────────────────── */}
          <div className="bg-white p-4 sm:p-6 rounded-xl shadow-warm-sm border border-theme-neutral-300">
            <div className="flex items-center gap-3 mb-6">
              <Palette className="w-5 h-5 text-theme-text-tertiary" />
              <div>
                <h2 className="text-xl font-semibold">Appearance</h2>
                <p className="text-theme-text-tertiary text-sm">Customize your theme and color preferences</p>
              </div>
            </div>

            {/* ── Theme grid (compact 2-col) ── */}
            <div>
              <h3 className="text-sm font-medium text-theme-text-primary uppercase tracking-wider mb-3">Theme Colors</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {allThemes.map((colorTheme) => (
                  <div
                    key={colorTheme.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setTheme(colorTheme)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setTheme(colorTheme) } }}
                    className={cn(
                      "group relative flex items-center gap-3 p-3 rounded-lg border-2 transition-all cursor-pointer",
                      theme.id === colorTheme.id
                        ? "border-theme-primary bg-theme-brand-tint-muted"
                        : "border-transparent bg-theme-surface-alt hover:border-theme-neutral-300"
                    )}
                  >
                    {/* Color dots stacked */}
                    <div className="flex gap-0.5 shrink-0">
                      <div className="w-5 h-5 rounded-full border border-theme-neutral-300" style={{ backgroundColor: colorTheme.primary }} />
                      <div className="w-5 h-5 rounded-full border border-theme-neutral-300" style={{ backgroundColor: colorTheme.secondary }} />
                      <div className="w-5 h-5 rounded-full border border-theme-neutral-300" style={{ backgroundColor: colorTheme.accent }} />
                    </div>

                    {/* Label */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-[#171A1F] truncate">{colorTheme.name}</span>
                        {colorTheme.isCustom && (
                          <span className="px-1.5 py-0.5 text-2xs font-medium text-amber-600 bg-amber-100 rounded-full leading-none">Custom</span>
                        )}
                      </div>
                      <p className="text-xs text-theme-text-tertiary truncate">{colorTheme.description}</p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      {colorTheme.isCustom && (
                        <>
                          <button onClick={(e) => { e.stopPropagation(); handleEditTheme(colorTheme) }} className="p-1 text-warm-400 hover:text-warm-700 opacity-0 group-hover:opacity-100 transition-opacity" title="Edit">
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); handleDeleteCustomTheme(colorTheme.id) }} className="p-1 text-red-400 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity" title="Delete">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                      {theme.id === colorTheme.id && (
                        <div className="flex items-center justify-center w-5 h-5 rounded-full bg-theme-primary">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Create Custom Theme trigger */}
              <button
                onClick={() => setShowCustomColorForm(!showCustomColorForm)}
                className={cn(
                  "w-full mt-3 p-3 rounded-lg border-2 border-dashed transition-all text-center",
                  showCustomColorForm
                    ? "border-theme-primary bg-theme-brand-tint-muted"
                    : "border-theme-neutral-300 hover:border-theme-primary bg-theme-surface-alt hover:bg-theme-brand-tint-muted"
                )}
              >
                <div className="flex items-center justify-center gap-2 text-sm">
                  {showCustomColorForm ? <X className="w-4 h-4 text-theme-primary" /> : <Plus className="w-4 h-4 text-theme-text-tertiary" />}
                  <span className={cn("font-medium", showCustomColorForm ? "text-theme-primary" : "text-theme-text-tertiary")}>
                    {showCustomColorForm ? 'Close' : 'Create Custom Theme'}
                  </span>
                </div>
              </button>
            </div>

            {/* ── Custom theme form ── */}
            {showCustomColorForm && (
              <div className="mt-4 p-4 sm:p-5 bg-theme-surface-alt rounded-lg border border-theme-neutral-300">
                <h4 className="text-base font-medium mb-4">{editingTheme ? 'Edit Custom Theme' : 'Create Custom Theme'}</h4>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-theme-text-primary mb-1.5">Theme Name</label>
                    <input type="text" value={customThemeName} onChange={(e) => setCustomThemeName(e.target.value)} placeholder="My Awesome Theme" className="w-full px-3 py-2 border border-theme-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-theme-primary focus:border-transparent bg-white" />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-theme-text-primary mb-1.5">Primary Color</label>
                      <div className="flex gap-2 items-center">
                        <input type="color" title="Choose primary color" value={customPrimary} onChange={(e) => setCustomPrimary(e.target.value)} className="w-10 h-9 border border-theme-neutral-300 rounded cursor-pointer" />
                        <input type="text" placeholder="#B1916A" value={customPrimary} onChange={(e) => setCustomPrimary(e.target.value)} className="flex-1 px-3 py-1.5 text-sm border border-theme-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-theme-primary focus:border-transparent bg-white font-mono" />
                      </div>
                      <PaletteSwatches value={customPrimary} onSelect={setCustomPrimary} />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-theme-text-primary mb-1.5">Secondary Color</label>
                      <div className="flex gap-2 items-center">
                        <input type="color" title="Choose secondary color" value={customSecondary} onChange={(e) => setCustomSecondary(e.target.value)} className="w-10 h-9 border border-theme-neutral-300 rounded cursor-pointer" />
                        <input type="text" placeholder="#9CA3FF" value={customSecondary} onChange={(e) => setCustomSecondary(e.target.value)} className="flex-1 px-3 py-1.5 text-sm border border-theme-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-theme-primary focus:border-transparent bg-white font-mono" />
                      </div>
                      <PaletteSwatches value={customSecondary} onSelect={setCustomSecondary} />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-theme-text-primary mb-1.5">Accent Color</label>
                      <div className="flex gap-2 items-center">
                        <input type="color" title="Choose accent color" value={customAccent} onChange={(e) => setCustomAccent(e.target.value)} className="w-10 h-9 border border-theme-neutral-300 rounded cursor-pointer" />
                        <input type="text" placeholder="#B4BAFF" value={customAccent} onChange={(e) => setCustomAccent(e.target.value)} className="flex-1 px-3 py-1.5 text-sm border border-theme-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-theme-primary focus:border-transparent bg-white font-mono" />
                      </div>
                      <PaletteSwatches value={customAccent} onSelect={setCustomAccent} />
                    </div>
                  </div>

                  {/* Live preview */}
                  <div className="p-3 bg-white rounded-lg border border-theme-neutral-300/50">
                    <p className="text-xs font-medium text-theme-text-tertiary uppercase tracking-wider mb-2">Preview</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="px-3 py-1.5 rounded-full text-white text-xs font-medium" style={{ backgroundColor: customPrimary }}>Primary</div>
                      <div className="px-3 py-1.5 rounded-full text-white text-xs font-medium" style={{ backgroundColor: customSecondary }}>Secondary</div>
                      <div className="px-3 py-1.5 rounded-full text-white text-xs font-medium" style={{ backgroundColor: customAccent }}>Accent</div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button onClick={handleFormSubmit} disabled={!customThemeName.trim()} className="px-4 py-2 text-sm bg-theme-primary text-white rounded-md hover:bg-theme-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                      {editingTheme ? 'Update Theme' : 'Create Theme'}
                    </button>
                    <button onClick={resetForm} className="px-4 py-2 text-sm border border-theme-neutral-300 text-theme-text-primary rounded-md hover:bg-white transition-colors">Cancel</button>
                  </div>
                </div>
              </div>
            )}

            {/* ── Active theme preview (only shown when custom form is closed) ── */}
            {!showCustomColorForm && (
              <div className="flex items-center gap-3 mt-4 p-3 bg-theme-surface-alt rounded-lg border border-theme-neutral-300/50">
                <span className="text-xs font-medium text-theme-text-tertiary uppercase tracking-wider shrink-0">Active:</span>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="px-3 py-1 rounded-full text-white text-xs font-medium" style={{ backgroundColor: theme.primary }}>Primary</div>
                  <div className="px-3 py-1 rounded-full text-white text-xs font-medium" style={{ backgroundColor: theme.secondary }}>Secondary</div>
                  <div className="px-3 py-1 rounded-full text-white text-xs font-medium" style={{ backgroundColor: theme.accent }}>Accent</div>
                </div>
                <span className="text-xs text-theme-text-secondary ml-auto hidden sm:block">{theme.name}</span>
              </div>
            )}
          </div>

          {/* ── Bucket Colors ──────────────────────────────── */}
          {((userPreferences && userPreferences.life_buckets.length > 0) || true) && (
            <div className="bg-white p-4 sm:p-6 rounded-xl shadow-warm-sm border border-theme-neutral-300">
              <div className="flex items-center gap-3 mb-5">
                <Square className="w-5 h-5 text-theme-text-tertiary" />
                <div>
                  <h2 className="text-xl font-semibold">Bucket Colors</h2>
                  <p className="text-sm text-theme-text-tertiary">Customize the colors for your life buckets</p>
                </div>
              </div>

              <div className="space-y-2">
                {(userPreferences?.life_buckets || []).map((bucket) => (
                  <div key={bucket} className="flex items-center justify-between p-3 bg-theme-surface-alt rounded-lg">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-4 h-4 rounded-full shrink-0"
                        style={{ backgroundColor: bucketColors[bucket] || getDefaultBucketColor() }}
                      />
                      <span className="font-medium text-sm">{bucket}</span>
                    </div>
                    <BucketColorPicker
                      value={bucketColors[bucket] || getDefaultBucketColor()}
                      onChange={(hex) => handleBucketColorChange(bucket, hex)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Data Backup & Restore ──────────────────────── */}
          <div className="bg-white p-4 sm:p-6 rounded-xl shadow-warm-sm border border-theme-neutral-300">
            <div className="flex items-center gap-3 mb-5">
              <Download className="w-5 h-5 text-theme-text-tertiary" />
              <div>
                <h2 className="text-xl font-semibold">Data Backup & Restore</h2>
                <p className="text-sm text-theme-text-tertiary">Download your data or restore from a previous backup</p>
              </div>
            </div>

            <div className="space-y-3">
              {/* Export */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 bg-theme-surface-alt rounded-lg">
                <div>
                  <h3 className="font-medium">Download Backup</h3>
                  <p className="text-sm text-theme-text-tertiary">Export all your tasks, preferences, calendar events, and tracking data as a JSON file</p>
                </div>
                <button
                  onClick={handleExport}
                  disabled={isExporting}
                  className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-theme-primary hover:bg-theme-secondary rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0 w-full sm:w-auto"
                >
                  {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  {isExporting ? 'Exporting...' : 'Download'}
                </button>
              </div>

              {/* Import */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 bg-theme-surface-alt rounded-lg">
                <div>
                  <h3 className="font-medium">Restore from Backup</h3>
                  <p className="text-sm text-theme-text-tertiary">Upload a previously exported JSON file to restore your data</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isImporting}
                  className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-theme-text-primary border border-theme-neutral-300 bg-theme-surface-raised hover:bg-theme-surface-alt rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0 w-full sm:w-auto"
                >
                  {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {isImporting ? 'Importing...' : 'Upload Backup'}
                </button>
              </div>

              {/* Import confirmation dialog */}
              {showImportConfirm && (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <h4 className="font-medium text-yellow-800">Confirm Data Restore</h4>
                      <p className="text-sm text-yellow-700 mt-1">
                        This will merge the backup data with your existing data. Records with matching IDs will be overwritten.
                        File: <span className="font-medium">{pendingFile?.name}</span>
                      </p>
                      <div className="flex gap-3 mt-3">
                        <button
                          onClick={handleImportConfirm}
                          className="px-4 py-2 text-sm font-medium text-white bg-yellow-600 hover:bg-yellow-700 rounded-md transition-colors"
                        >
                          Yes, Restore Data
                        </button>
                        <button
                          onClick={handleImportCancel}
                          className="px-4 py-2 text-sm font-medium text-theme-text-primary border border-theme-neutral-300 hover:bg-white rounded-md transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Status message */}
              {backupStatus && (
                <div className={cn(
                  "flex items-center gap-2 p-3 rounded-lg text-sm",
                  backupStatus.type === 'success'
                    ? "bg-green-50 text-green-700 border border-green-200"
                    : "bg-red-50 text-red-700 border border-red-200"
                )}>
                  {backupStatus.type === 'success'
                    ? <CheckCircle2 className="w-4 h-4 shrink-0" />
                    : <AlertCircle className="w-4 h-4 shrink-0" />
                  }
                  {backupStatus.message}
                </div>
              )}
            </div>
          </div>

          {/* ── Advanced / Danger Zone ─────────────────────── */}
          <div className="bg-white p-4 sm:p-6 rounded-xl shadow-warm-sm border border-theme-neutral-300">
            <h2 className="text-xl font-semibold mb-4">Advanced Settings</h2>
            <div className="flex items-start p-4 bg-yellow-50 border border-yellow-100 rounded-lg">
              <AlertCircle className="w-5 h-5 text-yellow-500 mt-0.5 mr-3 flex-shrink-0" />
              <div>
                <h3 className="font-medium text-yellow-800">Danger Zone</h3>
                <p className="text-sm text-yellow-700 mb-3">These actions are irreversible. Please proceed with caution.</p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button className="px-4 py-2 text-sm font-medium text-red-600 border border-red-200 hover:bg-red-50 rounded-md transition-colors">Delete Account</button>
                </div>
              </div>
            </div>
          </div>
        </div>
    </div>
  )
}
