import { NextRequest, NextResponse } from 'next/server'
import { getWithingsAuthUrl } from '@/lib/withings/client'
import { supabaseServer } from '@/utils/supabase/server'
import { sanitizeRedirectUrl } from '@/lib/url-utils'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const redirectUrl = sanitizeRedirectUrl(searchParams.get('redirectUrl'), '/onboarding/3')
  const forwardedProto = request.headers.get('x-forwarded-proto')
  const forwardedHost = request.headers.get('x-forwarded-host')
  const origin = forwardedProto && forwardedHost
    ? `${forwardedProto}://${forwardedHost}`
    : new URL(request.url).origin

  const supabase = supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL}/login?error=You must be logged in to connect Withings`)
  }

  const state = encodeURIComponent(JSON.stringify({
    redirectUrl,
    userId: user.id,
  }))

  // Replace dummy state placeholder with actual state
  const baseAuth = getWithingsAuthUrl(origin)
  const authUrl = `${baseAuth}&state=${state}`

  return NextResponse.redirect(authUrl)
} 
