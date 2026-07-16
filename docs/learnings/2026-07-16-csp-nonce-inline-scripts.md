# Inline scripts under a nonce CSP: nonce them AND suppress the hydration warning

**Problem** — Every page logged "Refused to execute inline script" — the root layout's service-worker registration and theme anti-flash scripts silently never ran (PWA dead, theme flash back) even though the app "worked".

**Approach** — The middleware mints a per-request nonce (`x-nonce` request header) and a CSP allowing only nonce-carrying inline scripts. Raw `<script dangerouslySetInnerHTML>` tags in `layout.tsx` had no nonce → blocked. Read the nonce in the Server Component root layout via `headers().get('x-nonce')` and pass `nonce={nonce}` to each script. First verification then showed a React hydration warning ("Prop nonce did not match. Server: '' Client: '…'") — inverted from what you'd guess: browsers implement *nonce hiding*, blanking the `nonce` content attribute after parsing, so client hydration always reads `""` where the server rendered a value.

**Solution** — `src/app/layout.tsx`: `headers()` import, `nonce={nonce}` + `suppressHydrationWarning` on both inline scripts (commit e51ef43).

**Rule** — In this repo any inline `<script>` must carry `nonce={headers().get('x-nonce')}` *and* `suppressHydrationWarning`. When adding one, verify with a browser console capture, not curl alone: the blocked-script failure mode is invisible in served HTML and doesn't stop the page from rendering.

**Dead ends** — Assuming the pages were fine because they rendered and hydrated (Next's own scripts get the nonce automatically; only the hand-written tags were dying). Treating the hydration warning as the server missing the nonce — it's the client that can never see it.
