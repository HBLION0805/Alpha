# Options-Only MVP Phase 2 File-Level Plan (Planning Only)

## Authority, status, and objective

Phase 2 is `NOT_STARTED_OWNER_AUTHORIZATION_REQUIRED`. This document is a
reviewable proposal only. It creates no Phase 2 implementation authority,
runtime, fixture, test, provider call, persistence write, or trading authority.
Phase 1 approval does not authorize Phase 2.

The proposed Phase 2 objective is a fixture-only, deterministic Options Market
Context and Candle Analysis foundation. It would consume already-canonical and
explicitly qualified Bars, produce auditable numerical context, and reuse the
existing market-data, calendar/session, evidence, and Market Regime authorities.
It would not predict option returns or produce recommendations.

Phase 2 may answer factual questions about series integrity, session coverage,
ATR, realized volatility, volume context, and agreement or disagreement among
approved timeframes. It excludes option chains, implied volatility, Greeks,
contract or strategy selection, Decision Cards, position sizing, accounts,
orders, Paper Trading, and execution.

The only allowed status transition is:

```text
NOT_STARTED_OWNER_AUTHORIZATION_REQUIRED
  -> OWNER_AUTHORIZED_TO_IMPLEMENT
  -> IMPLEMENTED_AWAITING_OWNER_REVIEW
  -> OWNER_APPROVED
```

The shorter label `NOT_STARTED` may appear in human explanations, but the
machine authority remains `NOT_STARTED_OWNER_AUTHORIZATION_REQUIRED`. Passing
tests can move implementation only to `IMPLEMENTED_AWAITING_OWNER_REVIEW`; it
can never create `OWNER_APPROVED`. Only a later explicit Owner decision may do
that.

## Planning blockers closed by this revision

| Blocker | Planning correction |
| --- | --- |
| 1. Competing market facts and authorities | Adds the reuse matrix, removes the proposed Options trend authority, and assigns single-Bar, provider, calendar/session, broad-market fact, regime, Evidence, and audit truth to existing components |
| 2. Untrusted fixture/provider lineage | Adds existing Registry/Composition pre-authorization, immutable test-only source and exact provider-symbol mapping bindings, post-Canonical-Bar authorization, and fail-closed ordering before calculation or persistence |
| 3. Incoherent timeframe/session fixtures | Defines one QQQ identity across `P1D`/`PT1H`/`PT15M`/`PT5M`, one versioned calendar/session grid, strict intraday adjacency, holiday/early-close/DST golden vectors, and explicit missing-session/internal-gap rejection |
| 4. Ambiguous numerical analysis | Defines session-aware simple returns and true range, Wilder ATR state boundaries, fixed-policy sample realized volatility, same-slot volume context, immutable per-timeframe Regime bindings, fixed-decimal scaling, rounding, annualization, and overflow bounds; removes support/resistance |
| 5. Unresolved corporate actions | Requires versioned qualification evidence and rejects unknown/mixed adjustment state or any unresolved action without guessing or repair |
| 6. Dishonest lifecycle and delivery authority | Defines the four-state Owner-controlled lifecycle, batch development/review/cost estimates, continuous P2-A..P2-D implementation semantics, and separate Git publication gates |
| 7. Incomplete acceptance evidence | Requires the four-timeframe success output plus explicit session-boundary, symbol-mapping, same-slot-volume, Regime-binding, gap, stale, calendar, provenance, corporate-action, and disagreement outputs; every rejection has exact provenance/health/query/write counters and zero valid-context writes |

## Architecture reuse and single source of truth

Phase 2 must add composition, not parallel authorities.

| Existing authority | Reused responsibility | Phase 2 boundary | Forbidden duplicate |
| --- | --- | --- | --- |
| `CanonicalBar` contract plus `validateCanonicalBarInput`, `createCanonicalBar`, and `validateCanonicalBar` | Single-Bar instrument, interval, half-open boundaries, fixed-decimal OHLCV, OHLC relationships, lifecycle, session metadata, adjustment state, quality, timestamps, identity, fingerprint, and bounded provenance | Phase 2 accepts only successfully created immutable Canonical Bars and adds cross-Bar qualification | No second OHLC validator, Bar constructor, decimal parser, timestamp repairer, interval validator, or Bar identity algorithm |
| `MarketDataProviderRegistry` | Canonical provider identity, status, default eligibility, declared `BARS` capability, and supported asset classes | A test-only provider registration is supplied to the existing immutable Registry and bound through existing provider composition; no production provider is implied | No Options-specific or fixture-specific competing provider registry |
| `ImmutableMarketDataProviderComposition` | Registry-to-adapter provider ID, capability, asset-class, interval-descriptor, enabled-status, and duplicate-binding checks | Phase 2 adds an immutable fixture manifest binding for facts the Registry does not own: exact adapter version, instrument, interval, origin, calendar/session policy, adjustment policy, and provenance | No bypass of Registry or Composition based on an adapter's self-description |
| `VerifiedMarketSnapshot`, `VerifiedMarketCalendarSessionEvidence`, `latestCompletedTradingSession`, and existing validators | Fingerprinted session evidence, completed-session selection, holiday status, explicit open/close, closure buffer, freshness, canonical Bar references, request/resolution provenance, and exact evidence binding | Phase 2 references existing evidence IDs/fingerprints, binds the evidence set to a versioned policy manifest, and adds only series-grid qualification for longer histories | No second calendar authority, inferred session from UTC date, guessed holiday, or replacement freshness truth |
| Broad Market Evidence | Reviewed broad-market membership, deterministic benchmark features, cross-benchmark agreement/disagreement, drawdown, rebound, range, and bounded-volatility facts | The QQQ success fixture may be adapted through this existing boundary when broad-market composition is required | No duplicate broad-market trend, range, recovery, or volatility-proxy engine |
| `MarketRegimeEngine` and `MarketRegimeAssessment` | The only current market-environment authority: short/medium trend facts, drawdown, rebound, window range, maximum-adjacent-return volatility proxy, primary regime, secondary conditions, evidence strength, reasons, and unresolved requirements | A narrow adapter may construct a validated Regime snapshot from qualified QQQ timeframe evidence and preserve the resulting assessment unchanged | No `OptionsTrendStructureEngine`, no competing bull/bear/range/correction labels, and no reinterpretation of regime reasons |
| Existing Evidence/Journal and Unified Audit boundaries | Evidence references, immutable provenance, read-only projection, and audit ownership | Phase 2 emits Options-namespaced references and projections only after successful qualification | No new generic Evidence, Journal, or audit authority |

`OptionsTrendStructureEngine.ts` is removed from the proposed design. Trend,
range, drawdown, rebound, and the existing bounded-volatility proxy must come
from Market Regime or Broad Market Evidence. Phase 2 realized volatility is a
separate statistical measurement; it cannot emit `HIGH_VOLATILITY` or another
regime label. Support/resistance is excluded entirely. It may return only in a
future plan that defines and reviews one exact pivot algorithm and proves it
does not compete with existing authorities.

Phase 2 reuses only `VerifiedMarketCalendarSessionEvidence`,
`CanonicalBarReference`, and their existing relevant validators by default. It
must not construct a complete `VerifiedMarketSnapshot` unless the pipeline has
real inputs satisfying every quote, candidate, request-attempt, resolution, and
provenance contract that the snapshot requires. It is forbidden to fabricate
an unrelated quote, transport attempt, candidate, or resolution merely to make
a snapshot validate.

## Required data flow and fail-closed ordering

```text
Raw fixture
  -> strict fixture adapter / normalizer
  -> existing CanonicalBar creation and validation
  -> immutable source / Registry / Composition / fixture-binding authorization
  -> series-integrity qualification
  -> deterministic ATR / realized-volatility / volume features
  -> existing Market Regime adapter plus multi-timeframe context
  -> Evidence references / repository / health
```

Before a fixture is read, the future pipeline must pre-authorize the provider
through `MarketDataProviderRegistry.requireEnabledProvider`,
`requireCapability(..., BARS)`, `requireAssetClass(..., ETF)`, and
`ImmutableMarketDataProviderComposition`. The post-normalization authorization
step must then compare every Canonical Bar with the immutable binding. Adapter
or fixture claims are untrusted.

The pipeline must stage all outputs in memory. An unknown/disabled provider,
capability mismatch, adapter drift, instrument or interval drift, unapproved
session/calendar, adjustment mismatch, provenance mismatch, malformed Bar,
gap, stale series, or unresolved corporate action fails closed before feature
calculation and before any valid context or Evidence repository write. A
machine-readable rejection and health measurement may be returned, but it is
not a valid context record.

## Immutable fixture source binding

The future `OptionsBarFixtureBinding` is a deeply frozen test-only manifest,
not a provider registry. It must contain and fingerprint exactly:

- existing Registry policy ID/version, registered `providerId`, and a binding
  fingerprint computed from that immutable policy plus `listProviders(ALL)`;
- `BARS` capability and approved ETF asset class;
- adapter ID/version and adapter descriptor fingerprint;
- one Canonical Instrument ID and metadata version;
- exact raw `providerSymbol`, provider-symbol mapping policy ID/version, and
  mapping fingerprint;
- exact allowed intervals `P1D`, `PT1H`, `PT15M`, and `PT5M`;
- data origin `FIXTURE`;
- session-calendar ID/version/evidence-set fingerprint;
- session type `REGULAR`;
- one adjustment policy ID/version and one allowed adjustment state;
- fixture manifest ID/version, content digest, and bounded provenance reference;
- effective-from/effective-to timestamps.

The binding must reuse one test-only `MarketDataProviderMetadata` registration
inside `InMemoryMarketDataProviderRegistry` and one existing immutable provider
composition. It must not add a second registry or place fixture registrations
in production defaults. Provider, adapter, instrument, interval, session,
calendar, adjustment, data-origin, effective-period, manifest digest, or
provenance drift returns an explicit `SOURCE_OR_PROVENANCE_DRIFT` rejection.

The raw schema must require `providerSymbol` on every fixture Bar. Before
normalization, that exact value must resolve through the immutable binding to
one and only one Canonical Instrument ID and metadata version. The adapter may
not ignore, replace, normalize by an unbound alias, or independently interpret
the symbol. After normalization, authorization must compare both the raw-symbol
mapping tuple and the resulting Canonical Instrument against the binding. Any
missing, ambiguous, substituted, version-drifted, or fingerprint-drifted mapping
returns `SOURCE_OR_PROVENANCE_DRIFT` before feature calculation or persistence,
with `validContextWriteCount = 0`.

## Success fixture collection

The complete positive fixture set uses one reviewed Canonical QQQ instrument.
The manifest declares that identity once and binds its exact raw
`providerSymbol` through a versioned, fingerprinted one-to-one mapping. A raw
provider symbol is an authorized lookup input, never independent identity
authority.

| Proposed fixture | Required content |
| --- | --- |
| `fixtures/options-market-context/qqq-qualified/manifest.json` | One versioned source binding, exact `providerSymbol` plus mapping version/fingerprint to one Canonical Instrument identity, four content digests, Registry/adapter references, calendar evidence-set fingerprint, `REGULAR` session policy, and one `RAW` adjustment policy |
| `fixtures/options-market-context/qqq-qualified/session-calendar.json` | Versioned/fingerprinted session evidence covering the complete lookback, holidays, normal sessions, one early close, and DST-boundary examples |
| `fixtures/options-market-context/qqq-qualified/corporate-action-qualification.json` | Versioned evidence that the fixture window contains no unresolved corporate action and that `RAW` is consistent across all four series |
| `fixtures/options-market-context/qqq-qualified/p1d.json` | Sufficient consecutive completed Regular-session daily Bars for all configured windows |
| `fixtures/options-market-context/qqq-qualified/pt1h.json` | Six exact full one-hour windows per full Regular session and three for a 13:00 early close, anchored at market open; the terminal 30 minutes are an explicit versioned grid exclusion, not an inferred or missing Bar |
| `fixtures/options-market-context/qqq-qualified/pt15m.json` | All 26 Regular-session windows per full session, adjusted deterministically for early-close evidence |
| `fixtures/options-market-context/qqq-qualified/pt5m.json` | All 78 Regular-session windows per full session, adjusted deterministically for early-close evidence |

All four series must use the same Canonical Instrument ID and metadata version,
the same calendar/session policy version, the same adjustment policy/state, the
same Registry-authorized provider and adapter version, and provenance covered
by the manifest digest. Cross-symbol or cross-instrument assembly is rejected.

## Session-calendar qualification

Phase 2 MVP supports only:

- `P1D` completed Regular sessions;
- Regular-session `PT1H`, `PT15M`, and `PT5M` Bars;
- `America/New_York` exchange-local calendar evidence represented by canonical
  UTC instants.

Premarket, postmarket, `EXTENDED`, `COMBINED`, and `CONTINUOUS` sessions are
not implemented. A versioned series policy must define the exact expected grid
for each interval. `P1D` requires one Bar spanning the evidence-defined Regular
open/close. `PT15M` and `PT5M` must tile the entire evidence-defined session.
`PT1H` accepts the six full one-hour windows beginning at Regular open on a
full session and the three full windows on a 13:00 early close; the reviewed
policy explicitly excludes the terminal 30-minute residual and must never
synthesize a shortened `PT1H` Bar.

Required deterministic calendar tests include:

- a full holiday closure with no expected Bars;
- an early close whose P1D end and intraday grid match evidence exactly;
- the spring and autumn DST changes, preserving 09:30 local open while UTC
  instants change;
- a missing expected trading-session evidence record;
- an internal missing or duplicate Bar inside an otherwise valid session;
- a Bar assigned to the wrong session date, calendar version, or timezone.

No weekend/holiday/session is inferred. Missing evidence, a missing session,
an internal gap, a non-grid boundary, overlap, duplicate timestamp, or calendar
drift is rejected. No Bar is guessed, resampled, shortened, filled, or repaired.

## Corporate-action and adjustment policy

Every accepted series must have one non-`UNKNOWN` `BarAdjustmentState`, and all
four timeframes must share it. The qualification evidence must bind its own
policy/version, Canonical Instrument ID/version, covered UTC window, reviewed
corporate-action source reference, evidence fingerprint, known events, and
resolution state.

Any `UNKNOWN` state, mixed adjustment states, a policy/evidence mismatch, or a
series crossing an unresolved split, dividend, symbol change, merger, or other
corporate action returns `UNRESOLVED_CORPORATE_ACTION`. Alpha must not guess an
adjustment, transform prices or volume, splice series, back-adjust, fill, or
repair. A provider claim without the versioned qualification evidence is
insufficient.

## Numerical algorithms

All numerical work uses `BigInt` over Canonical Bar fixed decimals. It never
uses binary floating-point prices, implicit coercion, hidden defaults, AI, or
silent repair.

### Cross-session pairing and state boundaries

Pair qualification is interval-specific and precedes every return or true-range
calculation:

- `P1D` may pair the current completed Regular-session Bar with the immediately
  preceding completed Regular-session Bar established by the same versioned
  calendar evidence. Weekends and holidays create no synthetic Bar; the prior
  completed session close is nevertheless the qualified `P1D` previous close.
- An intraday adjacent pair is qualified only when both Bars have the same
  Canonical Instrument ID/version, interval, `sessionDate`, calendar ID/version,
  and `previous.intervalEnd === current.intervalStart`. No pair may cross a
  Regular-session boundary.
- The first accepted intraday Bar of every session has
  `TR = high - low` and produces no close-to-close return.
- Wilder ATR state may continue from the last reviewed state under the same
  policy/version, interval, instrument, adjustment, and qualified-series
  lineage. Even when state continues, the first Bar's TR in a new intraday
  session must not reference the preceding session's close.
- RV window `N` counts qualified returns, not Bars or elapsed periods. An
  overnight boundary, holiday, early-close gap, DST transition, or the excluded
  terminal 30-minute `PT1H` residual produces no `PT1H`/`PT15M`/`PT5M` return.

Golden vectors must cover a normal close to the next Regular session, a 13:00
early close to the next Regular session, and both DST boundary directions. Each
vector must prove the permitted `P1D` previous-close pair, the absence of an
intraday cross-session return, the new-session `high - low` TR, the unchanged
fixed annualization policy, and the exact qualified-return count.

### Return type

- Existing Market Regime owns first-to-last short/medium directional returns
  and their basis-point trend/range facts; Phase 2 consumes those values.
- Phase 2 realized volatility uses close-to-close **simple arithmetic returns**,
  not logarithmic returns: `r_t = (C_t - C_(t-1)) / C_(t-1)`.
- The formula is evaluated only for a qualified pair under the cross-session
  rules above. In particular, an intraday session's first Bar emits no return.
- Each internal return is stored as signed parts per billion:
  `returnPpb = truncTowardZero((C_t - C_(t-1)) * 1_000_000_000 / C_(t-1))`.
- Zero or negative prior close, insufficient history, or an unsafe result is a
  rejection. No annualized return, forecast return, or expected return exists.

### True range and ATR

After decimal-scale alignment:

- first Bar, and every first intraday Bar in a new session:
  `TR_0 = high_0 - low_0`;
- a later Bar with a qualified previous-close pair:
  `TR_t = max(high_t - low_t, abs(high_t - close_(t-1)),
  abs(low_t - close_(t-1)))`;
- policy supplies integer `atrWindowN >= 2`;
- Wilder seed: `ATR_(N-1) = floor(sum(TR_0..TR_(N-1)) / N)`;
- recurrence: `ATR_t = floor((ATR_(t-1) * (N - 1) + TR_t) / N)`.

ATR is returned as a non-negative fixed decimal in the instrument currency,
with the common aligned input scale and calculation version `WILDER_ATR_V1`.
It is descriptive range evidence, not support/resistance or a trading limit.
Any carried Wilder state must include and match its state fingerprint, policy
version, instrument, interval, adjustment state, last qualified Bar, and last
session. A mismatch rejects the calculation; state continuity never authorizes
an intraday prior-session close in TR.

### Realized volatility

The policy supplies an integer return window `N >= 2` and requires exactly `N`
qualified returns. More than `N + 1` accepted intraday Bars may be needed
because each session boundary emits no return. Using the `returnPpb` values:

- `meanPpb = truncTowardZero(sum(r_i) / N)`;
- sample variance: `variancePpbSquared = floor(sum((r_i - meanPpb)^2) /
  (N - 1))`;
- annualized standard deviation:
  `annualizedVolatilityPpb = integerSqrtFloor(variancePpbSquared * periodsPerYear)`.

The versioned fixed policy `REGULAR_SESSION_FIXED_PERIODS_V1` defines
annualization factors `252` for `P1D`, `1512` for `PT1H`, `6552` for `PT15M`,
and `19656` for `PT5M`. These are policy constants, not values inferred from a
particular fixture or session. A holiday, early close, DST transition, or
excluded `PT1H` residual changes the available qualified-return count but never
silently changes the factor. The output binds the policy ID/version and factor,
preserves PPB, and includes a derived non-negative basis-point display value
`floor(annualizedVolatilityPpb / 100_000)`. The calculation is
`SAMPLE_SIMPLE_RETURN_RV_V1`; no volatility forecast, implied volatility, or
`HIGH_VOLATILITY` classification is produced.

### Volume context

Volume must already be Canonical `BASE_UNITS`, non-negative,
`PROVIDER_REPORTED`, and accepted under one source/adjustment policy. All
volumes are aligned to one decimal scale with exact `BigInt` powers of ten
before any sum or division. For a policy window `N >= 2`, the baseline excludes
the current Bar:

- `P1D` uses the preceding `N` qualified completed trading sessions;
- intraday uses the same interval and exact versioned session-grid slot from
  the preceding `N` comparable completed Regular sessions. It must not mix an
  opening slot with a midday slot or substitute a different slot after an early
  close;
- fewer than `N` qualified `P1D` sessions or same-slot intraday observations
  returns `INSUFFICIENT_VOLUME_BASELINE`;
- `baselineVolumeAtomic = floor(sum(the N aligned comparable volumes) / N)`;
- `relativeVolumeBps = floor(currentVolume * 10_000 /
  baselineVolumeAtomic)`;
- zero baseline returns `INSUFFICIENT_VOLUME_BASELINE`;
- policy thresholds must be safe integers satisfying
  `0 <= lowRelativeVolumeBps < highRelativeVolumeBps`;
- `relativeVolumeBps <= lowRelativeVolumeBps` returns `BELOW_BASELINE`;
- `relativeVolumeBps >= highRelativeVolumeBps` returns `ABOVE_BASELINE`;
- every other ratio returns `WITHIN_BASELINE`.

The output includes the exact aligned baseline, ratio, grid-slot ID, comparable
session IDs, and volume-policy ID/version/fingerprint.

This is volume context only. It cannot emit accumulation or distribution;
those Market Regime conditions continue to require verified volume semantics
and breadth evidence.

### Market Regime timeframe binding

Every reused `MarketRegimeAssessment` must be wrapped only by an external,
deeply immutable Phase 2 reference binding containing:

- the exact interval;
- the `qualifiedSeriesFingerprint`;
- `RegimeInputSnapshot` ID and fingerprint;
- `MarketRegimeAssessment` ID;
- Market Regime policy ID/version and `ruleSetVersion`.

The binding is authorization and provenance, not a new assessment. Every field
must match the existing input and assessment before multi-timeframe composition;
any mismatch returns `TIMEFRAME_REGIME_BINDING_DRIFT` and writes no valid
context. `P1D`, `PT1H`, `PT15M`, and `PT5M` assessments remain four independent
facts. Phase 2 must not vote, average, merge, relabel, or create a composite
Market Regime authority from them.

### Precision, rounding, and overflow

- Canonical input scale remains `0..18`; Phase 2 never changes it.
- Decimal alignment uses powers of ten and `BigInt` only.
- Accepted aligned input atomic magnitude is at most `2^255 - 1`.
- Every multiplication, squared deviation, and accumulated numerator must have
  absolute magnitude at most `2^511 - 1`.
- Integer division truncates toward zero; all non-negative means, Wilder steps,
  variances, ratios, and integer square roots therefore floor.
- Integer outputs exposed as JavaScript `number` must fit
  `Number.MAX_SAFE_INTEGER`; otherwise the operation fails with
  `NUMERIC_OVERFLOW` and writes no context record.
- No automatic rounding to cents, scale reduction, saturation, infinity,
  `NaN`, epsilon comparison, or scientific-notation parsing is allowed.

## Proposed implementation batches and file responsibilities

All paths are proposals. None is created or modified by this planning pass.

### P2-A — Contracts, policy, specification, and authority reuse

| Proposed path | Change | Responsibility |
| --- | --- | --- |
| `src/contracts/OptionsMarketContext.ts` | Add | Versioned qualified-series references, deterministic feature envelopes, multi-timeframe result, rejection envelope, provenance, and status contracts |
| `src/contracts/OptionsCandlePolicy.ts` | Add | Versioned allowed intervals, Regular-session grids, cross-session pair rules, history windows, freshness, numeric bounds, ATR/RV/volume policies, fixed annualization factors, calendar, and corporate-action requirements |
| `src/contracts/OptionsBarFixtureBinding.ts` | Add | Immutable test-only binding to existing Registry/Composition, adapter, exact provider-symbol mapping, instrument, interval, origin, calendar, adjustment, manifest digest, and provenance |
| `src/contracts/OptionsCandleRepository.ts` | Add | Port for valid fixture context records and replay-safe queries; rejection envelopes are not valid context records |
| `src/contracts/index.ts` | Modify | Export reviewed contracts only |
| `docs/specifications/OPTIONS_MARKET_CONTEXT_AND_CANDLE_ANALYSIS.md` | Add | Normative reuse, pipeline, numerical, calendar, adjustment, evidence, failure, and non-trading specification |
| `src/engines/options-market-context/OptionsMarketContextContracts.test.ts` | Add | Exact-field, policy, lifecycle, authority, numeric-boundary, and no-competing-authority tests |

P2-A must import the existing Canonical Bar types and validators. It must not
create `OptionsCandleValidation.ts` for single-Bar facts.

### P2-B — Fixture authorization and series integrity

| Proposed path | Change | Responsibility |
| --- | --- | --- |
| `fixtures/options-market-context/qqq-qualified/*` | Add | The manifest, calendar, corporate-action evidence, and four same-instrument success series listed above |
| `fixtures/options-market-context/rejections/*` | Add | Gap, stale, calendar drift, provider-symbol/source/provenance drift, Regime-binding drift, and unresolved-action inputs |
| `src/integration/options-market-context/OptionsBarFixtureSchemas.ts` | Add | Exact raw fixture schemas, including mandatory raw `providerSymbol`, that cannot enter domain contracts directly |
| `src/integration/options-market-context/FixtureOptionsBarAdapter.ts` | Add | Strict fixture-only normalizer that resolves the bound raw symbol and implements the existing Bar adapter port; no alias inference, HTTP, credentials, fallback, or persistence |
| `src/engines/options-market-context/OptionsBarSourceAuthorization.ts` | Add | Snapshot existing Registry/Composition and enforce the immutable fixture and provider-symbol mapping bindings before and after normalization and before computation/persistence |
| `src/engines/options-market-context/OptionsCandleSeriesIntegrityEngine.ts` | Add | Cross-Bar instrument, interval-grid, session-local adjacency, ordering, gap, duplicate, freshness, session-calendar, adjustment, corporate-action, and provenance qualification only |
| `src/integration/options-market-context/OptionsBarFixtures.test.ts` | Add | Strict normalization plus Registry, adapter, raw-symbol mapping, source, interval, calendar, adjustment, and provenance drift tests |
| `src/engines/options-market-context/OptionsCandleSeriesIntegrityEngine.test.ts` | Add | Normal/early-close/DST boundary golden vectors plus holiday, missing-session, internal-gap, stale, mixed-adjustment, and unresolved-action tests |

### P2-C — Deterministic features and context composition

| Proposed path | Change | Responsibility |
| --- | --- | --- |
| `src/engines/options-market-context/OptionsTechnicalFeatureEngine.ts` | Add | Only the reviewed session-aware Wilder ATR, qualified simple-return realized volatility, and P1D/same-slot volume-context algorithms with fixed-decimal provenance |
| `src/engines/options-market-context/OptionsMarketRegimeInputAdapter.ts` | Add | Narrow QQQ adapter from qualified Bar evidence to an existing validated `RegimeInputSnapshot`, plus the immutable interval/series/input/assessment/policy binding; no regime rules |
| `src/engines/options-market-context/OptionsMultiTimeframeContextEngine.ts` | Add | Bind four independent timeframe features and existing Market Regime assessments while preserving disagreement, missing, stale, rejected, and binding-drift states |
| `src/engines/options-market-context/OptionsMarketContextPipeline.ts` | Add | Enforce the reviewed stage order and all-or-nothing valid-context write boundary |
| `src/engines/options-market-context/OptionsTechnicalFeatureEngine.test.ts` | Add | Normal/early-close/DST golden vectors, session-first TR, no intraday boundary return, qualified-return RV, same-slot volume, thresholds, insufficient history, rounding, and overflow tests |
| `src/engines/options-market-context/OptionsMarketRegimeInputAdapter.test.ts` | Add | Exact interval/series/input/assessment/policy binding, drift rejection, and proof that existing Market Regime remains authoritative |
| `src/engines/options-market-context/OptionsMultiTimeframeContextEngine.test.ts` | Add | Four-timeframe agreement/disagreement, independent assessment bindings, ordering, stale/missing inputs, and no-voting/no-averaging tests |

There is no proposed `OptionsTrendStructureEngine`, pivot engine, or
support/resistance output.

### P2-D — Repository, evidence, health, governance, and acceptance

| Proposed path | Change | Responsibility |
| --- | --- | --- |
| `src/repositories/InMemoryOptionsMarketContextRepository.ts` | Add | Idempotent in-memory valid-context records and deterministic queries only |
| `src/repositories/OptionsMarketContextEvidenceAdapter.ts` | Add | Read-only `OPTIONS_MARKET_CONTEXT` projection into existing Evidence/Journal vocabulary |
| `src/repositories/index.ts` | Modify | Export reviewed repository/projection only |
| `src/engines/options-market-context/OptionsMarketContextHealth.ts` | Add | Fixture identity, Registry/binding status, calendar/freshness, qualification stage, feature latency, zero cost, and rejection telemetry |
| `src/engines/options-market-context/OptionsMarketContextEndToEnd.test.ts` | Add | Machine-readable success and all required rejection demonstrations |
| `scripts/alpha-validate.mjs` | Modify | Register the specification and focused tests only after implementation authorization |
| `package.json` | Modify | Add deterministic test commands with no dependency changes |
| `docs/status/current.json` and `docs/status/current.schema.json` | Modify | Record only the state actually reached; never infer Owner approval from tests |
| `scripts/validate-current-status.mjs` and `.test.mjs` | Modify | Enforce lifecycle, fixture-only authority, and later-phase prohibitions |
| `README.md`, `docs/ARCHITECTURE.md`, `docs/ROADMAP.md`, `docs/HANDOFF.md`, `docs/DECISIONS.md`, `docs/CHANGELOG.md` | Modify | Reconcile delivered state only after observed implementation evidence exists |

No durable database, migration, production repository, retention policy, or
runtime-data write is proposed.

## Batch estimates

| Batch | Development estimate | Owner review estimate | External service cost | Fixture runtime cost |
| --- | ---: | ---: | ---: | ---: |
| P2-A | 1.5-2.5 focused engineering days | 0.5-1 Owner day | `$0` | `$0` |
| P2-B | 2-3 focused engineering days | 0.5-1 Owner day | `$0` | `$0` |
| P2-C | 3-5 focused engineering days | 1-1.5 Owner days | `$0` | `$0` |
| P2-D | 2-3 focused engineering days | 0.5-1 Owner day | `$0` | `$0` |
| Total | 8.5-13.5 focused engineering days | 2.5-4.5 Owner days | `$0` | `$0` |

Estimates assume the existing locked toolchain, no dependency change, no live
provider, and no corporate-action service purchase. Any external data cost or
runtime cost above `$0` is outside this plan and requires separate Owner
authorization. The existing combined News + Options Data `$80/$100` policy is
a limit, not spending authority.

## Test plan and end-to-end acceptance outputs

Focused implementation tests must cover contracts, strict raw schemas,
existing Canonical Bar validation reuse, Registry/Composition binding,
provider-symbol mapping, calendar/session evidence, cross-session boundaries,
series integrity, corporate actions, every numeric algorithm, same-slot volume,
per-timeframe Regime binding, evidence lineage, replay, query, health, and
negative scope.

The machine-readable end-to-end suite must emit:

1. `QQQ_FOUR_TIMEFRAME_CONTEXT_ACCEPTED`: one Canonical Instrument, `P1D`,
   `PT1H`, `PT15M`, and `PT5M`, one Registry/adapter binding, one calendar and
   adjustment policy, qualified series, features, existing regime references,
   preserved multi-timeframe facts, evidence links, query result, and health;
2. `GAPPED_SERIES_REJECTED`: an internal expected-grid gap and zero valid
   context writes;
3. `STALE_SERIES_REJECTED`: recomputed freshness exceeds policy and zero valid
   context writes;
4. `SESSION_CALENDAR_DRIFT_REJECTED`: calendar/session/version/grid drift and
   zero valid context writes;
5. `SOURCE_PROVENANCE_DRIFT_REJECTED`: Registry, adapter, origin, manifest, or
   provenance drift and zero valid context writes;
6. `UNRESOLVED_CORPORATE_ACTION_REJECTED`: unknown/mixed/unresolved adjustment
   evidence and zero valid context writes;
7. `MULTI_TIMEFRAME_DISAGREEMENT_PRESERVED`: every accepted timeframe remains
   individually visible; no majority vote, averaging, forced consensus, or
   replacement regime is created;
8. `INTRADAY_SESSION_BOUNDARY_NOT_BRIDGED`: normal-close, early-close, and DST
   vectors produce no intraday cross-session return, use `high - low` for the
   new session's first TR, preserve the reviewed Wilder state boundary, and
   have zero valid context writes if any boundary is bridged;
9. `PROVIDER_SYMBOL_MAPPING_DRIFT_REJECTED`: a missing, substituted, ambiguous,
   version-drifted, or fingerprint-drifted raw provider-symbol mapping returns
   `SOURCE_OR_PROVENANCE_DRIFT` and zero valid context writes;
10. `VOLUME_SAME_SLOT_BASELINE_VERIFIED`: `P1D` uses prior qualified sessions,
    intraday uses the same interval/grid slot across prior comparable completed
    sessions, scales are aligned before summing, and exact boundary categories
    and baseline provenance are emitted;
11. `TIMEFRAME_REGIME_BINDING_DRIFT_REJECTED`: interval, qualified-series,
    Regime input, assessment, policy, or rule-set mismatch is rejected with
    zero valid context writes and cannot create a composite regime.

Each output must expose input manifest/binding fingerprints, Canonical Bar IDs
and fingerprints, calendar and corporate-action evidence, qualification
result, feature calculation versions, existing Market Regime references when
applicable, repository write count, query result, latency/freshness, health,
and side-effect counters. Every rejected scenario must have
`validContextWriteCount = 0`.

Implementation acceptance additionally requires strict TypeScript typecheck,
all focused suites, current-status tests and validator, D3B frozen-governance
validation, `git diff --check`, credential/network/dependency/runtime-data
scans, and complete `alpha:validate` with the actually observed totals.

## Implementation authorization and delivery checkpoints

A future explicit Phase 2 implementation authorization may direct continuous
execution of P2-A through P2-D. The plan display after preflight is an
informational checkpoint and does not require a second implementation approval
unless the discovered architecture forces a material scope change.

Continuous implementation authority does not include Git publication. Staging
for review, commit, push, PR creation, Ready-for-review conversion, and merge
remain separate Owner decisions. Tests passing does not grant any of them and
does not advance the status to `OWNER_APPROVED`.

## Explicit exclusions and hard stops

Stop immediately if future implementation would require:

- live network access, credentials, paid data, a dependency/lockfile change,
  or a provider not authorized by the existing Registry;
- raw or unauthorized data entering calculations or valid persistence;
- a second Canonical Bar validator, provider registry, calendar authority,
  Market Regime authority, Evidence authority, or Journal authority;
- guessing, filling, shortening, resampling, repairing, or back-adjusting Bars;
- an unresolved corporate action or mixed/unknown adjustment state;
- premarket, postmarket, Extended, Combined, or Continuous sessions;
- production persistence, an irreversible migration, or user runtime-data
  writes;
- changes to the frozen ETF Daily Scan or Event Contract product entries;
- option chains, implied volatility, Greeks, contract/strategy selection,
  Decision Cards, alerts, recommendations, sizing, Portfolio mutation,
  Robinhood/account/position access, orders, Paper Trading, or execution;
- AI calculation, classification, repair, validation, or authority decisions;
- a status claim beyond evidence and explicit Owner authorization.

Phase 2 remains `NOT_STARTED_OWNER_AUTHORIZATION_REQUIRED` until a separate
Owner task explicitly authorizes implementation.
