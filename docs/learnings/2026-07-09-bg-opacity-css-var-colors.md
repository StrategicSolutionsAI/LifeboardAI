# bg-opacity utilities silently fail on CSS-variable theme colors

**Problem** — Selected chips in onboarding rendered as solid brand-brown blocks with invisible labels; the same class combo (`bg-theme-primary bg-opacity-10`) sat in four files.

**Approach** — The screenshot showed solid fill where a 10% tint was intended. Checked `tailwind.config.ts`: theme colors are defined as plain CSS-variable hex strings (`var(--theme-primary)` → `#B1916A`). Tailwind's `bg-opacity-*` works by injecting `--tw-bg-opacity` into an `rgb(r g b / var(--tw-bg-opacity))` declaration — with a hex string there is no alpha slot, so the opacity utility is a no-op and the background renders fully opaque.

**Solution** — Replaced every `bg-theme-* bg-opacity-*` with the purpose-built tint tokens (`bg-theme-brand-tint`, plus `ring-1 ring-inset ring-theme-primary` for selected states). Fixed in `src/app/onboarding/1/page.tsx`, `2/page.client.tsx`, `3/page.tsx`, `4/page.tsx`; regression test in `src/app/onboarding/1/__tests__/page.test.tsx`.

**Rule** — Never combine `bg-opacity-*` / `text-opacity-*` with `theme-*` colors in this repo; use the `theme-brand-tint-*` tokens (or an inline `hexToRgba`) for translucent brand surfaces. Grep for `bg-opacity` when auditing new UI.

**Dead ends** — "Fix" by bumping opacity value (the utility does nothing at any value); redefining the Tailwind color with `<alpha-value>` (would break `applyTheme`, which writes plain hex vars at runtime).

**Update 2026-09-22** — Slash modifiers (`theme-*/NN`) are now alpha-capable through `alphaCapable()` in `tailwind.config.ts` (`color-mix()` on the runtime variable), so `ring-theme-primary/40` renders as intended. `bg-opacity-*` remains a no-op by design. See docs/learnings/2026-09-22-theme-color-opacity-modifiers-emit-nothing.md.
