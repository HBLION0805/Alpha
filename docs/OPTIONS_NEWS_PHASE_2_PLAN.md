# Options-Only MVP Phase 2 File-Level Plan (Planning Only)

## Status and objective

Phase 2 is `NOT_STARTED`. Neither Phase 1 implementation nor Phase 1 Owner
approval authorizes any Phase 2 work.

The proposed Phase 2 objective is a fixture-only, deterministic Options Market
Context and Candle Analysis foundation. It would transform already-canonical,
explicitly qualified Bars into auditable market-context evidence without
predicting option returns or producing trade recommendations. It would reuse
the existing Canonical Bar, Market Regime, Evidence, Journal, repository, and
validation foundations without reopening the frozen ETF Daily Scan product
entry.

Phase 2 would answer only factual context questions such as data continuity,
session coverage, returns, ranges, realized volatility, trend structure, and
multi-timeframe agreement. Option chains, Greeks, contract selection,
strategies, Decision Cards, positions, accounts, and execution remain later,
separately authorized concerns.

## Proposed implementation batches and files

All paths below are proposals. None of these files is created or modified by
Phase 1.

### P2-A — Contracts, policies, and validation

| Proposed path | Change | Responsibility |
| --- | --- | --- |
| `src/contracts/OptionsMarketContext.ts` | Add | Versioned market-context result, timeframe, session, freshness, completeness, and evidence-reference contracts. |
| `src/contracts/OptionsCandleAnalysis.ts` | Add | Deterministic candle-feature inputs/outputs, calculation provenance, insufficient-data states, and fail-closed reason codes. |
| `src/contracts/OptionsCandlePolicy.ts` | Add | Versioned minimum-history, allowed timeframe, session-calendar, gap, corporate-action, and staleness policies. |
| `src/contracts/OptionsCandleRepository.ts` | Add | Read/write port for fixture analysis records, evidence links, and replay-safe query results. |
| `src/contracts/index.ts` | Modify | Export only the reviewed Phase 2 contracts. |
| `src/engines/options-market-context/OptionsCandleValidation.ts` | Add | Strict exact-field, timestamp, interval, numeric-boundary, provenance, and policy validation. |
| `docs/specifications/OPTIONS_MARKET_CONTEXT_AND_CANDLE_ANALYSIS.md` | Add | Normative domain, calculation, failure, timezone, evidence, and non-trading specification. |

P2-A acceptance requires strict rejection of unknown fields, invalid OHLC
relationships, non-finite values, duplicate timestamps, unsupported intervals,
future Bars, missing provenance, and policy drift.

### P2-B — Fixture source and data-integrity qualification

| Proposed path | Change | Responsibility |
| --- | --- | --- |
| `fixtures/options-market-context/qqq-daily-qualified.json` | Add | Deterministic qualified daily-Bar success fixture. |
| `fixtures/options-market-context/nvda-intraday-qualified.json` | Add | Deterministic intraday/session and DST fixture. |
| `fixtures/options-market-context/gapped-series.json` | Add | Missing-session and internal-gap rejection fixture. |
| `fixtures/options-market-context/corporate-action-unresolved.json` | Add | Split/dividend adjustment uncertainty rejection fixture. |
| `src/integration/options-market-context/FixtureOptionsBarSource.ts` | Add | Fixture-only source behind a provider-independent Bar-source port; no HTTP or credentials. |
| `src/integration/options-market-context/OptionsBarFixtureSchemas.ts` | Add | Exact raw fixture schemas isolated from domain contracts. |
| `src/engines/options-market-context/OptionsCandleIntegrityEngine.ts` | Add | Validate ordering, interval continuity, session/calendar coverage, adjustment state, and canonical provenance. |
| `src/integration/options-market-context/OptionsBarFixtures.test.ts` | Add | Fixture-schema, normalization, DST, gap, and corporate-action boundary tests. |

P2-B must reuse `CanonicalBar`; it must not add a live market-data adapter or
claim that fixture behavior proves provider semantics, real freshness, or SLA.

### P2-C — Deterministic features and multi-timeframe context

| Proposed path | Change | Responsibility |
| --- | --- | --- |
| `src/engines/options-market-context/OptionsTechnicalFeatureEngine.ts` | Add | Pure calculations for returns, true range/ATR, realized volatility, volume context, and versioned feature provenance. |
| `src/engines/options-market-context/OptionsTrendStructureEngine.ts` | Add | Deterministic higher-high/lower-low, moving-window trend, range, and support/resistance evidence without prediction language. |
| `src/engines/options-market-context/OptionsMultiTimeframeContextEngine.ts` | Add | Combine approved timeframe evidence while preserving disagreement, missing-data, and stale states. |
| `src/engines/options-market-context/OptionsMarketContextPipeline.ts` | Add | Orchestrate validation, integrity, features, context, evidence links, and repository writes in replay-safe order. |
| `src/engines/options-market-context/OptionsTechnicalFeatureEngine.test.ts` | Add | Golden-vector, numeric-boundary, insufficient-history, and deterministic replay tests. |
| `src/engines/options-market-context/OptionsTrendStructureEngine.test.ts` | Add | Trend/range ambiguity, flat-market, gap, and no-prediction tests. |
| `src/engines/options-market-context/OptionsMultiTimeframeContextEngine.test.ts` | Add | Agreement, disagreement, missing timeframe, stale input, and ordering tests. |

All calculations must use deterministic software. No LLM may calculate,
classify, repair, or override candle facts. A context label is evidence, not a
directional forecast or trading instruction.

### P2-D — Persistence, evidence projection, telemetry, and acceptance

| Proposed path | Change | Responsibility |
| --- | --- | --- |
| `src/repositories/InMemoryOptionsMarketContextRepository.ts` | Add | Deterministic idempotent repository for fixture context records and replay. |
| `src/repositories/OptionsMarketContextEvidenceAdapter.ts` | Add | Controlled, read-only projection into existing Evidence/Journal vocabulary without changing legacy semantics. |
| `src/repositories/index.ts` | Modify | Export the reviewed repository and projection only. |
| `src/engines/options-market-context/OptionsMarketContextHealth.ts` | Add | Machine-readable fixture source, freshness, calculation, persistence, and failure telemetry. |
| `src/engines/options-market-context/OptionsMarketContextEndToEnd.test.ts` | Add | Qualified success plus missing/gapped/stale/corporate-action rejection demonstrations. |
| `scripts/alpha-validate.mjs` | Modify | Register Phase 2 specification and focused tests after implementation approval. |
| `package.json` | Modify | Add deterministic test commands only; no dependency changes anticipated. |
| `docs/status/current.json` | Modify | Record Phase 2 implementation state only after its acceptance gates actually pass. |
| `docs/status/current.schema.json` | Modify | Add exact machine-readable Phase 2 status and authority boundaries. |
| `scripts/validate-current-status.mjs` | Modify | Enforce Phase 2 state without weakening Phase 0/1 or frozen-lane history. |
| `scripts/validate-current-status.test.mjs` | Modify | Prevent Phase 2 fixture evidence from masquerading as live or trading authority. |
| `README.md` | Modify | Summarize the reviewed Phase 2 state. |
| `docs/ARCHITECTURE.md` | Modify | Describe the market-context boundary and reuse relationships. |
| `docs/ROADMAP.md` | Modify | Move the Options-Only milestone only after implementation evidence exists. |
| `docs/HANDOFF.md` | Modify | Record exact completion, validation, limitations, and next Owner gate. |
| `docs/DECISIONS.md` | Modify | Record calculation, authority, and reuse decisions. |
| `docs/CHANGELOG.md` | Modify | Record the delivered Phase 2 scope without implying later capabilities. |

No production repository or migration is proposed for this batch. Any durable
schema, external database, retention policy, or migration would require a
separate design and Owner approval.

## Test plan

Phase 2 implementation would require:

- contract and exact-schema tests;
- property/golden-vector tests for every numerical calculation;
- OHLC, timestamp, timezone, DST, market-session, gap, duplicate, and ordering
  tests;
- minimum-history, staleness, missing-timeframe, inconsistent-timeframe, and
  corporate-action fail-closed tests;
- fingerprint, idempotency, query, replay, evidence-lineage, and projection
  tests;
- negative-scope tests proving absence of option chain, Greeks, strategy,
  recommendation, broker, account, order, and execution language or ports;
- successful and rejected machine-readable end-to-end fixture demonstrations;
- strict TypeScript typecheck, focused tests, `git diff --check`, credential,
  network, dependency, runtime-data, and full `alpha:validate` gates.

## Acceptance criteria

Phase 2 may be submitted for Owner review only when all of the following hold:

1. Canonical Bars remain the sole price-series input contract.
2. Every output binds input Bar identities, policy/calculation versions,
   timestamps, and evidence provenance.
3. Invalid, stale, incomplete, ambiguous, gapped, or adjustment-uncertain data
   fails closed with a deterministic reason code.
4. Repeated identical input produces stable fingerprints and no duplicate
   context record.
5. Multi-timeframe disagreement is preserved rather than averaged away.
6. All feature calculations match reviewed golden vectors and reject non-finite
   or insufficient inputs.
7. End-to-end success and rejection fixtures expose evidence, query,
   persistence, latency/freshness, and health outputs.
8. All focused and complete validation passes with actual observed totals.
9. Machine status remains honest about fixture-only evidence and later-phase
   prohibitions.
10. No live network, credential read, real cost, production persistence,
    account, broker, order, Paper Trading, or execution side effect occurs.

## Permissions, cost, and hard stops

Expected development dependencies: none beyond the existing locked toolchain.
Expected fixture runtime cost: `$0`. The existing News + Options Data
`$80/$100` budget policy grants no spending authority and cannot authorize a
provider subscription or call.

Phase 2 requires a new Owner task before any proposed file is created. Stop
immediately if implementation would require:

- real network access, credentials, a paid provider, or dependency/lockfile
  change;
- unqualified or provider-raw Bars entering domain calculations;
- guessing missing Bars, silently repairing timestamps, or ignoring corporate
  actions;
- a production database, irreversible migration, or user runtime-data write;
- changing frozen ETF Daily Scan or Event Contract product behavior;
- option-chain, implied-volatility, Greeks, contract/strategy selection,
  Decision Card, sizing, broker, account, position, order, Paper Trading, or
  execution behavior;
- an LLM making deterministic calculations or authority decisions;
- status claiming `IMPLEMENTED`, `OWNER_APPROVED`, live readiness, SLA, or
  trading authority without corresponding evidence and approval.

Phase 1 evidence must never be interpreted as authorization for this plan.
