# AI Provider Adapter Specification v1.0

Status: Interface foundation implemented

Date: 2026-07-18

## 1. Problem Statement

Alpha has deterministic boundaries for selecting an AI provider/model and deciding whether its estimated cost is financially permitted. It needs a replaceable execution interface so future provider integrations can translate approved provider-neutral requests without exposing vendor types, credentials, errors, or usage formats to core logic.

This foundation defines that interface and its validation. It does not connect to a provider.

## 2. Expected Value

The adapter boundary preserves provider independence, makes future integrations conform to one execution contract, prevents adapters from taking ownership of routing or budgets, and gives future coordination code normalized health, output, usage, timeout, cancellation, and failure data.

## 3. Implementation and Operating Cost

The implementation consists of TypeScript contracts, deterministic validators, an in-memory registry, a shared compatibility evaluator, tests, and documentation. Runtime operating cost is local memory and CPU only. There are no provider fees, network calls, polling processes, databases, queues, or credential systems.

## 4. Why Now

The Router and Cost Governor boundaries are stable. Defining the post-approval execution contract before adding any vendor integration prevents the first provider from becoming Alpha's implicit architecture.

## 5. Non-Goals

- Provider SDKs, HTTP clients, API calls, or live model execution
- Production adapters for any provider
- API keys, credentials, authentication flows, or secret storage
- Retry, fallback, routing, or budget policy
- Reservation acquisition, cost commit, or ledger persistence
- Audit persistence or live health polling
- Plugin loading, dynamic imports, service discovery, or dependency-injection frameworks
- Full execution coordination
- Python business-logic changes

## 6. Architecture Boundary

```text
Business module
  -> AI Router selects provider/model
  -> AI Cost Governor approves cost
  -> AI Reservation Manager acquires reservation
  -> AI Execution Coordinator resolves adapter
  -> adapter executes only the selected provider/model
  -> normalized response and usage
  -> coordinator emits settlement instructions
  -> Reservation Manager commits or releases reservation
  -> Cost Ledger persistence and Unified Audit Repository through explicit caller boundaries
```

The adapter receives decision and reservation references as immutable identifiers. It never receives Router policy, Cost Governor policy, a fallback chain, or authority to change those decisions.

## 7. Adapter Responsibilities

An `AIProviderAdapter` must:

- Identify itself through a provider-neutral descriptor.
- Report provider-neutral health without initiating polling.
- Evaluate compatibility with the already-selected provider/model and constraints.
- Execute only the provider/model named in the request.
- Respect caller-supplied timeout and cancellation state.
- Return provider-neutral output, usage, timing, audit references, warnings, and normalized errors.
- Hide provider-specific request, response, and error types.
- Avoid mutating request or context objects.

## 8. Adapter Non-Responsibilities

An adapter must not:

- Select, reroute, or fall back to another provider/model.
- approve, override, reinterpret, reserve, commit, or release budget.
- retry unless a future coordinator explicitly invokes it for another attempt.
- persist audit, response, reservation, or ledger records.
- perform capital-domain calculations or actions.
- expose secrets through descriptors, responses, warnings, or normalized errors.

## 9. Execution Request Boundary

`AIExecutionRequest` contains only post-routing execution data:

- Request, provider, and model identifiers
- Task, input payload, expected output, capabilities, and reasoning
- Privacy, context, output-token, timeout, and cancellation constraints
- Router decision, Cost Governor decision, and reservation references
- Caller timestamp, trace ID, and optional correlation ID

The payload remains provider-neutral. API keys and provider-native request objects are forbidden.

`AIProviderExecutionContext` adds the coordinator-owned attempt number, invocation timestamp, immutable timeout policy, and current cancellation state. The cancellation and timeout references must match the request.

## 10. Execution Response Boundary

Responses are discriminated as completed, failed, timed out, or cancelled. Every response preserves the request, provider, model, trace, decision, reservation, adapter, timing, retryability, and warning metadata.

Successful responses include provider-neutral output, finish reason, token usage, and optional provider-reported cost in integer minor units. Failed responses include a normalized error and may include partial usage when reliable.

Response validation prevents an adapter from changing the selected provider/model or replacing routing, Cost Governor, reservation, trace, or correlation references.

## 11. Registry Behavior

`InMemoryAIProviderAdapterRegistry` provides a deterministic boundary for:

- Registering one adapter per provider ID
- Retrieving by non-empty provider ID
- Rejecting duplicate or malformed registrations
- Listing descriptor snapshots ordered by provider ID and adapter ID
- Returning only adapters compatible with the selected request

Registration validates both descriptor and current static health metadata. The registry does not load plugins, discover services, create adapters, execute requests, or own adapter lifecycles.

## 12. Compatibility Rules

Compatibility is evaluated in fixed order against:

- Adapter enabled state
- Exact selected provider and supported model
- Required capabilities and reasoning level
- Privacy and output types
- Context and output-token limits
- Timeout and cancellation support

The result contains explicit normalized reasons. It does not consider price, fallback preference, or business value because those belong upstream.

## 13. Health Representation

Provider-neutral health states are `AVAILABLE`, `DEGRADED`, `RATE_LIMITED`, `UNAVAILABLE`, and `UNKNOWN`. Health may include observation and expiry timestamps, latency estimate, reliability estimate, rate-limit state, retry-after metadata, and a non-secret source label.

Health is supplied by adapters or fixtures. This foundation performs no polling and does not treat health as routing authority.

## 14. Error Normalization

Normalized categories include invalid request, adapter not found, provider/model unavailable, unsupported capability, privacy rejection, timeout, cancellation, rate limit, authentication failure, provider error, malformed response, missing usage metadata, and unknown failure.

Errors contain safe messages, stable codes, retryability, time, selected provider/model, and optional retry-after data. Provider-native error objects and secrets must not cross the boundary. A retryable result is guidance to the future coordinator, not permission for the adapter to retry.

## 15. Timeout and Cancellation

Timeout values must be positive finite safe integers. Cancellation uses a caller-owned reference and explicit requested state. When cancellation is requested, its timestamp is required. Adapter context cannot replace the request timeout or cancellation ID.

The interface requires conforming adapters to respect these controls. This foundation does not start timers, create cancellation signals, or race promises because it does not implement live orchestration.

## 16. Privacy and Credential Boundary

Compatibility must reject unsupported privacy levels. Future adapters may maintain credentials internally behind a separately reviewed secret-management boundary, but credentials must never appear in public descriptors, execution requests, normalized responses, audit metadata, warnings, or errors.

Descriptor validation recursively rejects common secret-bearing keys in optional public configuration. Values are not logged or persisted by this layer.

## 17. Audit and Usage Metadata

Execution audit metadata preserves trace, correlation, routing decision, Cost Governor decision, reservation, adapter, and adapter-version references. Usage records validate non-negative safe-integer input, output, and total tokens; total must equal input plus output.

Optional reported cost uses the Cost Governor's integer minor-unit amount contract. The adapter reports usage but does not commit it to a ledger.

## 18. Execution Coordinator Boundary

The deterministic coordinator foundation now:

1. Accepts an approved Router and Cost Governor result.
2. Validates the supplied reservation plan/reference; durable acquisition remains future work.
3. Resolves the exact provider adapter.
4. Validates health and compatibility.
5. Invokes one attempt with timeout and cancellation controls.
6. Validates and records the normalized response in memory.
7. Determines whether policy recommends a future retry or return to Router.
8. Returns reservation and usage settlement instructions.
9. Returns audit and ledger instructions for the dedicated Cost Ledger and Unified Audit Repository ports.

It performs one adapter invocation only. It does not acquire or mutate reservations, execute retry/fallback plans, persist records, poll health, or provide live provider integration.

## 19. Future Provider Implementation Rules

Every future production adapter must be a separate, owner-reviewed integration. It must use neutral identifiers, keep its SDK and credentials private, translate only at the adapter edge, conform to the shared validators, preserve selected identifiers and references, and pass the full conformance suite.

Provider-specific additions must not require business logic, Router policy, or Cost Governor policy changes.

## 20. Conformance Tests

Every future adapter must reuse or reproduce tests for:

- Descriptor, health, compatibility, request, response, usage, timeout, and cancellation validation
- Exact provider/model preservation
- Routing, cost-decision, reservation, trace, and correlation references
- Normalized failures and retryability
- Input immutability and deterministic fixture behavior
- No direct ledger, persistence, routing, or budget ownership
- No public credentials or secret-bearing configuration

Live integration tests, SDK installation, and credential testing require separate explicit approval.
