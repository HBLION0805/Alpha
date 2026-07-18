# AI Execution Coordinator Specification v1.0

Status: Deterministic foundation implemented

Date: 2026-07-18

## 1. Problem Statement

Alpha has provider-independent Router, Cost Governor, and Provider Adapter boundaries. It needs one deterministic coordinator that verifies those upstream decisions, invokes exactly one approved adapter, validates the normalized response, and returns auditable retry and settlement instructions without owning provider, budget, or persistence policy.

## 2. Expected Value

The coordinator completes Alpha's provider-independent AI execution pipeline foundation. It prevents execution when routing, cost, reservation, adapter, health, privacy, or internal references are invalid. It also ensures future retry and ledger services receive explicit instructions rather than hidden side effects.

## 3. Implementation and Operating Cost

The foundation contains TypeScript contracts, validators, a single-attempt deterministic engine, neutral fixture tests, exports, and documentation. Runtime cost is local CPU and memory plus the cost of one future adapter invocation. This task introduces no provider fees, network traffic, database, queue, scheduler, or background process.

## 4. Why Now

The execution boundary must be proven before a production provider is added. Otherwise the first provider implementation could silently become responsible for routing, budget enforcement, retries, settlement, and audit behavior.

## 5. Non-Goals

- Production provider adapters or SDKs
- Credentials, HTTP clients, sockets, or external API calls
- Automatic retry loops, concurrent execution, or health polling
- Provider selection, fallback selection, or routing recalculation
- Budget calculation, reservation persistence, ledger mutation, or reconciliation
- Audit persistence or database storage
- Portfolio, trade, or Python business-logic changes

## 6. Architecture Position

```text
Original AI request
  -> deterministic AI Router decision and audit
  -> deterministic AI Cost Governor decision, audit, and reservation plan
  -> AI Execution Coordinator preconditions
  -> exact adapter lookup and compatibility/health checks
  -> one provider-neutral adapter invocation
  -> normalized response validation
  -> retry/fallback recommendation
  -> reservation and usage settlement instructions
  -> in-memory coordinator audit
  -> current local audit/ledger persistence and future transactional settlement services
```

## 7. Responsibilities

The coordinator:

- Validates immutable Router, Cost Governor, reservation, policy, trace, and audit references.
- Confirms the selected model satisfies any low-cost-only condition.
- Resolves only the adapter for the already-selected provider.
- Verifies descriptor compatibility and acceptable fresh health.
- Builds a provider-neutral execution request.
- Invokes the selected adapter exactly once.
- Validates identifiers, output, timestamps, latency, usage, reported cost, and audit references.
- Returns normalized status, error, retry/fallback plan, settlement instructions, attempt metadata, and audit output.

## 8. Non-Responsibilities

The coordinator does not:

- Choose another provider/model or alter a fallback chain.
- Recalculate Router or Cost Governor policy.
- Authorize an override or increase a budget.
- Acquire, mutate, commit, release, expire, or persist a reservation.
- Run a retry loop or execute a fallback.
- Persist audit, usage, response, or ledger data.
- Own credentials or expose provider-native errors.
- Perform capital-domain actions.

## 9. Coordinator Request

`AIExecutionCoordinatorRequest` contains immutable snapshots of:

- Original AI request
- Router decision and audit
- Cost Governor decision and audit
- Optional planned or acquired reservation
- Provider-neutral input payload
- Timeout and cancellation state
- Attempt number, trace/correlation identifiers, and execution policy

The adapter registry is passed as a separate execution dependency because it is an in-memory service boundary, not serializable request data.

The coordinator uses injected clock and deterministic execution-ID sources. It uses no randomness.

## 10. Precondition Validation

Preconditions run in stable fail-closed order:

1. Coordinator request shape and policy
2. Successful AI-selected routing status
3. Original request, routing decision, routing audit, provider/model, and policy references
4. Cost Governor status and audit references
5. Low-cost-only model eligibility
6. Critical-override authorization references when applicable
7. Required reservation presence
8. Reservation request, ID, amount, currency, status, and policy match
9. No pre-execution cancellation
10. Exact selected adapter resolution
11. Adapter compatibility
12. Provider health validity, freshness, provider match, and accepted status

Every evaluated precondition becomes audit metadata. Missing or inconsistent data is never assumed valid.

## 11. Adapter Invocation Rules

The coordinator constructs `AIExecutionRequest` from the immutable approved request and decision snapshots. It preserves the selected provider/model, requested capabilities, reasoning, privacy, output type, context/output limits, timeout, cancellation, decision IDs, reservation, and traces.

One call is made to one resolved adapter. The coordinator never calls a fallback adapter in the same invocation. Thrown adapter errors are normalized through the adapter boundary and raw errors are not returned.

## 12. Response Validation

The coordinator validates:

- Request, provider, and model identity
- Router, Cost Governor, reservation, trace, and correlation references
- Output type
- Start/end metadata and non-negative finite latency
- Non-negative safe-integer token counts and correct total
- Normalized error consistency and retryability
- Reported minor-unit cost and reservation currency

Malformed results, including missing metadata, are converted to stable invalid-response outcomes without a secondary runtime failure.

## 13. Retry and Fallback Planning

`AIRetryPlan` supports:

- `NO_RETRY`
- `RETRY_SAME_ADAPTER`
- `RETURN_TO_ROUTER_FOR_FALLBACK`
- `REJECT_FINAL`
- `DEFER`

Policy defines bounded maximum attempts and normalized adapter categories eligible for same-adapter retry or return to Router. Same-adapter retry is recommended only when attempts remain and the provider marks the failure retryable. When attempts are exhausted, configured categories may return control to Router.

No recommendation is executed by this engine. There are no hidden retry costs or live retry loops.

## 14. Reservation and Settlement Instructions

The coordinator returns instructions; it performs no mutations.

Reservation instruction types:

- `RELEASE_UNUSED_RESERVATION`
- `RELEASE_RESERVATION`
- `RETAIN_FOR_RETRY`
- `EXPIRE_RESERVATION`
- `NO_ACTION`

Usage settlement instruction types:

- `COMMIT_USAGE`
- `NO_ACTION`

Instructions carry reservation, request, estimated amount, optional actual reported amount, currency, reason, timestamp, execution ID, and policy version. Successful lower actual cost produces commit plus release-unused instructions. Retry recommendations may retain the reservation. Final failures release it.

Actual reported cost above the reservation is explicitly recorded as an overrun reason; it is not silently approved or recalculated.

## 15. Error Normalization

Coordinator categories include invalid input, routing/cost rejection, low-cost violation, missing/mismatched reservation, missing/incompatible adapter, provider unavailable, cancellation, timeout, provider failure, malformed response, invalid usage, provider/model mismatch, currency mismatch, internal reference mismatch, and unknown failure.

Errors contain stable category/code, safe message, retryability, and timestamp. Provider-native error objects are never included.

## 16. Audit Requirements

Every result returns an in-memory audit record with:

- Execution, request, trace, and correlation IDs
- Router decision, selected provider/model, and routing policy
- Cost Governor decision/status and budget policy
- Reservation reference
- Adapter descriptor and provider health snapshot when resolved
- Ordered precondition checks
- Execution plan and attempt metadata
- Coordinator output status
- Usage, latency, and reported cost when valid
- Retry and fallback plan
- Reservation and usage settlement instructions
- Normalized error and final result

Input payload content is not copied into coordinator audit output.

## 17. Privacy Boundary

Privacy compatibility is rechecked against the adapter descriptor. The coordinator receives no credentials and adds no secret configuration. Provider-native raw errors, secret prompts, and credential values must never appear in results or audit output.

## 18. Reservation Manager and Future Persistence Boundary

The deterministic AI Runtime Workflow now translates Coordinator settlement instructions into Reservation Manager requests without coupling the two implementations. Production durability and recovery remain future work.

Durable services must transact manager state, operation history, ledger entries, and audits and reconcile provider billing. This coordinator does not itself acquire or mutate reservations, and the current in-memory manager is not durable.

## 19. Future Production-Provider Sequence

Before live provider use:

1. Replace the in-memory reservation repository with owner-reviewed transactional persistence.
2. Replace local Cost Ledger and Unified Audit Repository persistence with production transactional storage.
3. Review one production adapter and its SDK/credential isolation separately.
4. Run adapter conformance tests.
5. Add explicit live timeout/cancellation controls.
6. Replace the local workflow result boundary with a durable execution claim and transactional or outbox-backed recovery model.
7. Start with a low-risk task and owner-observed rollout.

## 20. Known Limitations

- Only one sequential adapter attempt is performed.
- Retry and fallback are plans only.
- The coordinator's reservation and settlement outputs are instructions only; the separate Reservation Manager foundation applies explicit state operations in memory.
- Health is adapter-supplied static metadata; no polling occurs.
- No idempotency store prevents duplicate external invocation yet.
- Cost Governor decisions do not currently preserve their selected provider/model inputs, so cross-checking that pair relies on Router, reservation, and coordinator references.
- Provider-reported actual cost may be unavailable or exceed the reservation and requires future reconciliation.
