"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { OnboardingLayout } from "@/components/onboarding-layout"
import { supabase } from "@/utils/supabase/client"

const extractFirstWord = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null
  }
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }
  const [first] = trimmed.split(/\s+/)
  return first || null
}

export default function OnboardingIntro() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isActive = true

    const loadExistingName = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user || !isActive) {
          return
        }

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("first_name")
          .eq("id", user.id)
          .maybeSingle()

        if (profileError && profileError.code !== "PGRST116") {
          console.error("Failed to load profile during onboarding", profileError)
        }

        const fallbackCandidates: unknown[] = [
          profile?.first_name,
          user.user_metadata?.preferred_name,
          user.user_metadata?.first_name,
          user.user_metadata?.given_name,
          user.user_metadata?.nickname,
          user.user_metadata?.name,
          user.user_metadata?.full_name
        ]

        let resolvedName: string | null = null
        for (const candidate of fallbackCandidates) {
          const extracted = extractFirstWord(candidate)
          if (extracted) {
            resolvedName = extracted
            break
          }
        }

        if (resolvedName && isActive) {
          setName(prev => prev || resolvedName!)
        }
      } catch (err) {
        console.error("Unexpected error loading onboarding name", err)
      }
    }

    loadExistingName()

    return () => {
      isActive = false
    }
  }, [])

  const handleNext = async () => {
    if (isSaving) {
      return
    }

    const trimmed = name.trim()
    if (!trimmed) {
      setError("Please let us know what to call you.")
      return
    }

    setError(null)
    setIsSaving(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError("We couldn't verify your session. Please sign in again.")
        setIsSaving(false)
        return
      }

      const { error: upsertError } = await supabase
        .from("profiles")
        .upsert(
          { id: user.id, first_name: trimmed },
          { onConflict: "id" }
        )

      if (upsertError) {
        throw upsertError
      }

      router.push("/onboarding/1")
    } catch (err) {
      console.error("Failed to save onboarding name", err)
      setError("Something went wrong while saving your name. Please try again.")
      setIsSaving(false)
    }
  }

  return (
    <OnboardingLayout
      step={1}
      title="Welcome to LifeboardAI"
      subtitle="Your AI-powered life management platform"
      description="Get organized, stay focused, and achieve more with personalized insights."
      buttonText={isSaving ? "SAVING..." : "GET STARTED"}
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

        <div className="pt-6 text-left">
          <label htmlFor="preferred-name" className="block text-sm font-medium text-[#171A1F] mb-2">
            What should we call you?
          </label>
          <input
            id="preferred-name"
            type="text"
            value={name}
            onChange={(event) => {
              setName(event.target.value)
              if (error) {
                setError(null)
              }
            }}
            placeholder="Enter your first name"
            className="w-full rounded-lg border border-[#D0D5DD] bg-white px-4 py-3 text-sm text-[#171A1F] shadow-sm focus:border-theme-primary focus:outline-none focus:ring-2 focus:ring-theme-primary/20"
            autoComplete="given-name"
          />
          <p className="mt-2 text-xs text-[#565E6C]">
            We use this to personalize your dashboard greeting.
          </p>
          {error && (
            <p className="mt-2 text-sm text-red-500">
              {error}
            </p>
          )}
        </div>
      </div>
    </OnboardingLayout>
  )
}
