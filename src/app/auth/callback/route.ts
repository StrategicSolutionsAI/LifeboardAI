import { NextResponse } from 'next/server'
import { supabaseServer } from '@/utils/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const from = searchParams.get('from')
  
  if (code) {
    const supabase = supabaseServer()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      // Get user data after successful auth
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        return NextResponse.redirect(`${origin}/login?error=no_user`)
      }
      
      // If coming from signup page, always send to onboarding
      if (from === 'signup') {
        await supabase
          .from('profiles')
          .upsert({ id: user.id, onboarded: false })
          .throwOnError()
        return NextResponse.redirect(`${origin}/onboarding/1`)
      }
      
      // Check onboarding status for existing users
      const { data: profile } = await supabase
        .from('profiles')
        .select('onboarded')
        .eq('id', user.id)
        .maybeSingle()
      
      // First-time user with no profile
      if (!profile) {
        await supabase.from('profiles').insert({ id: user.id }).throwOnError()
        return NextResponse.redirect(`${origin}/onboarding/1`)
      }
      
      // User exists but hasn't completed onboarding
      if (!profile.onboarded) {
        return NextResponse.redirect(`${origin}/onboarding/1`)
      }
      
      // User has completed onboarding, go to dashboard
      return NextResponse.redirect(`${origin}/dashboard`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=oauth`)
}
