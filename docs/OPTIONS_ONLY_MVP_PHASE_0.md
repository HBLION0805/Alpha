# Alpha Options-Only MVP Phase 0

Status: OWNER_APPROVED (Phase 0-R1 correction)
Date: 2026-08-08
Authority: Owner-approved product governance; no trading or network authority

## 1. Current Product Direction

Alpha's current early product is an Options-Only decision-support MVP. The
system may eventually research options on approved ETFs and equities, but it
does not trade stocks, ETFs, Event Contracts, or options. Phase 0 changes
governance and contracts only; Phase 1 is `NOT_STARTED`. The only next action
is `OWNER_AUTHORIZATION_REQUIRED_TO_START_OPTIONS_PHASE_1`.

`productDirection.phase1Status = NOT_STARTED` is the only current Options
Phase 1 state. Frozen Daily Scan/Alpaca delivery history is retained only under
`frozenDailyScanAlpacaHistoricalDelivery` in the machine-readable status; it
does not describe the current product phase.

The permanent mission remains to protect, allocate, grow, and compound
capital. Options are a bounded early tool for growing operating capital, not
the destination. Long-term ownership of quality assets and non-leveraged
compounding remain the destination. Alpha promises no fixed return, daily
return, or capital-doubling schedule. `NO_TRADE` and cash are valid outcomes.

The Personal ETF Daily Scan and Event Contract product entries are frozen.
Their code and historical evidence remain in the repository for audit and
potential reuse; they must not be deleted, expanded, or treated as current
Owner product entries without a new decision.

## 2. Phase Boundary

Phase 0 includes only governance convergence, machine-readable status, risk
policy authority, module disposition, and the Phase 1 file-level plan.

Phase 0 does not implement news ingestion, candle analysis, option chains,
Greeks, strategy selection, Decision Card business logic, notifications,
broker integration, Paper Trading, orders, or execution. Phase 1 remains
`NOT_STARTED` until a separate Owner approval.

## 3. Risk Authority and Policy Layering

Risk meanings are separated by product domain:

1. `options-only-mvp-risk-policy-1.0` is the current Owner-approved Options
   product policy. It is recorded and authoritative for future Options design,
   but no runtime enforcement is implemented in Phase 0.
2. `phase0-owner-record-2026-07-29` remains the frozen legacy ETF/Event policy
   record. Its `$8`, `$5`, `$20`, `$40`, and `$80` values are not reinterpreted
   as Options limits.
3. `config/risk_config.py` and `app/risk_engine.py` remain Python research and
   compatibility calculations. They are not product approval authority.
4. A future deterministic TypeScript Options Risk Authority must implement the
   current Options policy in a separately reviewed phase. Until then, no
   component can claim an Options candidate is approved for trading.

### 3.1 Options Risk Policy v1.0

- `riskUnit = ACTUAL_USD`.
- `contractMultiplier = 100` for a standard contract.
- Normal mode maximum actual loss per trade: `$25.00`.
- `EVENT_MODE` maximum actual loss per trade: `$12.50`.
- Daily maximum realized loss: `$50.00`.
- Weekly maximum realized loss: `$100.00`.
- Cumulative drawdown hard pause: `$80.00`.
- The cumulative `$80` hard pause has priority over the weekly `$100` limit,
  does not reset automatically, and requires explicit Owner review and restart.
- Maximum loss must include contract quantity, premium or net debit, the
  standard multiplier, fees, regulatory charges, and configured slippage.
- Related open positions, remaining open-position loss, daily loss, weekly
  loss, and cumulative drawdown must be included by the future authority.
- If maximum actual loss cannot be proven, the required result is
  `NO_TRADE / MAX_LOSS_NOT_PROVEN`.
- If no qualified structure fits the budget, the result is
  `NO_TRADE / RISK_BUDGET_INSUFFICIENT`.

Only `OPERATING_CAPITAL` may be used by a future Options authority.
`LONG_TERM_COMPOUNDING_CAPITAL` and `CASH_RESERVE` cannot be automatically
migrated. The initial canonical underlying universe is `QQQ`, `SMH`, `SOXX`,
`GLD`, `TLT`, `NVDA`, `MSFT`, `AAPL`, `AMZN`, and `TSLA`, with a maximum of
15. An addition requires option-liquidity, news-coverage, candle-data, and
risk-classification evidence. Correlated candidates are not independent
diversification: same-direction `QQQ`, `SMH`, `SOXX`, and `NVDA` must be
displayed and gated as concentration.

`EVENT_MODE` covers earnings, FOMC, CPI, PPI, nonfarm payrolls, GDP, major
regulatory events, and major geopolitical events. At most one Event Mode
position may be open at a time.

### 3.2 Strategy, Expiry, and Order Boundaries

Allowed MVP strategies:

- Long Call
- Long Put
- Bull Call Debit Spread
- Bear Put Debit Spread

Prohibited structures include naked short options, credit strategies,
margin-dependent strategies, unlimited-risk structures, short straddles or
strangles, ratio spreads, calendars, diagonals, iron condors, automatic loss
rolls, averaging down, Martingale, and revenge trading.

Zero-DTE and one-DTE contracts are prohibited. The planned tactical range is
14-45 DTE and the planned macro range is 45-120 DTE. These ranges are policy
inputs for later implementation, not evidence that a candidate is qualified.
Only limit orders are permitted in the future manual workflow.

### 3.3 Owner and Robinhood Boundary

Alpha provides advice only. The Owner makes the final decision and manually
enters any order in Robinhood or Robinhood Legend outside Alpha. Alpha must not
read Robinhood accounts, balances, buying power, positions, or credentials. It
must not place, modify, cancel, roll, or exercise orders, connect to Paper
Trading, or display a Robinhood execution control.

## 4. Existing Module Disposition

| Module | Disposition | Phase 0 rationale |
| --- | --- | --- |
| Portfolio | REUSE | Preserve capital-state references; later Options work may consume only explicit `OPERATING_CAPITAL`. |
| Dashboard product capability | REUSE | Preserve presentation, review, and owner-control responsibilities; a future Options Dashboard requires a separately reviewed adapter and is not implemented in Phase 0. |
| Legacy Python sample terminal and Offline Daily Scan interfaces | RETIRE_LATER | Phase 0 audit confirmed that the Python terminal hard-codes Cash/Stocks/Event views and the Daily Scan interface belongs to the frozen ETF lane; preserve both until a reviewed replacement exists. |
| Decision Engine | REUSE | Keep deterministic coordination patterns; Options Decision Card logic is not implemented. |
| Config | REUSE | Preserve existing values by domain; future Options configuration must be versioned separately. |
| Risk Engine | REUSE | Preserve prototypes and gates; future TypeScript Options Risk Authority is separate. |
| Alpaca market-data components | KEEP | Retain audited provider work; the Daily Scan live/product path is frozen. |
| Canonical Bars/Quotes | REUSE | Provider-neutral time, quality, provenance, and fixed-decimal contracts are reusable. |
| Evidence | REUSE | Provenance, sufficiency, contradiction, and fail-closed gates are core Options infrastructure. |
| Market Regime | REUSE | Deterministic market-context foundations may feed later trend work through reviewed adapters. |
| Capital Allocation | REUSE | Preserve capital buckets and downstream review envelopes; no Options sizing is added. |
| Journal | REUSE | Reuse append-only decision and outcome context with Options-specific contracts later. |
| Prediction Log | REUSE | Reuse immutable forecast and review boundaries; no probability claim is added. |
| Strategy Versioning | REUSE | Reuse immutable policy and strategy lineage for later Options strategies. |
| ETF Daily Scan | FREEZE | Freeze the product entry and further expansion; retain code and evidence. |
| Event Contract | FREEZE | Freeze product entry, runner expansion, and live operation; retain research evidence. |
| Research/Backtesting foundations | REUSE | Reuse leakage prevention, temporal split, replay, and calibration foundations. |

`KEEP` means preserve without current product expansion. `REUSE` means a later
Options phase may consume the foundation behind a new reviewed contract.
`FREEZE` means no current product entry or feature expansion. `RETIRE_LATER`
means preserve now and remove only after a separately approved migration.
`RETIRE_LATER` applies only to the audited legacy interfaces, not to Dashboard
as a product capability. The future Options Dashboard must adapt reviewed
Options contracts and risk outcomes without owning decision or risk logic;
that adapter is outside Phase 0 and is not implemented here.

## 4.1 Migration and Gap Map

| Existing capability | Reusable foundation | Options gap | Planned phase | Current authority |
| --- | --- | --- | --- | --- |
| Portfolio/capital buckets | Capital references and explicit buckets | Only `OPERATING_CAPITAL` may later be eligible; no migration or sizing | Later risk/capital phase | Phase 0 policy record; not runtime-enforced |
| Dashboard capability / legacy interfaces | Presentation and Owner review capability | Options adapter and views are absent; only Python/Offline Daily Scan interfaces are `RETIRE_LATER` | Later Dashboard phase | `REUSE` capability; no adapter implemented |
| Decision Engine | Deterministic coordination patterns | No Options Decision Card or strategy selection | Later decision phase | `REUSE` only |
| Risk Engine | Prototype gates and fail-closed patterns | No TypeScript Options Risk Authority | Later risk phase | Policy recorded; runtime absent |
| Canonical Bars/Quotes | Time, quality, provenance, fixed-decimal contracts | No Options/candle qualification pipeline | Later market-data phase | `REUSE` only |
| Evidence | Provenance, sufficiency, contradiction gates | News source registry, entity linking, verification | Phase 1 planning | `REUSE`; Phase 1 not started |
| Market Regime | Deterministic context foundation | No Options trend conclusion | Later analysis phase | `REUSE` only |
| Journal / Prediction Log | Append-only review lineage | No Options decision/outcome contract | Later learning phase | `REUSE` only |
| Strategy Versioning | Immutable policy lineage | No Options strategy version or selection | Later strategy phase | `REUSE` only |
| Alpaca market-data components | Audited provider boundaries | Frozen Daily Scan product path is not an Options feed | Retain; future reviewed adapter only | `KEEP`; D3B next action frozen |
| ETF Daily Scan | Historical code and evidence | Not a current product entry | Frozen | `FREEZE`; code retained |
| Event Contract lane | Historical research and runner evidence | Not a current product entry | Frozen | `FREEZE`; code retained |

## 5. Phase 1 File-Level Plan: News Infrastructure Only

Phase 1 is planning-only in this document. The files below are proposed, not
created or modified by Phase 0.

### 5.1 Proposed New Files

| File | Responsibility |
| --- | --- |
| `docs/specifications/OPTIONS_NEWS_INFRASTRUCTURE.md` | Canonical news, verification, provenance, latency, budget, failure, privacy, and authority specification. |
| `src/contracts/NewsEvent.ts` | Provider-neutral canonical news event, source, entity, timestamp, language, URL, headline, and lifecycle contracts. |
| `src/contracts/NewsEvidence.ts` | Verification evidence, source independence, contradiction, retraction, expiry, and provenance contracts. |
| `src/contracts/NewsProvider.ts` | Provider capability, tier, health, cost, and normalized acquisition-result contracts. |
| `src/contracts/NewsSourceRegistry.ts` | Canonical source identity, tier, original/syndication lineage, independence group, eligibility state, and versioned registry provenance. |
| `src/contracts/NewsEntityResolution.ts` | Entity/company/ticker identities, aliases, ambiguity/collision results, point-in-time ticker mapping, and fail-closed unknown entity outcome. |
| `src/engines/news-normalization/NewsNormalizationEngine.ts` | Strict normalization of timestamps, URLs, headline text, language tags, and entity references. |
| `src/engines/news-source-registry/NewsSourceRegistryEngine.ts` | Resolve source identity, source tier, lineage, independence, trust, and eligibility without treating syndication as independent. |
| `src/engines/news-entity-linking/NewsEntityLinkingEngine.ts` | Independently resolve entities, aliases, collisions, ambiguity, and point-in-time ticker links; unknown entities fail closed. |
| `src/engines/news-contract-validation/NewsContractValidationEngine.ts` | Reject unknown fields and validate canonical contracts at adapter/domain boundaries before domain use. |
| `src/engines/news-deduplication/NewsDeduplicationEngine.ts` | Canonical fingerprinting, syndication lineage, cluster membership, and duplicate classification. |
| `src/engines/news-verification/NewsVerificationEngine.ts` | Exactly three valid paths: Tier 0 primary evidence; two independent consistent qualified sources; or a high-reputation source with successful accessible-primary-document cross-check. Preserve citation and checked facts. |
| `src/engines/news-freshness/NewsFreshnessEngine.ts` | Latency measurement, freshness, expiry, `UNMEASURED`, and `SLA_NOT_MET` states. |
| `src/engines/news-budget/NewsBudgetCircuitBreaker.ts` | Deterministic monthly actual/forecast cost and hard budget breaker. |
| `src/integration/news/NewsProviderAdapter.ts` | Provider abstraction; raw provider schemas never enter domain contracts. |
| `src/integration/news/official/OfficialNewsFixtureAdapter.ts` | Fixture-only Tier 0 adapter boundary for official sources. |
| `src/integration/news/tier1/Tier1NewsFixtureAdapter.ts` | Fixture-only benchmark boundary for replaceable free or paid Tier 1 providers. |
| `fixtures/news/` | Small, licensed/sanitized fixtures for duplicates, contradictions, retractions, outages, languages, and timestamps. |

Each engine and adapter file requires a colocated deterministic `.test.ts`
suite following existing repository conventions. Repository persistence is not
part of Phase 1 unless a separate specification approves it.

### 5.2 Proposed Modified Files

| File | Responsibility |
| --- | --- |
| `src/contracts/index.ts` | Export reviewed provider-neutral news contracts only. |
| `src/engines/index.ts` | Export reviewed deterministic news engines only. |
| `package.json` | Register individually callable news-focused tests; add no dependency. |
| `scripts/alpha-validate.mjs` | Register the new deterministic suites and retain network/credential scans. |
| `README.md` | Record Phase 1 implementation status only after it actually begins. |
| `docs/ARCHITECTURE.md` | Add the approved news authority and dependency direction. |
| `docs/ROADMAP.md` | Track Phase 1 substeps and explicit exit gates. |
| `docs/HANDOFF.md` | Record exact current task and observed validation only. |
| `docs/status/current.json` and schema | Advance machine state only after reviewed Phase 1 work exists. |

### 5.3 Canonical Data Contract

The minimum canonical event must preserve:

- `sourcePublishedAt`, `providerReceivedAt`, `systemIngestedAt`,
  `normalizedAt`, `verifiedAt`, and `alertedAt` as distinct UTC instants;
- original timezone/offset evidence plus deterministic America/New_York
  display derivation, without rewriting the canonical UTC instant;
- canonical source identity, source tier, provider identity, original source
  identity, URL, English original headline, BCP 47 language tag, and optional
  Chinese summary as a derived field;
- entities, ticker links, event type, original-source lineage, content
  fingerprint, canonical event fingerprint, and cluster identity;
- lifecycle values `DISCOVERED`, `NORMALIZED`, `DUPLICATE`, `VERIFYING`,
  `VERIFIED`, `CONFLICTED`, `RETRACTED`, `EXPIRED`, and `UNAVAILABLE`;
- verification evidence IDs, contradictions, provenance, policy versions,
  freshness, latency measurements, and limitations.

Deduplication must not count syndicated copies as independent sources. A
canonical fingerprint must use normalized original source, bounded event time,
entities, event type, and core facts; URL equality alone is insufficient.

The Source Registry is versioned provenance, not a provider payload. Entity
linking is independent from provider mappings: aliases, ambiguity, collisions,
and point-in-time ticker changes remain explicit; an unknown entity fails
closed. Adapter/domain boundaries reject unknown fields, and raw provider
schemas never enter canonical domain contracts.

Verification has exactly three valid routes: Tier 0 primary evidence; two
independent, consistent qualified sources; or one high-reputation source that
explicitly cites an accessible primary document whose key facts Alpha checks
and preserves with the citation. A citation without successful fact cross-check
is not the third route.

### 5.4 Provider and Cost Boundary

Provider adapters return bounded raw acquisition results to a product-owned
normalizer. They do not verify news, decide direction, persist evidence,
select another provider, or authorize network use. Official-source and Tier 1
adapters implement the same provider-neutral port. Free and paid providers may
be replaced without changing canonical contracts, dedupe, verification,
freshness, or downstream evidence consumers.

Phase 1 begins fixture-first and dry-run only. Any real network benchmark,
credential, paid subscription, quota increase, or provider selection requires
separate Owner approval. The later combined news/options-data operating budget
is at most `$100` per month; Phase 1 must design actual, forecast, and hard-stop
accounting without purchasing a service.

### 5.5 Latency and Failure States

Latency is measured from source publication through provider receipt, system
ingestion, normalization, verification, and alert stages. Missing timestamps
produce `UNMEASURED`, not an estimate. A measured breach produces
`SLA_NOT_MET`. Provider timeout, quota exhaustion, malformed data, clock
ambiguity, source conflict, retraction, or unavailable original evidence must
remain explicit and fail closed.

### 5.6 Tests

Planned tests include Source Registry version drift, trust/eligibility and
independence checks, syndication non-independence, entity aliases, ambiguity,
collisions, point-in-time ticker mapping, unknown-entity fail-closed behavior,
strict unknown-field rejection at every adapter/domain boundary, all valid and
invalid forms of the third verification route, contract validation, timestamp
and DST cases, timezone display, language preservation, URL normalization,
same-provider and syndicated duplicates, independent-source quorum,
contradictions, retractions, expiry, stale/unmeasured/SLA states, provider
outage and quota failure, budget breaker, raw-schema isolation, deterministic
replay, provenance integrity, fixture-only transport denial, credential scans,
and full regression validation.

### 5.7 Explicit Exclusions

Phase 1 excludes live ingestion, scraping, paywall bypass, social-media-only
verification, macro or trend conclusions, candle analysis, option chains,
Greeks, strategy selection, Decision Cards, notifications, persistence,
Robinhood data, Paper Trading, orders, and execution.

### 5.8 Estimated Cost

- Development: approximately 5-8 focused engineering days across contracts,
  fixture adapters, deterministic engines, tests, documentation, and review.
- Development service cost: `$0` expected; use repository fixtures and existing
  toolchain with no new dependency.
- Phase 1 runtime cost: `$0` because real network execution is excluded.
- Later benchmark cost: target `$0` using approved free tiers; any paid test is
  a separate Owner decision and must remain inside the combined `$100/month`
  ceiling.

## 6. Exit Gate

Phase 0 is Owner-approved and stops after these governance artifacts and
validation evidence. It grants no Phase 1 start without explicit Owner
authorization, and no network, credential, provider, persistence,
recommendation, account, broker, order, or execution authority.
