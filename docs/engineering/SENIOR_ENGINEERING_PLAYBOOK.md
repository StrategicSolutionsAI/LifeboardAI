# Senior Engineering Playbook

Senior engineering is not measured by how much code or how many agents are active. It is the ability to turn an uncertain goal into a safe, observable result while keeping scope, risk, and communication under control.

This repository uses one human priority, a maximum of four active lanes, and one controlled merge point.

## The operating loop

### 1. Frame the outcome

Before touching code, write a short task brief:

- **Outcome:** What user or system behavior should change?
- **Evidence:** What shows the problem exists or the opportunity is real?
- **Context:** Which code, data, designs, incidents, or documentation matter?
- **Constraints:** What must remain true? What is explicitly out of scope?
- **Risk:** Low, medium, or high, and why?
- **Done when:** What observable facts will prove completion?

Prefer outcome language over activity language. “A disconnected Withings account stays disconnected without repeated refresh calls” is stronger than “refactor token refresh.”

### 2. Investigate the system

Read before writing. Trace:

1. Entry point and user-visible behavior.
2. Callers, callees, state transitions, and persistence.
3. Existing patterns that should be extended.
4. Trust boundaries: browser/server, authenticated/unauthenticated, app/provider, process/filesystem, and tenant/tenant.
5. Existing tests, logs, metrics, and failure handling.
6. Current worktree changes so another lane's work is not overwritten.

The output of investigation is a system map and a smaller problem, not a pile of notes.

### 3. Choose the smallest safe plan

Use `PLANS.md` for medium- and high-risk changes. A strong plan names:

- the invariant being protected;
- the files or modules expected to change;
- important alternatives and why one was chosen;
- verification for each step;
- rollout, observability, and rollback for risky changes.

Keep decisions reversible when uncertainty is high. Delay abstraction until a second real use case exists.

### 4. Build in a controlled lane

One lane owns one bounded outcome. Before implementation, define:

- files it may change;
- files or responsibilities it must avoid;
- required verification;
- its handoff artifact.

Keep diffs surgical. Do not mix feature work, cleanup, dependency upgrades, and architecture changes in one patch. For a bug, reproduce it and add a regression test before or alongside the fix.

### 5. Verify behavior, not intention

Use the smallest fast check during development, then the appropriate completion gate.

| Risk | Typical changes | Minimum completion evidence |
| --- | --- | --- |
| Low | Documentation, isolated copy, narrow styling | Diff review plus targeted rendering or check |
| Medium | Feature logic, shared component, API behavior | Relevant tests, `npm run type-check`, and behavior verification; build for bundling or route changes |
| High | Auth, tenant data, schema, OAuth, security, destructive operations | Written plan, negative-path tests, migration and rollback notes, relevant full gates, independent review, and staged rollout where possible |

Additional evidence by change type:

- **UI:** inspect the actual screen at relevant viewport sizes and interaction states; include screenshots.
- **API:** test unauthenticated, unauthorized, invalid, provider-failure, and success paths as applicable.
- **Schema:** pair code with a migration, verify RLS and backfill behavior, and document rollback limitations.
- **Performance:** capture a baseline and compare the same measurement after the change.
- **Incident fix:** name the root cause, the detection gap, and the control preventing recurrence.

Never translate “the code looks right” into “verified.”

### 6. Review like an owner

Use `docs/engineering/CODE_REVIEW.md`. Review the final diff against the task brief and system invariants, not against personal taste.

Prioritize defects that can cause incorrect behavior, security exposure, data loss, outages, inaccessible UX, or silent operational failure. Each finding needs evidence, impact, and a concrete direction. Separate required fixes from follow-ups.

### 7. Ship deliberately

Before merge or deployment, answer:

- What changes for users?
- How will we know it works in production?
- What failure signal should trigger intervention?
- Can it be disabled or rolled back safely?
- Does the migration or external side effect make rollback asymmetric?
- Who owns the immediate follow-up?

Deployments are serialized through the lead lane. Do not let a background lane deploy independently.

### 8. Close the learning loop

After a surprising failure, repeated correction, or non-obvious discovery, add a concise note under `docs/learnings/`:

- problem and observable symptom;
- root cause;
- solution and verification;
- durable rule;
- dead ends worth avoiding.

Promote a lesson into automation, a test, or `AGENTS.md` only when it is reusable. Prefer mechanical enforcement over a growing instruction list.

## Four-lane workflow

| Lane | Responsibility | Access | Handoff |
| --- | --- | --- | --- |
| Lead | Holds the goal, resolves tradeoffs, owns plan, merge, and deploy | Main checkout | Decision log and integrated result |
| Explorer | Maps code, investigates bugs, validates assumptions | Read-only | System map with file references, risks, and open questions |
| Builder | Implements one bounded outcome | Sole writer in a checkout, preferably an isolated worktree | Focused diff, tests, and verification report |
| Reviewer | Checks correctness, security, regressions, UX, and evidence | Read-only or test-only | Prioritized findings with file and line references |

### Concurrency rules

- Maximum four active threads: lead plus three supporting lanes.
- Parallelize only work that is genuinely independent.
- Use subagents primarily for read-heavy exploration, test analysis, and review.
- If two agents must write, use separate worktrees and branches with non-overlapping ownership.
- Pipeline work when possible: builder handles current work, reviewer checks the previous change, explorer scopes the next one.
- Stop a lane when its assumptions or file ownership become stale.

Do not parallelize competing architecture decisions, the same component, schema plus code that depends on an unsettled schema, production deployment, final visual judgment, or rapidly changing requirements.

## Decision habits

For consequential choices, record a lightweight decision:

```text
Decision:
Context:
Options considered:
Choice and why:
Consequences:
Revisit when:
```

The goal is not ceremony. It is to keep future maintainers from reopening settled questions without the original constraints.

## Personal cadence

At the start of a work session:

1. Choose one priority and state its definition of done.
2. Check current branch and uncommitted changes.
3. Select the risk level and whether a plan is warranted.
4. Assign only independent lanes.

Before ending a session:

1. Review the diff and verification evidence.
2. Record remaining risks and the next concrete action.
3. Stop or close stale lanes.
4. Capture a learning only if it changes future behavior.

Once a week, inspect incomplete work, flaky checks, dependency and security findings, operational alerts, and repeated friction. Schedule these lanes to report findings; do not allow them to make broad changes or deploy automatically.

## Reusable prompts

### Frame a task

```text
Before editing, turn this request into a task brief with outcome, evidence,
context, constraints, risk level, and observable definition of done. Map the
relevant system and identify any decision I need to make. Then propose the
smallest safe plan with a verification step for each change.
```

### Investigate in parallel

```text
Use read-only subagents only where the work is independent: one explorer for
the code and data flow, one analyst for test and regression gaps, and one
reviewer for trust boundaries. Wait for all results, reconcile disagreements,
and return one system map and plan. Do not edit code yet.
```

### Review before shipping

```text
Review the final diff against the task brief and
docs/engineering/CODE_REVIEW.md. Return prioritized findings with file and line
references. Then list verification performed, unverified behavior, rollout
signals, and rollback concerns. Do not edit during this review.
```

### Learn from a miss

```text
Run a blameless retrospective. Separate the observable symptom, root cause,
contributing conditions, detection gap, fix, and prevention. Recommend the
smallest durable improvement: test, automation, code change, or instruction.
```
