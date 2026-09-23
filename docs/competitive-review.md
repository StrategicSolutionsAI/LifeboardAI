# Lifeboard vs. the family-organizer market

**Date:** 2026-09-23 · **Lifeboard state:** pre-release, no external users, branch `perf/bundle-and-api-roundtrips`

Twenty-one competitors were researched from primary sources (product sites, pricing pages, help centres, App Store and Google Play listings) on 2026-09-22/23. Lifeboard's own column was built by reading this repository, not its marketing. Nothing is marked shipped unless a logged-in user can reach it through the UI *and* the code behind it does real work.

**Verdict up front.** Lifeboard is not currently a family organizer. It is a single-player life dashboard wearing family vocabulary. All seven direct competitors share a calendar between two accounts; Lifeboard shares nothing between two accounts, because no data table in the schema carries a `household_id` column. Across the thirteen dimensions below it scores one ✅, seven 🟡 and five ❌, and the single ✅ is budget, which is per-user. Its genuinely rare assets — device-fed wellness tracking, a real Gmail client, composable buckets — are real, and they all sit on the wrong side of that wall.

---

## 1. Feature matrix

Legend: ✅ shipped and usable · 🟡 partial, stubbed, or present but limited · ❌ absent · ❓ unverified

Maple is marked `*` because it is dying: Grow Maple was acquired by Wander on 2026-07-29 and the product shuts down on 2026-12-31, confirmed by a sunset notice on its own site and by the acquirer's blog post. Its App Store and Google Play listings already return 404. It is kept in the matrix because it was a well-built direct competitor and its feature set is instructive, but it should not be treated as a live rival. Read the other way, a free, AI-first, well-funded family organizer failing to reach escape velocity is the single most useful market signal in this review.

#### Tier 1 — direct all-in-one family organizers

| Dimension | **Lifeboard** | Jam | Cozi | Maple* | FamilyWall | TimeTree | FamCal | Calendara |
|---|---|---|---|---|---|---|---|---|
| 1. Multi-person / shared calendar | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 2. Event capture (manual/NL/email/photo/voice) | 🟡 | ✅ | 🟡 | 🟡 | 🟡 | 🟡 | 🟡 | 🟡 |
| 3. Tasks: delegation + due dates | 🟡 | ✅ | 🟡 | ✅ | ✅ | 🟡 | ✅ | 🟡 |
| 4. Shared lists | 🟡 | ✅ | ✅ | ✅ | ✅ | 🟡 | ✅ | ✅ |
| 5. Permissions / roles (kids, caregivers) | ❌ | ✅ | ❌ | 🟡 | 🟡 | ❌ | ❌ | 🟡 |
| 6. Chores and rewards | ❌ | 🟡 | 🟡 | 🟡 | ❌ | ❌ | ❌ | 🟡 |
| 7. Meal planning | ❌ | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| 8. Budget / finance | ✅ | ❌ | ❌ | 🟡 | ✅ | ❌ | 🟡 | ❌ |
| 9. Wellness / energy / capacity | 🟡 | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 10. AI (reactive / proactive / agentic) | 🟡 | 🟡 | 🟡 | ✅ | 🟡 | 🟡 | ❌ | 🟡 |
| 11. Integrations (GCal / Apple / Gmail / feeds) | 🟡 | 🟡 | 🟡 | ✅ | 🟡 | 🟡 | 🟡 | 🟡 |
| 12. Platforms (web/iOS/Android/widgets/display) | 🟡 | 🟡 | 🟡 | ✅ | ✅ | ✅ | 🟡 | 🟡 |
| 13. Pricing model | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

#### Tier 2 — AI "mental load" assistants

| Dimension | **Lifeboard** | Ohai | Anna | AlphaMa | Ollie | Sense | Nori |
|---|---|---|---|---|---|---|---|
| 1. Multi-person / shared calendar | ❌ | ✅ | ✅ | 🟡 | 🟡 | ✅ | ✅ |
| 2. Event capture | 🟡 | ✅ | ✅ | 🟡 | ✅ | ✅ | ✅ |
| 3. Tasks: delegation + due dates | 🟡 | ✅ | ✅ | ✅ | 🟡 | ✅ | ✅ |
| 4. Shared lists | 🟡 | ✅ | 🟡 | 🟡 | ✅ | ✅ | ✅ |
| 5. Permissions / roles | ❌ | 🟡 | 🟡 | 🟡 | ❌ | 🟡 | 🟡 |
| 6. Chores and rewards | ❌ | 🟡 | ❌ | 🟡 | 🟡 | ✅ | ✅ |
| 7. Meal planning | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 8. Budget / finance | ✅ | ❌ | ❌ | ❌ | 🟡 | 🟡 | ❌ |
| 9. Wellness / energy / capacity | 🟡 | 🟡 | ❌ | ✅ | 🟡 | ❌ | ❌ |
| 10. AI | 🟡 | ✅ | ✅ | 🟡 | ✅ | 🟡 | ✅ |
| 11. Integrations | 🟡 | 🟡 | 🟡 | 🟡 | 🟡 | 🟡 | 🟡 |
| 12. Platforms | 🟡 | 🟡 | 🟡 | 🟡 | 🟡 | ✅ | ✅ |
| 13. Pricing model | ❌ | ✅ | ✅ | 🟡 | ✅ | ✅ | ✅ |

#### Tier 3 — wall-mounted displays

| Dimension | **Lifeboard** | Skylight | Hearth |
|---|---|---|---|
| 1. Multi-person / shared calendar | ❌ | ✅ | ✅ |
| 2. Event capture | 🟡 | ✅ | 🟡 |
| 3. Tasks: delegation + due dates | 🟡 | ✅ | ✅ |
| 4. Shared lists | 🟡 | ✅ | ✅ |
| 5. Permissions / roles | ❌ | 🟡 | 🟡 |
| 6. Chores and rewards | ❌ | ✅ | ✅ |
| 7. Meal planning | ❌ | ✅ | ✅ |
| 8. Budget / finance | ✅ | ❌ | ❌ |
| 9. Wellness / energy / capacity | 🟡 | ❌ | 🟡 |
| 10. AI | 🟡 | ✅ | 🟡 |
| 11. Integrations | 🟡 | ✅ | 🟡 |
| 12. Platforms | 🟡 | ✅ | 🟡 |
| 13. Pricing model | ❌ | ✅ | ✅ |

#### Tier 4 — 2026 entrants

| Dimension | **Lifeboard** | Homsy | OneHaus | Kinmory | Lifestack |
|---|---|---|---|---|---|
| 1. Multi-person / shared calendar | ❌ | ✅ | ✅ | ✅ | ❌ |
| 2. Event capture | 🟡 | 🟡 | 🟡 | ✅ | 🟡 |
| 3. Tasks: delegation + due dates | 🟡 | ✅ | ✅ | ✅ | 🟡 |
| 4. Shared lists | 🟡 | ✅ | ✅ | 🟡 | ❌ |
| 5. Permissions / roles | ❌ | 🟡 | 🟡 | 🟡 | ❌ |
| 6. Chores and rewards | ❌ | 🟡 | 🟡 | ✅ | ❌ |
| 7. Meal planning | ❌ | ✅ | ✅ | ✅ | 🟡 |
| 8. Budget / finance | ✅ | ✅ | 🟡 | ❌ | ❌ |
| 9. Wellness / energy / capacity | 🟡 | ❌ | ❌ | ❌ | ✅ |
| 10. AI | 🟡 | ❌ | 🟡 | ✅ | ✅ |
| 11. Integrations | 🟡 | 🟡 | 🟡 | ✅ | 🟡 |
| 12. Platforms | 🟡 | ✅ | 🟡 | ✅ | 🟡 |
| 13. Pricing model | ❌ | ✅ | ✅ | ✅ | ✅ |

#### Baseline

| Dimension | **Lifeboard** | Google Calendar + Families | Apple Calendar + Family Sharing |
|---|---|---|---|
| 1. Multi-person / shared calendar | ❌ | ✅ | ✅ |
| 2. Event capture | 🟡 | 🟡 | 🟡 |
| 3. Tasks: delegation + due dates | 🟡 | 🟡 | ✅ |
| 4. Shared lists | 🟡 | ✅ | ✅ |
| 5. Permissions / roles | ❌ | 🟡 | ✅ |
| 6. Chores and rewards | ❌ | ❌ | ❌ |
| 7. Meal planning | ❌ | ❌ | ❌ |
| 8. Budget / finance | ✅ | ❌ | 🟡 |
| 9. Wellness / energy / capacity | 🟡 | ❌ | 🟡 |
| 10. AI | 🟡 | 🟡 | 🟡 |
| 11. Integrations | 🟡 | 🟡 | ✅ |
| 12. Platforms | 🟡 | 🟡 | 🟡 |
| 13. Pricing model | ❌ | ✅ | ✅ |

Apple deserves more attention than a baseline usually gets. It is free, it is already on the family's phones, and on three dimensions it beats every paid product here: assigning a shared Reminder actually notifies the assignee, it documents four real roles (Organizer, Adult, Parent/Guardian, Child) with Ask to Buy and Screen Time behind them, and Calendar subscribes to webcal/`.ics` school feeds natively alongside Google, Exchange and CalDAV accounts. It has no chores, no meal planning and no Android app. Any pitch for a paid family organizer has to clear "we already use the shared calendar that came with the phones."

### What Lifeboard's own cells mean

| # | Cell | Why |
|---|---|---|
| 1 | ❌ | Members are text labels in a widget, not accounts. `assignee_id` is `text`. No table has `household_id`. |
| 2 | 🟡 | Manual and natural-language entry work. No email-forward, no photo. The AI's own event path is broken (§4b). |
| 3 | 🟡 | Due dates, recurrence and per-occurrence exceptions are excellent. Delegation is a label nobody receives. |
| 4 | 🟡 | One shopping list per user, not shared, no second list type. |
| 5 | ❌ | `admin`/`member` gate household membership management only, nothing else. |
| 6 | ❌ | "Chore Assignments" is a counter widget with `unit: "task"`. |
| 7 | ❌ | "Meal Plan" is a counter widget with `unit: "week"`. FatSecret is calorie logging. |
| 8 | ✅ | Real envelope budgeting: categories, monthly caps, progress, health score. Per-user. |
| 9 | 🟡 | Deep tracking across ~14 metrics with three live device integrations. Nothing acts on it. |
| 10 | 🟡 | Reactive only. No cron, no digest, no inbox watch, no outward actions. |
| 11 | 🟡 | Gmail full client, Todoist two-way, three health providers. Google Calendar read-only, no Apple, no ICS feeds. |
| 12 | 🟡 | Web, installable PWA, Electron desktop. No native mobile, no OS widgets, no display. |
| 13 | ❌ | Landing page sells three tiers; there is no billing code of any kind. |

---

## 2. Category fit

**The case that Lifeboard is competing in this category.** It is positioned for busy working parents, ships a calendar, tasks, a shopping list and a family-members roster, has a `households` table with invite-by-email, lets tasks and shopping items be assigned to a family member, colour-codes the calendar by person, and sells a "$39/month Team" tier promising shared boards and role-based access. Every one of those is a family-organizer move. A buyer reading the landing page would put it directly against Cozi.

**The case that it is in a different category.** Nothing is shared. The product's centre of gravity is a customizable widget dashboard over *your own* life: 49 widget templates weighted toward wellness (11), health (9) and medical (6) against 8 family ones — of which seven are unimplemented counters — plus three wearable integrations, a full personal Gmail client, and a personal budget. Cozi has no wellness, no budget and no email client; Lifeboard has no sharing, no meal planner and no chores. Read by what it does rather than what it says, Lifeboard is a personal operating system in the lineage of Notion dashboards and Lifestack, and the family vocabulary is a skin over single-player data.

**Verdict: adjacent today, and unintentionally so.** Lifeboard is built as a personal dashboard and marketed as a family product. That gap is the single most important fact in this review, because it decides whether the next three months go into sharing or into depth. The category it could credibly own — family coordination that is aware of the parent's actual capacity — is empty: none of the seven Tier 1 apps has any wellness feature at all, and the only product doing capacity-aware scheduling, Lifestack, is a single-user tool with no family features. Lifeboard is the only product in this set holding both halves. It has not connected them.

---

## 3. Where Lifeboard is genuinely ahead

Three claims were tested. Two survive, one partly.

**Wellness tracking — survives, and it is the strongest claim.** All seven Tier 1 organizers score ❌ on dimension 9, without exception; so do Skylight, Homsy, OneHaus, Kinmory, Nori and Google. Lifeboard tracks sleep, steps, water, weight, heart rate, caffeine, mood, cycle, habits, meditation, breathwork and nutrition, with Withings, Fitbit and Google Fit live end-to-end including OAuth token refresh, plus FatSecret for macros. The nearest things to competition are outside the category: Lifestack does genuine energy forecasting from wearables but is single-user with no family features at all, AlphaMa does mood check-ins with no device data, Hearth ships emoji "Today's Feelings", and Apple shares Health and Fitness data between family members without ever connecting it to the calendar. Nobody in this set joins wellness data to household scheduling. That intersection is empty, and Lifeboard is the only product holding both halves of it.

**Buckets — unique, but it does not survive as an *advantage*.** No competitor offers a user-composed widget dashboard; Hearth has a fixed Family Dashboard and Kinmory a fixed tablet display. So the structure is genuinely rare. It is not yet a reason to switch, for two reasons. Of 49 widget templates, 23 have a bespoke component and the other 26 render as increment-to-target counters — and the split falls in the worst possible place: of the eight templates in the `family` category, exactly one, Family Members, is real. Family Calendar, Chore Assignments, Meal Plan, Allowance/Budget, Photo Carousel, Health & Emergency Info and Carpool Schedule are all counters. A parent who adds "Meal Plan" gets a widget that counts to one week. Second, configurability is a cost to the exhausted buyer this product targets. Cozi's proposition is that it works in four minutes; "30+ widgets, fully customizable" is homework. Treat buckets as a retention mechanic for users who already stayed, not as an acquisition argument.

**Budget — partly survives, and it is the weakest of the three.** Lifeboard's budget is real: categories with icons, per-category monthly caps, progress, a health score, month navigation and a dashboard widget. But it is not rare, and it is pointed the wrong way. FamilyWall ships category spending limits with custom periods and attachments on Premium; Homsy ships expenses with income, recurring charges and cost-splitting between members; Maple shipped an Expense Sheet before it was acquired; FamCal does trip expenses; OneHaus projects subscription costs; Apple Cash Family does allowances and spending limits. Two of those — FamilyWall and Homsy — are full household budgets *shared across the family*, which is the whole point of a family budget. Lifeboard's is per-user. Ahead of four of the seven Tier 1 apps; behind the two competitors that matter on this dimension.

**Two more, unclaimed but real.** A browsable Gmail client — threads, search, attachments, labels, send, reply, drafts, bulk archive and trash, plus an unsubscribe-driven inbox cleaner — is unique in this set. Several competitors touch email: Jam, FamilyWall, Maple, Sense, Nori and Skylight accept forwarded mail at a capture address, AlphaMa triages a connected inbox and drafts replies, and Anna sends after approval. None gives the user a place to actually read and manage their mail. Separately, task recurrence with per-occurrence exceptions (skip one, override one, truncate future) is more sophisticated than anything in Tier 1.

**And one nobody thought to claim: two-way Todoist sync.** Creates, completions, reopens, deletions, reschedules and edits are all written back. No competitor in this set syncs with a third-party task manager at all. It matters less than the others because Todoist is not where family logistics live, but it is a real integration nobody else has.

Whether the email client is an *asset* is a separate question, taken up in §7. Note also what did **not** survive: a voice assistant is not a differentiator. Jam, Ohai, Anna, Ollie, Sense, Nori, Kinmory, AlphaMa and Skylight all ship voice capture. Lifeboard's Realtime implementation is good, and it is table stakes.

---

## 4. Table-stakes gaps

Features that four or more of the seven Tier 1 apps have and Lifeboard lacks, ordered by how badly they hurt.

| Gap | Tier 1 coverage | Lifeboard |
|---|---|---|
| **Shared calendar across accounts** | 7 / 7 | ❌ No table has `household_id` |
| **Reminders / notifications** | 7 / 7 | ❌ None of any kind |
| **Native mobile apps** | 7 / 7 | ❌ Web, PWA and Electron only |
| **Shared lists** | 6 / 7 | 🟡 One list, per-user |
| **Real delegation (assignee is an account)** | 4 / 7 | 🟡 A text label |
| **Meal planning** | 4 / 7 (Cozi, Maple, FamilyWall, FamCal) | ❌ A counter widget |
| **Email-forward capture** | 4 / 7 (Jam, Cozi Max, FamilyWall, Maple) | ❌ Route exists, no address |
| **Chore lists** | 4 / 7 | ❌ A counter widget |
| **Some role model for kids or caregivers** | 4 / 7 | ❌ Roles gate only membership |

A note on the two that verification softened. "Chores" is 4 of 7 and not one of those four is more than a *list* — assign a recurring to-do to a child and let them tick it off. No Tier 1 app ships points, allowance or a reward economy; that belongs to Sense, Kinmory, Nori and Skylight. FamCal markets "manage all family chores" with no chore feature behind it. "Roles" is thinner still: Cozi's FAQ states plainly that it "does not offer a restricted access option"; TimeTree's help centre says there is "no other difference between members' permissions" beyond who may remove people; FamilyWall makes every email-invited member an administrator by default; and FamCal's "child members" have no login at all, making them colour labels rather than accounts — which is precisely what Lifeboard already has. Only Jam (Little Kid / Big Kid / Teen plus scoped caregivers) and Apple have a role model worth the name. Lifeboard should aim at the 4-of-7 bar, not at Jam.

Two of these deserve elaboration.

**Notifications.** Lifeboard has no web push, no scheduled reminders, no email digests, no local notifications — nothing but in-app toasts. A sweep for any delivery mechanism returns only placeholder text, widget descriptions and a "Coming Soon" Slack card. The assistant's own suggested prompt in `src/components/chat-bar.tsx:67` is "Add a reminder to call the dentist tomorrow at 9am", which produces a task that will never remind anyone of anything. Cozi sends daily and weekly agenda emails on its free tier. A family calendar that cannot tell anyone anything is not a coordination tool; it is a record.

**Pricing.** The market has settled at **$40–$80 per year for an entire family**, almost always with a real free tier: Cozi Gold $39/yr and Max $79.99/yr, FamCal Gold $39.99/yr, Calendara $39.99/yr, TimeTree Premium $44.99/yr, Sense $59.99/yr, Nori $59.90/yr, Kinmory $69.84/yr. Jam is the outlier at $119.99/yr, and it covers twelve members including caregivers. Lifeboard's landing page asks **$18/month ($216/yr) for one person** and **$39/month ($468/yr)** for a Team tier whose three headline features — shared bucket boards, role-based access, family meal planning — none exist. That is three to six times the category price for a strict subset of the category's function, and it is currently unbuildable because there is no billing code at all.

### 4a. The "proactive AI" gap is smaller than the marketing suggests

Fact-checking moved four products *down* from proactive to reactive once a feature page was demanded instead of a tagline. Jam's help centre returns zero articles for "proactive" and every documented behaviour of its assistant is user-triggered. TimeTree's entire 147-article help centre contains nothing that reads mail or messages; its Event Scan is an upload-a-photo flow. AlphaMa's Gmail triage runs when the user asks. OneHaus's blog has a section headed "Proactive" describing nudges that do not exist in the product.

That leaves genuinely unprompted behaviour with a much smaller group: Ohai (Smart Ohai Sync connects to email directly, in beta), Ollie (morning briefing text and evening email digest to the family group chat), Maple, Kinmory, Nori and Skylight for inbox or flyer ingestion, and Anna, which is agentic but ships with email sending off by default. Ohai will now book a doctor's appointment through a Ferry Health partnership.

For Lifeboard this reframes dimension 10. Being reactive-only is roughly par for a Tier 1 organizer, not a deficit. The gap that actually costs users is capture (§4) and notification, both of which look like AI features in competitors' marketing but are really plumbing. Build the plumbing; do not chase the adjective.

### 4b. Three problems found while inventorying

None is a competitive matter. All three tell the user something untrue, and all three should be fixed before anyone outside the team opens the app.

**The invite toast lies.** `src/features/widgets/components/family-members-widget.tsx:374` renders "Invite sent successfully". No email is sent, because no mail library is installed — `package.json` has no Resend, SendGrid, Nodemailer, Postmark, Mailgun or SES dependency, and `src/app/api/household/invite/route.ts` only inserts a `household_members` row with `status: 'pending'`. The invitee learns nothing. If they independently sign up with that address they are auto-joined by `src/app/auth/callback/route.ts:98-116` and land in an app that shows them nothing, because no data table is household-scoped. This is the first thing a parent does in any of these products, and it is the first thing that fails.

**AI-created calendar events are never displayed.** `add_calendar_event` in `src/lib/chat-commands.ts:564` posts to `/api/calendar/events` without a `source`, which defaults to `"manual"` at `src/app/api/calendar/events/route.ts:52`. The calendar view's only source of `calendar_events` rows is `GET /api/calendar/upload`, which filters `.eq('source','uploaded_calendar')`. Nothing in the codebase reads `source='manual'`. The assistant replies "✅ Added X to your calendar", the row is written, and it never appears. Worse, `src/lib/chat-context.ts:58` reads the table with no source filter, so on the next turn the assistant sees the event and will insist it exists.

**The email-to-task extractor is orphaned.** `src/app/api/email/ai/extract-tasks/route.ts` is a complete 124-line implementation — Gmail fetch, bucket-aware prompt, Gemini with an OpenAI fallback, confidence filtering — with zero call sites in the UI and no persistence. The hardest part of the single most valuable missing feature is already built and unreachable.

---

## 5. Differentiation thesis

Nothing would make a working parent pick Lifeboard over Cozi, Jam or Ohai today — not "nothing much", literally nothing, because the first act in any of these products is to invite your partner, and in Lifeboard that shows a success toast, sends no email, and would deliver the partner into an empty app if they signed up anyway. Everything downstream of that is theatre: the assignee chips, the per-member calendar colours, the member filter and the roster with its allergens and medical notes are all single-player features wearing plural language. Cozi is free, works in four minutes and has roughly 20 million registered users; that comparison cannot be won on family logistics from here.

But there is one defensible position available, and only Lifeboard can currently reach it: **the organizer that knows what the parent actually has left in the tank.** Every competitor treats the household as a schedule to be filled and the parent as infinite capacity. Not one of the seven Tier 1 apps knows that you slept five hours, that it is day 26 of your cycle, that your steps have been flat all week, or that Thursday already holds eleven hours of obligations. Lifeboard has all four of those data points live today, through Withings, Fitbit, Google Fit, cycle tracking and its own task and calendar load, and it does nothing with any of them. "The family calendar that knows what you can actually absorb this week" is a sentence Cozi, Jam, FamilyWall, TimeTree, FamCal and Calendara cannot say, and Lifestack — the one product that could — is single-user with no family layer at all.

That wedge has the right shape strategically, because it grows *into* sharing rather than starting from it: the capacity view is valuable to one parent on day one, and inviting the partner makes the load visible to both. It needs two things Lifeboard lacks — a second account that can see a row, and a planner that reads the wellness tables — which is roughly five to six focused weeks. And the Maple lesson should sit next to it: Maple had eight of thirteen dimensions full, two-way Google and Apple sync, email capture, proactive AI and a real expense sheet, and it is being switched off on 2026-12-31 after an acquihire by a travel company. Breadth is not what survives. Being the only product that answers one question is.

---

## 6. Top 5 recommendations

Ranked by impact against effort, which is why a half-day fix outranks the migration that matters most. Every one reuses machinery already in the repo. Effort figures are engineer-days and assume familiarity with this codebase.

**1. Fix the assistant that lies about the calendar.** *Impact: high. Effort: 0.5–1 day.*
The best ratio available. `add_calendar_event` in `src/lib/chat-commands.ts:564` posts without a `source`, the route defaults it to `"manual"` at `src/app/api/calendar/events/route.ts:52`, and the calendar's only reader — `GET /api/calendar/upload` — filters `.eq('source','uploaded_calendar')`. Either pass an explicit source and widen the reader, or fold manual rows into the same query. Marquee feature, silent data loss, and the assistant then reads the row back from `src/lib/chat-context.ts:58` and insists the event exists.
*First commit:* a failing test that inserts a `source='manual'` row and asserts the calendar fetch returns it, then the one-line widening that makes it pass.

**2. Make the landing page tell the truth.** *Impact: high. Effort: 0.5–1 day.*
`src/app/page.tsx` sells Pro at $18/mo and a Team tier at $39/mo whose three headline bullets — "Shared bucket boards", "Role-based access", "Family meal planning" — do not exist in any form, on a product with no billing code, at three to six times the category price. It also promises planning "based on your energy patterns", which nothing computes. Every early user will test the sharing promise in the first five minutes and find the toast that lies. Replace the pricing block with a beta or waitlist card and delete the unbuilt bullets. This is the cheapest churn prevention on the list, and it costs nothing but copy.

**3. Ship the capture loop that is already built and unreachable.** *Impact: high. Effort: 3–4 days.*
Four of seven Tier 1 apps do email capture, and `src/app/api/email/ai/extract-tasks/route.ts` is a finished 124-line implementation — Gmail fetch, bucket-aware prompt, Gemini with an OpenAI fallback, confidence filtering — with zero callers and no persistence. Add an action to the existing email AI toolbar in the `/email` page, matching the Filter Spam and AI Reply pattern rather than inventing a new one; render the results in a review sheet with confidence shown, because every competitor gates AI-created items behind confirmation; then persist through the task and calendar repositories. A forwarding address like Jam's `go@` is a larger, later step. Scanning the inbox the user has already connected captures most of the value with none of the mail infrastructure.
*First commit:* a "Find tasks in this thread" action that calls the existing route and renders what comes back.

**4. Make households real: `household_id` on the core tables, and an invite that sends.** *Impact: decisive. Effort: 10–15 days.*
This is the difference between a family product and a personal one, and the product cannot enter its stated category without it. The scaffolding exists: `supabase/migrations/20260306_create_households_tables.sql` has households, members, roles and RLS; `src/app/api/household/{route,invite,members}` is 313 working lines; `src/hooks/use-household.ts` is wired into the Family Members widget; `src/app/auth/callback/route.ts:98-116` auto-joins a pending invite. What is missing is the data layer and the email. Add a nullable `household_id` to `lifeboard_tasks`, `calendar_events`, `calendar_imports`, `shopping_list_items` and the three budget tables; rewrite each RLS policy to `user_id = auth.uid() OR household_id IN (…my active households…)` behind a single `SECURITY DEFINER` helper rather than duplicating the membership subquery seven times; extend the mappers and `*_SELECT_COLUMNS` in `src/repositories/`; widen the query filters. Scope check: **110 `.eq('user_id', …)` call sites across 58 files**, of which only the shared-entity subset changes. Add a mail provider and replace the hardcoded success toast at `src/features/widgets/components/family-members-widget.tsx:374` with the route's real result.
*Sequence:* ship the inert half first — the nullable column, the index and the backfill, with no behaviour change — then one table end-to-end. `shopping_list_items` is the smallest and the most immediately useful.
*First commit:* the migration plus the RLS rewrite for `shopping_list_items`, with a test that a second member actually reads the row.
*Risks to price in:* `notes`, `meal_entries` and `nutrition_goals` exist in the live database with no `CREATE TABLE` migration on disk, so reconcile the live schema before touching them. And prove the membership path works with two real cookie sessions before writing the migration — an RLS recursion bug between `households` and `household_members` is easy to write and hard to see.

**5. Ship one notification.** *Impact: high. Effort: 5–8 days.*
All seven Tier 1 apps run on reminders and Cozi meters them on its free tier; Lifeboard has none, and the assistant's own example prompt offers to set one. The PWA service worker at `public/sw.js` is already registered in production, which is a real head start. Land the delivery surface before the scheduling logic: a `push_subscriptions` table, a subscribe route, VAPID keys, and push plus `notificationclick` handlers in the existing worker. Then exactly one notification — the due-task reminder — on a scheduled job. A daily agenda email is the cheaper alternative if web push on iOS proves painful.

**Next tier, deliberately outside the five.** School and team calendar subscription by ICS URL with scheduled refresh (3–4 days; extract the parser out of `src/app/api/calendar/upload/route.ts` into a library first, then add a feed table and a refresh job) — three of seven Tier 1 apps have it and Apple does it natively. And the wellness-to-capacity connection that §5 argues is the actual wedge (3–5 days for the first honest version): `src/lib/chat-context.ts` already injects today's step count, so extend it with last night's sleep, mood and cycle phase and let the assistant weigh them when asked to plan a day. It is a context-and-prompt change, not a subsystem, and it is the only item here no competitor can copy quickly, because none of them has the data. It is outside the five only because it is worth little until somebody else can see the calendar.

**Deliberately not recommended:** meal planning (four of seven have it, but it needs recipe primitives Lifeboard does not have), chores (only four of seven have even a partial version, and the bar is a shared assignable checklist that recommendation 4 delivers nearly for free), and native mobile apps (a real gap, a very large effort, and the PWA covers the daily loop until there are users to justify it).

---

## 7. Don't build

**A wall display or hardware.** Skylight and Hearth are hardware businesses with hardware margins, supply chains and returns policies; Hearth charges $699 plus $86.40/yr. Kinmory's approach — an always-on view that runs on a tablet the family already owns — is the right shape if this is ever wanted, and it is a responsive layout, not a product line.

**Agentic outbound actions.** Ohai, Anna and Ollie send messages and make bookings on the user's behalf. That demands trust Lifeboard has not earned, a support burden for when it acts wrongly, and a liability surface. Anna ships with email sending off by default, which tells you how the people building it feel about it. Reactive-plus-approval is the right setting for a pre-release product.

**A second inbox.** The Gmail client is impressive and it is the wrong thing to keep investing in. Competitors deliberately do not build one: the parent does not want another place to read mail, they want the school email to become a calendar entry without opening it. Keep the client, stop extending it, and spend the Gmail integration on capture instead (recommendation 3).

**Location sharing and in-app family messaging.** FamilyWall has both. They are trust-heavy, privacy-sensitive and comprehensively solved by the phones and group chats every family already uses.

**Rewards, points and allowance economies.** Zero of the seven Tier 1 apps ship a real one. It is a differentiator only for Sense, Nori, Kinmory and Skylight, all of which are chasing a younger-children segment that Lifeboard's wellness-and-budget centre of gravity does not point at. Chore *lists* are table stakes; chore *economies* are not.

**Billing, for now.** Implementing Stripe would be premature: the product has no shareable unit to charge a family for, and the market rate for what Lifeboard ships today is closer to zero than to $216 a year. Take the pricing page down (recommendation 2), decide the model after the sharing work, and price against $40–$80 per year per family rather than per seat. The `[PRICING -- PENDING PRODUCT DECISION]` placeholder still sitting in the terms of service suggests this was already understood.

**A second calendar sync engine.** Two-way Google Calendar write-back is tempting and only Maple and Calendara have it. It is also a well-known source of duplicate-event and loop bugs, and the write scope is already requested but unused. Read-only overlay plus ICS subscription covers the school-and-team job that actually drives adoption, at a fraction of the risk.

---

## Appendix A — Lifeboard feature inventory

Verified by reading the repository. ✅ shipped · 🟡 partial · ❌ absent.

### Calendar
| | Feature | Evidence |
|---|---|---|
| ✅ | Day / week / month / agenda views, manual entry | `src/features/calendar/`, `src/app/(app)/calendar` |
| ✅ | Recurring events (daily/weekdays/weekly/monthly), multi-day | `supabase/migrations/20251012_add_multi_day_events_support.sql` |
| ✅ | Event ↔ task linking, per-member colour, member filter | `src/features/calendar/hooks/use-calendar-events.ts` |
| ✅ | Google Calendar read-only overlay | `src/app/api/integrations/google/calendar/events` |
| ✅ | One-off `.ics` file upload | `src/app/api/calendar/upload` |
| ❌ | Shared calendar, Google write-back, Apple/CalDAV, ICS URL subscription, reminders | no `household_id`; no `events.insert`; no `webcal`/`ics_url` |

### Tasks
| | Feature | Evidence |
|---|---|---|
| ✅ | Due dates, start/end, hour slots, duration, all-day | `src/types/tasks.ts` |
| ✅ | Recurrence with per-occurrence exceptions | `supabase/migrations/20250929_create_task_occurrence_exceptions.sql` |
| ✅ | Kanban, bucket board, list view, bulk actions | `src/app/(app)/tasks/page.client.tsx` |
| ✅ | Todoist two-way sync | `src/app/api/integrations/todoist/**` |
| ✅ | Creation by chat and voice | `src/lib/chat-command-catalog.ts` |
| 🟡 | Assignee | `assignee_id text` — a label, not an account |
| ❌ | Real delegation, subtasks, priority, reminders | — |

### Household and sharing
| | Feature | Evidence |
|---|---|---|
| ✅ | Family Members roster widget | `src/features/widgets/components/family-members-widget.tsx` |
| 🟡 | Household create / invite / members API and UI | `src/app/api/household/**`, `src/hooks/use-household.ts` |
| 🟡 | Invite acceptance on signup | `src/app/auth/callback/route.ts:98-116` |
| ❌ | Invite email delivery | no mail provider anywhere in the repo |
| ❌ | **Shared data of any kind** | no `household_id` on any data table |
| ❌ | Kid / caregiver / view-only roles | `CHECK (role IN ('admin','member'))`, gating membership only |

### AI and capture
| | Feature | Evidence |
|---|---|---|
| ✅ | Text chat creating tasks, events and shopping items | `src/app/api/chat`, `src/lib/chat-commands.ts` |
| ✅ | Voice via OpenAI Realtime GA native tool calls | `src/app/api/openai/realtime-session` |
| ✅ | Email AI: spam filter, organize, sweep marketing, reply | `src/app/api/email/ai/**` |
| 🟡 | Email → task extraction | `.../extract-tasks/route.ts` — complete, zero callers |
| ❌ | Proactive AI, agentic actions, email-forward address, photo/OCR | no cron, no digest, no inbound mail |

### Email
| | Feature | Evidence |
|---|---|---|
| ✅ | Full Gmail client: inbox, threads, attachments, send, reply, drafts, labels, bulk modify | `src/app/(app)/email`, `src/lib/gmail/**` |
| ✅ | Inbox Cleaner with unsubscribe | `src/app/api/email/inbox-cleaner/**` |
| 🟡 | Multiple accounts | `supabase/migrations/20260314_gmail_multi_account.sql` |
| ❌ | Non-Gmail providers, email widget or sidebar | — |

### Lists, budget, wellness
| | Feature | Evidence |
|---|---|---|
| ✅ | Shopping list with quantities, needed-by, purchased history, assignee label | `src/app/api/shopping-list`, `src/repositories/shopping-list.ts` |
| ✅ | Notes, folders | `src/app/api/notes`, `src/features/folders/` |
| ✅ | Budget: categories, monthly caps, progress, health score, widget | `src/app/(app)/budget`, `supabase/migrations/20260316_budget_tables.sql` |
| ✅ | Wellness tracking across ~14 metrics with trends and history | `src/features/widgets/components/*` |
| ✅ | Withings, Fitbit, Google Fit live end-to-end; FatSecret nutrition logging | `src/lib/{withings,fitbit,googlefit,fatsecret}/` |
| ❌ | Multiple named lists, shared lists, meal planning, chores, rewards, energy awareness | counter templates only |

### Platform and commercial
| | Feature | Evidence |
|---|---|---|
| ✅ | Web app, installable PWA with offline page, data export | `public/manifest.json`, `public/sw.js` |
| 🟡 | Electron desktop for mac/win/linux, tray, auto-update | `electron/`, `electron-builder.yml` |
| ❌ | Native iOS/Android, OS widgets, push notifications, wall display | — |
| ❌ | Billing, plans, paywalls | no Stripe, no tier column, no gating |

## Appendix B — Method and confidence

Lifeboard's inventory was produced by eleven parallel readers, one per subsystem, each required to cite file paths and to treat a feature as shipped only when both the UI path and the backing logic were real. Every claim that carries this review was then re-verified by direct inspection of the repository rather than taken from a report: no household-scoped table, label-only delegation, no notification mechanism, no billing code, read-only Google Calendar, no ICS subscription, the counter-widget chores and meal plans, the three problems in §4b, and the 110 `user_id` call sites.

Competitors were researched from primary sources on 2026-09-22/23, then fact-checked by independent agents working against the same sources with instructions to refute rather than confirm. That pass materially changed the picture. Four products moved *down* from proactive to reactive AI once a feature page was demanded instead of a tagline (Jam, TimeTree, AlphaMa, OneHaus); Cozi gained natural-language entry via SmartAdd and a two-week Gold trial the first pass missed; Calendara lost meal planning, which its own FAQ files under "not included"; FamilyWall's roles turned out to be inverted, with every email-invited member becoming an administrator; FamCal lost roles and chores entirely; Maple gained a real expense sheet, two-way Google and Apple sync and mobile widgets; and Ohai gained both autonomous inbox monitoring and appointment booking through a Ferry Health partnership. The finished matrix reflects the corrected values.

A three-lens strategy panel — user-first, risk-first and build-first — then worked from the verified inventory and the corrected competitor set. They converged on the same conclusion (nothing wins today until a second account can read a row) and disagreed usefully on category: two called Lifeboard adjacent, one called it a different product dangerously mislabelled. §2 reflects that disagreement rather than hiding it.

Known limits. Maple's help centre was Cloudflare-blocked, so parts of its permissions model rest on site and store copy. Ohai's App Store in-app purchase prices run $5–$10 above its website and the discrepancy is unresolved; its web pricing is used here. Kinmory's hardware is not purchasable and has no published price. Cozi's Gold tier shows several regional price points alongside the headline $39/yr. AlphaMa has an unpriced enterprise track sold to employers. Effort estimates in §6 are engineer-days from three independent readings of this codebase and span a range where the panels disagreed; the household work was estimated at 10–15, 10–14 and 18–25 days, and the figure given takes the lower consensus. Competitors' own "best family calendar 2026" roundups were used for feature facts only, never for rankings — Calendara's claim to offer "everything Cozi Gold offers" was checked and is false.
