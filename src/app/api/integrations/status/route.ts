import { NextResponse } from 'next/server';
import { supabaseServer } from '@/utils/supabase/server';
import { withErrorHandling } from '@/lib/api-error-handler';
import { logger } from '@/lib/logger';
import { refreshWithingsToken } from '@/lib/withings/client';
import { withRefreshLock } from '@/lib/token-refresh-lock';

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

      try {
        await withRefreshLock(integration.id, async () => {
          // Re-check freshness inside the lock
          const { data: freshRow } = await supabase
            .from('user_integrations')
            .select('access_token, refresh_token, token_data, updated_at')
            .eq('id', integration.id)
            .maybeSingle()

          if (freshRow?.updated_at) {
            const freshTokenData = (freshRow.token_data || {}) as { expires_in?: number }
            const freshUpdated = new Date(freshRow.updated_at).getTime()
            const freshExpires = freshUpdated + (freshTokenData.expires_in ?? 3600) * 1000
            if (Date.now() < freshExpires - 60_000 && freshRow.access_token) {
              scoped.info('Token already refreshed by another request', { integrationId: integration.id })
              return // already fresh
            }
          }

          const latestRefresh = freshRow?.refresh_token || integration.refresh_token
          const newTokens = await refreshFn(latestRefresh!)
          await supabase
            .from('user_integrations')
            .update({
              access_token: newTokens.access_token,
              refresh_token: newTokens.refresh_token || latestRefresh,
              token_data: newTokens,
              updated_at: new Date().toISOString(),
            })
            .eq('id', integration.id)
          scoped.info('Token refreshed proactively', { integrationId: integration.id })
        })
      } catch (e) {
        scoped.warn('Proactive token refresh failed', { integrationId: integration.id }, e as Error)
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
