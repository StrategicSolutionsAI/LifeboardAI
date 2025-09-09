import { NextResponse } from 'next/server';
import { supabaseServer } from '@/utils/supabase/server';
import { withErrorHandling } from '@/lib/api-error-handler';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic'

async function handler(request: Request) {
  const url = new URL(request.url);
  const searchParams = url.searchParams;
  const provider = searchParams.get('provider');
  const scoped = logger.forRequest(request, { operation: 'integration-status', provider });

  // Get the current user
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ connected: false, message: 'User not authenticated' }, { status: 401 });
  }

  if (!provider) {
    return NextResponse.json({ connected: false, message: 'Provider parameter is required' }, { status: 400 });
  }

  // Check if the user has an integration for the specified provider
  const { data: integration, error } = await supabase
    .from('user_integrations')
    .select('id, access_token, updated_at')
    .eq('user_id', user.id)
    .eq('provider', provider)
    .maybeSingle();

  scoped.info('Checked integration row', {
    hasAccessToken: !!integration?.access_token,
    error: error?.message
  });

  if (error) {
    return NextResponse.json({ connected: false, message: 'Error fetching integration status' }, { status: 500 });
  }

  const result = {
    connected: !!integration?.access_token,
    lastUpdated: integration?.updated_at || null,
    integrationId: integration?.id || null
  };

  return NextResponse.json(result);
}

export const GET = withErrorHandling(handler, 'integrations/status')
