# OpenAI Realtime beta→GA migration: native tools replace transcript regex parsing

**Problem** — Voice mode created wrong/duplicate tasks and only handled task creation. The client parsed the assistant's *spoken transcript* with ~300 lines of regex heuristics (trigger words, quoted-text extraction, `[LIFEBOARD_CMD]` blocks the model was begged to emit), guarded by create-locks against double-firing.

**Approach** — Instead of patching the heuristics, moved action-handling to the layer that supports it natively:
1. Recognized the root cause: the beta integration made *speech* the command channel, so every action rode on unreliable text parsing.
2. The GA Realtime API supports native function calling — declare tools at session mint; tool calls arrive as structured `function_call` items in `response.done`, never in the audio.
3. Reused the existing `executeCommand()` union (chat routes) as the tool surface: one tool per `LifeboardCommand` action, executed server-side by a new route, so voice and typed chat share one execution path.
4. Migrated the three API touchpoints in order: session mint endpoint → session config shape → client SDP endpoint, then deleted all transcript parsing.

**Solution**
- `src/app/api/openai/realtime-session/route.ts` — mint via `POST /v1/realtime/client_secrets` with GA body `{ session: { type: 'realtime', model, instructions, tools, audio: { input: { transcription, turn_detection: { type: 'semantic_vad' } }, output: { voice } } } }`; secret is `data.value` (was `data.client_secret.value`); model default `gpt-realtime`; `OpenAI-Safety-Identifier: user.id` header; dashboard context injected into instructions via `buildChatContext` (non-fatal `.catch`).
- `src/app/api/chat/execute-command/route.ts` (new) — validates with `executeCommandSchema` (zod discriminated union, `src/lib/validations.ts`), calls exported `executeCommand()` (`src/lib/chat-commands.ts`); `refresh_context` action returns fresh context as tool output.
- `src/components/chat-bar.tsx` — data channel handles exactly three events: input transcription → user message, output transcript done → assistant message, `response.done` function_calls → POST execute-command → `conversation.item.create` with `function_call_output` per call → one `response.create` to make the model speak the confirmation. Client connects via `POST /v1/realtime/calls` with **no model query param and no `OpenAI-Beta` header** (session is bound to the ephemeral key).

**Rule** — Never parse an LLM's conversational output (especially speech transcripts) to detect actions. If the API offers function calling, define one tool per action, execute tool calls server-side through the same validated path as the text UI, and return `function_call_output` + `response.create` so the model confirms. If you find yourself writing trigger-word regexes over model output, stop — you're on the wrong layer.

**Dead ends**
- `[LIFEBOARD_CMD]` inline text blocks: the model reads them aloud, omits them, or mangles the JSON; needs regex salvage + create-locks and still double-fires.
- Client-side NL parsing of user/assistant transcripts (trigger words, quoted content, date/bucket regexes): brittle, English-only, create-only, duplicates server logic.
- Keeping beta endpoints with GA models: `/v1/realtime/sessions` + `client_secret.value` + `OpenAI-Beta: realtime=v1` + `?model=` on the SDP call are all beta-shape; GA rejects/ignores them — migrate all four together, not piecemeal.
- Executing tool calls directly against `/api/integrations/todoist/tasks` from the client: bypasses the command union's validation, bucket resolution, and non-task actions.
