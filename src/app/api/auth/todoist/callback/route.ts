import { NextRequest, NextResponse } from 'next/server';
import { exchangeTodoistCodeForToken } from '@/lib/todoist/client';
import { supabaseServer } from '@/utils/supabase/server';
import { sanitizeRedirectUrl } from '@/lib/url-utils';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  let redirectUrl = '/dashboard';
  let userIdFromState = '';

  if (state) {
    try {
      const s = JSON.parse(decodeURIComponent(state));
      if (s.redirectUrl) redirectUrl = sanitizeRedirectUrl(s.redirectUrl);
      if (s.userId) userIdFromState = s.userId;
    } catch (e) {
      console.error('Failed to parse state param', e);
    }
  }

  if (!code) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL}/error?message=No authorization code from Todoist`);
  }

  try {
    const tokenData = await exchangeTodoistCodeForToken(code);

    const supabase = supabaseServer();
    const { data: { user } } = await supabase.auth.getUser();

    const effectiveUserId = user?.id || userIdFromState;

    if (!effectiveUserId) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL}/login?error=User not authenticated`);
    }

    // Ensure table exists (reuse create-table endpoint)
    try {
      const { error: tableError } = await supabase.from('user_integrations').select('id').limit(1);
      if (tableError && (tableError.code === '42P01' || tableError.message?.includes('does not exist'))) {
        await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/integrations/create-table`, { method: 'POST' });
      }
    } catch (e) {
      console.error('Error verifying user_integrations table', e);
    }

    const { error: upsertError } = await supabase
      .from('user_integrations')
      .upsert({
        user_id: effectiveUserId,
        provider: 'todoist',
        access_token: tokenData.access_token,
        token_data: tokenData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,provider' });

    if (upsertError) {
      console.error('Failed to store Todoist tokens', upsertError);
      redirectUrl += (redirectUrl.includes('?') ? '&' : '?') + 'integrationError=true';
    }

    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL}${redirectUrl}`);
  } catch (err) {
    console.error('Todoist OAuth callback error', err);
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL}/error?message=Todoist authentication failed`);
  }
} 