"use client"

import { useRouter } from "next/navigation"
import { OnboardingLayout } from "@/components/onboarding-layout"

export default function OnboardingIntro() {
  const router = useRouter()

  const handleNext = () => {
    router.push("/onboarding/1")
  }

  return (
    <OnboardingLayout
      step={1}
      title="Welcome to LifeboardAI"
      subtitle="Your AI-powered life management platform"
      description="Get organized, stay focused, and achieve more with personalized insights."
      buttonText="GET STARTED"
      onNext={handleNext}
    >
      <div className="space-y-6 text-center">
        <div className="text-5xl mb-4">🎯</div>
        
        <div className="space-y-4">
          <div className="flex items-start space-x-4 text-left">
            <div className="bg-theme-primary text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold shrink-0">1</div>
            <div>
              <h3 className="font-semibold text-[#171A1F] mb-1">Organize Your Life</h3>
              <p className="text-[#565E6C] text-sm">
                Create custom buckets for different areas of your life - work, health, family, and more.
              </p>
            </div>
          </div>
          
          <div className="flex items-start space-x-4 text-left">
            <div className="bg-theme-primary text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold shrink-0">2</div>
            <div>
              <h3 className="font-semibold text-[#171A1F] mb-1">Connect Your Apps</h3>
              <p className="text-[#565E6C] text-sm">
                Sync with Google Calendar, Todoist, Fitbit, and more to automatically import your data.
              </p>
            </div>
          </div>
          
          <div className="flex items-start space-x-4 text-left">
            <div className="bg-theme-primary text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold shrink-0">3</div>
            <div>
              <h3 className="font-semibold text-[#171A1F] mb-1">Get AI Insights</h3>
              <p className="text-[#565E6C] text-sm">
                Receive personalized recommendations and insights to optimize your productivity and well-being.
              </p>
            </div>
          </div>
        </div>

        <div className="pt-4 bg-gray-50 rounded-lg p-4">
          <p className="text-[#565E6C] text-sm">
            ⏱️ Setup takes just 2 minutes
          </p>
        </div>
      </div>
    </OnboardingLayout>
  )
}