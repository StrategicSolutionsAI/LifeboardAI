# Concurrent Claude sessions in one repo: commit only your hunks, distrust .next artifacts

**Problem** — Mid-session, `tsc --noEmit` failed on `.next/types/app/(app)/tasks/board/page.ts` referencing a source file that didn't exist, and a file I had edited (`sidebar-layout.tsx`) grew unrelated changes (new Budget nav item) I never made.

**Approach** — Checked `git status` before debugging anything: another active session had deleted the `tasks/board` route and was modifying ~20 files. That explained both symptoms — the tsc error was a stale generated stub in `.next/types` from my earlier build (the route existed at build time), and the sidebar changes were the other session's work interleaved with mine.

**Solution** — Removed only the stale stub (`rm -rf '.next/types/app/(app)/tasks/board'`), never `.next` wholesale (a prod server was serving from it). For the shared file, staged only my hunks: `git diff -- file > full.patch`, awk-filter to the hunks whose `@@ -old` headers I authored, `git apply --cached filtered.patch`, then commit. The other session's changes stayed uncommitted in the working tree. Before staging any file, `git diff -- <file>` to confirm it contains only your changes.

**Rule** — In a repo where another session may be working: (1) treat a `tsc` error inside `.next/types` pointing at a missing source file as a stale generated artifact — check `git status` for a `D` on that route before touching application code; (2) never `git add <file>` on a shared-touched file without diffing it first; use a filtered patch + `git apply --cached` when a file mixes authors ­— subset hunks apply cleanly because git matches on old-file line numbers and context; (3) don't edit CLAUDE.md or other files the concurrent session has dirty.

**Dead ends** — Re-running the build to "fix" the tsc error (regenerates types but tramples the running server and wastes minutes); trying to hand-reconstruct the file to separate authors (the diff already separates them by hunk).
