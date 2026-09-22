# Reviewing every route at two widths, with real before/after, behind an auth wall

**Problem** — A whole-app design pass needs each route at 1440×900 and 390×844; `resize_window` is a no-op on the user's fullscreen Chrome, Playwright cannot get past the login wall, and there was no way to take "before" screenshots after the code had changed.

**Approach** — Reused the user's live localhost session by injecting a harness into a localhost tab: strip the page, add two same-origin iframes side by side (1440×900 and 390×844), and a `__go(path)` helper that swaps both `src`s. Same-origin means `contentDocument` is scriptable, so tab clicks, computed styles, stylesheet inspection, and `fetch` patching all work per viewport. One screenshot then shows both widths. For "before" shots: `git worktree add --detach <scratchpad>/before-wt <pre-change-sha>`, `cp -Rc node_modules` (APFS clone, ~13 s), copy `.env.local`, `next dev -p 3005` — the second-dev-server hook only guards 3000–3002, and cookies are per host not per port, so the session carries over. Rebuild the harness on the 3005 origin for those shots, then reuse the same worktree for `npm run build` (mistake 19: it must have its own `node_modules`).

**Solution** — Harness snippet (run in a localhost tab):

```js
document.head.querySelectorAll('style,link[rel=stylesheet]').forEach(n=>n.remove());
document.body.innerHTML=''; document.body.style.cssText='margin:0;background:#555;display:flex;gap:24px;padding:16px;overflow:hidden';
const mk=(w,h)=>{const f=document.createElement('iframe');f.style.cssText=`width:${w}px;height:${h}px;border:0;background:#fff;flex:none`;document.body.appendChild(f);return f};
window.__d=mk(1440,900); window.__m=mk(390,844);
window.__go=p=>{__d.src=location.origin+p;__m.src=location.origin+p;return p};
```

To force an error state, patch `contentWindow.fetch` **before first load** (a 5 ms interval that patches as soon as the iframe window's pathname matches) — patching after load and clicking refresh never surfaced the error branch.

**Rule** — For any UI review or verification, build the dual-viewport harness first and never judge from a single width. For before/after evidence use a worktree on another port, never `git stash` (another agent commits on this branch, and stash would sweep its changes). Keep browser batches short: a batch that runs long times out on return even though every step executed, and screenshots saved to disk in that batch are lost.

**Dead ends** — `resize_window`; Playwright against `/dashboard` (auth redirect); one 15-step browser batch (timed out, results discarded); patching `fetch` after the page had loaded.
