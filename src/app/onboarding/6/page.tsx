"use client"

import { useRouter } from 'next/navigation'
import { supabase } from '@/utils/supabase/client'
import { OnboardingLayout } from "@/components/onboarding-layout"

export default function OnboardingStep6() {
  const router = useRouter()

  const handleFinish = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) {
      const { error } = await supabase.from('profiles').upsert({ id: user.id, onboarded: true })
      if (error) {
        console.error('Failed to mark onboarding complete:', error)
        // Optionally show a toast or redirect with error query
        return
      }
    }
    router.push('/dashboard')
  }

  const handleBack = () => {
    router.push("/onboarding/4")
  }

  return (
    <OnboardingLayout
      step={6}
      title="You're all set!"
      description="Welcome to Lifeboard AI. Your personalized dashboard is ready."
      onNext={handleFinish}
      onBack={handleBack}
      isLastStep={true}
    >
      <div className="text-center space-y-6">
        <div className="text-6xl mb-4">🎉</div>
        
        <div className="space-y-4">
          <div className="bg-green-50 p-4 rounded-lg">
            <h3 className="font-semibold text-green-800 mb-2">Your Profile is Complete</h3>
            <p className="text-green-600 text-sm">
              We've set up your personalized dashboard based on your preferences and chosen theme.
            </p>
          </div>

          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="font-semibold text-blue-800 mb-2">AI Insights Ready</h3>
            <p className="text-blue-600 text-sm">
              Our AI will start generating personalized insights as you track your data.
            </p>
          </div>

          <div className="bg-purple-50 p-4 rounded-lg">
            <h3 className="font-semibold text-purple-800 mb-2">Start Tracking Today</h3>
            <p className="text-purple-600 text-sm">
              Begin your journey by logging your first metrics on the dashboard.
            </p>
          </div>
        </div>

        <div className="pt-4">
          <p className="text-gray-600 text-sm">
            Remember: You can always adjust your settings, theme, and preferences from your dashboard.
          </p>
        </div>
      </div>
    </OnboardingLayout>
  )
}