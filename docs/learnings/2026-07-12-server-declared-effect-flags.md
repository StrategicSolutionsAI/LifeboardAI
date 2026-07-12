# Client behavior keyed on tool *names* is a lockstep trap — server declares effects

**Problem** — After each realtime voice tool call, the client decided whether to refresh the dashboard by checking `call.name !== 'refresh_context'` — a hardcoded list of which tools count as mutations, living in a different layer than the tool definitions.

**Approach** — Altitude review question: "if a new read-only tool (`search_tasks`) is added server-side, what breaks?" Answer: the client fires a spurious triple task refetch for every call to it, and nothing fails loudly — the exclusion list must be updated in lockstep with the server tool catalog.

**Solution** — `/api/chat/execute-command` now returns `mutated: boolean` on every response (`false` for `refresh_context`, `result.success` for commands). The client keys `notifyTasksUpdated` on `results.some(r => r.success && r.mutated)` — once per response, no name knowledge. Files: `src/app/api/chat/execute-command/route.ts`, `src/components/chat-bar.tsx`.

**Rule** — When a client must react differently to different server operations, the server response declares the effect (`mutated`, `requiresReauth`, …) as a machine-readable field; the client never switches on operation names, error text, or any other list it would have to keep in sync with the server. Same family as the `x-session-expired` header rule (2026-07-09-session-expiry-header-marker.md).

**Dead ends** — Folding `refresh_context` into `executeCommand`'s switch so the route has no branch at all: would force `refresh_context` into the `LifeboardCommand` union that the typed-chat `[LIFEBOARD_CMD]` prompt also enumerates, coupling the two chat pipelines. The route-level `mutated` field fixes the client contract without that coupling.
