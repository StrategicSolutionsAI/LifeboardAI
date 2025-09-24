"use client"

import React, { useState, useEffect } from 'react'
import { Settings, Check, AlertCircle, Palette, Plus, Trash2, Edit3, Square } from 'lucide-react'
import { ThemeColor, getAllThemes, createCustomTheme, saveCustomTheme, deleteCustomTheme, updateCustomTheme } from '@/lib/theme'
import { useTheme } from '@/components/theme-provider'
import { cn } from '@/lib/utils'
import { SidebarLayout } from '@/components/sidebar-layout'
import { getUserPreferencesClient, saveUserPreferences, UserPreferences } from '@/lib/user-preferences'
import { invalidateBucketColorCache } from '@/lib/bucket-colors'

export default function SettingsPageClient() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    const loadUserPreferences = async () => {
      console.log('Loading user preferences...')
      const prefs = await getUserPreferencesClient()
      console.log('User preferences loaded:', prefs)
      if (prefs) {
        console.log('Life buckets:', prefs.life_buckets)
        console.log('Bucket colors:', prefs.bucket_colors)
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
  const [customPrimary, setCustomPrimary] = useState('#8491FF')
  const [customSecondary, setCustomSecondary] = useState('#9CA3FF')
  const [customAccent, setCustomAccent] = useState('#B4BAFF')
  const [allThemes, setAllThemes] = useState<ThemeColor[]>(getAllThemes())
  const [userPreferences, setUserPreferences] = useState<UserPreferences | null>(null)
  const [bucketColors, setBucketColors] = useState<Record<string, string>>({})

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
    setCustomPrimary('#8491FF')
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
        console.log('Could not save to database, using localStorage fallback:', error)
      }
    }
  }

  const getDefaultBucketColor = () => '#6B7280'

  if (!mounted) return null

  return (
    <SidebarLayout>
      <div className="p-4 sm:p-6 max-w-4xl mx-auto min-h-screen">
        <div className="flex items-center gap-3 mb-6 sm:mb-8">
          <Settings className="w-6 h-6 text-gray-600" />
          <h1 className="text-2xl sm:text-3xl font-bold">Settings</h1>
        </div>

        <div className="space-y-8">
          {/* Debug Section - Remove after testing */}
          <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
            <h3 className="font-medium text-yellow-800 mb-2">Debug Info</h3>
            <div className="text-sm text-yellow-700 space-y-1">
              <p>Mounted: {mounted.toString()}</p>
              <p>User Preferences: {userPreferences ? 'Loaded' : 'Not loaded'}</p>
              <p>Life Buckets: {userPreferences?.life_buckets?.length || 0}</p>
              <p>Bucket Colors: {Object.keys(bucketColors).length}</p>
              {userPreferences?.life_buckets && (
                <p>Buckets: {userPreferences.life_buckets.join(', ')}</p>
              )}
            </div>
          </div>

          <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border">
            <h2 className="text-xl font-semibold mb-4">Account Settings</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <h3 className="font-medium">Profile Information</h3>
                  <p className="text-sm text-gray-500">Update your name, email, and other account details</p>
                </div>
                <button className="px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-md">Edit Profile</button>
              </div>
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <h3 className="font-medium">Change Password</h3>
                  <p className="text-sm text-gray-500">Update your account password</p>
                </div>
                <button className="px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-md">Change Password</button>
              </div>
            </div>
          </div>

          <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border">
            <div className="flex items-center gap-3 mb-6">
              <Palette className="w-5 h-5 text-gray-600" />
              <div>
                <h2 className="text-xl font-semibold">Appearance</h2>
                <p className="text-gray-500">Customize your theme and color preferences</p>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium mb-4">Theme Colors</h3>
                <p className="text-sm text-gray-500 mb-4">Choose a color scheme that matches your style</p>

                <div className="grid grid-cols-1 gap-3">
                  {allThemes.map((colorTheme) => (
                    <div
                      key={colorTheme.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setTheme(colorTheme)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setTheme(colorTheme) } }}
                      className={cn(
                        "w-full p-4 rounded-lg border-2 transition-all text-left cursor-pointer",
                        theme.id === colorTheme.id
                          ? "border-theme-primary bg-theme-primary bg-opacity-10"
                          : "border-[#E5E7EB] bg-white hover:border-[#D1D5DB]"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex gap-1">
                            <div className="w-6 h-6 rounded-full border border-gray-200" style={{ backgroundColor: colorTheme.primary }} />
                            <div className="w-6 h-6 rounded-full border border-gray-200" style={{ backgroundColor: colorTheme.secondary }} />
                            <div className="w-6 h-6 rounded-full border border-gray-200" style={{ backgroundColor: colorTheme.accent }} />
                          </div>
                          <div>
                            <h4 className="text-[16px] font-medium text-[#171A1F]">
                              {colorTheme.name}
                              {colorTheme.isCustom && (
                                <span className="ml-2 px-2 py-0.5 text-xs font-medium text-purple-600 bg-purple-100 rounded-full">Custom</span>
                              )}
                            </h4>
                            <p className="text-[14px] text-[#6B7280]">{colorTheme.description}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {colorTheme.isCustom && (
                            <>
                              <button onClick={(e) => { e.stopPropagation(); handleEditTheme(colorTheme) }} className="p-1 text-blue-500 hover:text-blue-700" title="Edit custom theme">
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); handleDeleteCustomTheme(colorTheme.id) }} className="p-1 text-red-500 hover:text-red-700" title="Delete custom theme">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          {theme.id === colorTheme.id && (
                            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-theme-primary">
                              <Check className="w-4 h-4 text-white" />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  <button onClick={() => setShowCustomColorForm(!showCustomColorForm)} className="w-full p-4 rounded-lg border-2 border-dashed border-gray-300 hover:border-theme-primary transition-all text-left bg-gray-50 hover:bg-gray-100">
                    <div className="flex items-center justify-center gap-2 text-gray-600 hover:text-theme-primary">
                      <Plus className="w-5 h-5" />
                      <span className="font-medium">Create Custom Theme</span>
                    </div>
                  </button>
                </div>

                {showCustomColorForm && (
                  <div className="mt-6 p-4 sm:p-6 bg-gray-50 rounded-lg border">
                    <h4 className="text-lg font-medium mb-4">{editingTheme ? 'Edit Custom Theme' : 'Create Custom Theme'}</h4>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Theme Name</label>
                        <input type="text" value={customThemeName} onChange={(e) => setCustomThemeName(e.target.value)} placeholder="My Awesome Theme" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-theme-primary focus:border-transparent" />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Primary Color</label>
                          <div className="flex gap-2 items-center">
                            <input type="color" title="Choose primary color" value={customPrimary} onChange={(e) => setCustomPrimary(e.target.value)} className="w-12 h-10 border border-gray-300 rounded cursor-pointer" />
                            <input type="text" placeholder="#8491FF" value={customPrimary} onChange={(e) => setCustomPrimary(e.target.value)} className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-theme-primary focus:border-transparent" />
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Secondary Color</label>
                          <div className="flex gap-2 items-center">
                            <input type="color" title="Choose secondary color" value={customSecondary} onChange={(e) => setCustomSecondary(e.target.value)} className="w-12 h-10 border border-gray-300 rounded cursor-pointer" />
                            <input type="text" placeholder="#9CA3FF" value={customSecondary} onChange={(e) => setCustomSecondary(e.target.value)} className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-theme-primary focus:border-transparent" />
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Accent Color</label>
                          <div className="flex gap-2 items-center">
                            <input type="color" title="Choose accent color" value={customAccent} onChange={(e) => setCustomAccent(e.target.value)} className="w-12 h-10 border border-gray-300 rounded cursor-pointer" />
                            <input type="text" placeholder="#B4BAFF" value={customAccent} onChange={(e) => setCustomAccent(e.target.value)} className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-theme-primary focus:border-transparent" />
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 p-4 bg-white rounded-lg border">
                        <h5 className="text-sm font-medium text-gray-700 mb-3">Preview</h5>
                        <div className="flex items-center gap-3 flex-wrap">
                          <div className="px-4 py-2 rounded-full text-white text-sm font-medium" style={{ backgroundColor: customPrimary }}>Primary</div>
                          <div className="px-4 py-2 rounded-full text-white text-sm font-medium" style={{ backgroundColor: customSecondary }}>Secondary</div>
                          <div className="px-4 py-2 rounded-full text-white text-sm font-medium" style={{ backgroundColor: customAccent }}>Accent</div>
                        </div>
                      </div>

                      <div className="flex gap-3 pt-4">
                        <button onClick={handleFormSubmit} disabled={!customThemeName.trim()} className="px-4 py-2 bg-theme-primary text-white rounded-md hover:bg-theme-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                          {editingTheme ? 'Update Theme' : 'Create Theme'}
                        </button>
                        <button onClick={resetForm} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors">Cancel</button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-3 mt-6 p-4 bg-[#F9FAFB] rounded-lg border">
                  <h4 className="text-[16px] font-medium text-[#171A1F]">Preview</h4>
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="px-4 py-2 rounded-full text-white text-sm font-medium" style={{ backgroundColor: theme.primary }}>Primary Button</div>
                    <div className="px-4 py-2 rounded-full text-white text-sm font-medium" style={{ backgroundColor: theme.secondary }}>Secondary</div>
                    <div className="px-4 py-2 rounded-full text-white text-sm font-medium" style={{ backgroundColor: theme.accent }}>Accent</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {((userPreferences && userPreferences.life_buckets.length > 0) || true) && (
            <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border">
              <div className="flex items-center gap-3 mb-6">
                <Square className="w-5 h-5 text-gray-600" />
                <div>
                  <h2 className="text-xl font-semibold">Bucket Colors</h2>
                  <p className="text-gray-500">Customize the colors for your life buckets</p>
                </div>
              </div>

              <div className="space-y-4">
                {(userPreferences?.life_buckets || ['Health', 'Work', 'Personal', 'Finance']).map((bucket) => (
                  <div key={bucket} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-6 h-6 rounded-full border border-gray-200"
                        style={{ backgroundColor: bucketColors[bucket] || getDefaultBucketColor() }}
                      />
                      <div>
                        <h3 className="font-medium">{bucket}</h3>
                        <p className="text-sm text-gray-500">Change the color for this bucket</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={bucketColors[bucket] || getDefaultBucketColor()}
                        onChange={(e) => handleBucketColorChange(bucket, e.target.value)}
                        className="w-10 h-10 border border-gray-300 rounded cursor-pointer"
                        title={`Choose color for ${bucket}`}
                      />
                      <input
                        type="text"
                        value={bucketColors[bucket] || getDefaultBucketColor()}
                        onChange={(e) => handleBucketColorChange(bucket, e.target.value)}
                        placeholder="#6B7280"
                        className="w-20 px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-theme-primary focus:border-transparent"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border">
            <h2 className="text-xl font-semibold mb-4">Advanced Settings</h2>
            <div className="space-y-4">
              <div className="flex items-start p-4 bg-yellow-50 border border-yellow-100 rounded-lg">
                <AlertCircle className="w-5 h-5 text-yellow-500 mt-0.5 mr-3 flex-shrink-0" />
                <div>
                  <h3 className="font-medium text-yellow-800">Danger Zone</h3>
                  <p className="text-sm text-yellow-700 mb-3">These actions are irreversible. Please proceed with caution.</p>
                  <div className="flex gap-3">
                    <button className="px-4 py-2 text-sm font-medium text-red-600 border border-red-200 hover:bg-red-50 rounded-md transition-colors">Delete Account</button>
                    <button className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 hover:bg-gray-50 rounded-md transition-colors">Export Data</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SidebarLayout>
  )
}
