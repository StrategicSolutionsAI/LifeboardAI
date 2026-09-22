# OAuth redirect_uri_mismatch on the hosted deployment

**Problem** — On the Vercel-hosted app, connecting Google Calendar failed with Google's "doesn't comply with OAuth 2.0 policy… register the redirect URI" page, showing `redirect_uri=https://lifeboard-ai-tk6j.vercel.app/api/auth/google/callback`. Localhost worked fine.

**Approach**
1. Read how the callback URL is built (`src/lib/google/client.ts` → `resolveOrigin`, called from `src/app/api/auth/google/route.ts` with the request's forwarded host). Confirmed the URI in the error is exactly what the code sends, so the code is correct and the problem is registration, not derivation.
2. Confirmed the hostname is the project's stable production alias (`vercel ls --prod` shows per-deploy hashes; the alias is what the error carried), so one registration covers production.
3. The console listed two OAuth clients. Pulled the production env (`vercel env pull --environment=production`) and matched the first characters of `GOOGLE_CLIENT_ID` (`…-7ip9`) to the console row ("Lifeboard Supabase") before telling the user which pencil icon to click. `GOOGLE_FIT_CLIENT_ID` (`…-tsvp`) mapped to the other client.

**Solution** — No code change. Added `https://lifeboard-ai-tk6j.vercel.app/api/auth/google/callback` under Authorized redirect URIs (and the origin under JavaScript origins) on the "Lifeboard Supabase" client in Google Cloud Console → APIs & Services → Credentials. Same treatment applies to the Google Fit client with `/api/auth/googlefit/callback`.

**Rule** — When an OAuth provider rejects a redirect URI on a new host, first confirm the URI in the error equals what the code derives; if so, the fix is registration in the provider console, not code. Identify the right client by matching the env var's client-ID prefix to the console list — never guess from names. Redirect URIs are per exact host: every new hosting domain (production alias, custom domain) must be added to every OAuth client the app uses; Vercel preview hashes cannot be registered (no wildcards).

**Dead ends**
- Looking under IAM & Admin → Service Accounts. Service accounts have no redirect URIs; OAuth clients live under APIs & Services → Credentials.
- Assuming a mismatch means `NEXT_PUBLIC_SITE_URL` is wrong. The routes pass the request origin, so the env var is only a fallback and was not the cause.
