# AI Cost Governor Specification v1.0

Status: Foundation implemented

Date: 2026-07-18

## 1. Problem Statement

AI requests have an estimated monetary cost before execution and an actual cost after execution. Alpha needs one provider-independent boundary that decides whether estimated cost may be reserved without allowing provider adapters or business modules to implement their own budget rules.

The AI Cost Governor evaluates policy and usage snapshots. It does not select providers, call models, persist money, or perform capital actions.

## 2. Business Value

The governor protects operating budgets, makes cost decisions reproducible, preserves evidence for owner review, and allows Alpha to add or replace AI providers without changing core business logic. It also separates recommendations that may use AI from deterministic financial calculations and enforcement.

## 3. Implementation and Operating Cost

The foundation consists of TypeScript contracts, validation, a pure evaluation engine, an AI Router mapping boundary, tests, and documentation. Its runtime operating cost is local CPU and memory only. It introduces no provider fees, network traffic, credentials, database, queue, or background process.

## 4. Why Now

The deterministic AI Router foundation can estimate and select a candidate but needs a dedicated enforcement boundary before provider execution is designed. Establishing this boundary now prevents cost policy from leaking into future adapters and business modules.

## 5. Goals

- Evaluate estimated AI cost against deterministic, versioned policy.
- Support per-request, daily, monthly, task-category, provider, and model scopes.
- Include committed and reserved usage in projected cost.
- Distinguish soft-limit low-cost behavior from hard-limit rejection.
- Permit narrowly authorized critical overrides.
- Return a reservation plan and complete audit record.
- Use provider-neutral contracts and normalized errors.

## 6. Non-Goals

- Provider SDK or API integration
- AI or model execution
- HTTP or other network access
- Credential handling
- Persistent ledger or database implementation
- Live usage ingestion or reconciliation
- Billing-provider integration
- Autonomous business or capital actions
- Modification of Python business logic

## 7. Architecture Boundary

The governor is a deterministic policy layer after cost estimation and before provider execution:

```text
Business module
  -> AI Router request and deterministic candidate selection
  -> selected candidate cost estimate
  -> Router-to-Cost-Governor mapping boundary
  -> AI Cost Governor decision and reservation plan
  -> future reservation persistence
  -> future provider adapter execution
  -> future actual-cost commit or reservation release
```

The current Router remains a planning engine. `AIRouterCostBoundary` converts its major-unit estimates and aggregate usage snapshot into the governor contract. Direct provider execution is intentionally absent.

## 8. Monetary Representation

All governor arithmetic uses non-negative safe integer minor units. A policy declares `minorUnitScale`; amounts using that policy must share the same currency. The Router bridge uses 1,000,000 units per major currency unit and performs one deterministic rounding operation when crossing the boundary.

Floating-point values are not used inside budget comparisons. Negative, non-finite, fractional-minor-unit, unsafe-integer, and currency-mismatched inputs are rejected or normalized as validation failures.

## 9. Contracts

### CostGovernorRequest

Identifies the request, task and reasoning level, optional provider/model, estimated minor-unit cost, currency, reservation ID, and optional override authorization.

### CostGovernorPolicy

Identifies the policy and version, currency, minor-unit scale, enabled limits, low-cost behavior, critical-override controls, critical task/reasoning classifications, and optional reservation TTL.

### BudgetUsageSnapshot

Provides a timestamped, currency-specific snapshot of committed and already-reserved cost for each scope. Missing usage for an applicable enabled aggregate scope defers evaluation; the engine never assumes unknown usage is zero.

### CostGovernorDecision

Returns a deterministic status, reason codes, evaluated scopes, low-cost requirement, required override amount, optional override ID, and optional reservation plan.

### CostAuditRecord

Records the decision identity, timestamp, policy version, estimated cost, every scope evaluation, reasons, reservation, override reference, normalized error, and final result.

### AI Cost Ledger Boundary

The implemented AI Cost Ledger now defines its own richer persistence port, append results, sequence ordering, currency-separated queries, and reconciliation contracts. The legacy governor-local `CostLedgerRepository` type remains only as an earlier compatibility contract and is not used by the ledger engine.

## 10. Budget Scopes

- `PER_REQUEST`: evaluates the new estimate with no prior usage requirement.
- `DAILY`: evaluates committed daily usage plus reserved daily usage plus the estimate.
- `MONTHLY`: evaluates committed monthly usage plus reserved monthly usage plus the estimate.
- `TASK_CATEGORY`: applies only when its scope ID matches the request task type.
- `PROVIDER`: applies only when its scope ID matches the selected provider ID.
- `MODEL`: applies only when its scope ID matches the selected model ID.

Scope and identifier pairs must be unique within policy and usage snapshots. Disabled limits are audited but do not enforce. A `null` hard limit is explicitly unlimited.

## 11. Deterministic Limit Rules

For every applicable enabled scope:

```text
projected = committed + reserved + estimated new cost
```

- `projected <= hard limit` is allowed.
- `projected > hard limit` is rejected unless a valid critical override covers the breach.
- `projected > soft limit` and `projected <= hard limit` requires low-cost mode when enabled.
- Equality with a soft or hard threshold does not exceed that threshold.
- Soft limit must not exceed a finite hard limit.
- Arithmetic outside the safe-integer range fails closed.

Identical request, policy, usage snapshot, and clock inputs produce identical output. Array order does not introduce random selection because the governor does not choose among candidates.

## 12. Critical Overrides

An override can apply only when all conditions hold:

- The override feature and policy permission are enabled.
- The task type or reasoning level is classified as critical by policy.
- Authorization metadata is complete and unexpired.
- The request task is explicitly authorized.
- Every exceeded scope is explicitly authorized.
- The maximum override amount covers the largest required scope breach.

Invalid, expired, insufficient, disabled, task-unauthorized, or scope-unauthorized overrides are rejected with normalized reason codes. Authorization is evidence, not an instruction to bypass unrelated policy.

## 13. Reservation Model

An allowed decision returns a `PLANNED` reservation containing the request, amount, applicable enabled scopes, policy version, creation time, and optional deterministic expiry. The pure engine does not persist or atomically acquire the reservation.

The implemented AI Reservation Manager foundation validates and atomically transitions the plan to `RESERVED` in its in-memory repository. It later supports `PARTIALLY_COMMITTED`, `COMMITTED`, `RELEASED`, and `EXPIRED` outcomes using idempotency and compare-and-set versions. The in-memory implementation is not a durable production accounting boundary.

## 14. Ledger Model

Immutable ledger entries now distinguish reservation acquisition, partial/full usage commit, release, expiry, cancellation, rejection, override use, and authorized manual adjustment. The Reservation Manager emits append-only instructions and the Cost Ledger translates and persists them through a separate port.

The ledger is the accounting source for rebuilding usage summaries and reconciling reservation history. Its local NDJSON repository is restart-persistent but is not a production transactional database or provider-billing integration.

## 15. AI Router Interaction

The Router first establishes an eligible candidate and estimate. The boundary maps:

- Router request identity, task, reasoning, and override metadata
- selected provider and model IDs
- estimate and currency
- Router per-request, daily, and monthly budget configuration
- aggregate daily and monthly usage

The governor then returns one of: allowed, allowed-low-cost-only, allowed-with-override, rejected, or deferred. The deterministic AI Runtime Workflow honors that result before any fixture adapter call. Business logic consumes provider-neutral outcomes only.

## 16. Audit Requirements

Every evaluation records:

- Request, decision, audit, and policy identifiers
- Evaluation timestamp and estimated amount
- Committed, reserved, projected, remaining, soft, and hard values for every applicable scope
- Decision status and normalized reasons
- Low-cost requirement
- Required and authorized override information
- Reservation plan, when allowed
- Normalized error and retryability, when present
- Final result: allowed, rejected, or deferred

Audit creation remains in memory inside the Governor. Callers may now translate and append it to the local Unified Audit Repository; production transactional audit persistence remains future work.

## 17. Failure Behavior

Invalid request, policy, usage, cost, override, or currency inputs return normalized results rather than provider exceptions. Missing required usage defers with a retryable budget-unavailable error. Hard-limit and invalid-override failures are non-retryable unless policy or authorization changes.

## 18. Future Persistence and Execution Compatibility

Future providers remain behind Router provider definitions and adapters. Future persistence remains behind the ledger repository port. Neither addition requires changes to capital-domain business logic.

Before live execution, Alpha still needs:

1. A durable transactional implementation of the Reservation Manager repository and Cost Ledger.
2. Workflow wiring from reservation acquisition through Coordinator settlement instructions.
3. Production transactional audit storage and reconciliation beyond the implemented local Unified Audit Repository.
4. Usage aggregation by accounting timezone and policy version.
5. Explicit owner-reviewed provider adapters and credential boundaries.

These are separate implementation tasks and are not implied by this foundation.
