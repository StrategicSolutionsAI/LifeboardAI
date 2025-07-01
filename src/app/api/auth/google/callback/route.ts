import { NextRequest, NextResponse } from 'next/server';
import { getOAuth2Client } from '@/lib/google/client';
import { supabaseServer } from '@/utils/supabase/server';
import { PostgrestError } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  // Get the authorization code from the URL
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  // Parse the state to get the redirectUrl if it exists
  let redirectUrl = '/dashboard';
  let userId = '';
  
  if (state) {
    try {
      const stateObj = JSON.parse(decodeURIComponent(state));
      if (stateObj.redirectUrl) redirectUrl = stateObj.redirectUrl;
      if (stateObj.userId) userId = stateObj.userId;
    } catch (e) {
      console.error('Error parsing state:', e);
    }
  }

  if (!code) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_SITE_URL}/error?message=No authorization code received`
    );
  }

  try {
    // Exchange the code for tokens
    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    
    // Get user details from Supabase
    const supabase = supabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_SITE_URL}/login?error=User not authenticated`
      );
    }

    // Try to check if the user_integrations table exists
    try {
      // First attempt to access the table to see if it exists
      const { error: tableError } = await supabase
        .from('user_integrations')
        .select('count')
        .limit(1);

      // If table doesn't exist, call our API to create it
      if (tableError && (tableError.code === '42P01' || tableError.message?.includes('relation "user_integrations" does not exist'))) {
        const createTableResponse = await fetch(
          `${process.env.NEXT_PUBLIC_SITE_URL}/api/integrations/create-table`, 
          { 
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY || ''}` 
            }
          }
        );
        
        if (!createTableResponse.ok) {
          console.error('Failed to create table via API');
          throw new Error('Failed to create integration table');
        }
      }
    } catch (error) {
      console.error('Error checking or creating table:', error);
      // Continue anyway - we'll handle insert errors gracefully below
    }

    // Store the tokens in the database, making sure we don't overwrite a valid
    // refresh_token with `null` or `undefined` (Google often omits it on
    // subsequent consent flows). This ensures the Calendar API can refresh
    // expired access_tokens later on.
    let insertError = null;
    try {
      let refreshTokenToStore: string | undefined = tokens.refresh_token ?? undefined;

      // If Google did not send a refresh_token, keep the one already stored.
      if (!refreshTokenToStore) {
        const { data: existingRow } = await supabase
          .from('user_integrations')
          .select('refresh_token')
          .eq('user_id', user.id)
          .eq('provider', 'google_calendar')
          .maybeSingle();

        if (existingRow?.refresh_token) {
          refreshTokenToStore = existingRow.refresh_token as string;
        }
      }

      const tokenDataToStore = { ...tokens, refresh_token: refreshTokenToStore };

      const { error } = await supabase
        .from('user_integrations')
        .upsert({
          user_id: user.id,
          provider: 'google_calendar',
          access_token: tokens.access_token,
          refresh_token: refreshTokenToStore,
          token_data: tokenDataToStore,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      insertError = error;
    } catch (error) {
      console.error('Exception storing tokens:', error);
      insertError = error as PostgrestError | Error;
    }

    if (insertError) {
      console.error('Error storing tokens:', insertError);
      
      // We'll still redirect to the dashboard, but with a query parameter to indicate the error
      // This is more user-friendly than going to an error page
      const targetUrl = redirectUrl.includes('?') 
        ? `${redirectUrl}&integrationError=true` 
        : `${redirectUrl}?integrationError=true`;
      
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL}${targetUrl}`);
    }

    // Redirect back to the onboarding or dashboard
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL}${redirectUrl}`);

  } catch (error) {
    console.error('Error in Google OAuth callback:', error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_SITE_URL}/error?message=Failed to authenticate with Google`
    );
  }
}
