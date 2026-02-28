"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { OnboardingLayout } from "@/components/onboarding-layout"
import { cn } from "@/lib/utils"

const lifeBuckets = [
  "Health",
  "Wellness",
  "Medical",
  "Household",
  "Family",
  "Social",
  "Work",
  "Finance",
  "Education",
  "Hobbies",
  "Travel",
  "Meals"
]

export default function OnboardingStep1() {
  const router = useRouter()
  const [selectedBuckets, setSelectedBuckets] = useState<string[]>([])

  const toggleBucket = (bucket: string) => {
    setSelectedBuckets(prev => 
      prev.includes(bucket) 
        ? prev.filter(b => b !== bucket)
        : [...prev, bucket]
    )
  }

  const handleContinue = () => {
    // Store selected buckets in localStorage to be picked up by the next step
    if (typeof window !== 'undefined') {
      localStorage.setItem('life_buckets', JSON.stringify(selectedBuckets));
    }
    router.push("/onboarding/2");
  }

  const handleBack = () => {
    router.push("/onboarding/0")
  }

  return (
    <OnboardingLayout
      step={2}
      title="Choose Your Life Areas"
      subtitle="Select the categories that matter to you"
      description="These will become your personalized dashboard buckets. Don't worry - you can add more later!"
      buttonText="Continue"
      onNext={handleContinue}
      onBack={handleBack}
    >
      <div className="w-full flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <h2 className="text-[18px] font-medium text-[#171A1F]">Popular life categories</h2>
          <p className="text-sm text-[#565E6C]">Choose as many as you'd like - you can customize these next</p>
        </div>
        
        <div className="flex flex-wrap gap-1.5">
          {lifeBuckets.map((bucket) => (
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
    </OnboardingLayout>
  )
}
