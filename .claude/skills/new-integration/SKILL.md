---
name: new-integration
description: Playbook for adding or repairing a third-party service integration (OAuth APIs like Todoist, Withings, Fitbit, Google, FatSecret) — folder layout, token storage, error handling, and the OAuth pitfalls that have already cost time here.
---

# Add or repair a service integration

Existing integrations live in `src/lib/<service>/` (see `todoist`, `withings`, `fitbit`, `gmail`, `google`, `googlefit`, `fatsecret`). Copy their shape; don't invent a new one.

## Structure
- `src/lib/<service>/` — client, token helpers, API wrappers. All credentials via env vars; add the names to `.env.example`, never commit values.
- API routes under `src/app/api/<service>/` — OAuth callback route + data routes, wrapped in `withErrorHandling`, auth-checked, using `createApiError`.
- Errors routed through `src/lib/integration-error-handler.ts` so failures degrade gracefully in widgets instead of crashing the dashboard.
- Slow/rate-limited external calls: use `fetch-with-timeout.ts` and `rate-limit.ts`; cache reads per `cache-config.ts` TTL patterns.

## OAuth checklist (Withings broke on exactly these)
1. Callback URL registered with the provider must match the route exactly, including protocol and port, for both localhost and prod.
2. Store **both** access and refresh tokens with their expiry timestamp; persist via a migration-backed table, not in-memory.
3. Refresh flow: test it by manually expiring the access token, not by waiting. A token refresh that's never been exercised is broken.
4. Handle the "user revoked access" case: surface a reconnect prompt in the widget, don't retry-loop.

## Definition of done
- Connect → fetch → disconnect → reconnect all exercised against the real service (or its sandbox) with output shown.
- Token refresh proven with a forced-expiry test.
- Widget renders a sane state for: no connection, connected-with-data, connected-but-API-down.
- Migration file for any new token/settings table, mappers in `src/repositories/` if data is stored.
