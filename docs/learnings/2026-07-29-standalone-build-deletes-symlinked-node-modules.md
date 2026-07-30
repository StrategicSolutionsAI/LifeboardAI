# A measurement build in a worktree deleted the repo's node_modules

**Problem** — After a clean `next build` in a scratch git worktree, the next command in the
main repo failed with `Cannot find module './impl'`, and `du -sh node_modules` reported 0 B.

**Approach** — Wrong first instinct: another Claude session had a worktree in this repo and had
moved `main` forward, so I blamed a concurrent `npm ci`. Two things falsified that: `ps` showed
no install running, and the wipe recurred *after* I restored node_modules and ran another build.
What settled it was lining up the build history instead of the process list:

- build 1 **succeeded** -> node_modules empty
- build 2 failed in 10 s (`Cannot find module './impl'` — next deleting its own files)
- restore, build 3 **succeeded** -> node_modules empty
- build 4 failed in 6 s, identical error

The failures weren't the cause, they were the *victims*: each successful build wiped the tree at
its end, and the next build then started against nothing. The only unusual thing about the
harness was `ln -s <repo>/node_modules <worktree>/node_modules`, combined with
`output: 'standalone'` in next.config.js, which traces and copies node_modules as a build step.
That step resolved through the symlink and cleaned out the real directory.

**Solution** — Never symlink a shared node_modules into a build worktree. Give the worktree its
own copy; on APFS `cp -Rc <repo>/node_modules <worktree>/node_modules` clones copy-on-write in
~14 s for 1.4 GB, and the clone has independent inodes so a build there cannot reach the
original. Verified by re-running the same build and confirming the real tree survived at 1.4 GB.
Recovery when it happens: `npm ci` (package-lock.json is authoritative); the running dev server
survives the wipe and keeps serving, which is what makes the damage easy to miss.

**Rule** — When measuring bundle size in an isolated worktree, copy node_modules, never
symlink it — `output: 'standalone'` writes through the link and destroys the source. And when a
tool appears to have been sabotaged by something else in the environment, correlate the damage
against your *own* command history in timestamp order before blaming a concurrent process; a
concurrent session that really exists is a seductive red herring.

**Dead ends**
- Blaming the other session's worktree / an interrupted `npm ci`. It genuinely existed and had
  moved `main`, which made the story fit. It was not the cause.
- Reading `Cannot find module './impl'` as a corrupted or version-mismatched `next` install.
  It only means node_modules was already gone when the build started.
- Checking `find .next/standalone -type l` for symlinks to explain it — by the time you look,
  the failed build has already cleaned `.next`, so you find nothing and learn nothing.
