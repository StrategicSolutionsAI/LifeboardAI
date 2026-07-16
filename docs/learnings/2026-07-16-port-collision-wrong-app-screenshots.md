# Foreign dev server on port 3000 — identical-size screenshots are the tell

**Problem** — A 33-page screenshot audit "succeeded" but every non-root capture was Next's 404 page: the process on port 3000 was a *different project's* dev server (only `/` existed there).

**Approach** — The giveaway was every screenshot having the exact same byte size (10,154 bytes) — identical images mean identical pages, i.e. one shared error page. `ps`/`lsof -p <pid> | grep cwd` on the port's owner showed a foreign project directory. Killing it didn't stick: tracing the parent chain (`ps -o ppid=` upward) showed another live Claude Code session owned it and restarted it per its own standing orders. Broke the loop by not contending — ran this project's server as a harness-tracked background task on the port Next fell back to, and pointed the audit there.

**Solution** — Audit re-ran against the correct server (`:3002` that session). No repo change.

**Rule** — Before trusting any localhost capture or probe, verify the server's identity, not just that the port answers: check `lsof -p $(lsof -ti:PORT) | grep cwd` matches this repo, or probe a route that only this app serves (e.g. `/login` returning 200). If a batch of screenshots comes back byte-identical, the run captured one shared error page — stop and re-verify the target before reviewing anything. If another live session owns the port, don't enter a kill loop — run on an explicit alternate port and say so.

**Dead ends** — Killing the occupant repeatedly (a sibling Claude session's standing orders respawn it); trusting `curl /` returning 200 as proof the right app is up (the foreign app also had a `/`); backgrounding the dev server with plain `&` in a tool shell (dies when the shell exits — use the harness's background mode).
