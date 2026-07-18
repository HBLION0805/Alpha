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

### Boundaries

- No provider SDK, credentials, HTTP client, external AI call, provider adapter, persistence, live usage ingestion, or Python business-logic change was added.

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
