"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { OnboardingLayout } from "@/components/onboarding-layout"
import { cn } from "@/lib/utils"
import { CheckCircle2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

interface Integration {
  id: string
  name: string
  description: string
  icon: string
  comingSoon?: boolean
}

const integrations: Integration[] = [
  { 
    id: "google-calendar", 
    name: "Google Calendar", 
    description: "Sync your tasks and events with Google Calendar", 
    icon: "🗓️" 
  },
  { 
    id: "todoist", 
    name: "Todoist", 
    description: "Sync tasks from your Todoist account", 
    icon: "✅" 
  },
  { 
    id: "fitbit", 
    name: "Fitbit", 
    description: "Connect your Fitbit device to sync health and fitness data", 
    icon: "⌚"
  },
  { 
    id: "google-fit", 
    name: "Google Fit", 
    description: "Import activity and wellness metrics", 
    icon: "📱" 
  },
  { 
    id: "withings", 
    name: "Withings Smart Scale", 
    description: "Sync weight and body composition data from your Withings account", 
    icon: "⚖️" 
  },
  { 
    id: "apple-health", 
    name: "Apple Health", 
    description: "Sync health and fitness data from iOS Health app", 
    icon: "🍎",
    comingSoon: true
  },
  { 
    id: "strava", 
    name: "Strava", 
    description: "Track workouts and activities", 
    icon: "🏃",
    comingSoon: true
  },
  { 
    id: "myfitnesspal", 
    name: "MyFitnessPal", 
    description: "Sync nutrition data", 
    icon: "🥗",
    comingSoon: true
  },
  { 
    id: "apple-calendar", 
    name: "Apple Calendar", 
    description: "Sync your tasks and events with Apple Calendar", 
    icon: "📅",
    comingSoon: true
  },
  { 
    id: "notion", 
    name: "Notion", 
    description: "Link your Notion workspace and documents", 
    icon: "📘",
    comingSoon: true
  },
  { 
    id: "slack", 
    name: "Slack", 
    description: "Get notifications directly in your Slack workspace", 
    icon: "💬",
    comingSoon: true
  },
]

export default function OnboardingStep4() {
  const router = useRouter()
  const [selectedIntegrations, setSelectedIntegrations] = useState<string[]>([])

  const [connectingGoogle, setConnectingGoogle] = useState(false)
  const [connectingFitbit, setConnectingFitbit] = useState(false)
  const [connectingGoogleFit, setConnectingGoogleFit] = useState(false)
  const [connectingTodoist, setConnectingTodoist] = useState(false)
  const [connectingWithings, setConnectingWithings] = useState(false)
  
  const connectGoogleCalendar = async () => {
    setConnectingGoogle(true)
    
    try {
      // Redirect to our API endpoint that will initiate Google OAuth flow
      window.location.href = '/api/auth/google?redirectUrl=/onboarding/4'
    } catch (error) {
      console.error('Error connecting to Google Calendar:', error)
      setConnectingGoogle(false)
    }
  }
  
  const connectFitbit = async () => {
    setConnectingFitbit(true)
    try {
      window.location.href = '/api/auth/fitbit?redirectUrl=/onboarding/4'
    } catch (error) {
      console.error('Error connecting to Fitbit:', error)
      setConnectingFitbit(false)
    }
  }
  
  const connectGoogleFit = async () => {
    setConnectingGoogleFit(true)
    try {
      window.location.href = '/api/auth/googlefit?redirectUrl=/onboarding/4'
    } catch (error) {
      console.error('Error connecting to Google Fit:', error)
      setConnectingGoogleFit(false)
    }
  }

  const connectWithings = async () => {
    setConnectingWithings(true)
    try {
      window.location.href = '/api/auth/withings?redirectUrl=/onboarding/4'
    } catch (error) {
      console.error('Error connecting to Withings:', error)
      setConnectingWithings(false)
    }
  }

  const connectTodoist = async () => {
    setConnectingTodoist(true)
    try {
      window.location.href = '/api/auth/todoist?redirectUrl=/onboarding/4'
    } catch (error) {
      console.error('Error connecting to Todoist:', error)
      setConnectingTodoist(false)
    }
  }
  
  const toggleIntegration = (integrationId: string) => {
    const integration = integrations.find(i => i.id === integrationId)
    
    // Don't allow selection of "coming soon" integrations
    if (integration?.comingSoon) return
    
    // For Google Calendar, start the OAuth flow
    if (integrationId === 'google-calendar') {
      connectGoogleCalendar()
      return
    }
    // For Fitbit, start OAuth
    if (integrationId === 'fitbit') {
      connectFitbit()
      return
    }
    // For Google Fit, start OAuth
    if (integrationId === 'google-fit') {
      connectGoogleFit()
      return
    }
    // For Withings, start OAuth
    if (integrationId === 'withings') {
      connectWithings()
      return
    }
    // For Todoist, start OAuth
    if (integrationId === 'todoist') {
      connectTodoist()
      return
    }
    
    // For other integrations, just toggle the selection
    setSelectedIntegrations(prev => 
      prev.includes(integrationId) 
        ? prev.filter(i => i !== integrationId)
        : [...prev, integrationId]
    )
  }

  const handleNext = () => {
    // Skip step 5 since we've consolidated all integrations here
    router.push("/onboarding/6")
  }

  const handleBack = () => {
    router.push("/onboarding/3")
  }

  return (
    <OnboardingLayout
      step={5}
      title="Connect Your Apps"
      subtitle="Sync your favorite tools and services"
      description="Connect apps you already use to automatically import your data and get better insights. You can always add more later."
      buttonText="CONTINUE"
      onNext={handleNext}
      onBack={handleBack}
    >
      <div className="w-full flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <h2 className="text-[18px] font-medium text-[#171A1F]">Popular integrations</h2>
          <p className="text-[14px] text-[#565E6C]">Click any service below to connect instantly</p>
        </div>
        
        <div className="grid grid-cols-1 gap-3">
          {integrations.map((integration) => (
            <div 
              key={integration.id}
              onClick={() => toggleIntegration(integration.id)}
              className={cn(
                "flex items-center p-4 rounded-lg border border-[#E5E7EB] transition-all",
                integration.comingSoon 
                  ? "opacity-70 cursor-not-allowed bg-[#F9F9FB]" 
                  : selectedIntegrations.includes(integration.id)
                    ? "border-theme-primary bg-theme-primary bg-opacity-10" 
                    : "cursor-pointer hover:border-[#D1D5DB] bg-white"
              )}
            >
              <div className="mr-3 text-2xl">{integration.icon}</div>
              
              <div className="flex-1">
                <div className="flex items-center">
                  <h3 className="text-[16px] font-medium text-[#171A1F]">
                    {integration.name}
                  </h3>
                  {integration.comingSoon && (
                    <span className="ml-2 px-2 py-0.5 text-[10px] font-medium text-[#6B7280] bg-[#F3F4F6] rounded-full">
                      Coming Soon
                    </span>
                  )}
                </div>
                <p className="text-[14px] text-[#6B7280]">
                  {integration.description}
                </p>
              </div>

              {!integration.comingSoon && (
                <div className={cn(
                  "flex items-center justify-center",
                )}>
                  {integration.id === 'google-calendar' && connectingGoogle ? (
                    <Loader2 className="h-5 w-5 animate-spin text-theme-primary" />
                  ) : integration.id === 'fitbit' && connectingFitbit ? (
                    <Loader2 className="h-5 w-5 animate-spin text-theme-primary" />
                  ) : integration.id === 'google-fit' && connectingGoogleFit ? (
                    <Loader2 className="h-5 w-5 animate-spin text-theme-primary" />
                  ) : integration.id === 'withings' && connectingWithings ? (
                    <Loader2 className="h-5 w-5 animate-spin text-theme-primary" />
                  ) : integration.id === 'todoist' && connectingTodoist ? (
                    <Loader2 className="h-5 w-5 animate-spin text-theme-primary" />
                  ) : (
                    <div className={cn(
                      "w-6 h-6 flex items-center justify-center rounded-full",
                      selectedIntegrations.includes(integration.id)
                        ? "text-theme-primary" 
                        : "text-[#D1D5DB]"
                    )}>
                      <CheckCircle2 
                        className={cn(
                          "w-5 h-5",
                          selectedIntegrations.includes(integration.id)
                            ? "opacity-100 stroke-theme-primary fill-theme-primary fill-opacity-10" 
                            : "opacity-50 stroke-[#D1D5DB] fill-transparent"
                        )}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Info text */}
        <div className="flex flex-col gap-2 mt-4">
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[12px] text-[#6B7280]">
              💡 Don't see your app? More integrations are coming soon! You can always manage connections later from settings.
            </p>
          </div>
        </div>
      </div>
    </OnboardingLayout>
  )
}