"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"

export default function OnboardingStep5() {
  const router = useRouter()

  useEffect(() => {
    // Step 5 is now consolidated into step 4, redirect to completion
    router.replace("/onboarding/6")
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <p className="text-gray-600">Redirecting...</p>
      </div>
    </div>
  )
}