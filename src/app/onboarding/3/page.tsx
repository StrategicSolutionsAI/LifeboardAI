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
  { 
    id: "fitbit", 
    name: "Fitbit", 
    description: "Connect your Fitbit device to sync health and fitness data", 
    icon: "⌚"
  },
  { 
    id: "todoist", 
    name: "Todoist", 
    description: "Sync tasks from your Todoist account", 
    icon: "✅" 
  },
]

export default function OnboardingStep3() {
  const router = useRouter()
  const [selectedIntegrations, setSelectedIntegrations] = useState<string[]>([])

  const [connectingGoogle, setConnectingGoogle] = useState(false)
  const [connectingFitbit, setConnectingFitbit] = useState(false)
  const [connectingTodoist, setConnectingTodoist] = useState(false)
  
  const connectGoogleCalendar = async () => {
    setConnectingGoogle(true)
    
    try {
      // Redirect to our API endpoint that will initiate Google OAuth flow
      window.location.href = '/api/auth/google?redirectUrl=/onboarding/3'
    } catch (error) {
      console.error('Error connecting to Google Calendar:', error)
      setConnectingGoogle(false)
    }
  }
  
  const connectFitbit = async () => {
    setConnectingFitbit(true)
    try {
      window.location.href = '/api/auth/fitbit?redirectUrl=/onboarding/3'
    } catch (error) {
      console.error('Error connecting to Fitbit:', error)
      setConnectingFitbit(false)
    }
  }
  
  const connectTodoist = async () => {
    setConnectingTodoist(true)
    try {
      window.location.href = '/api/auth/todoist?redirectUrl=/onboarding/3'
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
    // Store selected integrations if needed, then navigate to dashboard
    router.push("/dashboard")
  }

  const handleBack = () => {
    router.push("/onboarding/2")
  }

  return (
    <OnboardingLayout
      step={3}
      title="Connect Your Tools"
      subtitle="Integrate with your favorite services"
      description=""
      buttonText="COMPLETE SETUP"
      onNext={handleNext}
      onBack={handleBack}
      isLastStep={true}
    >
      <div className="w-full flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <h2 className="text-[18px] font-medium text-[#171A1F]">Select integrations</h2>
          <p className="text-[14px] text-[#565E6C]">Connect TaskBoard with your favorite tools</p>
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
                    ? "border-[#5271F8] bg-[#EEF0FF]" 
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
                    <Loader2 className="h-5 w-5 animate-spin text-[#5271F8]" />
                  ) : integration.id === 'fitbit' && connectingFitbit ? (
                    <Loader2 className="h-5 w-5 animate-spin text-[#5271F8]" />
                  ) : integration.id === 'todoist' && connectingTodoist ? (
                    <Loader2 className="h-5 w-5 animate-spin text-[#5271F8]" />
                  ) : (
                    <div className={cn(
                      "w-6 h-6 flex items-center justify-center rounded-full",
                      selectedIntegrations.includes(integration.id)
                        ? "text-[#5271F8]" 
                        : "text-[#D1D5DB]"
                    )}>
                      <CheckCircle2 
                        className={cn(
                          "w-5 h-5",
                          selectedIntegrations.includes(integration.id)
                            ? "opacity-100 stroke-[#5271F8] fill-[#EEF0FF]" 
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
        <div className="flex flex-col gap-2 mt-2">
          <p className="text-[12px] text-[#6B7280]">
            Note: You can always manage your integrations later from settings
          </p>
          
          <div className="flex justify-end mt-2">
            <Button 
              onClick={connectGoogleCalendar}
              disabled={connectingGoogle}
              className="bg-[#5271F8] hover:bg-[#4060E8] text-white text-sm px-4"
            >
              {connectingGoogle ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>Connect Google Calendar</>
              )}
            </Button>
            <Button
              onClick={connectTodoist}
              disabled={connectingTodoist}
              variant="secondary"
              className="text-sm ml-2"
            >
              {connectingTodoist ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>Connect Todoist</>
              )}
            </Button>
          </div>
        </div>
      </div>
    </OnboardingLayout>
  )
}
