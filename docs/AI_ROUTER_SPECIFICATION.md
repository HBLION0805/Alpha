# Alpha AI Router Specification v1.0

Status: Proposed architecture and contracts
Task: D4-T2 AI Router Specification v1.0
Date: 2026-07-18

## 1. Purpose

The AI Router selects and invokes an eligible AI model for an Alpha task while balancing capability, reliability, context capacity, latency, privacy, and cost.

The Router is provider-independent. Alpha business modules describe what a task needs through stable task and capability contracts. They never select a provider, name a provider model, import a provider SDK, or branch on provider identity.

The Router is decision-support infrastructure. It does not own portfolio calculations, risk limits, opportunity scores, prediction state, instrument ranking, capital decisions, trade approval, execution, or strategy activation. AI output remains advisory until the responsible deterministic Alpha module validates and accepts it.

## 2. Design principles

1. Deterministic software takes precedence when it can solve the task accurately.
2. Routing is deterministic for the same request, policy, registry, budget, and health snapshots.
3. Provider and model details are isolated in configuration and provider adapters.
4. Hard constraints are applied before preferences are scored.
5. Privacy and capability requirements may never be weakened by fallback.
6. Budget is reserved before an external request and reconciled afterward.
7. Every routing decision and execution attempt is auditable.
8. AI output never bypasses deterministic validation or owner approval.
9. No random routing, random tie-breaking, or undocumented downgrade is allowed.
10. Contracts, policy, pricing, and provider profiles are versioned independently.

## 3. Scope

### 3.1 In scope

- Validate a Router Request.
- Prefer a registered deterministic handler when one is eligible.
- Classify task requirements through the Task Catalog.
- Resolve reusable capability profiles.
- Filter provider models using hard constraints.
- Select one primary route using deterministic policy.
- Precompute an ordered fallback chain.
- Enforce per-request, daily, and monthly cost limits.
- Invoke AI through an abstract provider adapter.
- Validate the response envelope and expected output shape.
- Record selection, attempts, retries, fallback, cost, and completion events.

### 3.2 Out of scope

- Provider-specific SDK implementation.
- Prompts for individual Alpha business modules.
- Business calculations or risk enforcement.
- Automatic approval of trades or strategy changes.
- Broker execution.
- Replacing Alpha source records with AI output.
- Evaluating whether an AI recommendation is financially correct.

## 4. Position inside Alpha

The Router is an infrastructure service used by Alpha modules that have a justified AI task. It sits between those modules and provider adapters.

```text
Alpha business module
        |
        | provider-neutral Router Request
        v
AI Router API
        |
        +--> Request Validator
        +--> Task Catalog and Capability Resolver
        +--> Deterministic Handler Registry
        +--> Privacy Policy
        +--> Budget Governor and Cost Ledger
        +--> Provider/Model Registry and Health Snapshot
        +--> Deterministic Policy Engine
        +--> Fallback Planner
        +--> Audit Log
        |
        v
Provider Adapter Interface
        |
        v
Configured provider/model
        |
        | provider-neutral result envelope
        v
Output Validation
        |
        v
Calling Alpha module
        |
        v
Deterministic business validation and owner approval where required
```

The Config System is the source of truth for routing policy, budgets, task mappings, capability profiles, and enabled provider profiles. The audit repository is the source of truth for historical routing events. Dynamic availability and latency data are observations, not business rules.

## 5. Complete request flow

1. A business module decides that a task may require AI and constructs a provider-neutral Router Request.
2. The Request Validator validates contract version, required fields, value ranges, context estimate, output requirements, privacy classification, and authorization metadata.
3. The Task Catalog adds the minimum capabilities, reasoning floor, reliability floor, and control requirements for the declared task type. A caller may strengthen these requirements but may not weaken them.
4. The Deterministic Gate checks whether a registered deterministic handler can satisfy the request. If so, and `deterministicAllowed` is true, the Router selects it before any AI model. Tasks marked deterministic-only are rejected if no eligible handler exists; they are never sent to AI.
5. The Capability Resolver expands named capability profiles into concrete required features and thresholds.
6. The Provider Registry supplies a versioned snapshot of enabled provider and model profiles. The Health Monitor supplies a timestamped availability, reliability, rate-limit, and latency snapshot.
7. Hard filters remove candidates that fail privacy, capability, feature, reasoning, context, output, availability, reliability, latency deadline, or budget requirements.
8. The Cost Governor estimates the maximum request cost using the current pricing version. Candidates exceeding the request budget or remaining daily/monthly budget are removed unless a valid critical-task override authorizes a bounded exception.
9. The Policy Engine orders the remaining candidates using the deterministic policy for the request's priority mode. Stable provider and model profile IDs provide the final tie-break.
10. The Fallback Planner stores the remaining candidates in deterministic order with the failure conditions under which each may be used.
11. The Cost Governor reserves the primary route's maximum estimated cost.
12. The Router returns and records the routing decision. If execution was requested, it invokes the selected provider through the abstract adapter.
13. The provider adapter translates the neutral request into provider-specific transport and translates the result back into the neutral response envelope.
14. Output Validation verifies transport success, output type, referenced schema, size, and required metadata. It does not treat model output as trusted business data.
15. On an eligible transient failure, the Retry and Fallback Controller follows the recorded strategy. It never chooses randomly or silently weakens constraints.
16. The Cost Governor reconciles reserved cost against actual metered usage.
17. The Router records final success, failure, rejection, retries, fallback usage, latency, and cost.
18. The calling business module deterministically validates and decides whether to use the returned content.

## 6. Router Request Contract

The following is contract notation, not implementation code.

```text
RouterRequestV1
  contractVersion: "1.0"
  requestId: string
  correlationId?: string
  parentRequestId?: string
  requestedAt: ISO-8601 timestamp
  requestedBy: ActorReference

  taskType: TaskTypeId
  capabilityRequired: CapabilityProfileId[]
  reasoningLevel: NONE | LOW | MEDIUM | HIGH | CRITICAL

  context: ContextDescriptor
  latency: LatencyRequirement
  costBudget: RequestCostBudget
  privacy: PrivacyRequirement

  deterministicAllowed: boolean
  expectedOutput: ExpectedOutputRequirement
  executionMode: PLAN_ONLY | PLAN_AND_EXECUTE

  criticality: ROUTINE | IMPORTANT | CRITICAL
  criticalOverrideAuthorizationId?: string
  idempotencyKey?: string
  metadata?: string-to-scalar map
```

### 6.1 Field definitions

| Field | Meaning and rule |
|---|---|
| `contractVersion` | Exact Router Request schema version. Unsupported major versions are rejected. |
| `requestId` | Globally unique identifier used for idempotency and audit correlation. |
| `correlationId` | Groups related work across Alpha systems. |
| `parentRequestId` | Links a derived or retry request to its source without rewriting history. |
| `requestedAt` | Caller timestamp. The Router also records its own received timestamp. |
| `requestedBy` | Identifies the system module and, when applicable, owner or service identity. |
| `taskType` | Stable Task Catalog identifier such as `research` or `coding`; never a provider name. |
| `capabilityRequired` | One or more reusable profiles. Task Catalog minimums are always added. |
| `reasoningLevel` | Minimum reasoning class. `CRITICAL` also activates critical-task controls; it does not authorize financial action. |
| `context` | Input size estimate, reserved output size, modalities, and context-reduction permission. |
| `latency` | Priority, optional deadline, and timeout requirements. |
| `costBudget` | Per-request maximum and cost mode. It cannot authorize daily or monthly overspend. |
| `privacy` | Data sensitivity and processing constraints. |
| `deterministicAllowed` | Allows an eligible registered deterministic handler to satisfy the task. It does not permit AI to replace deterministic-only business rules. |
| `expectedOutput` | Output format, schema, validation, and maximum size requirements. |
| `executionMode` | `PLAN_ONLY` returns a route without invoking it; `PLAN_AND_EXECUTE` permits adapter invocation. |
| `criticality` | Business impact used for reliability requirements and override eligibility. |
| `criticalOverrideAuthorizationId` | Reference to a valid, bounded, owner-approved cost override. Never a free-form assertion. |
| `idempotencyKey` | Required for requests that may be retried and could cause provider-side tool effects. |
| `metadata` | Non-sensitive routing tags only. Context or secrets must not be copied here. |

### 6.2 Supporting request types

```text
ActorReference
  moduleId: string
  actorType: OWNER | ALPHA_MODULE | SCHEDULED_JOB
  actorId?: string

ContextDescriptor
  estimatedInputTokens: non-negative integer
  reservedOutputTokens: positive integer
  modality: TEXT | IMAGE | AUDIO | MULTIMODAL
  attachmentCount: non-negative integer
  contextReductionAllowed: boolean
  contextFingerprint: string

LatencyRequirement
  priority: BATCH | LOW | NORMAL | HIGH | REALTIME
  deadlineMs?: positive integer
  attemptTimeoutMs: positive integer

RequestCostBudget
  currency: configured budget currency
  maximumEstimatedCost: non-negative decimal
  mode: LOW_COST | BALANCED | QUALITY_FIRST

PrivacyRequirement
  level: PUBLIC | INTERNAL | SENSITIVE | LOCAL_ONLY
  externalProcessingAllowed: boolean
  allowedProcessingRegions?: string[]
  retentionAllowed: boolean
  sensitiveDataCategories?: string[]

ExpectedOutputRequirement
  type: TEXT | STRUCTURED_JSON | REPORT | CODE | PATCH | TRANSLATION | IMAGE | MULTIMODAL
  schemaId?: string
  maximumOutputTokens: positive integer
  strictSchema: boolean
  toolCallingRequired: boolean
```

`schemaId` is required for strict structured output. Schemas are owned by the calling Alpha module or a shared contract package, not by a provider adapter.

## 7. Router Response Contract

```text
RouterResponseV1
  contractVersion: "1.0"
  requestId: string
  routingDecisionId: string
  status: DETERMINISTIC_SELECTED | AI_SELECTED | REJECTED | COMPLETED | FAILED

  selectedProvider?: SelectedProvider
  selectedModel?: SelectedModel
  deterministicHandlerId?: string

  routingReason: RoutingReason
  estimatedCost: CostEstimate
  estimatedLatency: LatencyEstimate
  confidence: RoutingConfidence
  fallbackChain: FallbackRoute[]
  auditMetadata: RoutingAuditMetadata

  execution?: ExecutionResultEnvelope
  rejection?: RoutingRejection
```

### 7.1 Response definitions

```text
SelectedProvider
  providerProfileId: string
  displayName: string
  adapterId: string
  profileVersion: string

SelectedModel
  modelProfileId: string
  providerModelReference: string
  profileVersion: string
  matchedCapabilities: CapabilityProfileId[]

RoutingReason
  summary: string
  reasonCodes: string[]
  satisfiedConstraints: string[]
  preferencePolicy: string

CostEstimate
  currency: string
  estimatedInputCost: decimal
  estimatedOutputCost: decimal
  estimatedFixedCost: decimal
  estimatedMaximumTotal: decimal
  pricingVersion: string
  estimationBasis: string

LatencyEstimate
  expectedMs: non-negative integer
  p95Ms: non-negative integer
  healthSnapshotAt: ISO-8601 timestamp

RoutingConfidence
  level: LOW | MEDIUM | HIGH
  score: integer from 0 to 100
  basis: string[]

FallbackRoute
  order: positive integer
  providerProfileId: string
  modelProfileId: string
  eligibleTriggers: FailureCode[]
  estimatedMaximumCost: decimal

RoutingAuditMetadata
  policyVersion: string
  taskCatalogVersion: string
  capabilityCatalogVersion: string
  providerRegistryVersion: string
  healthSnapshotId: string
  budgetSnapshotId: string
  candidateCountBeforeFiltering: integer
  eligibleCandidateCount: integer
  excludedCandidateReasonCounts: string-to-integer map
  deterministicGateResult: string
  decidedAt: ISO-8601 timestamp

ExecutionResultEnvelope
  attemptCount: integer
  finalProviderProfileId?: string
  finalModelProfileId?: string
  outputType?: string
  outputSchemaId?: string
  outputReference?: string
  inputTokens?: integer
  outputTokens?: integer
  actualCost?: decimal
  totalLatencyMs: integer
  success: boolean
  failureCode?: FailureCode

RoutingRejection
  code: string
  reason: string
  failedConstraints: string[]
  retryable: boolean
```

Routing confidence measures confidence that the selected route satisfies the routing requirements. It is not confidence in the model's answer, prediction, or financial outcome.

Provider and model fields are absent for deterministic and rejected outcomes. An application must never interpret a missing provider as an implicit default.

## 8. Task classification

Task definitions are configuration records in a versioned Task Catalog. Adding a provider never changes this catalog. Adding a genuinely new Alpha task may add a catalog record without introducing provider-specific business logic.

| Task type | Minimum capability | Typical reasoning | Control notes |
|---|---|---|---|
| `research` | `RESEARCH`, `LONG_CONTEXT` | High | Requires evidence separation, citations when applicable, and structured unknowns. |
| `market_analysis` | `RESEARCH`, `HIGH_REASONING` | High | Current-data tools may be required. Output is advisory and cannot perform risk calculations. |
| `prediction` | `HIGH_REASONING`, `LONG_CONTEXT` | High | Produces forecast support only. Deterministic systems own prediction status, freeze, and resolution. |
| `strategy` | `CRITICAL_DECISION`, `HIGH_REASONING` | Critical | May draft or compare strategy changes. Owner approval and Strategy Versioning remain mandatory. |
| `journal` | `FAST` or `LOW_COST` | Low | Summarizes source records; may not replace or rewrite them. |
| `summary` | `LOW_COST`; add `LONG_CONTEXT` when needed | Low or medium | Prefer deterministic extraction when the requested result is mechanical. |
| `coding` | `CODING`; add `HIGH_REASONING` for complex work | Medium or high | Must respect repository policy, tests, and human review. |
| `documentation` | `LONG_CONTEXT`; optionally `CODING` | Medium | Must preserve documented architecture and distinguish proposals from implemented behavior. |
| `translation` | `FAST`, `LOW_COST` | Low | Preserve meaning and required terminology; use deterministic lookup for fixed vocabularies. |
| `general_chat` | `FAST` | Low or medium | Must not be used to bypass a specialized Alpha task policy. |

Classification is explicit. The caller supplies `taskType`; the Router validates it against the caller module's permitted task types. The Router does not ask an AI model to classify its own routing request.

## 9. Capability profiles

Capability profiles describe requirements, not providers or models. Profiles may be composed. All requirements in the resolved composition must be met.

| Profile | Required characteristics |
|---|---|
| `FAST` | Meets the configured p95 latency ceiling and minimum reliability. |
| `LOW_COST` | Meets the configured maximum estimated unit cost while retaining task minimum quality and reliability. |
| `HIGH_REASONING` | Supports the required reasoning tier and structured reasoning task class. |
| `LONG_CONTEXT` | Has enough usable context for input, reserved output, system overhead, and safety margin. |
| `CODING` | Supports code generation/review, structured output where requested, and the configured coding reliability floor. |
| `VISION` | Accepts required image input and can return the requested output modality. |
| `RESEARCH` | Supports evidence-oriented research, required tools, citations or source references, and long-form structured output. |
| `CRITICAL_DECISION` | Meets the highest reliability floor, high reasoning, strict output validation, full audit, and critical-task policy. It remains advisory. |

Each profile resolves to versioned requirements such as supported modalities, feature flags, minimum reasoning tier, minimum observed reliability, maximum p95 latency, minimum context, tool requirements, and output constraints.

`LOW_COST` never means lowest price regardless of quality. It means the lowest-cost eligible route after all hard requirements pass.

## 10. Abstract provider profile

Provider configuration is registered outside business logic.

```text
ProviderProfileV1
  profileVersion: string
  providerProfileId: string
  name: string
  displayName: string
  adapterId: string
  enabled: boolean
  processingBoundary: LOCAL | EXTERNAL
  supportedRegions: string[]
  privacyCapabilities: PrivacyCapability
  models: ModelProfileV1[]
  reliability: ReliabilityProfile
  availability: AvailabilityProfile
  metadata?: string-to-scalar map

ModelProfileV1
  modelProfileId: string
  providerModelReference: string
  enabled: boolean
  capabilities: string[]
  supportedReasoningLevels: string[]
  supportedInputModalities: string[]
  supportedOutputTypes: string[]
  contextLimitTokens: positive integer
  maximumOutputTokens: positive integer
  visionSupport: boolean
  functionCallingSupport: boolean
  strictStructuredOutputSupport: boolean
  streamingSupport: boolean
  cost: ModelCostProfile
  reliability: ReliabilityProfile
  availability: AvailabilityProfile
  lifecycle: ACTIVE | DEPRECATED | DISABLED

ModelCostProfile
  currency: string
  inputPerMillionTokens: decimal
  outputPerMillionTokens: decimal
  cachedInputPerMillionTokens?: decimal
  fixedRequestCost?: decimal
  pricingVersion: string
  effectiveAt: ISO-8601 timestamp

ReliabilityProfile
  rollingSuccessRate: decimal from 0 to 1
  schemaComplianceRate?: decimal from 0 to 1
  sampleWindow: string
  observedAt: ISO-8601 timestamp

AvailabilityProfile
  status: AVAILABLE | DEGRADED | RATE_LIMITED | UNAVAILABLE | UNKNOWN
  p50LatencyMs?: integer
  p95LatencyMs?: integer
  observedAt: ISO-8601 timestamp

PrivacyCapability
  supportedPrivacyLevels: (PUBLIC | INTERNAL | SENSITIVE | LOCAL_ONLY)[]
  retentionModes: string[]
  trainingUseDisabled: boolean
  supportedProcessingRegions: string[]
```

Static profile data and dynamic observations must be distinguishable. Stale or missing health data is handled by policy; it must not silently be treated as healthy.

## 11. Provider adapter boundary

Every provider integration implements the same neutral responsibilities:

- Report adapter version and supported features.
- Translate a neutral execution request to provider transport.
- Apply configured credentials without exposing them to business modules or logs.
- Normalize provider usage, latency, status, errors, and outputs.
- Map provider errors to Router failure codes.
- Honor timeouts and cancellation.
- Avoid adding provider-specific meaning to Alpha contracts.

Adapters may not contain task classification, financial rules, routing priorities, budget policy, or Alpha approval rules.

## 12. Deterministic routing policy

### 12.1 Hard-constraint filtering order

Candidates are filtered in this order, and every exclusion is recorded:

1. Provider and model are enabled and not deprecated.
2. Availability status is allowed for the request priority.
3. Privacy level, external-processing permission, retention, and region requirements pass.
4. All resolved capability profiles pass.
5. Minimum reasoning level and required input/output modalities pass.
6. Function calling and strict-schema requirements pass.
7. Usable context is sufficient for estimated input, reserved output, Router overhead, and configured safety margin.
8. Reliability and schema-compliance floors pass.
9. Attempt timeout and any request deadline can be met using the configured latency policy.
10. Maximum estimated cost fits the request, daily, and monthly budgets or an authorized override.

If no candidate survives, the request is rejected with explicit failed constraints. The Router must not choose a nearly eligible model.

### 12.2 Deterministic candidate ordering

Candidate ranking is lexicographic and stable:

- `LOW_COST`: estimated maximum cost ascending, reliability descending, p95 latency ascending, provider profile ID ascending, model profile ID ascending.
- `HIGH` or `REALTIME` latency priority: p95 latency ascending, reliability descending, estimated maximum cost ascending, stable IDs ascending.
- `QUALITY_FIRST` or `CRITICAL`: reliability descending, schema compliance descending, capability fit descending, context headroom descending, estimated maximum cost ascending, stable IDs ascending.
- `BALANCED`: configured integer utility score descending, reliability descending, estimated maximum cost ascending, p95 latency ascending, stable IDs ascending.

The balanced utility formula and integer weights are versioned configuration. Inputs are normalized deterministically. A tie is always resolved by stable IDs. Random choice, round-robin selection, and hidden provider preference are prohibited.

Dynamic health or budget state can change the result, but the exact snapshots used must be recorded so the decision is reproducible.

## 13. Fallback strategy

The fallback chain is the remaining eligible candidate order calculated during routing. A new health snapshot may remove a failed or unavailable candidate, but fallback may not introduce a candidate that failed the original hard constraints unless the entire request is explicitly rerouted and audited under a new decision ID.

| Failure | Required behavior |
|---|---|
| Provider unavailable | Mark attempt failed, release unused reservation, choose next eligible provider/model. |
| Rate limit | Respect a bounded server retry delay when it fits the deadline; otherwise use the next eligible route. |
| Context too large | Try an eligible larger-context route. If `contextReductionAllowed` is true, use only a registered deterministic reducer and audit the resulting fingerprint; otherwise reject. |
| Timeout | Cancel the attempt. Retry the same route only when policy allows, the operation is idempotent, and the deadline remains feasible; otherwise fall back. |
| Model unavailable | Disable it for the health snapshot and select the next eligible route. |
| Budget exceeded before call | Try cheaper eligible routes. If none fit, use an authorized critical override or reject without calling a provider. |
| Actual cost threatens budget during streaming | Stop safely when supported and policy requires; record partial usage and fail or return a clearly marked partial result. |
| Invalid output/schema | Permit only the configured bounded repair retry, then use an eligible fallback or fail. Never pass invalid structured data to business logic. |
| Authentication/configuration error | Do not retry the same adapter blindly. Alert, record a configuration failure, and use another eligible provider if available. |
| Privacy/policy rejection | Terminal for that candidate. Never fall back to a less compliant route. |

Retry limits, backoff intervals, and maximum total attempts are deterministic policy values. Each attempt requires a distinct attempt ID. Retries and fallbacks remain linked to the original request and routing decision.

Capability, privacy, output schema, and critical reliability floors may never be downgraded automatically. A requested reasoning level may only be raised, not lowered, during fallback.

## 14. Cost governance

### 14.1 Budget hierarchy

The Cost Governor enforces all of the following:

1. Per-request maximum from the Router Request.
2. Daily Alpha AI budget.
3. Monthly Alpha AI budget.
4. Optional sub-budgets by module, task type, or environment.

The effective allowance is the smallest remaining applicable limit. Budgets use a configured currency, accounting timezone, reset rule, and policy version.

### 14.2 Reservation and reconciliation

- Estimate cost using input tokens, reserved output tokens, fixed request charges, and the selected pricing version.
- Reserve the maximum estimated cost atomically before invocation.
- Prevent concurrent requests from spending the same remaining budget.
- Record actual provider usage when available.
- Reconcile the reservation to actual cost after every attempt, including failed and partial attempts.
- Treat missing usage as the conservative configured estimate and flag it for review.
- Never use floating-point values for monetary enforcement; use decimal or integer minor units.

### 14.3 Daily and monthly enforcement

- Reject or choose a cheaper eligible route when the daily budget would be exceeded.
- Reject or choose a cheaper eligible route when the monthly budget would be exceeded.
- Emit configurable warning events before each limit is reached.
- A budget reset never alters historical ledger entries.

### 14.4 Critical-task override

A critical override is allowed only when:

- The task type and criticality are eligible under policy.
- A valid owner-approved authorization reference is supplied.
- The authorization has a maximum amount, scope, expiry, and permitted task types.
- The selected route still satisfies privacy, capability, reliability, and context constraints.
- Override usage is recorded separately and generates an owner-visible alert.

An override permits a bounded budget exception only. It never permits bypassing risk rules, owner approval, privacy policy, or deterministic business validation.

### 14.5 Low-cost mode

Low-cost mode selects the cheapest eligible route after hard constraints pass. It may also:

- Prefer registered deterministic handlers.
- Reduce optional output size through caller-approved limits.
- Use batch latency where the request permits it.
- Reject nonessential work when configured budget thresholds are reached.

Low-cost mode must not silently lower task capability, reasoning, reliability, privacy, or schema requirements.

## 15. Privacy and security policy

- `PUBLIC` data may use any otherwise eligible configured processing boundary.
- `INTERNAL` data may use only providers approved for internal data.
- `SENSITIVE` data requires approved retention, training-use, and region controls.
- `LOCAL_ONLY` data requires approved local processing and prohibits external processing.
- Secrets, credentials, raw private context, and model output are not stored in general audit metadata.
- Audit records use context fingerprints and secure content references instead of raw prompt content.
- Provider credentials are owned by the adapter runtime and secret store.
- Prompt-injection defenses and tool allowlists belong to execution policy; model instructions cannot expand tool or data access.

Privacy is a hard filter. Cost or availability never justifies a privacy downgrade.

## 16. Audit logging

The Router writes append-only, versioned audit events. Corrections are new linked events; historical decisions are not overwritten.

### 16.1 Required event types

- `REQUEST_RECEIVED`
- `REQUEST_VALIDATED`
- `REQUEST_REJECTED`
- `DETERMINISTIC_HANDLER_EVALUATED`
- `CANDIDATE_EXCLUDED`
- `ROUTE_SELECTED`
- `BUDGET_RESERVED`
- `ATTEMPT_STARTED`
- `ATTEMPT_SUCCEEDED`
- `ATTEMPT_FAILED`
- `RETRY_SCHEDULED`
- `FALLBACK_SELECTED`
- `OUTPUT_VALIDATED`
- `OUTPUT_REJECTED`
- `BUDGET_RECONCILED`
- `ROUTING_COMPLETED`
- `ROUTING_FAILED`
- `CRITICAL_OVERRIDE_USED`

### 16.2 Required audit fields

Every event records, when applicable:

- Event ID and event type
- Timestamp
- Request, correlation, parent, decision, and attempt IDs
- Task type and resolved capability profiles
- Requested reasoning, context size, latency priority, privacy, and output type
- Provider profile and model profile
- Policy, Task Catalog, capability catalog, registry, pricing, health, and budget versions
- Routing reason and reason codes
- Candidate exclusions without secret configuration values
- Estimated cost, reserved cost, actual cost, and currency
- Estimated and actual latency
- Success or failure
- Normalized failure code and safe failure detail
- Retry number, retry reason, and delay
- Fallback order and prior failed route
- Budget override reference and amount used
- Input/output token counts
- Output validation result and schema ID
- Context fingerprint and secure content reference
- Actor and calling module

Audit queries must be able to answer:

- Why was this provider and model selected?
- Which alternatives were rejected, and why?
- What did Alpha estimate, reserve, and actually spend?
- Did a retry, fallback, downgrade request, or override occur?
- Which policy and registry state produced the decision?
- Did execution succeed, fail, time out, or return invalid output?

## 17. Normalized failure codes

Provider adapters map provider-specific errors to stable Router codes:

```text
PROVIDER_UNAVAILABLE
RATE_LIMITED
MODEL_UNAVAILABLE
CONTEXT_LIMIT_EXCEEDED
TIMEOUT
AUTHENTICATION_FAILED
CONFIGURATION_INVALID
BUDGET_EXCEEDED
PRIVACY_POLICY_REJECTED
CAPABILITY_UNAVAILABLE
OUTPUT_INVALID
TOOL_EXECUTION_FAILED
CONTENT_POLICY_REJECTED
REQUEST_CANCELLED
UNKNOWN_PROVIDER_ERROR
```

Business modules depend only on these normalized codes, never on provider error types.

## 18. Configuration ownership

The Config System owns:

- Task Catalog
- Capability profile definitions
- Routing priority policies and balanced score weights
- Provider and model profiles
- Pricing records
- Reliability and latency thresholds
- Context safety margins
- Retry and fallback limits
- Privacy allowlists
- Daily, monthly, and module budgets
- Low-cost mode
- Critical override rules

Configuration changes are versioned, validated, reviewed, and auditable. Invalid configuration fails closed. No implicit provider or model is used when configuration is missing.

## 19. Future compatibility

Future providers and models are added by:

1. Implementing the neutral Provider Adapter interface.
2. Registering a versioned Provider Profile and model profiles.
3. Mapping provider capabilities and errors to Router capabilities and failure codes.
4. Passing adapter conformance, privacy, cost, fallback, and audit tests.
5. Enabling the profiles through reviewed configuration.

No Portfolio, Research, Opportunity, Prediction, Instrument Ranking, Risk, Decision, Trade, Learning, Journal, or Strategy module changes are required.

New model features are introduced as versioned capability identifiers. Older Router contract versions remain supported according to the compatibility policy. Provider model deprecation is handled through profile lifecycle and routing configuration, not business-code edits.

The initial implementation may use an in-process registry and one adapter, but it must preserve these boundaries so registries, budgets, health monitoring, and adapters can later move to separate services without changing business contracts.

## 20. Determinism and reproducibility

A routing decision is reproducible from:

- Router Request
- Task Catalog version
- Capability catalog version
- Routing policy version
- Provider Registry version
- Pricing version
- Health snapshot
- Budget snapshot
- Deterministic handler registry version

The Router records each identifier. Replaying the same inputs must produce the same ordered candidates and decision. Execution output from a generative model is not expected to be deterministic; the routing decision is.

## 21. Validation requirements for future implementation

Before the Router can be considered implemented, tests must demonstrate:

- Provider names never appear in business module routing rules.
- Identical snapshots produce identical selections and fallback chains.
- Deterministic handlers win when eligible.
- Every hard constraint excludes incompatible candidates.
- Stable tie-breaking works.
- Daily and monthly concurrent budget reservations cannot overspend.
- Critical overrides are bounded and fully audited.
- Low-cost mode never weakens hard requirements.
- Privacy cannot be downgraded during fallback.
- Context overflow, timeout, rate limit, unavailable provider/model, budget exhaustion, and invalid output follow the specified paths.
- All provider errors normalize correctly.
- All decisions and attempts produce complete audit events.
- A new conforming provider can be registered without modifying business logic.

## 22. Assumptions

- Alpha remains a decision-support system with owner-controlled execution.
- Deterministic Alpha modules retain ownership of calculations, validation, enforcement, records, and state transitions.
- Provider pricing and operational health are supplied through versioned configuration or trusted observations.
- Token counts before execution are estimates; budget enforcement therefore reserves a conservative maximum.
- A secure secret store and secure content store will exist outside general Router audit metadata.
- Initial implementation will target the current TypeScript deterministic architecture unless a separate architecture decision changes the language boundary.
- Concrete persistence contracts for the cost ledger and audit events will be designed before production use.

## 23. Recommended implementation sequence

1. Review and approve this specification.
2. Define TypeScript contracts for requests, responses, task profiles, provider profiles, failures, cost ledger entries, and audit events.
3. Define configuration schemas and validation without adding a provider SDK.
4. Implement and test the deterministic policy engine using fixture profiles.
5. Implement budget reservation and audit repositories.
6. Define adapter conformance tests.
7. Add the first provider adapter as a separate, replaceable integration.
8. Integrate one low-risk Alpha task before any critical decision-support task.

## 24. Deterministic planning engine boundary

The minimum AI Router Engine is a planning component. It validates a provider-neutral request and configuration, evaluates every registered provider/model candidate, records explicit rejection reasons, calculates configured cost estimates, applies deterministic ranking, and returns a primary route with an ordered fallback plan and audit record.

The engine ends after producing the routing decision. It does not call a model, invoke a provider adapter, retry a request, persist an audit record, or return generated model content. Provider adapters and execution orchestration remain separate future components.

Selection uses hard eligibility constraints first. Remaining candidates are ordered lexicographically by the configured cost mode and latency priority, followed by stable provider and model IDs. Provider display names never affect selection, and identical requests plus configuration, budget, and clock snapshots produce identical decisions.
