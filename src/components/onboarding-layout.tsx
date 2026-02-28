"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

interface OnboardingLayoutProps {
  step: number
  title: string
  subtitle?: string
  description: string
  children: React.ReactNode
  buttonText?: string
  onNext: () => void
  onBack?: () => void
  isLastStep?: boolean
  totalSteps?: number
}

export function OnboardingLayout({
  step,
  title,
  subtitle,
  description,
  children,
  buttonText,
  onNext,
  onBack,
  isLastStep = false,
  totalSteps = 6
}: OnboardingLayoutProps) {
  const boundedStep = Math.min(Math.max(step, 1), totalSteps)
  const progressPercent = Math.round((boundedStep / totalSteps) * 100)

  return (
    <div className="min-h-screen flex flex-col items-center" style={{ backgroundImage: "linear-gradient(90deg, rgba(252,250,248,0.7) 0%, rgba(252,250,248,0.7) 100%), linear-gradient(90deg, #fff 0%, #fff 100%)" }}>
      {/* Navbar */}
      <div className="w-full h-[84px] bg-white border-b border-theme-neutral-300 shadow-warm-sm">
        <div className="w-full h-full px-4 sm:px-10 flex items-center">
          <div className="flex items-center gap-0.5">
            <span className="text-theme-primary text-3xl font-medium">Lifeboard</span>
            <span className="text-theme-text-primary text-3xl font-medium">AI</span>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="w-full max-w-[560px] px-4 flex flex-col items-center gap-4 mt-10 sm:mt-14">
        <div className="w-full">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-theme-text-tertiary">
            <span>{`Step ${boundedStep} of ${totalSteps}`}</span>
            <span>{progressPercent}%</span>
          </div>
          <div className="mt-2 h-2 rounded-full bg-theme-progress-track overflow-hidden">
            <div
              className="h-full rounded-full bg-theme-primary transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Header */}
        <div className="w-full p-2.5 flex flex-col items-center text-center">
          <h1 className="text-theme-text-primary text-2xl sm:text-3xl font-medium leading-tight">{title}</h1>
          {subtitle && <p className="mt-1 text-theme-text-primary text-base font-normal">{subtitle}</p>}
          <p className="mt-3 text-sm text-theme-text-tertiary">{description}</p>
        </div>

        {/* Main Content Card */}
        <Card className="w-full p-4 sm:p-8 bg-white rounded-xl shadow-warm border border-theme-neutral-300">
          {children}
        </Card>

        {/* Actions */}
        <div className="w-full pt-4 sm:pt-8 flex items-center justify-between gap-3">
          {onBack ? (
            <Button
              type="button"
              variant="outline"
              onClick={onBack}
              className="min-w-[100px] border border-theme-neutral-300 hover:bg-theme-surface-alt transition-colors"
            >
              Back
            </Button>
          ) : (
            <div />
          )}

          <Button
            onClick={onNext}
            className="px-4 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-theme-secondary to-theme-accent rounded-xl text-[#FFFEF7] font-semibold text-sm sm:text-base min-w-[140px] sm:min-w-[180px]"
          >
            {isLastStep ? "Finish & Go to Dashboard" : (buttonText || "Continue")}
          </Button>
        </div>

        {/* Skip option */}
        <div className="w-full flex justify-center pb-6">
          <button
            type="button"
            onClick={onNext}
            className="text-sm text-theme-text-tertiary hover:text-theme-text-secondary transition-colors"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  )
}
