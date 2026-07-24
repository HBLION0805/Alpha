# Capital Allocation Framework v1.0

Status: Day14-T1 implemented locally, uncommitted, and pending owner review.

Schema version: `1.0`

Framework version: `1.0`

## Purpose

Alpha exists to protect, allocate, grow, and compound capital. Prediction is one possible evidence input; it is never allocation authority. The Capital Allocation Framework provides one provider-independent, deterministic boundary that validates already-reviewed upstream state and constructs a standardized immutable allocation recommendation.

The v1 boundary is:

`reviewed market evidence -> READY Evidence Fusion -> accepted Market Regime -> completed Risk gate -> Capital Allocation Framework -> immutable recommendation -> future external leverage/ranking review`

The framework does not calculate a trade, rank opportunities, choose leverage, size an order, mutate a portfolio, or execute anything.

## Responsibilities

The framework owns:

- the versioned `AllocationCandidate` and `AllocationRecommendation` contracts;
- explicit Portfolio, Evidence Fusion, Market Regime, and Risk input read models;
- deterministic validation of evidence-before-allocation and risk-before-allocation ordering;
- bounded, provider-independent candidate metadata;
- immutable construction, canonical ordering, serialization, and a deterministic local fingerprint;
- explicit non-execution authorization metadata;
- bounded extension references for future Earnings Research and Capital Rotation evidence.

It does not own:

- Portfolio balances or position truth;
- Evidence Fusion, Market Regime, Risk, Decision, or Config calculations;
- predictions, probabilities, expected returns, opportunity scores, or rankings;
- leverage, optimization, rebalancing mathematics, order sizing, brokerage, or execution;
- AI, external APIs, market-data fetching, persistence, replay, or UI behavior.

## Authoritative Inputs

V1 requires four provider-independent read inputs:

1. A current Portfolio snapshot reference. Portfolio System remains portfolio truth.
2. A `READY`, `COMPLETE`, `CURRENT`, and `ACCEPTED` Evidence Fusion snapshot reference. Fusion remains evidence-gate truth.
3. An accepted Market Regime assessment with adequate evidence. Market Regime remains environment-classification truth.
4. A completed Risk assessment with `CLEARED` or `CONSTRAINED` status. Risk Engine remains risk authority.

Each input retains its authoritative record identifier, timestamp, schema or policy version, and evidence references. Runtime shape validation rejects undeclared keys recursively, including nested ranking, leverage, sizing, order, provider, credential, AI, and arbitrary-extension data. The framework constructs allow-listed read models field by field and never modifies or broadly copies source records.

Every eligible candidate requires exactly one Fusion reference matching the gated top-level assessment ID, snapshot ID, fingerprint, schema version, policy version, rule-set version, evaluation time, accepted state, and authoritative evidence-reference set. Event Analyzer output may be preserved only as `LIMITED` supplemental candidate context alongside that exact Fusion evidence. Its prototype recommendation is never accepted as allocation authority and cannot independently make a candidate eligible. Future Earnings Research and Capital Rotation references are accepted only in the dedicated extension boundary and cannot appear directly in candidate support until separately approved contracts and adapters exist.

## Allocation Candidate

Every candidate contains:

- an Alpha-owned candidate ID and canonical instrument ID;
- a display ticker that is never used as canonical identity;
- bounded asset type and allocation category;
- sector text;
- evidence-strength confidence, never probability;
- explicit evidence quality and risk level;
- expected holding-period band;
- a primary catalyst statement;
- typed supporting evidence references;
- a recommendation reason;
- an optional weight in integer portfolio basis points;
- `UNRANKED` priority in v1;
- an explicit review status.

V1 does not calculate suggested weight. The optional field is a validated placeholder for later authorized input. It does not authorize a position or order.

`topCandidates` is retained as the standardized output field requested by the product architecture. In v1 it means eligible-for-review candidates, not ranked winners. The framework orders them by candidate ID. A future Opportunity Ranking Engine must own ranking and version its output separately.

## Allocation Recommendation

The immutable recommendation preserves:

- recommendation ID, timestamp, creation time, schema version, and framework version;
- Market Regime read model;
- overall Risk read model;
- Evidence Fusion and Portfolio references;
- recommended review action;
- deterministic eligible and avoid candidate lists;
- cash recommendation;
- notes, consolidated evidence references, and a trace reference;
- deterministic fingerprint and read-only markers;
- `FRAMEWORK_ONLY_NOT_EXECUTION_AUTHORITY` authorization.

Allowed v1 actions are review-oriented: `REVIEW_CANDIDATES`, `MAINTAIN_ALLOCATION`, `INCREASE_CASH`, and `NO_ALLOCATION`. They are not broker instructions.

## Fail-closed Construction

No recommendation is constructed when:

- Fusion is missing, blocked, incomplete, stale, unknown, rejected, or contradictory;
- Market Regime is `INSUFFICIENT_EVIDENCE`, has insufficient evidence strength, or has rejected/non-accepted data quality;
- Risk is blocked or unavailable;
- Risk predates either the gated Fusion assessment or accepted Market Regime assessment;
- Risk is `CONSTRAINED` without at least one explicit unique valid constraint;
- the Portfolio reference is not current;
- an upstream assessment is future-dated relative to the recommendation;
- required source identity, policy/version, provenance, or evidence references are missing;
- a top candidate lacks sufficient evidence, has prohibited/unknown risk, or is not eligible for review;
- an eligible candidate lacks accepted Fusion support or treats Event Analyzer as accepted authority;
- duplicate candidates or canonical instruments occur across eligible and avoid lists;
- a supplied weight is outside `0..10,000` basis points or total supplied candidate weights exceed 100%;
- ranking, leverage, execution, provider-native, or unvalidated extension data is attempted.
- any governed object contains an undeclared field.

Validation returns ordered issue codes. Construction throws one structured validation error and produces no partial recommendation.

## Pipeline and Extension Points

```text
Portfolio read state --------------------+
                                          |
Market/Broad/other reviewed evidence      |
  -> Evidence Fusion ---------------------+--> Risk gate
Market Regime ----------------------------+       |
                                                  v
                                      Capital Allocation Framework v1
                                                  |
                                      immutable unranked recommendation
                                                  |
                                  future Leverage Decision Engine (external)
                                                  |
                                  future Opportunity Ranking Engine (external)
                                                  |
                                  future final owner-approved allocation
```

Leverage and Opportunity Ranking are downstream systems. They are not v1 allocation inputs and are not implemented here. A later milestone may define a new final-allocation record that references this recommendation plus separately validated leverage/ranking assessments.

Future Earnings Research and Capital Rotation may become upstream evidence only through new bounded contracts or adapters. Adding a source requires source authority, schema/version, state, timestamp, evidence references, validation, fixtures, and documentation. Arbitrary payloads and runtime reflection are prohibited.

## Example Workflow

1. Portfolio System exposes a current immutable read reference.
2. Evidence producers are assessed through Evidence Fusion.
3. Market Regime describes the environment without recommending a trade.
4. Risk Engine evaluates capital constraints and returns `CLEARED`, `CONSTRAINED`, `BLOCKED`, or `UNAVAILABLE`.
5. The framework validates the upstream gates and constructs an immutable recommendation containing eligible review candidates, avoid records, and a cash posture.
6. Future leverage and ranking systems may review the recommendation without mutating it.
7. Owner approval, Decision/trade-plan authority, Portfolio mutation, and execution remain separate future boundaries.

## Determinism and Immutability

All output is deeply frozen. Declared fields only are constructed through recursive allow lists; caller-owned objects are never broadly cloned or spread into output. Candidate lists, supporting evidence, notes, constraints, and consolidated references have deterministic ordering. Repeating an identical request produces the same output and FNV-1a fingerprint.

FNV-1a is local change detection only, not a cryptographic integrity primitive.

## Deferred Work

- Opportunity Ranking and scoring;
- leverage decisions;
- allocation optimization and target-weight calculation;
- portfolio/risk runtime adapters;
- Decision Engine integration and final owner approval;
- execution plans, orders, brokerage, and portfolio mutation;
- additional Evidence Fusion sources and Event Analyzer evidence adapters;
- Earnings Research and Capital Rotation engines;
- persistence, audit translation, replay, Dashboard, APIs, and AI.
