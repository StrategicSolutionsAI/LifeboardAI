# staleTimes.dynamic: force-dynamic apps lose the client router cache after 30s

**Problem** — Every sidebar navigation to a page visited more than 30s ago paid a full RSC round trip (middleware + auth + server render) before the page swapped, even though every (app) page is a static client shell whose data lives in client-side caches.

**Approach** — The root layout is `force-dynamic` (required by the nonce CSP), which puts every page in Next 14.2's *dynamic* router-cache bucket: 30s staleTime by default. Since the RSC payload of a client-shell page never meaningfully changes, extending the bucket is free win; the safety question is session expiry, which in this app rides on API 401s + the `x-session-expired` header (machine-readable marker, not page renders), and sign-out calls `clearAllUserCaches()`.

**Solution** — `experimental.staleTimes = { dynamic: 300 }` in `next.config.js` (commit 42a3c48). Config changes need a dev-server restart to take effect.

**Rule** — In a client-shell App Router app that is force-dynamic for CSP/nonce reasons, set `experimental.staleTimes.dynamic` to make re-navigation instant; before doing so, confirm (1) session expiry is enforced by API responses, not by the page render, and (2) sign-out clears client data caches. Verify behaviorally, not by reading docs: navigate A→B→A with >30s between visits against a **production build** and assert zero requests with the page's pathname (RSC `?_rsc=` or document) fire on the return navigation — and that the cache-served page is still interactive (click something).

**Dead ends** — Verifying in `next dev` (router cache behavior differs and first-visit compiles drown the signal); asserting on timing instead of request presence (local prod round trips are ~20ms, indistinguishable from cache).
