"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { OnboardingLayout } from "@/components/onboarding-layout"

export default function OnboardingStep3() {
  const router = useRouter()
  const [preferences, setPreferences] = useState({
    reminderTime: "09:00",
    frequency: "daily",
    notifications: true,
    weekStart: "monday"
  })

  const handleNext = () => {
    router.push("/onboarding/4")
  }

  const handleBack = () => {
    router.push("/onboarding/2")
  }

  return (
    <OnboardingLayout
      step={3}
      title="Set your preferences"
      description="Customize how Lifeboard.ai works for you."
      onNext={handleNext}
      onBack={handleBack}
    >
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Daily reminder time
          </label>
          <input
            type="time"
            value={preferences.reminderTime}
            onChange={(e) => setPreferences(prev => ({ ...prev, reminderTime: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Check-in frequency
          </label>
          <select
            value={preferences.frequency}
            onChange={(e) => setPreferences(prev => ({ ...prev, frequency: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="custom">Custom</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Week starts on
          </label>
          <select
            value={preferences.weekStart}
            onChange={(e) => setPreferences(prev => ({ ...prev, weekStart: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="sunday">Sunday</option>
            <option value="monday">Monday</option>
          </select>
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            id="notifications"
            checked={preferences.notifications}
            onChange={(e) => setPreferences(prev => ({ ...prev, notifications: e.target.checked }))}
            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
          />
          <label htmlFor="notifications" className="ml-2 text-sm text-gray-700">
            Enable push notifications
          </label>
        </div>
      </div>
    </OnboardingLayout>
  )
}
