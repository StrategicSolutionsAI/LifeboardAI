import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/utils/supabase/server';
import { getOAuth2Client, getCalendarClient } from '@/lib/google/client';

export async function GET(request: NextRequest) {
  try {
    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const timeMin = searchParams.get('timeMin') || new Date().toISOString();
    const timeMax = searchParams.get('timeMax') || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const maxResults = searchParams.get('maxResults') || '10';
    
    // Get the current user
    const supabase = supabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ 
        error: 'User not authenticated' 
      }, { status: 401 });
    }

    // Get the user's Google Calendar integration
    const { data: integration, error } = await supabase
      .from('user_integrations')
      .select('token_data')
      .eq('user_id', user.id)
      .eq('provider', 'google_calendar')
      .maybeSingle();

    if (error || !integration?.token_data) {
      return NextResponse.json({ 
        error: 'Google Calendar integration not found' 
      }, { status: 404 });
    }

    // Create a calendar client with the user's tokens
    const tokens = integration.token_data;
    const calendar = await getCalendarClient(tokens);

    // Get the user's calendar events
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin,
      timeMax,
      maxResults: parseInt(maxResults),
      singleEvents: true,
      orderBy: 'startTime',
    });

    const events = response.data.items?.map(event => ({
      id: event.id,
      summary: event.summary,
      start: event.start,
      end: event.end,
      location: event.location,
      htmlLink: event.htmlLink,
    })) || [];

    return NextResponse.json({ events });
    
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    return NextResponse.json({ 
      error: 'Error fetching calendar events'
    }, { status: 500 });
  }
}
