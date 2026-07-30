# The First Load JS table said "no change" after a split that worked

**Problem** — After moving a 22 kB component behind `next/dynamic`, `next build` reported
/tasks 215 kB -> 206 kB but /calendar 293 kB -> **295 kB**. The same change, opposite verdicts.

**Approach** — Treating the route table as the measurement is the mistake; it is a gzipped
per-route rollup of a chunk *group*, and webpack rebalances which chunks belong to a group on
every build. A 2 kB move between shared chunks can swamp a real win, in either direction.

The measurement that actually answers "did this leave the critical path" is per-module, and it
needs two files the build already produces:

- `.next/app-build-manifest.json` — `pages[route]` lists the chunk files a route loads initially
- webpack-bundle-analyzer with `analyzerMode: 'json'` — module -> `parsedSize` per chunk

Intersect them: sum `parsedSize` of every non-`node_modules` module in the chunks the route's
manifest entry names. That is app code on the initial path, unaffected by gzip ratios or chunk
renaming. Here it went /calendar 80 -> 59 kB and /tasks 79 -> 52 kB — the split worked on both
routes, and the +2 kB on /calendar was chunk-group churn, not a regression. Cross-checked with
raw bytes per route (sum `os.path.getsize` over the manifest's chunk list): /tasks 705 -> 677 kB,
/calendar 983 -> 983 kB. So the honest claim is "/tasks shipped 28 kB less; /calendar ships the
same bytes but no longer parses the editor during hydration" — not a made-up win on both.

**Solution** — Method only, nothing shipped. Install `webpack-bundle-analyzer` **in the scratch
worktree, not the repo**, patch its `next.config.js` to add the plugin behind `if (!isServer &&
process.env.ANALYZE)`, and keep that config out of the rsync so repeated syncs don't clobber it.

**Rule** — Never report a bundle win from the `next build` route table alone. It is gzipped and
chunk-group-relative, so it can show +2 kB for a change that removed 21 kB of app code. Prove it
per-module by intersecting `.next/app-build-manifest.json` with analyzer JSON, and report the
metric you actually measured. When the two disagree, say so rather than quoting the flattering one.

**Dead ends**
- `grep`-ing built chunks for library names to attribute weight. Minification strips them:
  `recharts` was findable, `@hello-pangea/dnd` and `framer-motion` were not, so the search
  reports "absent" for libraries that are present.
- Reading the shared-baseline line ("First Load JS shared by all") as the thing to optimize. It
  was already 91 kB here; the remaining weight was 931 kB of *app source*, which means the work
  is code-splitting our own modules, not swapping libraries.
