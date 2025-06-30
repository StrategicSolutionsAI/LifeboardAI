import { NextRequest, NextResponse } from 'next/server'
import { getGoogleFitAuthUrl } from '@/lib/googlefit/client'
import { supabaseServer } from '@/utils/supabase/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const redirectUrl = searchParams.get('redirectUrl') || '/onboarding/3'

  const supabase = supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_SITE_URL}/login?error=You must be logged in to connect Google Fit`,
    )
  }

  const state = encodeURIComponent(
    JSON.stringify({ redirectUrl, userId: user.id }),
  )

  const authUrl = `${getGoogleFitAuthUrl()}&state=${state}`
  return NextResponse.redirect(authUrl)
}
