import { redirect } from "next/navigation"

// Step 5 was consolidated into step 4; keep old URLs working.
export default function OnboardingStep5() {
  redirect("/onboarding/6")
}
