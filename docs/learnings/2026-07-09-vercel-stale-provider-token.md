# Production chat broken while local works — stale provider token in Vercel env

**Problem** — On the deployed app (lifeboard-ai-tk6j.vercel.app), every chat message returned the "technical difficulties" fallback (`isError: true`) in under a second, while local chat worked.

**Approach** — (1) Read the route to learn what "broken" looks like: `/api/chat` never 500s on LLM failure — it streams a 200 with a fallback `text` frame and `isError: true`, so verification means reading the NDJSON frames, not the status code. (2) Reproduced against production with a minted session (see 2026-07-09-minted-session-perf-measurement.md) — sub-second failure meant the Replicate call died immediately, pointing at credentials rather than timeouts. (3) `vercel env ls` showed `REPLICATE_API_TOKEN` set 303 days ago. (4) Decisive test: `vercel env pull` the production value and curl `https://api.replicate.com/v1/account` with the prod token (401) and the local `.env.local` token (200). Different tokens, prod one revoked.

**Solution** — Replaced `REPLICATE_API_TOKEN` in all three Vercel environments with the working local value (`vercel env rm` + `vercel env add` piped from `.env.local`, never echoed), then `vercel redeploy <current-prod-url>` so the runtime picks it up without shipping local working-tree state. Re-tested: real streamed reply, no `isError`. No repo code changed.

**Rule** — When a provider-backed feature fails in one environment but works in another, don't debug application code: pull both environments' credential values and validate each directly against the provider's cheapest authenticated endpoint (Replicate: `GET /v1/account`). A token that 401s there is the whole diagnosis. After changing a Vercel env var, a redeploy is required — existing deployments keep the old value.

**Dead ends** — Assuming the 200 status meant chat worked (the route masks LLM failure inside the stream). Reading Vercel runtime logs first — token validation was faster and conclusive. Deploying from the local tree with `vercel --prod` — `vercel redeploy` of the existing production deployment applies new env without risking uncommitted local state.
