"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { OnboardingLayout } from "@/components/onboarding-layout"
import { cn } from "@/lib/utils"
import { Check, Plus } from "lucide-react"
import { themeColors, ThemeColor, getAllThemes, createCustomTheme, saveCustomTheme } from "@/lib/theme"

export default function OnboardingStep3() {
  const router = useRouter()
  const [selectedTheme, setSelectedTheme] = useState<string>("indigo") // Default to indigo
  const [showCustomColorForm, setShowCustomColorForm] = useState(false)
  const [customThemeName, setCustomThemeName] = useState('')
  const [customPrimary, setCustomPrimary] = useState('#5271F8')
  const [customSecondary, setCustomSecondary] = useState('#7482FE')
  const [customAccent, setCustomAccent] = useState('#909CFF')
  const [allThemes, setAllThemes] = useState<ThemeColor[]>(getAllThemes())

  const handleCreateCustomTheme = () => {
    if (!customThemeName.trim()) return
    
    const newTheme = createCustomTheme(
      customThemeName.trim(),
      customPrimary,
      customSecondary,
      customAccent
    )
    
    saveCustomTheme(newTheme)
    setSelectedTheme(newTheme.id)
    setAllThemes(getAllThemes())
    
    // Reset form
    setCustomThemeName('')
    setCustomPrimary('#5271F8')
    setCustomSecondary('#7482FE')
    setCustomAccent('#909CFF')
    setShowCustomColorForm(false)
  }

  const handleContinue = () => {
    // Store selected theme in localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('user_theme', selectedTheme)
      
      // Store the full theme object for easier access
      const selectedThemeData = allThemes.find(theme => theme.id === selectedTheme)
      if (selectedThemeData) {
        localStorage.setItem('theme_colors', JSON.stringify(selectedThemeData))
      }
    }
    router.push("/onboarding/4")
  }

  const handleBack = () => {
    router.push("/onboarding/2")
  }

  return (
    <OnboardingLayout
      step={3}
      title="Choose Your Theme"
      subtitle="Personalize your experience"
      description=""
      buttonText="CONTINUE"
      onNext={handleContinue}
      onBack={handleBack}
    >
      <div className="w-full flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <h2 className="text-[18px] font-medium text-[#171A1F]">Select your theme colors</h2>
          <p className="text-[14px] text-[#565E6C]">Choose a color scheme that matches your style</p>
        </div>
        
        <div className="grid grid-cols-1 gap-4">
          {allThemes.map((theme) => (
            <button
              key={theme.id}
              onClick={() => setSelectedTheme(theme.id)}
              className={cn(
                "w-full p-4 rounded-lg border-2 transition-all text-left",
                selectedTheme === theme.id
                  ? "border-theme-primary bg-theme-primary bg-opacity-10"
                  : "border-[#E5E7EB] bg-white hover:border-[#D1D5DB]"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {/* Color preview circles */}
                  <div className="flex gap-1">
                    <div 
                      className="w-6 h-6 rounded-full border border-gray-200"
                      style={{ backgroundColor: theme.primary }}
                    />
                    <div 
                      className="w-6 h-6 rounded-full border border-gray-200"
                      style={{ backgroundColor: theme.secondary }}
                    />
                    <div 
                      className="w-6 h-6 rounded-full border border-gray-200"
                      style={{ backgroundColor: theme.accent }}
                    />
                  </div>
                  
                  <div>
                    <h3 className="text-[16px] font-medium text-[#171A1F]">
                      {theme.name}
                      {theme.isCustom && (
                        <span className="ml-2 px-2 py-0.5 text-xs font-medium text-purple-600 bg-purple-100 rounded-full">
                          Custom
                        </span>
                      )}
                    </h3>
                    <p className="text-[14px] text-[#6B7280]">{theme.description}</p>
                  </div>
                </div>
                
                {/* Selection indicator */}
                {selectedTheme === theme.id && (
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-theme-primary">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                )}
              </div>
            </button>
          ))}
          
          {/* Create Custom Theme Button */}
          <button
            onClick={() => setShowCustomColorForm(!showCustomColorForm)}
            className="w-full p-4 rounded-lg border-2 border-dashed border-gray-300 hover:border-theme-primary transition-all text-left bg-gray-50 hover:bg-gray-100"
          >
            <div className="flex items-center justify-center gap-2 text-gray-600 hover:text-theme-primary">
              <Plus className="w-5 h-5" />
              <span className="font-medium">Create Your Own Theme</span>
            </div>
          </button>
        </div>
        
        {/* Custom Color Form */}
        {showCustomColorForm && (
          <div className="mt-6 p-6 bg-gray-50 rounded-lg border">
            <h4 className="text-lg font-medium mb-4">Create Custom Theme</h4>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Theme Name
                </label>
                <input
                  type="text"
                  value={customThemeName}
                  onChange={(e) => setCustomThemeName(e.target.value)}
                  placeholder="My Awesome Theme"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-theme-primary focus:border-transparent"
                />
              </div>
              
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Primary Color
                  </label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      value={customPrimary}
                      onChange={(e) => setCustomPrimary(e.target.value)}
                      className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={customPrimary}
                      onChange={(e) => setCustomPrimary(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-theme-primary focus:border-transparent"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Secondary Color
                  </label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      value={customSecondary}
                      onChange={(e) => setCustomSecondary(e.target.value)}
                      className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={customSecondary}
                      onChange={(e) => setCustomSecondary(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-theme-primary focus:border-transparent"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Accent Color
                  </label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      value={customAccent}
                      onChange={(e) => setCustomAccent(e.target.value)}
                      className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={customAccent}
                      onChange={(e) => setCustomAccent(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-theme-primary focus:border-transparent"
                    />
                  </div>
                </div>
              </div>
              
              {/* Live Preview */}
              <div className="mt-4 p-4 bg-white rounded-lg border">
                <h5 className="text-sm font-medium text-gray-700 mb-3">Preview</h5>
                <div className="flex items-center gap-3 flex-wrap">
                  <div 
                    className="px-4 py-2 rounded-full text-white text-sm font-medium"
                    style={{ backgroundColor: customPrimary }}
                  >
                    Primary
                  </div>
                  <div 
                    className="px-4 py-2 rounded-full text-white text-sm font-medium"
                    style={{ backgroundColor: customSecondary }}
                  >
                    Secondary
                  </div>
                  <div 
                    className="px-4 py-2 rounded-full text-white text-sm font-medium"
                    style={{ backgroundColor: customAccent }}
                  >
                    Accent
                  </div>
                </div>
              </div>
              
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleCreateCustomTheme}
                  disabled={!customThemeName.trim()}
                  className="px-4 py-2 bg-theme-primary text-white rounded-md hover:bg-theme-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Create & Select Theme
                </button>
                <button
                  onClick={() => setShowCustomColorForm(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Preview section */}
        <div className="flex flex-col gap-3 mt-4 p-4 bg-[#F9FAFB] rounded-lg border">
          <h3 className="text-[16px] font-medium text-[#171A1F]">Preview</h3>
          <div className="flex items-center gap-3">
            <div 
              className="px-4 py-2 rounded-full text-white text-sm font-medium"
              style={{ backgroundColor: allThemes.find(t => t.id === selectedTheme)?.primary }}
            >
              Primary Button
            </div>
            <div 
              className="px-4 py-2 rounded-full text-white text-sm font-medium"
              style={{ backgroundColor: allThemes.find(t => t.id === selectedTheme)?.secondary }}
            >
              Secondary
            </div>
            <div 
              className="px-4 py-2 rounded-full text-white text-sm font-medium"
              style={{ backgroundColor: allThemes.find(t => t.id === selectedTheme)?.accent }}
            >
              Accent
            </div>
          </div>
        </div>
      </div>
    </OnboardingLayout>
  )
}