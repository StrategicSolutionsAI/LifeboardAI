import { NextRequest, NextResponse } from 'next/server';
import { getGoogleAuthUrl } from '@/lib/google/client';
import { supabaseServer } from '@/utils/supabase/server';
import { sanitizeRedirectUrl } from '@/lib/url-utils';

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const redirectUrl = sanitizeRedirectUrl(searchParams.get('redirectUrl'), '/onboarding/3');
  const forwardedProto = request.headers.get('x-forwarded-proto')
  const forwardedHost = request.headers.get('x-forwarded-host')
  const origin = forwardedProto && forwardedHost
    ? `${forwardedProto}://${forwardedHost}`
    : new URL(request.url).origin
  
  // Get user from Supabase (optional for Google OAuth login)
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  
  // Create state parameter with redirect URL and user ID (if available)
  const state = encodeURIComponent(JSON.stringify({
    redirectUrl,
    userId: user?.id || null,
  }));

  // Get the authorization URL
  const authUrl = getGoogleAuthUrl(origin) + `&state=${state}`;
  
  // Redirect to Google's OAuth consent screen
  return NextResponse.redirect(authUrl);
}
