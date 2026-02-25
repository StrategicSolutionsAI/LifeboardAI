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
      <div className="w-full h-[84px] bg-white border-b border-[#dbd6cf] shadow-[0px_4px_16px_rgba(163,133,96,0.06)]">
        <div className="w-full h-full px-10 flex items-center">
          <div className="flex items-center gap-0.5">
            <span className="text-theme-primary text-[30px] font-medium">Lifeboard</span>
            <span className="text-[#314158] text-[30px] font-medium">AI</span>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="w-full max-w-[560px] px-4 flex flex-col items-center gap-4 mt-10 sm:mt-14">
        <div className="w-full">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-[#8e99a8]">
            <span>{`Step ${boundedStep} of ${totalSteps}`}</span>
            <span>{progressPercent}%</span>
          </div>
          <div className="mt-2 h-2 rounded-full bg-[#eae6e1] overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-theme-primary to-theme-secondary transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Header */}
        <div className="w-full p-2.5 flex flex-col items-center text-center">
          <h1 className="text-[#314158] text-[30px] font-medium leading-tight">{title}</h1>
          {subtitle && <p className="mt-1 text-[#314158] text-base font-normal">{subtitle}</p>}
          <p className="mt-3 text-sm text-[#8e99a8]">{description}</p>
        </div>

        {/* Main Content Card */}
        <Card className="w-full p-8 bg-white rounded-xl shadow-warm border border-[#dbd6cf]">
          {children}
        </Card>

        {/* Actions */}
        <div className="w-full pt-4 sm:pt-8 flex items-center justify-between gap-3">
          {onBack ? (
            <Button
              type="button"
              variant="outline"
              onClick={onBack}
              className="min-w-[100px] border-[#dbd6cf]"
            >
              Back
            </Button>
          ) : (
            <div />
          )}

          <Button
            onClick={onNext}
            className="px-6 py-4 bg-gradient-to-r from-theme-secondary to-theme-accent rounded-xl text-[#FFFEF7] uppercase font-bold text-base tracking-wider min-w-[180px]"
          >
            {isLastStep ? "finish & go to dashboard" : (buttonText?.toLowerCase() || "continue")}
          </Button>
        </div>
      </div>
    </div>
  )
}
