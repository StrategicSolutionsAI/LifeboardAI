# Dead-code audit with knip + grep verification

**Problem** — "Remove any dead code" in a repo with dynamic wiring (widget registries, runtime `sw.js` registration, Electron entry outside the Next graph): a raw `npx knip` run reported 132 lines of findings, many of them false positives that would have broken the app if deleted blindly.

**Approach** — the order matters:
1. `npx knip --no-exit-code` once, save the full report to a scratch file.
2. Classify *files* first, deps second, exports last (each earlier class changes the later ones — deleting a barrel file turns its re-exported symbols into dead exports).
3. For every flagged item, grep the whole repo for the identifier **and** its kebab-case filename before touching it. Word-boundary greps lie here: `border` matched 118 files (CSS strings), `getBucketColor` "matched" `getBucketColorSync`, `msgId` matched an unrelated local variable. When grep and knip disagree, trust knip's module resolution but read the hits to understand why.
4. For "unused exports" the question is only: used *inside* its own file? Yes → remove the `export` keyword. No → delete the definition, then chase the cascade (deleting `getBucketColor` orphaned its private TTL cache and `BUCKET_COLORS_CACHE_TTL_MS` in cache-config).
5. Re-run knip at the end; encode every intentional keep in `knip.json` (electron/scripts/sw.js as `entry`, `src/components/ui/**` ignored) and tag documented-but-unreferenced API with `/** @public */` so the next run is zero-noise.

**Solution** — 9 files deleted, 11 deps removed (+ stale `optimizePackageImports` entries in `next.config.js`), ~20 dead functions/types deleted, ~35 symbols unexported; `knip.json` added. Commit `chore: remove dead code and unused dependencies (knip audit)`. Verified with `tsc --noEmit`, jest, and an empty knip re-run.

**Rule** — Never delete from a knip report directly. Knip finds candidates; a per-item grep (identifier + filename + registry/string references) grants permission. Intentional keeps go into `knip.json` or `@public` tags in the same PR, so the tool's report stays a to-do list, not a judgment call.

**Dead ends**
- Deleting `electron/*`, `scripts/*.js`, `public/sw.js`, `dotenv`, `electron-updater` — all flagged "unused" but are entry points outside the import graph (Electron main, manually-run ops scripts, runtime SW registration).
- Deleting shadcn `src/components/ui` exports (`CardFooter`, `buttonVariants`, `Dialog*`) — conventional UI-kit surface; ignore the folder in knip instead.
- Deleting `border`/`layout` from `src/lib/styles.ts` — unreferenced but documented design-system API in STYLE_GUIDE.md; `@public` tag instead.
- Counting grep hits to decide "externally used" — string collisions make raw counts meaningless; read the hits.
