# Strategy Review Foundation

Status: D8-T2 implemented, owner-approved, committed, and pushed
Contract version: `1.0`

## Responsibility

Strategy Review is a deterministic, read-only post-completion assessment of one prediction, frozen plan, execution, risk-compliance, and realized outcome cycle. It preserves four independent conclusions:

1. prediction quality;
2. execution quality;
3. risk discipline;
4. trading profitability.

The foundation prevents Alpha from treating profit as proof of prediction quality, compliant execution, risk discipline, or strategy effectiveness.

## Non-responsibilities

Strategy Review does not:

- make or revise a trading decision;
- reopen a completed trade;
- emit an execution instruction;
- modify a prediction, frozen plan, strategy version, execution, outcome, replay, risk record, or evidence assessment;
- calculate Risk Engine limits;
- approve a lesson or create a strategy version;
- rank strategies or combine cycles statistically;
- create an overall strategy score or weighted verdict;
- call AI, a provider, a network, or a live market source;
- persist review results.

## Dependency Direction

```text
authoritative source records
  -> narrow deterministic source adapters/read snapshots
  -> Evidence Assessment and replay references
  -> Strategy Review Engine
  -> future human-reviewed learning workflow
```

Prediction Log, Strategy Versioning, Risk Engine outputs, trade/execution records, Event Replay, and Evidence Assessment remain authoritative. This foundation accepts a normalized read snapshot and never queries or mutates their repositories.

## Current Source Boundary

The existing TypeScript contracts provide:

- `PredictionStatus`, completed `PredictionReview`, and `PredictionAccuracy` from Prediction Log;
- `TradeStatus`, plan-adherence facts, risk-review facts, and realized economic fields from `TradeRecord`;
- completed lifecycle states from Event Replay;
- immutable strategy-version identity;
- the versioned Evidence Assessment gate.

The repository does not yet contain a durable append-only Trade Outcome Log. Therefore this foundation does not claim production outcome authority or persistence. A caller must supply an explicit finalized, realized profitability snapshot and traceable source references. Future adapters may translate approved authoritative records into this contract without changing the review engine.

## Lifecycle Eligibility

A formal review requires explicit lifecycle evidence:

```text
prediction reviewed or archived
  -> prediction review completed
  -> execution closed, stopped out, invalidated, or archived with finalized evidence
  -> frozen plan released after completion
  -> outcome finalized and realized
  -> replay completed or explicitly unavailable under policy
  -> Evidence Assessment
  -> Strategy Review
```

Timestamps never imply completion. An active prediction, incomplete execution, pending outcome, active frozen plan, unresolved replay, or required unavailable replay blocks review.

`CANCELLED`, `EXPIRED`, and `ERROR` trade states do not prove a completed execution/outcome cycle in this foundation. A later reviewed contract may define separate cancelled-plan review behavior.

## Evidence Gate

“No sufficient review evidence, no completed formal review.”

- `SUFFICIENT`: lifecycle-eligible dimension conclusions may be produced.
- `INSUFFICIENT`: the review is `INCOMPLETE`; conclusions are withheld.
- `CONFLICTING`: the review is `BLOCKED`; conflicts are preserved without arbitration.
- `UNAVAILABLE`: the review is `UNAVAILABLE`; dependent conclusions are withheld.

Evidence sufficiency permits review but does not prove strategy quality. Required blockers cannot be averaged away, and AI cannot override the gate.

## Four Independent Dimensions

### Prediction Quality

The engine maps only the completed Prediction Log accuracy classification:

- `ACCURATE` -> `CORRECT`
- `PARTIALLY_ACCURATE` -> `PARTIALLY_CORRECT`
- `INACCURATE` -> `INCORRECT`
- `INDETERMINATE` -> `INDETERMINATE`

Profit and execution never alter this conclusion. Prediction Log remains responsible for its underlying accuracy classification.

### Execution Quality

Execution findings use a bounded criterion set and explicit `COMPLIANT`, `VIOLATION`, or `UNKNOWN` states. The versioned policy declares required criteria and which required criteria are hard requirements.

- no required gaps or violations -> `COMPLIANT`;
- only non-hard violations -> `PARTIALLY_COMPLIANT`;
- any hard violation -> `NON_COMPLIANT`;
- missing or unknown required findings -> `INDETERMINATE`.

Profit and prediction accuracy never alter execution quality.

### Risk Discipline

Risk findings preserve authoritative risk-compliance outputs without recalculating limits.

- any explicit violation -> `VIOLATION`;
- missing or unknown required findings -> `PARTIAL_OR_UNKNOWN`;
- complete required findings without violation -> `COMPLIANT`.

A profitable result cannot erase a risk violation.

### Trading Profitability

Profitability records the sign of an explicitly finalized realized net result:

- positive -> `PROFIT`;
- negative -> `LOSS`;
- zero -> `BREAK_EVEN`;
- unavailable, pending, or unrealized -> `UNAVAILABLE`.

Gross result, net result, fees, slippage, return percentage, maximum capital employed, and currency remain separate visible fields when supplied. Profitability never changes the other dimensions.

## Review Status

- `COMPLETE`: lifecycle and Evidence Gate pass, required dimension inputs are available and resolved.
- `INCOMPLETE`: evidence or required findings are incomplete without an unavailable source.
- `BLOCKED`: active/incomplete lifecycle, frozen-plan protection, unresolved replay, or conflicting evidence prevents formal review.
- `UNAVAILABLE`: required evidence, replay, outcome, or dimension sources are unavailable.

Each blocker and warning preserves source-reference IDs. A review may preserve an independent available dimension while another dimension is unavailable, but the overall formal review cannot be `COMPLETE`.

## Source Authority and Auditability

Every normalized source has a bounded type, source ID, version, lifecycle status, availability, and audit references. Dimension findings reference only declared sources. The output preserves:

- review schema, policy ID, and policy version;
- Evidence Assessment ID, schema, policy, status, blocker codes, unresolved items, and conflicts;
- prediction, outcome, review, strategy, plan, execution, risk, replay, and trade-outcome identifiers;
- deterministic finding order and reason codes;
- correlation, trace, and audit-reference metadata;
- unresolved source references.

The caller supplies `reviewId` and `evaluatedAt`; no ambient clock or generated identity affects determinism.

## Immutability and Active-Trade Protection

The result is deeply frozen and contains explicit protections:

- authoritative sources are read-only;
- active-plan mutation is prohibited;
- completed-trade reopening is prohibited;
- execution instructions are prohibited.

A profitable completed trade remains completed. Regret, excitement, or fear of missing out cannot reopen it through Strategy Review.

## Human-Reviewed Learning Boundary

Every result sets `humanReviewRequired: true`. The engine produces no automatic lesson text. Facts, deviations, violations, and unresolved items may later support a separate reviewed-learning proposal, but this foundation cannot approve a lesson, mutate a strategy, or create Strategy v2.

## Policy Versioning

`StrategyReviewPolicy` preserves:

- policy ID and version;
- whether completed replay evidence is required;
- required execution criteria;
- hard execution criteria, which must be a subset of required criteria;
- required risk criteria.

There are no hidden weights and no aggregate score. Future Config System adapters may supply an approved policy; this foundation adds no configuration framework.

## Deferred

- durable Trade Outcome Log and production persistence
- source-repository adapters and cross-repository transactions
- automatic lesson generation or approval
- strategy mutation, Strategy v2 generation, optimization, and ranking
- multi-cycle or multi-strategy statistical comparison
- AI summaries or natural-language coaching
- dashboard/UI integration
- backtesting, paper trading, live data, broker integration, and automatic execution
- portfolio allocation and active-trade intervention
