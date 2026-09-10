# Code Review Standard

Review code as a production owner. The goal is to find material risk and verify the requested outcome, not to reward activity or impose personal style.

## Review inputs

Before reviewing, identify:

- the task brief and definition of done;
- the base revision and exact diff in scope;
- applicable plan or decision record;
- relevant repository instructions;
- verification already performed and what remains unverified.

If any of these are missing, state the assumption used.

## Review order

1. **Outcome and scope** — Does the diff solve the stated problem without unrelated change?
2. **Correctness** — Are state transitions, boundary conditions, concurrency, dates, retries, and error paths sound?
3. **Security and data** — Are authentication, authorization, tenant isolation, validation, secrets, RLS, and external inputs handled at the correct trust boundary?
4. **Resilience and operations** — Are timeouts, idempotency, partial failure, logging, monitoring, rollout, and rollback appropriate?
5. **UX and accessibility** — Does the visible behavior work across loading, empty, error, keyboard, focus, viewport, and theme states?
6. **Performance** — Is expensive work bounded, measured when relevant, and placed at the right layer?
7. **Tests and evidence** — Do tests prove the behavior and important failure modes rather than mirror implementation details?
8. **Maintainability** — Does the change extend existing patterns with the smallest clear design?

## Finding format

Use priorities consistently:

- **P0:** Immediate catastrophic risk; blocks all use or exposes critical data.
- **P1:** Likely severe correctness, security, data-loss, or outage risk; must fix before merge.
- **P2:** Real regression or maintainability risk under plausible conditions; normally fix before merge.
- **P3:** Low-impact improvement worth addressing but not a merge blocker.

Each finding must contain:

```text
[P1] Short imperative title
File: path/to/file.ts:line
Impact: What breaks, for whom, and under what condition.
Evidence: The specific code path, invariant, or reproduction supporting it.
Direction: The smallest safe correction or test that would close the gap.
```

Keep line ranges tight. Do not report speculative concerns without a plausible failure path. Do not hide required fixes in a general summary.

## Review output

Return, in order:

1. Prioritized findings.
2. Assumptions or unresolved questions that materially affect approval.
3. Verification observed or run.
4. Residual risks and unverified behavior.

If there are no findings, say so explicitly and still report residual risks and verification gaps. Approval means the evidence supports the task's definition of done; it does not mean the code is perfect.
