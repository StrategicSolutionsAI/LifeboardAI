# Execution Plans

Use an execution plan for medium- or high-risk work, cross-cutting changes, migrations, unfamiliar systems, or tasks likely to span more than one session. Do not create one for a trivial, well-understood edit.

The plan is a living engineering artifact. Update it when investigation changes the approach, when a milestone completes, or when verification contradicts an assumption. A future contributor should be able to continue from the plan without reconstructing the entire conversation.

## Plan quality bar

A plan must:

- describe the observable outcome and why it matters;
- name the current behavior and evidence;
- define scope, non-goals, invariants, and risk level;
- identify affected modules and trust boundaries;
- record meaningful decisions and alternatives;
- divide work into ordered, verifiable milestones;
- explain tests and behavior checks;
- include rollout, monitoring, and rollback for risky changes;
- track discoveries, progress, and remaining risks.

Do not write a file-by-file implementation transcript. Explain behavior, dependencies, and proof.

## Template

Copy the sections below into a task-specific document when the work needs a persistent plan. Keep it near the relevant project documentation or in the task branch; remove instructional placeholders as you fill it out.

```markdown
# <Outcome-oriented title>

## Task brief

- Outcome:
- Evidence/current behavior:
- Context:
- Constraints:
- Non-goals:
- Risk: Low | Medium | High — <reason>
- Done when:

## System map

- Entry points:
- Data/state flow:
- Existing pattern to extend:
- Trust boundaries:
- Affected files/modules:
- Existing tests and observability:

## Invariants

- <Property that must remain true>

## Decisions

### <Decision>

- Context:
- Options considered:
- Choice and why:
- Consequences:
- Revisit when:

## Milestones

1. <Milestone>
   - Change:
   - Verify:
   - Stop condition:

2. <Milestone>
   - Change:
   - Verify:
   - Stop condition:

## Test and verification strategy

- Regression coverage:
- Negative paths:
- Manual or visual checks:
- Required commands:
- Evidence to retain:

## Rollout and operations

- Rollout sequence:
- Success signals:
- Failure signals:
- Rollback/disable path:
- Irreversible or asymmetric effects:

## Progress

- [ ] <timestamp> — <milestone or decision>

## Discoveries and plan changes

- <timestamp> — <new evidence, changed assumption, and plan impact>

## Residual risks and follow-ups

- Required before completion:
- Deliberately deferred:
```

## Completion rule

A plan is complete only when the observable definition of done is satisfied and the evidence is recorded. Passing commands without verifying the requested behavior is not completion. If work stops early, leave the plan with current evidence, the blocker, and the next concrete action.
