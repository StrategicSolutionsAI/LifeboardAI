"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { OnboardingLayout } from "@/components/onboarding-layout"

const integrations = [
  { id: "apple-health", name: "Apple Health", icon: "🍎", description: "Sync health and fitness data" },
  { id: "google-fit", name: "Google Fit", icon: "📱", description: "Import activity and wellness metrics" },
  { id: "fitbit", name: "Fitbit", icon: "⌚", description: "Connect your Fitbit device" },
  { id: "strava", name: "Strava", icon: "🏃", description: "Track workouts and activities" },
  { id: "myfitnesspal", name: "MyFitnessPal", icon: "🥗", description: "Sync nutrition data" },
  { id: "calendar", name: "Calendar", icon: "📅", description: "Integrate with your calendar" }
]

export default function OnboardingStep4() {
  const router = useRouter()
  const [selectedIntegrations, setSelectedIntegrations] = useState<string[]>([])

  const toggleIntegration = (integrationId: string) => {
    setSelectedIntegrations(prev => 
      prev.includes(integrationId) 
        ? prev.filter(i => i !== integrationId)
        : [...prev, integrationId]
    )
  }

  const handleNext = () => {
    router.push("/onboarding/5")
  }

  const handleBack = () => {
    router.push("/onboarding/3")
  }

  return (
    <OnboardingLayout
      step={4}
      title="Connect your apps"
      description="Integrate with your favorite apps to automatically sync data and get better insights."
      onNext={handleNext}
      onBack={handleBack}
    >
      <div className="space-y-4">
        {integrations.map((integration) => (
          <button
            key={integration.id}
            onClick={() => toggleIntegration(integration.id)}
            className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
              selectedIntegrations.includes(integration.id)
                ? "border-indigo-500 bg-indigo-50"
                : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <div className="flex items-center">
              <span className="text-2xl mr-4">{integration.icon}</span>
              <div className="flex-1">
                <div className="font-medium">{integration.name}</div>
                <div className="text-sm text-gray-500">{integration.description}</div>
              </div>
              <div className={`w-4 h-4 rounded-full border-2 ${
                selectedIntegrations.includes(integration.id)
                  ? "bg-indigo-500 border-indigo-500"
                  : "border-gray-300"
              }`} />
            </div>
          </button>
        ))}
      </div>

      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <p className="text-sm text-gray-600">
          Don't worry - you can always add or remove integrations later from your dashboard settings.
        </p>
      </div>
    </OnboardingLayout>
  )
}
