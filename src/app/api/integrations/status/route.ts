import { NextResponse } from 'next/server';
import { supabaseServer } from '@/utils/supabase/server';
import { withErrorHandling } from '@/lib/api-error-handler';
import { logger } from '@/lib/logger';
import { refreshWithingsToken } from '@/lib/withings/client';
import { createIntegrationErrorHandler } from '@/lib/integration-error-handler';
import { getUserCached } from '@/lib/server-auth-cache';

export const dynamic = 'force-dynamic'

// Map of provider → refresh function
const providerRefreshFns: Record<string, (refreshToken: string) => Promise<any>> = {
  withings: refreshWithingsToken,
}

type IntegrationRow = {
  id: string
  access_token: string | null
  refresh_token: string | null
  token_data: unknown
  updated_at: string | null
}

/** Status for one provider, including the proactive token refresh. */
async function resolveStatus(
  provider: string,
  integration: IntegrationRow | undefined,
  userId: string,
  scoped: ReturnType<typeof logger.forRequest>
) {
  scoped.info('Checked integration row', {
    provider,
    hasAccessToken: !!integration?.access_token,
  })

  if (!integration?.access_token) {
    return { connected: false, lastUpdated: null, integrationId: null }
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
        userId,
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

  return {
    connected: true,
    lastUpdated: integration.updated_at || null,
    integrationId: integration.id || null,
    tokenFresh,
  }
}

async function handler(request: Request) {
  const url = new URL(request.url);
  const searchParams = url.searchParams;
  const provider = searchParams.get('provider');
  // `?providers=a,b,c` answers the whole set in one request. /integrations used
  // to fetch one provider at a time, so a visit cost one request, one auth
  // check and one single-row query per provider.
  const providersParam = searchParams.get('providers');
  const scoped = logger.forRequest(request, { operation: 'integration-status', provider: provider ?? providersParam });

  // Get the current user
  const supabase = supabaseServer();
  const { data: { user } } = await getUserCached(supabase);

  if (!user) {
    return NextResponse.json({ connected: false, message: 'User not authenticated' }, { status: 401 });
  }

  if (!provider && !providersParam) {
    return NextResponse.json({ connected: false, message: 'Provider parameter is required' }, { status: 400 });
  }

  const requested = providersParam
    ? providersParam.split(',').map(p => p.trim()).filter(Boolean)
    : [provider as string]

  if (!requested.length) {
    return NextResponse.json({ connected: false, message: 'Provider parameter is required' }, { status: 400 });
  }

  // One query for the whole set (including token_data for the expiry check)
  const { data: rows, error } = await supabase
    .from('user_integrations')
    .select('id, access_token, refresh_token, token_data, updated_at, provider')
    .eq('user_id', user.id)
    .in('provider', requested);

  if (error) {
    scoped.warn('Error fetching integration status', { error: error.message })
    return NextResponse.json({ connected: false, message: 'Error fetching integration status' }, { status: 500 });
  }

  const byProvider = new Map<string, IntegrationRow>(
    (rows ?? []).map(r => [r.provider as string, r as IntegrationRow])
  )

  const headers = { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' }

  // Single-provider form stays byte-identical for existing callers.
  if (!providersParam) {
    const result = await resolveStatus(provider as string, byProvider.get(provider as string), user.id, scoped)
    return NextResponse.json(result, { headers });
  }

  const resolved = await Promise.all(
    requested.map(async p => [p, await resolveStatus(p, byProvider.get(p), user.id, scoped)] as const)
  )
  return NextResponse.json({ statuses: Object.fromEntries(resolved) }, { headers });
}

export const GET = withErrorHandling(handler, 'integrations/status')
