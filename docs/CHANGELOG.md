# Alpha Changelog

## 2026-07-18

### Added

- Added AI Router v1 provider-neutral request, response, provider, model, configuration, budget, fallback, error, and audit contracts.
- Added deterministic validation for Router requests, registries, costs, budgets, decisions, and audit records.
- Added the deterministic AI Router planning engine with explicit eligibility, cost estimation, budget checks, critical overrides, stable ranking, fallback planning, normalized failures, and in-memory audit generation.
- Added focused AI Router contract and engine tests and an aggregate TypeScript test command.
- Added provider-neutral AI Cost Governor request, policy, usage, decision, reservation, ledger, audit, and normalized error contracts.
- Added deterministic integer-minor-unit enforcement for per-request, daily, monthly, task-category, provider, and model scopes, including soft thresholds and bounded critical overrides.
- Added a Router-to-governor cost mapping boundary and 32 focused governor tests.
- Added the AI Cost Governor specification and aligned architecture, roadmap, decisions, and handoff documentation.
- Added provider-neutral AI Provider Adapter execution, health, capability, usage, timeout, cancellation, response, audit, and normalized-error contracts.
- Added deterministic adapter validation, compatibility evaluation, and an in-memory registry with stable ordering and duplicate-provider rejection.
- Added 28 focused adapter boundary tests using a network-free, test-local neutral fixture.
- Added the AI Provider Adapter specification and aligned architecture, roadmap, decisions, and handoff documentation.
- Added provider-neutral AI Execution Coordinator request, result, policy, plan, attempt, retry/fallback, settlement, audit, and normalized-error contracts.
- Added deterministic single-attempt coordination across Router, Cost Governor, reservation, adapter registry, health, execution response, retry planning, and settlement instructions.
- Added 34 focused coordinator tests covering preconditions, execution, failures, malformed responses, deterministic planning, audit completeness, and immutability.
- Added the AI Execution Coordinator specification and aligned the provider-independent execution architecture documentation.
- Added provider-neutral AI Reservation Manager contracts for lifecycle operations, idempotency, optimistic versions, ledger instructions, audits, policies, and normalized errors.
- Added deterministic acquire, full/partial commit, release, expiration, cancellation, and rejection behavior with safe integer amount conservation.
- Added a defensive in-memory reservation repository with duplicate-create protection, compare-and-set updates, stable queries, and replayable operation history.
- Added focused Reservation Manager tests and its specification, and aligned the Cost Governor and Coordinator persistence boundaries.
- Added provider-neutral AI Cost Ledger entry, append, query, balance, usage-summary, reconciliation, policy, error, audit, repository, and checkpoint contracts.
- Added deterministic append, idempotency, monotonic sequence, currency-separated query/summary, unresolved-reservation, manual-adjustment, and reconciliation behavior.
- Added defensive in-memory and append-only local NDJSON repositories with strict canonical reload validation, flush-on-append behavior, corruption detection, and traversal-resistant ledger IDs.
- Added Reservation Manager instruction translation, 48 focused Cost Ledger tests, runtime-data Git exclusion, and the Cost Ledger specification.
- Added provider-neutral Unified Audit Repository contracts for normalized records, privacy, retention, idempotency, trace reconstruction, integrity checks, owner approval, export, and operation audits.
- Added deterministic append policy enforcement, stable compound queries, trace reconstruction, read-only integrity inspection, privacy-aware snapshot export, and pure translations for current Router, Cost Governor, Reservation, Execution, and Cost Ledger audits.
- Added defensive in-memory and canonical append-only local NDJSON audit repositories with monotonic sequence assignment, flush-on-append durability, strict corruption detection, and traversal-resistant store IDs.
- Added 61 focused Unified Audit Repository tests, runtime audit-data Git exclusion, aggregate test exposure, and the Unified Audit Repository specification.
- Added provider-neutral AI Runtime Workflow contracts, strict validation, normalized stages, statuses, errors, retry dispositions, compensation results, and immutable configuration boundaries.
- Added deterministic end-to-end orchestration for routing, bounded low-cost rerouting, cost governance, reservation acquisition, ledger appends, required audit evidence, single-adapter execution, settlement, reconciliation, final audit, and trace acceptance.
- Added an idempotent in-memory workflow result repository so exact replay cannot repeat adapter execution, reservation transitions, ledger entries, or audit appends.
- Added 46 focused AI Runtime Workflow tests and its specification, and exposed the suite through the aggregate TypeScript command.
- Normalized Router composite registry identity for Unified Audit compatibility and permitted the valid Cost Ledger-to-Reservation transition used by partial commit plus release traces.

### Boundaries

- No provider SDK, credentials, HTTP client, external AI call, production provider adapter, production database, live provider usage ingestion, live retry loop, health polling, or Python business-logic change was added.

## 2026-07-16

### Changed

- Completed the Alpha architecture consistency review.
- Clarified ownership boundaries across research, opportunity scoring, prediction, instrument ranking, risk, decision, outcome tracking, learning, and strategy versioning.
- Moved prediction finalization and freeze before the final capital decision and execution.
- Clarified that execution remains external and owner-controlled.
- Aligned README, Architecture, Roadmap, and Handoff with the current project state.
- Corrected stale references that described established architecture systems as future systems.
- Added missing cross-system integrations and handoffs.
- Recorded that no application behavior or source code changed.
