# One SDK barrel import was 60% of the server bundle and 1.2s of cold start

**Problem** — Nothing looked wrong. Gmail and Google Calendar routes worked; the previous pass had
already fixed the client bundle. The only suspicion was that `googleapis` is a big package.

**Approach** — Measured the thing that actually costs money on a serverless platform — module
evaluation on a cold start — before reading any application code:

```
node -e "const t=process.hrtime.bigint(); require('googleapis');
         console.log(Number(process.hrtime.bigint()-t)/1e6, Object.keys(require.cache).length)"
```

**1274 ms / 985 modules.** The same measurement against the specific API module plus its auth
export: **51 ms / 123 modules**. A 25x difference from one import specifier.

The reason tree-shaking cannot help: `googleapis`' index constructs a `GoogleApis` instance that
assigns every API onto itself at require time. It is not dead code a bundler may drop — it is
executed initialisation. So `import { google } from 'googleapis'` is a *runtime* cost, not just a
bytes cost, and no `optimizePackageImports` entry or `sideEffects` flag will touch it.

Then confirmed the fix in build output rather than by reading imports. App Router webpack-bundles
server deps, so `.nft.json` traces list nothing useful — the evidence is in `.next/server/chunks`.
Grepping those chunks for the version-namespace markers each API module declares (`gmail_v1`,
`calendar_v3`, `youtube_v3`, ...) counts what actually shipped:

| | server chunks | google api namespaces |
|---|---|---|
| root barrel | 16,999 kB | 530 |
| targeted imports | 6,763 kB | 2 |

**Solution** — `src/lib/google/client.ts` and `src/lib/gmail/client.ts` import
`googleapis/build/src/apis/calendar` / `.../gmail`, which export both the api factory (`calendar`,
`gmail`) *and* an `auth` AuthPlus instance — so `new auth.OAuth2(...)` replaces
`new google.auth.OAuth2(...)` with the identical class, and no new dependency is needed.
`src/app/api/auth/gmail/callback/route.ts` imports `gmail` the same way. Verified at runtime that
`generateAuthUrl`, `getToken`, `setCredentials` and the `.on('tokens')` refresh listener are all
present, then `tsc --noEmit`, `next build`, and the client route table (byte-identical, ±3 B of
chunk-hash noise).

`import type { gmail_v1 } from 'googleapis'` in `message-parser.ts` was left alone — `import type`
is erased, so it costs nothing.

**Rule** — For a multi-API SDK (`googleapis`, cloud SDKs, anything shaped as one client object
exposing dozens of services), never import the root barrel in server code: import the one service
module. Prove the cost with a `require` timing + `require.cache` count in plain node, and prove the
fix by grepping `.next/server/chunks` for per-service marker strings — not by reading import
statements. A deep `build/src/...` path is internal, and that is an acceptable trade here because a
rename breaks `tsc --noEmit` loudly rather than failing at runtime.

**Dead ends**
- Reaching for `google-auth-library` as a direct dependency for `OAuth2Client`. Unnecessary — the
  api submodule already re-exports an `auth` object with the same constructor.
- Looking for the footprint in `route.js.nft.json`. Every Gmail/Calendar route traced **zero**
  googleapis files, which reads like "already fixed" and means nothing: webpack had inlined the
  dependency into shared chunks instead.
- Expecting `experimental.optimizePackageImports` to help. It rewrites barrel *imports*; it cannot
  undo initialisation the barrel performs when required.
