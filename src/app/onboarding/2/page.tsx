"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { OnboardingLayout } from "@/components/onboarding-layout"

const healthMetrics = [
  { id: "weight", name: "Weight", icon: "⚖️" },
  { id: "sleep", name: "Sleep Hours", icon: "😴" },
  { id: "steps", name: "Daily Steps", icon: "👟" },
  { id: "water", name: "Water Intake", icon: "💧" },
  { id: "exercise", name: "Exercise Minutes", icon: "💪" },
  { id: "mood", name: "Mood Rating", icon: "😊" }
]

export default function OnboardingStep2() {
  const router = useRouter()
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([])

  const toggleMetric = (metricId: string) => {
    setSelectedMetrics(prev => 
      prev.includes(metricId) 
        ? prev.filter(m => m !== metricId)
        : [...prev, metricId]
    )
  }

  const handleNext = () => {
    router.push("/onboarding/3")
  }

  const handleBack = () => {
    router.push("/onboarding/1")
  }

  return (
    <OnboardingLayout
      step={2}
      title="What would you like to track?"
      description="Choose the health and wellness metrics you want to monitor daily."
      onNext={handleNext}
      onBack={handleBack}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {healthMetrics.map((metric) => (
          <button
            key={metric.id}
            onClick={() => toggleMetric(metric.id)}
            className={`p-4 rounded-lg border-2 text-left transition-all ${
              selectedMetrics.includes(metric.id)
                ? "border-indigo-500 bg-indigo-50"
                : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <div className="flex items-center">
              <span className="text-2xl mr-3">{metric.icon}</span>
              <div>
                <div className="font-medium">{metric.name}</div>
              </div>
              <div className={`ml-auto w-4 h-4 rounded-full border-2 ${
                selectedMetrics.includes(metric.id)
                  ? "bg-indigo-500 border-indigo-500"
                  : "border-gray-300"
              }`} />
            </div>
          </button>
        ))}
      </div>
    </OnboardingLayout>
  )
}
