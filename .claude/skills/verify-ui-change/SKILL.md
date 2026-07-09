---
name: verify-ui-change
description: Required closing loop for any UI change in Lifeboard — visual verification, both themes, mobile width, and dev-server discipline. Run before reporting any UI task as done.
---

# Verify a UI change

No UI task in this repo is done until it has been *seen*. "Compiles" is not "works".

## Steps
1. Use the already-running dev server on port 3000. Never restart it, never start a second instance, never switch ports. If it isn't running, start one with `npm run dev`; if 3000 is occupied, diagnose (`lsof -ti:3000`) instead of moving.
2. `npx tsc --noEmit` — must be clean first.
3. Open the affected page in the browser. Exercise the actual interaction (click, drag, save), not just the render.
4. Check **both light and dark mode** — the token system (`src/lib/styles.ts`) should make this free; hardcoded colors are where it breaks.
5. Check mobile width (390px) for any layout change.
6. Screenshot the result and include it in your report.
7. If the page is behind auth and you cannot log in: report exactly that and stop. Do not mark the task done, do not claim it "should work".

## Quality gates before "done"
- New async UI has a loading skeleton.
- Colors come from `@/lib/styles` tokens — grep your diff for hex values and raw Tailwind palette classes (`bg-amber-`, `text-purple-`); there should be none.
- The new control lives inside an existing UI pattern (modal, popover, context menu) and you can name the sibling example you matched.
