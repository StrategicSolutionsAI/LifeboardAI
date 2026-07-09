# Withings "reconnect every session" — refresh used the wrong action param

**Problem** — Withings integration required a full OAuth reconnect every session; every other integration stayed connected.

**Approach** — In order, and why:
1. Read the whole token lifecycle before touching anything: `src/lib/withings/client.ts` (refresh request), OAuth callback (initial storage), `integration-error-handler.ts` (refresh + wipe policy), status route (what the UI calls "connected").
2. Queried the live `user_integrations` table with the service-role key (read-only script, tokens masked) instead of theorizing. That showed the Withings row had `access_token`/`refresh_token`/`token_data` all NULL while every other provider's tokens were intact → proved the code's own `clearInvalidTokens` wiped them, and ruled out duplicates/RLS theories.
3. Asked "what makes refresh fail *permanently* every time?" and checked each Withings request param against the docs — refresh sent `action=refresh_token`; docs require `action=requesttoken` for all grants.
4. Verified against the **live** Withings API with a deliberately bogus refresh token: old action → status 2554 ("Not implemented"); fixed action → status 503 "Invalid Params: invalid refresh_token". This both proved the diagnosis and revealed the real dead-token status code (503, not 401 as the code assumed).

**Solution** — `src/lib/withings/client.ts`: `action: 'requesttoken'` in `refreshWithingsToken`; error mapping now treats only 401 or 503-with-`refresh_token`-message as `INVALID_REFRESH_TOKEN` (permanent → reauth), everything else as transient (tokens preserved). Regression tests in `src/lib/withings/__tests__/client.test.ts`. Commit `7849f01`.

**Rule** — When an OAuth integration keeps "disconnecting", first check the DB row: NULL tokens mean your own error handler wiped them — find what it misclassified as permanent. Then verify the refresh request against the provider's live API with a deliberately invalid token: the error status you get back tells you whether the request *shape* is even reaching token validation. Never map a provider error code to "token expired" without seeing that code come back for a genuinely dead token.

**Dead ends** —
- Refresh-token rotation races (in-memory lock not shared across route bundles/serverless instances): real design smell, but not the cause — Withings keeps the old refresh token valid ~8h after rotation, and the DB evidence showed a deterministic wipe, not an intermittent race.
- Duplicate `user_integrations` rows breaking `.maybeSingle()`: live DB had exactly one row per provider.
- RLS blocking user-scoped token updates: the owner UPDATE policy exists; Fitbit persists refreshes through the same path fine.
