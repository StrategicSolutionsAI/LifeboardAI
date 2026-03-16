import { NextRequest, NextResponse } from 'next/server'
import { getGmailAuthUrl } from '@/lib/gmail/client'
import { supabaseServer } from '@/utils/supabase/server'
import { sanitizeRedirectUrl } from '@/lib/url-utils'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const redirectUrl = sanitizeRedirectUrl(searchParams.get('redirectUrl'), '/email')
  const forwardedProto = request.headers.get('x-forwarded-proto')
  const forwardedHost = request.headers.get('x-forwarded-host')
  const origin = forwardedProto && forwardedHost
    ? `${forwardedProto}://${forwardedHost}`
    : new URL(request.url).origin

  const supabase = supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  const state = encodeURIComponent(JSON.stringify({
    redirectUrl,
    userId: user?.id || null,
  }))

  const authUrl = getGmailAuthUrl(origin) + `&state=${state}`

  return NextResponse.redirect(authUrl)
}
