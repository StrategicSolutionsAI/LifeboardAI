import { NextRequest, NextResponse } from 'next/server';
import { getTodoistAuthUrl } from '@/lib/todoist/client';
import { supabaseServer } from '@/utils/supabase/server';
import { sanitizeRedirectUrl } from '@/lib/url-utils';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const redirectUrl = sanitizeRedirectUrl(searchParams.get('redirectUrl'), '/onboarding/3');

  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL}/login?error=You must be logged in to connect Todoist`);
  }

  const state = encodeURIComponent(JSON.stringify({
    redirectUrl,
    userId: user.id,
  }));

  const authUrl = `${getTodoistAuthUrl()}&state=${state}`;
  return NextResponse.redirect(authUrl);
} 