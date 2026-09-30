# Owner plan preparation V1

Task: options-owner-plan-readiness-20260929. Baseline: 0a5c92b.
Scope: connect current saved decision evidence and the existing ETF setup engine
to the existing Owner thesis planner. No new detector, source or storage.

- Compose current Decision Cards, Decision Readiness and recomputed ETF setup.
- Preserve original canonical blockers, modeled-cost blockers and setup limitations.
- A research RULE_MATCH_OBSERVED is not source authentication or trade approval.
- Require matching assessment clock, symbol, contract, direction and prospective
  setup clocks before labeling a research match current. Future clocks fail closed.
- Missing quotes, source flags, review, costs or plan terms remain explicit.
- Opening a candidate in the planner is an explicit Owner choice. Copy exact
  contract identity and bounded source context only; do not invent entry prices,
  stop, target, cost confirmation, declaration time or deadlines.
- Reuse SAVE_PLAN_DRAFT, Preview and Confirm & freeze without adding a write route.
  Saved drafts are rechecked against current candidate identity. Frozen plans are
  never overwritten. Existing preview remains the authority for plan completeness.
- No execution, source refresh, scheduling or real acceptance claims.
- Acceptance: synthetic bars must produce the existing engine's actual research
  match and preserve qualification blockers; test missing/future/stale/wrong-side
  evidence, immutable inputs, identity mapping, draft conflicts and UI escaping.
  Run focused suites, strict typecheck, full alpha:validate and diff checks.
- Real qualified setup evidence and September 30 collection/acceptance remain
  pending. Installed scheduling is not verified by this implementation.
