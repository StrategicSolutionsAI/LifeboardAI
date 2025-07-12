"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import Link from "next/link"

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
  isLastStep = false
}: OnboardingLayoutProps) {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-[#F6F6FC] flex flex-col items-center">
      {/* Navbar */}
      <div className="w-full h-[84px] bg-white">
        <div className="w-full h-full px-10 flex items-center">
          <div className="flex items-center gap-0.5">
            <span className="text-theme-primary text-[30px] font-medium">Lifeboard</span>
            <span className="text-[#242849] text-[30px] font-medium">AI</span>
          </div>
        </div>
      </div>
      
      {/* Content Area */}
      <div className="w-full max-w-[500px] flex flex-col items-center gap-4 mt-[100px]">
        {/* Header */}
        <div className="w-full p-2.5 flex flex-col items-center">
          <h1 className="text-[#242849] text-[30px] font-medium">{title}</h1>
          {subtitle && <p className="text-[#171A1F] text-base font-normal">{subtitle}</p>}
        </div>
        
        {/* Main Content Card */}
        <Card className="w-full p-8 bg-white rounded-lg shadow-sm border border-theme-primary">
          {children}
        </Card>

        {/* Continue Button */}
        <div className="w-full pt-12 flex justify-center">
          <Button 
            onClick={onNext} 
            className="px-6 py-4 bg-gradient-to-r from-theme-secondary to-theme-accent rounded-xl text-[#FFFEF7] uppercase font-bold text-base tracking-wider"
          >
            {isLastStep ? "finish & go to dashboard" : (buttonText?.toLowerCase() || "continue")}
          </Button>
        </div>
      </div>
    </div>
  )
}
