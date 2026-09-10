# Layout updates — September 10, 2026

## Task brief

- Outcome: Apply the eight approved layout recommendations so daily content is readable and reachable on desktop and mobile.
- Evidence: Live review found 64px mobile email subjects, a navigation sheet extending 40px above a landscape viewport, 2.89:1 label contrast, nested Tasks scroll areas, and dashboard widgets pushed below summary cards.
- Context: SidebarLayout owns the page frame; route components own action handlers and content. The current checkout also contains unrelated authentication/loading work, including edits in Email.
- Constraints: Preserve the warm palette, folder presentation, Notes list/editor structure, existing data behavior, and all pre-existing edits. No production deployment or data mutation is part of this task.
- Risk: Medium — shared layout and text tokens affect multiple routes.
- Done when: All eight updates are implemented, focused regressions and type/lint/build checks pass, and the actual local screens are inspected at desktop, phone, and landscape sizes.

## System map and invariants

- `(app)/layout.tsx` -> QueryProvider -> SidebarLayout -> route content.
- Route callbacks retain ownership of add/compose operations; a shared header action slot moves their rendering without duplicating handlers.
- Tasks gets a bounded flex workspace and one list scroll owner at normal heights. At viewport heights of 600px or less, the full workspace scrolls so controls cannot collapse the list. Other pages retain normal page scrolling.
- Email keeps account selection, labels, queries, read state, and bulk operations intact; the same message content reflows across breakpoints.
- Dashboard retains category navigation, widget order, editing, logging, and drag/drop behavior.
- Shared theme colors and responsive layout change only client presentation. No auth/API/schema changes.

## Milestones

1. [x] Shared frame: compact header/actions, account menu, active secondary mobile navigation, bounded navigation sheet; remove Budget's extra outer gutters.
2. [x] Email: stacked mobile sender/time, full-width subject and preview; preserve desktop list and keyboard/control behavior.
3. [x] Tasks: available-height workspace and a single deliberate vertical list scroller.
4. [x] Dashboard: compact summary strip, one widget column on phones, chat placement with reserved space.
5. [x] Contrast: readable informative labels and timestamps, with documentation updated to match tokens.
6. [x] Calendar: full date above mobile controls with comfortable targets.
7. [x] Verify: focused regression tests, type-check, lint, build, and local rendered desktop/mobile/landscape review; inspect final task-specific diff.

## Decisions

- Use a header portal for route-owned actions rather than global events or duplicated action state. Portals preserve React context and unmount with their page.
- Keep existing app servers and unrelated listeners intact; use an isolated local source snapshot for preview/build verification if their build artifacts are stale.
- Validate actual geometry in the browser. JSDOM tests cover navigation and interaction contracts, not CSS layout.

## Verification and rollout

- Regressions: secondary mobile navigation state, header action lifecycle, message row content and independent action behavior; browser checks for bounds and scroll ownership.
- Viewports: desktop around 1440px, laptop 1280px, phone 390px and narrow 320px where relevant, landscape 667x375.
- Exercise add/compose dialogs without saving, navigation, tab/view switching, and scroll reachability. Avoid opening unread live mail because it marks messages read.
- Rollout: local changes only. No schema or deployment. Revert only this task's hunks to roll back; a source-only starting snapshot is saved under `/tmp/lifeboard-layout-baseline`.

## Progress and discoveries

- 2026-09-10: Source and existing dirty diff revalidated. Both existing local production servers return Internal Server Error in the authenticated browser; their ports and processes are preserved. A separate development snapshot runs at `http://localhost:3003`.
- Short landscape Tasks initially collapsed its list to zero height. The 600px height fallback now allows the main region to scroll all content; the last tasks are reachable at 667x375, including with search open. At 1280x800, main stays at 760px with no overflow, and the list alone scrolls (490px visible / 1970px content).
- More reflects secondary routes. The navigation sheet at 667x375 occupies y=16 through y=375 and scrolls its contents. Escape restores focus to both More and the top navigation trigger.
- Email's actual component was rendered with temporary synthetic messages in the isolated preview because the live Gmail list returned a load error after refresh. Long mobile subjects have 330px at 390px viewport width and wrap to two lines; desktop rows remain 40px tall. The fixture was removed after inspection. Live Compose still opens from the header.
- Dashboard's first phone widget moved from y=646 to y=398, with 316px-wide cards in one column. Chat opens within portrait and landscape bounds (landscape y=32.5–295). Add Widget opens its existing library.
- Calendar at 320px shows the complete September 2026 title and 44px-high Today, view, previous/next, and More controls. Controls wrap without horizontal overflow.
- Budget uses the shared 24px phone gutters. Add Expense opens correctly; the desktop folder composition is preserved and Add Folder opens correctly.
- Shopping header fits at 320px and Add Item opens correctly. Notes retains its desktop list/editor split; Integrations has no horizontal overflow. Account menu exposes Settings and Sign out.
- Informative tertiary text is #667085, confirmed from the live computed token; it has 4.97:1 contrast against white.
- Final read-only review against the source-only starting snapshot found no remaining actionable findings. Existing unrelated source edits match the starting snapshot.

## Validation results

- `npm run test -- --runInBand`: 35 suites passed, 183 tests passed; 1 suite / 4 tests remain skipped as configured. New regressions cover header portal lifecycle, mobile route selection and focus, independent email selection/star/open actions, and Compose.
- `npm run type-check`: passed.
- `npm run lint`: passed with existing repository warnings.
- `npm run build`: passed in a separate source snapshot, preserving running servers and their build artifacts. Existing dependency/Browserslist and lint warnings remain.
- `git diff --check`: passed.
- Browser inspection used the actual app at desktop, 390px phone, 320px narrow phone, and 667x375 landscape sizes. Screenshots were inspected during the session; DOM geometry confirmed scroll ownership, action placement, and viewport bounds.

## Residual risks

- Physical touch behavior and all custom theme combinations require separate device coverage.
- Live Gmail message retrieval is currently failing independently of this presentation change; mail layout was verified using synthetic messages and interaction regressions. No email was sent, no live unread message was opened, and no records were added during QA.
- Full provider integrations and every task mode/filter combination were not exercised. No production deployment was performed.
