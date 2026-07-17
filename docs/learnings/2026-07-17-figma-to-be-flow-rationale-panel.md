# Designing a "proposed optimal flow" page that stays defensible

**Problem** — "Generate what you think the optimal flow should be" in Figma: an opinion deliverable, easy to produce as vague arrows that nobody can act on or argue with.

**Approach** — (1) Don't invent from taste: every proposed change must map to a pain point already *proven* from code on the as-is map (dead onboarding step, four orphan routes, onboarding-only integration setup, reset→re-login hop, sign-out→marketing page, mobile nav gaps). (2) Encode each delta as a numbered badge (`[1]`–`[10]`) placed on the diagram at the exact node/edge it changes, plus a side panel giving one sentence of rationale per badge — the diagram shows *what*, the panel shows *why*, and each row names today's behavior so the proposal is checkable. (3) Used plain `[n]` markers instead of ①–⑩: enclosed-alphanumeric glyphs are a font-support gamble in Inter; brackets never tofu. (4) Same build mechanics as the as-is map (vector-network arrows, zone frames, screenshot loop — see 2026-07-17-figma-flow-map-design-file.md).

**Solution** — Page "Optimal Flow (Proposed)" (39:2) in file SXgUxnZ3zp3FBiUsnKjr1V: 3 zones, 10-badge change system, rationale panel + legend as auto-layout frames (AUTO sizing both axes).

**Rule** — A to-be flow map is as-is map + numbered deltas + per-delta rationale that names the current behavior; if a proposed change can't cite a code-verified pain point, drop it. And when placing labels, frame *borders* are collision geometry too — a label that clears every box can still be struck through by a container edge.

**Dead ends** — Blamed the strike-through line on an arrow and nearly moved the wrong thing; a `sips`-cropped zoom of the screenshot showed it was the container frame's right border (x=1040). Crop-and-zoom the exact region before "fixing" a collision — full-page screenshots hide which line is which.
