"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

interface OnboardingLayoutProps {
  step: number
  title: string
  description: string
  children: React.ReactNode
  onNext: () => void
  onBack?: () => void
  isLastStep?: boolean
}

export function OnboardingLayout({
  step,
  title,
  description,
  children,
  onNext,
  onBack,
  isLastStep = false
}: OnboardingLayoutProps) {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl p-8">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between text-sm text-gray-500 mb-2">
            <span>Step {step} of 5</span>
            <span>{Math.round((step / 5) * 100)}% Complete</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(step / 5) * 100}%` }}
            />
          </div>
        </div>

        {/* Content */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">{title}</h1>
          <p className="text-gray-600 text-lg">{description}</p>
        </div>

        <div className="mb-8">
          {children}
        </div>

        {/* Navigation */}
        <div className="flex justify-between">
          <div>
            {step > 1 && onBack && (
              <Button variant="outline" onClick={onBack}>
                Back
              </Button>
            )}
          </div>
          <Button onClick={onNext}>
            {isLastStep ? "Finish & Go to Dashboard" : "Next"}
          </Button>
        </div>
      </Card>
    </div>
  )
}
