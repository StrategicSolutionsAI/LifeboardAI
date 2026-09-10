# The PWA service worker serves stale code in development

**Problem** — After editing components (and after a full dev-server restart) the browser kept rendering the old markup: the dashboard still showed removed stat tiles, a changed media query had no effect, and a component's class list matched the pre-edit source.

**Approach**
1. Ruled out the server: `curl http://localhost:3000/_next/static/chunks/app/(app)/calendar/page.js | grep -c 'max-width: 1023px'` returned the new code, so the process on port 3000 was fine.
2. Ruled out a foreign or orphaned server: `lsof -nP -iTCP:3000 -sTCP:LISTEN` plus `lsof -p <pid> | grep cwd` (three orphaned next-servers from this repo were running on 3000/3001/3002 and were killed, but that was not the cause).
3. In the page: `navigator.serviceWorker.getRegistrations()` showed `/sw.js` active with cache `lifeboard-v2`. `public/sw.js` answers `/_next/static/` cache-first, and dev chunk URLs never change, so the cache wins forever.
4. `getRegistrations().then(unregister)` + `caches.delete('lifeboard-v2')`, reload: the new code appeared.

**Solution** — `src/app/layout.tsx` only injects the service-worker registration script when `NODE_ENV === 'production'`. Production chunks carry content hashes, so cache-first stays safe there.

**Rule** — When a source change is invisible in the browser, check `navigator.serviceWorker.getRegistrations()` and `caches.keys()` before blaming the dev server or HMR. Never let a cache-first worker cover unhashed URLs, and never register a worker in development.

**Dead ends**
- Restarting the dev server (twice). It recompiles correctly; the browser never asks it.
- Assuming the process on port 3000 was stale because its uptime predated the edits.
