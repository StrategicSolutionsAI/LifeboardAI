import { NextResponse } from 'next/server';
import { supabaseServer } from '@/utils/supabase/server';
import { getCalendarClient } from '@/lib/google/client';
import { withErrorHandling } from '@/lib/api-error-handler';
import { SESSION_EXPIRED_HEADER } from '@/lib/session-expired';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function handler(request: Request) {
  const scoped = logger.forRequest(request, { operation: 'google-calendar-events' })
  // Get query parameters
  const url = new URL(request.url)
  const searchParams = url.searchParams;
  const timeMin = searchParams.get('timeMin') || new Date().toISOString();
  const timeMax = searchParams.get('timeMax') || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const maxResults = searchParams.get('maxResults') || '10';

  // Get the current user
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: 'User not authenticated' },
      { status: 401, headers: { [SESSION_EXPIRED_HEADER]: '1' } }
    );
  }

  // Get the user's Google Calendar integration
  const { data: integration, error } = await supabase
    .from('user_integrations')
    .select('token_data')
    .eq('user_id', user.id)
    .eq('provider', 'google')
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: 'Error fetching Google Calendar integration' }, { status: 500 });
  }

  if (!integration?.token_data) {
    // Calendar views fetch Google events unconditionally — an unconnected
    // account is a normal empty state, not a 404 in every user's console.
    return NextResponse.json({ events: [], connected: false });
  }

  // Create a calendar client with the user's tokens
  const tokens = integration.token_data;
  const calendar = await getCalendarClient(tokens);

  // Get the user's calendar events
  const response = await scoped.timeOperation('calendar-events-list', async () =>
    calendar.events.list({
      calendarId: 'primary',
      timeMin,
      timeMax,
      maxResults: parseInt(maxResults),
      singleEvents: true,
      orderBy: 'startTime',
    })
  );

  const events = response.data.items?.map(event => ({
    id: event.id,
    summary: event.summary,
    start: event.start,
    end: event.end,
    location: event.location,
    htmlLink: event.htmlLink,
  })) || [];

  const res = NextResponse.json({ events });
  res.headers.set('Cache-Control', 'private, max-age=60, stale-while-revalidate=120');
  return res;
}

export const GET = withErrorHandling(handler, 'integrations/google/calendar/events')
