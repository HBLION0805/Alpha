# Options News Infrastructure v1.0

## Authority and scope

This specification defines the implemented, fixture-only Options-Only MVP
Phase 1 news infrastructure. It is evidence infrastructure, not a news trading
strategy. It authorizes no live network call, subscription, credential read,
broker/account access, order entry, Paper Trading, option selection, or capital
execution. All provider fixtures have simulated cost `0`.

## Separate domain records

`NewsEvidenceRecord` is an immutable provider observation. It preserves source,
publisher and upstream lineage; original headline, URL, timestamp and timezone;
UTC receive/ingest/normalize times; raw SHA-256 provenance; entity and topic
candidates; adapter/schema versions; simulated cost; and latency state.
Duplicates remain stored and auditable.

`CanonicalNewsEvent` is a clustered factual event. It has a versioned canonical
fingerprint, checked facts, point-in-time entity mappings, topics, truth-only
verification confidence, evidence lists, timestamps, an auditable Chinese
summary envelope, and a reason-coded current state. `impactHypothesis` defaults
to `UNKNOWN` and is never trading direction.

`EventEvidenceLink` records `SUPPORTS`, `CONFLICTS`, `RETRACTS`, `DUPLICATES`,
or `CITES_PRIMARY` with checked facts and rule provenance.
`VerificationTransitionRecord` is append-only state history. The summary port
is provider-independent; Phase 1 implements only a deterministic offline
provider. Summary failure cannot change verification.

## Sources, adapters, and transports

The immutable Source Registry owns Tier and independence policy. Adapters may
not promote themselves or change publisher lineage. Implemented sources are:

| Source | Tier | Adapter | Fixture cost | Live state |
| --- | --- | --- | ---: | --- |
| SEC EDGAR | 0 | `SecEdgarNewsAdapter` | $0 | blocked |
| Federal Reserve | 0 | `FederalReserveNewsAdapter` | $0 | blocked |
| Finnhub / Reuters | 1 | `FinnhubNewsAdapter` | $0 | blocked |
| Alpha Vantage / Reuters | 1 | `AlphaVantageNewsAdapter` | $0 | blocked |

Each adapter has a provider request builder, an exact raw schema boundary,
raw-to-domain normalization, provider timestamp/lineage handling, and
deterministic failures. `StaticNewsFixtureTransport` is the only data-bearing
transport. Dry run returns a request plan. Live transport always throws
`NETWORK_BLOCKED`; fixture mode never requires credentials.

Finnhub and Alpha Vantage Reuters fixtures deliberately share
`origin:publisher:reuters`. They are two observations but one independent
source.

## Verification and lifecycle

An event can be `VERIFIED` by exactly one of these deterministic paths:

1. parsed Tier 0 primary evidence with checked facts;
2. two eligible, fact-consistent, distinct `independenceKey` values;
3. checked citation of an accessible Tier 0 primary document.

Unproven independence or primary evidence remains `VERIFYING`. Checked factual
conflict becomes `CONFLICTED`; authoritative retraction becomes `RETRACTED`.
Recovery from `CONFLICTED` must pass through `VERIFYING`. Initial processing
must pass `DISCOVERED -> NORMALIZED -> VERIFYING`; illegal skips fail closed.
Expiry requires an event-type TTL policy. Replay uses stable identities and
does not duplicate canonical events or transitions.

Canonical event fingerprinting includes only event type, point-in-time entity
identity, sorted key facts, and a bounded UTC time window. It deliberately
excludes provider, publisher, upstream origin, `independenceKey`, and primary
document identity so separate observations of the same facts can enter one
event. Source identity and primary-document provenance remain in each
`NewsEvidenceRecord` and its evidence fingerprint. A matching accessible
primary-document fingerprint may prove the cited-primary cross-check path, but
does not split otherwise matching observations. The canonical fingerprint is
not a headline hash. Clustering retains every observation and separates events
whose key facts differ.

## Time and latency

Original time text and timezone are retained while comparable values use UTC.
Display time is generated with `America/New_York`, including EST/EDT behavior.
Latency distinguishes publish, provider receive, Alpha ingest, normalize, and
verify boundaries. Missing inputs produce `UNMEASURED` with a reason. Fixture
measurements validate calculations only and make no live SLA claim; p95 120
seconds remains a future target, not a Phase 1 result.

## Persistence, projection, and query

`InMemoryOptionsNewsRepository` is deterministic and supports idempotent event,
evidence, link, and transition writes. Queries support topic, entity, symbol,
event type, verification state, and UTC time range. Raw payload hashes and
provenance remain traceable.

`OptionsNewsEvidenceJournalAdapter` creates a read-only, explicitly
`OPTIONS_NEWS`-namespaced projection into existing Evidence/Journal vocabulary.
It does not silently change or write existing Journal contracts. Phase 1 writes
no production database or user runtime data.

## Budget and health

The versioned combined News + Options Data monthly policy uses a UTC boundary,
an `$80.00` warning threshold and `$100.00` hard threshold. The in-memory ledger
requires a known estimate before reservation, accounts for pending reservations,
reconciles actual simulated cost, releases failures, and cannot be bypassed by
provider switching. Reconcile and release may transition only `RESERVED`
entries; identical settlements replay, conflicting or cross-terminal
settlements fail closed, and reconciled actual cost cannot later be released.
All month selection requires a canonical UTC ISO-8601 timestamp. States are
`NORMAL`, `WARNING`, `BLOCKED_BUDGET`, and
`BLOCKED_COST_UNKNOWN`. This policy grants no spending authority.

Health snapshots expose adapter/transport identity, fixture success time,
failure reason, stage counts, latency samples, cost totals, budget state,
blocked network authority, unread credential authority, and fixture-only
freshness. Provider degradation cannot be hidden by fallback.

## Acceptance evidence

Deterministic tests cover strict contracts, registry drift, entity ambiguity,
DST, all verification paths, same-origin syndication, clustering, lifecycle,
replay, queries, budget boundary cases, health and negative scope guards.
End-to-end acceptance includes a Tier 0 SEC fixture reaching `VERIFIED` with
complete provenance, two fact-consistent independent observations reaching
`INDEPENDENT_SOURCE_QUORUM / VERIFIED`, a Tier 1 citation plus matching
accessible Tier 0 primary evidence reaching
`CITED_PRIMARY_CROSS_CHECK / VERIFIED`, and a Finnhub/Alpha Vantage Reuters
pair entering the same event while remaining `VERIFYING` because independence
is not proven. These scenarios execute through `OptionsNewsPipeline`, not only
the standalone verification rule.
