import { NextResponse } from 'next/server';
import { supabaseServer } from '@/utils/supabase/server';
import { withErrorHandling } from '@/lib/api-error-handler';
import { logger } from '@/lib/logger';
import { refreshWithingsToken } from '@/lib/withings/client';
import { createIntegrationErrorHandler } from '@/lib/integration-error-handler';

export const dynamic = 'force-dynamic'

// Map of provider → refresh function
const providerRefreshFns: Record<string, (refreshToken: string) => Promise<any>> = {
  withings: refreshWithingsToken,
}

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

  // Fetch the full integration row (including token_data for expiry check)
  const { data: integration, error } = await supabase
    .from('user_integrations')
    .select('id, access_token, refresh_token, token_data, updated_at')
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

  if (!integration?.access_token) {
    return NextResponse.json({
      connected: false,
      lastUpdated: null,
      integrationId: null,
    });
  }

  // Proactively refresh the token if it's expired (or about to expire).
  // This runs before any widget fetches, preventing race conditions where
  // multiple widgets all try to refresh simultaneously.
  let tokenFresh = true
  const refreshFn = providerRefreshFns[provider]
  if (refreshFn && integration.refresh_token) {
    const tokenData = (integration.token_data || {}) as { expires_in?: number }
    const expiresIn = tokenData.expires_in ?? 3600
    const updatedAt = integration.updated_at ? new Date(integration.updated_at).getTime() : 0
    const expiresAt = updatedAt + expiresIn * 1000
    const willExpireSoon = Date.now() > expiresAt - 60_000

    if (willExpireSoon) {
      scoped.info('Token expired or expiring soon, refreshing proactively', {
        integrationId: integration.id,
        expiresAt: new Date(expiresAt).toISOString(),
      })

      // Shared handler = same lock, persistence, and wipe policy as the
      // metrics and history routes (Withings refresh tokens are single-use).
      const errorHandler = createIntegrationErrorHandler({
        provider,
        userId: user.id,
        integrationId: integration.id,
        operation: 'status-proactive-refresh',
      })
      const result = await errorHandler.handleTokenRefresh(
        refreshFn,
        integration.refresh_token,
        integration.id
      )
      if (result.success) {
        scoped.info('Token refreshed proactively', { integrationId: integration.id })
      } else {
        scoped.warn('Proactive token refresh failed', { integrationId: integration.id })
        tokenFresh = false
      }
    }
  }

  const result = {
    connected: true,
    lastUpdated: integration.updated_at || null,
    integrationId: integration.id || null,
    tokenFresh,
  };

  return NextResponse.json(result, {
    headers: {
      'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
    },
  });
}

export const GET = withErrorHandling(handler, 'integrations/status')
