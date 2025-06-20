"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { OnboardingLayout } from "@/components/onboarding-layout"

const goals = [
  "Improve physical health",
  "Better mental wellness",
  "Increase productivity",
  "Build better habits",
  "Track life metrics",
  "Achieve work-life balance"
]

export default function OnboardingStep1() {
  const router = useRouter()
  const [selectedGoals, setSelectedGoals] = useState<string[]>([])

  const toggleGoal = (goal: string) => {
    setSelectedGoals(prev => 
      prev.includes(goal) 
        ? prev.filter(g => g !== goal)
        : [...prev, goal]
    )
  }

  const handleNext = () => {
    // Store selected goals (in real app, save to user profile)
    router.push("/onboarding/2")
  }

  return (
    <OnboardingLayout
      step={1}
      title="What are your main goals?"
      description="Select the areas where you'd like Lifeboard.ai to help you improve."
      onNext={handleNext}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {goals.map((goal) => (
          <button
            key={goal}
            onClick={() => toggleGoal(goal)}
            className={`p-4 rounded-lg border-2 text-left transition-all ${
              selectedGoals.includes(goal)
                ? "border-indigo-500 bg-indigo-50"
                : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <div className="flex items-center">
              <div className={`w-4 h-4 rounded-full border-2 mr-3 ${
                selectedGoals.includes(goal)
                  ? "bg-indigo-500 border-indigo-500"
                  : "border-gray-300"
              }`} />
              <span className="font-medium">{goal}</span>
            </div>
          </button>
        ))}
      </div>
    </OnboardingLayout>
  )
}
