"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { OnboardingLayout } from "@/components/onboarding-layout"
import { cn } from "@/lib/utils"
import { Check } from "lucide-react"
import { themeColors, ThemeColor } from "@/lib/theme"

export default function OnboardingStep3() {
  const router = useRouter()
  const [selectedTheme, setSelectedTheme] = useState<string>("indigo") // Default to indigo

  const handleContinue = () => {
    // Store selected theme in localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('user_theme', selectedTheme)
      
      // Store the full theme object for easier access
      const selectedThemeData = themeColors.find(theme => theme.id === selectedTheme)
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
          {themeColors.map((theme) => (
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
                    <h3 className="text-[16px] font-medium text-[#171A1F]">{theme.name}</h3>
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
        </div>
        
        {/* Preview section */}
        <div className="flex flex-col gap-3 mt-4 p-4 bg-[#F9FAFB] rounded-lg border">
          <h3 className="text-[16px] font-medium text-[#171A1F]">Preview</h3>
          <div className="flex items-center gap-3">
            <div 
              className="px-4 py-2 rounded-full text-white text-sm font-medium"
              style={{ backgroundColor: themeColors.find(t => t.id === selectedTheme)?.primary }}
            >
              Primary Button
            </div>
            <div 
              className="px-4 py-2 rounded-full text-white text-sm font-medium"
              style={{ backgroundColor: themeColors.find(t => t.id === selectedTheme)?.secondary }}
            >
              Secondary
            </div>
            <div 
              className="px-4 py-2 rounded-full text-white text-sm font-medium"
              style={{ backgroundColor: themeColors.find(t => t.id === selectedTheme)?.accent }}
            >
              Accent
            </div>
          </div>
        </div>
      </div>
    </OnboardingLayout>
  )
}