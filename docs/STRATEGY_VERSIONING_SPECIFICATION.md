# Strategy Versioning Foundation Specification v1.0

Status: Implemented foundation; owner-approved and committed
Date: 2026-07-18

## 1. Problem, Value, Cost, and Timing

Alpha needs one authoritative record of strategy definitions, exact immutable versions, why they changed, what evidence supported them, how they were validated, who approved them, and when they were eligible for use. Silent edits destroy attribution and let hindsight alter the rules that governed earlier predictions, decisions, and trade plans.

The foundation creates deterministic local strategy governance at moderate implementation cost and low single-owner operating cost. It uses provider-neutral TypeScript contracts and canonical local NDJSON without a database, network service, provider SDK, market feed, or new package.

It belongs after Prediction Log, Alpha Journal, and Research Lab because those systems now provide immutable evidence for owner-reviewed changes. Strategy learning occurs after outcomes and review—not during execution.

## 2. Core Principles

1. Every material change creates a new immutable Strategy Version.
2. Strategy Definitions provide stable identity; versions provide exact rules and parameters.
3. Validation and owner approval are separate append-only evidence.
4. AI may propose a version but cannot approve or activate it.
5. Only an approved, validated, effective, active version is eligible for a new plan.
6. Existing plans retain their frozen strategy version and parameter snapshot.
7. Rollback creates a new version; it never rewrites or directly reactivates history.
8. Prediction quality and trading profitability remain separate version-level metrics.
9. A profitable completed trade is final evidence and is never reopened because of regret or FOMO.

## 3. Non-Goals

This task does not implement live trading, broker integration, portfolio mutation, active trade-plan mutation, automatic strategy optimization, AI approval/activation, performance ingestion, full backtesting, Learning Loop automation, production persistence, encryption, signing, multi-writer coordination, or D5-T5.

## 4. Architecture and Authority

```text
Research / Prediction / Journal / Decision / Risk / Trade evidence
  -> immutable Strategy Version proposal
  -> validation evidence
  -> owner approval
  -> deterministic activation eligibility
  -> future Decision/Trade Plan freezes exact active version
  -> later outcomes and review
  -> new proposal, retirement, or rollback version
```

Strategy Versioning owns strategy identity, version lineage, governance status, and activation history. Research Lab remains research truth, Prediction Log prediction truth, Alpha Journal context and learning truth, Unified Audit trace truth, Risk Engine hard-constraint authority, and future Trade Outcome Log execution/outcome truth.

## 5. Definition and Version Model

`StrategyDefinition` is stable purpose identity: deterministic definition ID, title, category, owner, scope, objective, privacy/retention, tags, trace/correlation IDs, policy versions, and metadata.

`StrategyVersion` belongs to exactly one definition and freezes schema/semantic version, rules, parameters, constraints, assumptions, risks, invalidation conditions, expected behavior, applicable markets/assets/capital stage, minimum-data requirements, evidence references, previous/superseded/rollback references, structured change set and reason, author, effective time, privacy/retention, policies, trace/correlation IDs, metadata, and append-only lifecycle history.

Definitions and versions use content-derived IDs. No update, overwrite, or delete operation exists.

## 6. Categories

V1 supports capital allocation, portfolio risk, stock/ETF selection, event contracts, entry, exit, take profit, stop loss, position sizing, cash reserve, rebalancing, catalyst, earnings, sector rotation, relative strength, macro regime, research, prediction, AI routing, AI cost control, and system validation. Strategies need not reference a ticker or asset.

## 7. Semantic Versioning

Versions use strict `MAJOR.MINOR.PATCH` non-negative integers without prefixes or leading zeroes. The first version is `1.0.0`. Every later version directly references the previous version in the same definition and increases monotonically without duplicating a semantic version.

- PATCH: documentation clarification, correction, or non-behavioral evidence/metadata change.
- MINOR: backward-compatible optional rule/parameter/scope enhancement.
- MAJOR: changed or removed behavior, entry/exit logic, risk boundary, position sizing, allocation logic, incompatible parameter meaning, or materially different thesis.

Every change declares semantic impact. Structural validation prevents documentation-only changes from claiming MINOR/MAJOR, prevents rule removal or risk-boundary changes from claiming less than MAJOR, and requires the semantic increment to equal the maximum declared impact.

## 8. Lifecycle, Validation, and Approval

```text
DRAFT (workspace only) -> PROPOSED -> VALIDATING
VALIDATING -> APPROVED -> ACTIVE -> SUSPENDED -> RETIRED -> ARCHIVED
VALIDATING -> REJECTED -> ARCHIVED
APPROVED -> RETIRED
ACTIVE -> RETIRED
```

The first authoritative event is proposal. Validation start is a lifecycle event. At least one immutable passed validation is required before approval. Validation does not imply approval. Approval must be an immutable owner record; an AI/system approver is rejected. Approval does not imply profitability.

Activation requires APPROVED status, passed validation, non-expired owner approval, and an effective timestamp that has arrived. V1 permits one active version per definition and rejects a second activation until the prior active version is suspended or retired. Suspension prohibits new-plan eligibility. Retirement prevents new use and preserves all references and performance attribution. Rejected and archived versions remain retrievable.

## 9. Changes and Evidence

Every noninitial version includes a structured change set: stable change ID, field/rule reference, previous and new canonical values, change type, semantic impact, reason, evidence references, expected effect, introduced risk, reversibility, and owner note. Material changes require a non-empty reason and at least one evidence reference.

Typed resolved/unresolved references cover Research, Prediction, Journal, Decision, Risk, Trade, Unified Audit, validation, future Backtest, and future Event Replay. Resolved references freeze version/status. Source records remain authoritative and are never copied wholesale or mutated.

## 10. Activation, Suspension, and Retirement

Activation, suspension, and retirement are immutable records coupled to lifecycle events. Suspension records whether existing plans may continue while prohibiting new plans by default. Retirement may identify a successor and preserves frozen plan/performance references. V1 requires explicit suspension or retirement before activating another version; it performs no hidden compound transition.

## 11. Trade-Plan Freeze Boundary

A pure eligibility/freeze operation for future trade plans returns definition ID, version ID, semantic version, ruleset fingerprint, exact parameter snapshot, risk-policy reference, decision timestamp, and owner-approval reference. It succeeds only for an effective ACTIVE version.

Later strategy versions, suspension, retirement, or rollback cannot mutate this snapshot. Existing plans may continue only under their predeclared policy and exceptional conditions. No trade-plan repository or execution is implemented.

## 12. Performance Attribution

Immutable performance summaries are scoped to one version and preserve period, completeness, sample size, source references, and three separate metric groups:

- Prediction: direction, calibration, outcome, and horizon accuracy.
- Trading: realized return, win rate, gains/losses, expectancy, drawdown, risk-adjusted return, and execution quality.
- Process: rule adherence, plan deviation, review completion, evidence quality, and sample size.

Missing values remain absent and are never invented. Versions are never silently combined. Profitability never proves prediction accuracy, and prediction accuracy never proves profitability.

## 13. Comparison and Rollback

Deterministic comparison is allowed only within one definition. It reports added, removed, and changed canonical paths; behavioral/risk classifications; evidence, validation, and performance differences; and stable ordering.

Rollback means proposing a new semantic version that references both the current lineage parent and the previously trusted version, explicitly copies selected rules/parameters, explains failure, and repeats validation and owner approval. Old versions are not directly reactivated or modified.

## 14. Repository and Persistence

The repository appends definitions, versions/change sets, validation start/results, approvals/rejections, activations, suspensions, retirements, performance summaries, and archive events. It retrieves definitions/versions/history/current active version, queries filters, lists lineage, and exposes deterministic event order. There is no update, overwrite, or delete.

In-memory and canonical local NDJSON implementations use monotonic repository sequence, canonical FNV fingerprints, idempotent replay, conflicting-duplicate rejection, defensive copies, strict reconstruction, newline/fsync append, and traversal-safe paths. Runtime data belongs beneath `data/runtime/strategy-versioning/` and remains Git-ignored.

Local storage is unencrypted, single-owner, single-process development persistence—not a production database or transaction boundary. FNV identity/fingerprints are deterministic evidence references, not cryptographic signatures.

## 15. Query, Statistics, and Export

Filters cover definition/category/status, market/asset/capital stage, Research/Prediction/Journal reference, tags, date range, trace/correlation ID, and active-only state. Pagination follows repository sequence. Statistics count definitions/categories, versions/status, active/approved/rejected/suspended/retired versions, validation completion, semantic change classes, linked evidence, versions per definition, and performance sample sizes.

Deterministic JSON/NDJSON export includes complete filtered histories. `LOCAL_ONLY` external export is prohibited and sensitive export requires configured authorization. No AI summarization exists.

## 16. Unified Audit and Integration Boundaries

A pure translation maps definition creation, proposal, validation, approval, activation, suspension, retirement, rejection, comparison, rollback, archive, export, and validation rejection to Unified Audit `STRATEGY_VERSION` records from `STRATEGY_VERSIONING`. It preserves definition/version/semantic identity, status, owner approval, policies, trace/correlation, reason/evidence references, privacy, and retention without recursive persistence.

Prediction records keep frozen strategy references; Journal records rationale and candidates but cannot activate; Research supersession cannot rewrite versions; Decision may later use only active eligible versions; Risk policy references are frozen and no Strategy Version bypasses Risk Engine constraints.

## 17. Known Limitations

- References are structurally validated but not resolved transactionally across repositories.
- Local compound lifecycle/evidence writes are not production crash-safe transactions.
- No automatic prior-version retirement, parallel experiment mode, direct reactivation, or production rollback orchestration exists.
- No live performance ingestion, backtesting engine, Learning Loop, optimizer, broker, market feed, encryption, signing, backup, or multi-writer coordination exists.
