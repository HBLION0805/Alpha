# AI Runtime Workflow Specification v1.0

Status: Implemented deterministic foundation
Task: D4-T11
Date: 2026-07-18

## Problem Solved

Alpha's provider-independent AI components previously exposed correct local boundaries but did not prove that those boundaries could complete one coherent request lifecycle. The AI Runtime Workflow supplies the minimum deterministic orchestration layer connecting Router, Cost Governor, Reservation Manager, Cost Ledger, Unified Audit Repository, Execution Coordinator, and Provider Adapter Registry.

It prevents business logic and callers from assembling a partial or unsafe sequence, particularly execution without approved routing, budget enforcement, reservation, accounting evidence, and pre-execution audit evidence.

## Expected Value

- One provider-neutral entry point and normalized result for an AI request lifecycle.
- Fail-closed ordering for routing, cost control, reservation, accounting, audit, execution, settlement, reconciliation, and trace validation.
- Explicit idempotency and compensation semantics without pretending that separate repositories are transactional.
- A fixture-proven foundation for later production adapters and persistence without provider dependencies in Alpha core logic.

## Implementation and Operating Cost

The implementation cost is a focused TypeScript contract, validator, deterministic engine, in-memory result repository, exports, and tests. It reuses existing subsystem contracts and translation boundaries rather than duplicating their policies.

The local operating cost is in-process computation plus in-memory or local repository I/O. There are no provider charges, network calls, background processes, cloud services, credentials, or production adapters in v1.

## Why Build It Now

D4-T6 through D4-T10 established the necessary subsystem boundaries. Integrating them now verifies their compatibility before any live provider or production persistence work can make errors expensive, stateful, or externally visible. This completes the Alpha AI Infrastructure v1 foundation while keeping live execution disabled.

## Non-Goals

The workflow does not:

- make investment, portfolio, risk, allocation, or trade decisions;
- own business-domain policy or choose a provider outside Router;
- calculate monetary truth outside Cost Ledger and Reservation Manager;
- call external APIs, select a hidden fallback, or run a live retry loop;
- contain provider credentials, SDKs, HTTP clients, sockets, or production adapters;
- provide cross-repository transactions, distributed locks, workers, cloud storage, or multi-node coordination;
- repair corrupted audit or ledger history.

## Architecture Position

```text
Provider-neutral caller
        |
        v
AI Runtime Workflow
        |
        +--> AI Router ------------------------------+
        |                                            |
        +--> AI Cost Governor                        |
        |                                            |
        +--> AI Reservation Manager <--> repository  |
        |                                            |
        +--> AI Cost Ledger <----------> repository  |
        |                                            |
        +--> Unified Audit Repository <-> repository |
        |                                            |
        `--> AI Execution Coordinator                |
                    |                                |
                    v                                |
            Provider Adapter Registry <--------------+
                    |
                    v
             neutral fixture adapter
```

The workflow coordinates subsystem results. Each subsystem retains its own validation, policy, state-transition, accounting, and audit responsibilities. Repositories and the adapter registry are injected dependencies, not request payloads.

## Request Contract

`AIRuntimeWorkflowRequest` carries contract version 1.0, workflow/idempotency/request/correlation/trace identifiers, the original `AIRequest`, provider-neutral execution input, timeout and cancellation state, all caller-supplied deterministic operation IDs and idempotency keys, and immutable runtime configuration.

`AIRuntimeWorkflowConfiguration` contains Router configuration and usage, Cost Governor policy and usage snapshot, Reservation, Execution, Cost Ledger, Unified Audit, and workflow policies. Validation requires identity continuity, supported enum values, explicit timestamps, budget-policy version alignment, and a v1 reroute limit of zero or one. It never accepts provider credentials.

`AIRuntimeWorkflowDependencies` injects the clock, adapter registry, reservation repository, Cost Ledger repository, Unified Audit Repository, and workflow result repository. No random ID or ambient time source is used.

## End-to-End Stage Model

The deterministic stage order is:

1. `REQUEST_VALIDATION`
2. `ROUTING`
3. `COST_GOVERNANCE`
4. `LOW_COST_REROUTING` when required
5. `RESERVATION_ACQUISITION`
6. `RESERVATION_LEDGER_APPEND`
7. `PRE_EXECUTION_AUDIT`
8. `PROVIDER_EXECUTION`
9. `RESERVATION_SETTLEMENT`
10. `SETTLEMENT_LEDGER_APPEND`
11. `LEDGER_RECONCILIATION`
12. `FINAL_AUDIT_APPEND`
13. `TRACE_VALIDATION`
14. one terminal stage: `COMPLETED`, `FAILED`, `DEFERRED`, or `REQUIRES_REROUTE`

`COMPENSATION` is inserted only when a prior successful state mutation requires an explicit recovery action. Every stage result includes status, timestamp, input and output references, reason codes, optional normalized error, and source audit references. Omitted branches are not represented as successful work.

## Routing and Low-Cost Rerouting

Router is the only model selector. The normal route is evaluated by Cost Governor. `ALLOWED` and `ALLOWED_WITH_OVERRIDE` may continue; override and approval references remain in the source decisions. `DEFERRED` ends deterministically before reservation. Rejected cost ends before reservation.

`ALLOWED_LOW_COST_ONLY` permits at most one explicit reroute when workflow policy allows it. The workflow enables low-cost routing, asks Router again, preserves both decisions and audit records, verifies that the selected route is cheaper or explicitly low-cost eligible, and reruns Cost Governor when configured. Failure to find a compliant route is a rejection, never a hidden provider fallback.

## Reservation Acquisition

The workflow maps the approved Cost Governor reservation plan into Reservation Manager acquisition. Execution requires a successfully persisted `RESERVED` state with matching request, currency, amount, policy, trace, and correlation identity. The returned acquisition instruction is appended idempotently to Cost Ledger before provider execution.

Repository state is read back after acquisition. A success response without matching persisted state is an internal inconsistency and stops execution.

## Pre-Execution Audit

Before adapter invocation, normalized evidence must exist for every Router attempt, every Cost Governor decision, reservation acquisition, and the acquisition ledger append. Existing translation functions preserve source record IDs and policy versions while excluding raw prompts and execution payloads.

The v1 default is strict fail-closed behavior. If required evidence cannot be appended, the workflow stops and explicitly compensates an acquired reservation. The `WARN_AFTER_MONETARY_SUCCESS` policy applies only after monetary state has already succeeded; it does not permit execution without pre-execution evidence.

## Provider Execution

The workflow passes the selected provider/model, reservation, routing decision, Cost Governor decision, trace, input, timeout, and cancellation state to Execution Coordinator. Coordinator resolves one adapter from the provider-neutral registry, checks compatibility and health, invokes it once, validates identity/output/usage, and returns normalized retry and settlement instructions.

The workflow does not call an alternate adapter, rerun a provider during compensation, or execute a fallback locally. A fallback recommendation returns control to Router through the normalized result.

## Settlement

Coordinator settlement instructions are mapped into Reservation Manager operations:

- successful metered usage is committed;
- unused reserved value is released when policy requires it;
- partial commit plus release preserves committed value;
- non-retryable failure releases the reservation;
- an explicit retry plan may retain it;
- cancellation, timeout, rate limit, malformed output, and identity mismatch remain normalized outcomes.

One execution reference cannot commit twice. Currency must match, actual usage cannot exceed the reservation, and every state transition and operation is idempotent. The workflow never reverses a successful monetary mutation silently.

## Ledger Append and Reconciliation

Every Reservation Manager ledger instruction is translated into exactly one append request with caller-supplied entry and operation identity. After settlement, the workflow reconciles the full reservation history and reports over-commit, duplicate settlement, missing acquisition, currency mismatch, invalid transition, missing required final settlement, or sequence inconsistency without repair.

An intentionally retained reservation may remain open only when its sole reconciliation issue is the expected missing final settlement. All other inconsistent histories fail with manual reconciliation disposition.

## Unified Audit Trace

The workflow appends normalized records for routing, cost decisions, reservation operations, Cost Ledger appends, Execution Coordinator result, reconciliation, and final runtime result. Owner approval remains a separate evidence type when an override policy requires it; v1 does not invent approval evidence.

The final trace is reconstructed from Unified Audit Repository in repository sequence order. The result includes nodes, edges, missing references, issues, final outcome, trace status, and whether policy accepts that status. A nominally successful workflow becomes `FAILED_TRACE_INTEGRITY` if the trace is not acceptable.

## Final Statuses

The normalized status set is:

- `COMPLETED_SUCCESS`, `COMPLETED_WITH_WARNING`;
- `REJECTED_ROUTING`, `REJECTED_COST`, `REJECTED_RESERVATION`, `REJECTED_AUDIT`;
- `FAILED_EXECUTION`, `FAILED_SETTLEMENT`, `FAILED_LEDGER`, `FAILED_RECONCILIATION`, `FAILED_TRACE_INTEGRITY`;
- `DEFERRED_BUDGET_UNAVAILABLE`, `REQUIRES_ROUTER_FALLBACK`, `CANCELLED`;
- `INVALID_REQUEST`, `INTERNAL_INCONSISTENCY`.

Every result includes stable distinct reason codes, last completed stage, full stage results, subsystem results, compensations, retry disposition, and final workflow audit evidence.

## Compensation Behavior

There is no hidden rollback and no fake atomicity:

- acquisition ledger failure triggers reservation release and attempts the corresponding release ledger append;
- pre-execution audit failure performs the same explicit release compensation;
- execution success followed by settlement failure preserves execution evidence, does not re-execute, and recommends manual reconciliation;
- settlement success followed by ledger append failure recommends idempotent ledger replay and does not undo settlement;
- post-monetary audit failure is an explicit warning or failure according to policy and preserves source records for audit replay.

Compensation ordering is stable and every action is reported as applied, failed, recommended, or not required.

## Failure Boundaries

Validation, Router, Cost Governor, Reservation Manager, Cost Ledger, Unified Audit, Adapter/Coordinator, settlement, reconciliation, workflow result persistence, and final trace acceptance remain distinct boundaries. Errors are normalized at the boundary where they occur. A later failure never changes an earlier source subsystem's result and never causes silent stage skipping.

## Idempotency and Replay

The caller supplies all operation and idempotency keys. Subsystem repositories enforce their own replay semantics. `InMemoryAIRuntimeWorkflowRepository` stores the complete result with a canonical request fingerprint. An identical workflow or idempotency replay returns a defensive copy of the stored result without another adapter call, reservation transition, ledger append, or audit append. Reuse with a different fingerprint returns an idempotency conflict.

This result-repository boundary is required because replaying orchestration from the beginning could repeat an irreversible provider execution even when downstream repositories are idempotent.

## Privacy Boundaries

Audit records contain identifiers, normalized status, policy versions, reason codes, cost/usage references, and scalar metadata. They do not contain the raw prompt, provider credential, sensitive execution payload, or adapter secret. Unified Audit policy rejects secret-bearing metadata keys and prevents privacy downgrade across parent links.

The original request's processing boundary and privacy constraints remain Router and adapter compatibility inputs. The workflow cannot weaken them.

## Sources of Truth

Cost Ledger is the append-only monetary source of truth. Reservation Manager owns valid reservation state transitions. Unified Audit Repository is the evidence ordering, linkage, integrity, and trace source of truth; it does not recompute monetary totals. Router alone selects models. Cost Governor alone decides cost eligibility. Execution Coordinator owns provider response validation and settlement instructions.

## Local Persistence Behavior

The v1 workflow result repository is in memory. Existing Reservation Manager is in memory; Cost Ledger and Unified Audit also expose in-memory repositories plus local NDJSON repositories for their own records. The workflow does not create runtime data during tests and does not claim transactional durability across these stores.

## Future Production Provider Sequence

Before a live provider is enabled:

1. owner-review a transactional persistence and recovery design for workflow, reservation, ledger, and audit state;
2. implement durable idempotency, outbox/inbox processing, and crash recovery;
3. implement provider billing reconciliation against Cost Ledger;
4. add one separately reviewed production adapter behind the existing adapter contract;
5. run privacy, credential, network, timeout, rate-limit, and failure-injection reviews;
6. enable provider execution only through explicit configuration after owner approval.

Business logic and all existing subsystem contracts remain provider-independent throughout this sequence.

## Known Limitations

- No durable workflow result repository or cross-repository transaction exists.
- In-process operation cannot recover automatically from a process crash between stores.
- There is no outbox, inbox, worker, lease, distributed lock, or multi-node coordination.
- No production provider adapter, live retry loop, or automatic alternate-provider execution exists.
- Owner approval evidence must already exist when a future override policy requires it.
- Local NDJSON repositories are not a substitute for transactional production persistence.

## Future Transaction and Outbox Requirements

Production design must atomically record intended reservation, ledger, audit, and workflow transitions or use an owner-reviewed transactional outbox with idempotent consumers. It must define crash points, replay ownership, monotonic sequencing under concurrency, poison-message handling, dead-letter review, audit replay, ledger replay, and provider-execution deduplication. Provider invocation requires a durable execution claim so recovery can distinguish "not invoked" from "invoked but response not persisted" without guessing or repeating cost-bearing work.
