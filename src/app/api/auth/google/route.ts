import { NextRequest, NextResponse } from 'next/server';
import { getGoogleAuthUrl } from '@/lib/google/client';
import { supabaseServer } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const redirectUrl = searchParams.get('redirectUrl') || '/onboarding/3';
  const forwardedProto = request.headers.get('x-forwarded-proto')
  const forwardedHost = request.headers.get('x-forwarded-host')
  const origin = forwardedProto && forwardedHost
    ? `${forwardedProto}://${forwardedHost}`
    : new URL(request.url).origin
  
  // Get user from Supabase
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_SITE_URL}/login?error=You must be logged in to connect Google Calendar`
    );
  }

  // Create state parameter with redirect URL and user ID
  const state = encodeURIComponent(JSON.stringify({
    redirectUrl,
    userId: user.id,
  }));

  // Get the authorization URL
  const authUrl = getGoogleAuthUrl(origin) + `&state=${state}`;
  
  // Redirect to Google's OAuth consent screen
  return NextResponse.redirect(authUrl);
}
