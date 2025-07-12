"use client"

import { useState, useEffect, FormEvent, KeyboardEvent, ChangeEvent } from "react"
import { useRouter } from "next/navigation"
import { OnboardingLayout } from "@/components/onboarding-layout"
import { PlusCircle, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { saveUserPreferences } from "@/lib/user-preferences"
import { supabase } from "@/utils/supabase/client"

// Some suggested custom buckets to help users get started
const suggestedBuckets = [
  "Travel",
  "Learning",
  "Side Projects",
  "Pets",
  "Home",
  "Volunteering"
]

export default function OnboardingStep2() {
  const router = useRouter()
  const [selectedBuckets, setSelectedBuckets] = useState<string[]>([])
  const [customBuckets, setCustomBuckets] = useState<string[]>([])
  const [newBucketInput, setNewBucketInput] = useState<string>('')

  useEffect(() => {
    // Load buckets from step 1
    if (typeof window !== 'undefined') {
      const storedBuckets = localStorage.getItem('life_buckets');
      if (storedBuckets) {
        try {
          const bucketsFromStep1 = JSON.parse(storedBuckets);
          if (Array.isArray(bucketsFromStep1)) {
            setSelectedBuckets(bucketsFromStep1);
          }
        } catch (e) {
          console.error("Failed to parse life_buckets from localStorage", e);
        }
      }
    }
  }, []); // Empty dependency array ensures this runs only once on mount

  const toggleBucket = (bucket: string) => {
    setSelectedBuckets(prev => 
      prev.includes(bucket) 
        ? prev.filter(b => b !== bucket)
        : [...prev, bucket]
    )
  }

  const addCustomBucket = () => {
    const trimmedInput = newBucketInput.trim()
    if (trimmedInput && !customBuckets.includes(trimmedInput)) {
      setCustomBuckets(prev => [...prev, trimmedInput])
      setSelectedBuckets(prev => [...prev, trimmedInput])
      setNewBucketInput('')
    }
  }

  const handleInputSubmit = (e: FormEvent) => {
    e.preventDefault()
    addCustomBucket()
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addCustomBucket()
    }
  }

  const handleContinue = async () => {
    try {
      // Save selected buckets to user preferences
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        // First attempt direct API save
        const response = await fetch('/api/user/preferences', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            life_buckets: selectedBuckets,
          }),
        })

        if (response.ok) {
          const savedPrefs = await response.json();
          if (savedPrefs && savedPrefs.life_buckets) {
            localStorage.setItem('life_buckets', JSON.stringify(savedPrefs.life_buckets));
          }
        } else {
          console.error('API save failed. You may be offline.');
          // Fallback for offline: merge with existing localStorage
          const existingBuckets = JSON.parse(localStorage.getItem('life_buckets') || '[]');
          const combined = Array.from(new Set([...existingBuckets, ...selectedBuckets]));
          localStorage.setItem('life_buckets', JSON.stringify(combined));
        }
      }
    } catch (error) {
      console.error('Error saving user preferences:', error)
    }

    // Continue to next step regardless of save status
    router.push("/onboarding/3")
  }

  const handleBack = () => {
    router.push("/onboarding/1")
  }

  return (
    <OnboardingLayout
      step={2}
      title="Customize Your Buckets"
      subtitle="Add your own custom categories"
      description=""
      buttonText="CONTINUE"
      onNext={handleContinue}
      onBack={handleBack}
    >
      <div className="w-full flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <h2 className="text-[18px] font-medium text-[#171A1F]">Add custom life buckets</h2>
          <p className="text-[14px] text-[#565E6C]">Create your own categories for better organization</p>
        </div>
        
        <form onSubmit={handleInputSubmit} className="flex gap-2">
          <Input
            type="text"
            placeholder="Enter custom bucket name"
            value={newBucketInput}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setNewBucketInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 border-[#E5E7EB] focus-visible:ring-theme-primary rounded"
          />
          <Button 
            onClick={addCustomBucket} 
            type="button"
            className="bg-theme-primary hover:bg-theme-secondary text-white"
          >
            <PlusCircle className="h-4 w-4 mr-2" />
            Add
          </Button>
        </form>
        
        {/* Selected buckets section */}
        <div className="flex flex-col gap-2">  
          <h3 className="text-[16px] font-medium text-[#171A1F]">Your selected buckets</h3>
          
          <div className="flex flex-wrap gap-1.5">
            {selectedBuckets.length > 0 ? (
              selectedBuckets.map((bucket) => (
                <div 
                  key={bucket} 
                  className="py-3.5 px-3 bg-theme-primary bg-opacity-10 text-theme-primary rounded"
                  onClick={() => toggleBucket(bucket)}
                >
                  <span className="text-xs font-medium">{bucket}</span>
                </div>
              ))
            ) : (
              <p className="text-[14px] text-[#6B7280] italic">No buckets selected yet</p>
            )}
          </div>
        </div>
        
        {/* Suggestions section */}
        <div className="flex flex-col gap-2 mt-2">
          <h3 className="text-[16px] font-medium text-[#171A1F]">Suggestions</h3>
          
          <div className="flex flex-wrap gap-1.5">
            {suggestedBuckets.map((bucket) => (
              <button
                key={bucket}
                onClick={() => toggleBucket(bucket)}
                className={cn(
                  "py-3.5 px-3 rounded transition-all",
                  selectedBuckets.includes(bucket)
                    ? "bg-theme-primary bg-opacity-10 text-theme-primary"
                    : "bg-[#F5F5FA] text-[#2E3D62] hover:bg-[#EAEAF0]"
                )}
              >
                <span className="text-xs font-medium">{bucket}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </OnboardingLayout>
  )
}
