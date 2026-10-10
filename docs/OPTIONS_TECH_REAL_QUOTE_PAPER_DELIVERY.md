# Isolated real-quote Paper bridge

The existing spread-plan entrypoint now accepts `TECH_SPREAD_PLAN_INPUT_V2` with
`mode: REAL_QUOTE_PAPER`. It maps a qualified saved two-strike batch into the same
spread economics engine and exclusive append/recovery journal. No second fill
engine, collector, schedule, broker order or production arming path was added.

## Modes and evidence

`TECH_QUOTE_PAPER_DEBIT_SPREAD_V1` is distinct from both MOCK versions and LIVE
execution. Its explicit model is `TWO_LEG_BID_ASK_PAPER_ASSUMPTION`: both displayed
legs are modeled together, without asserting an atomic exchange snapshot or
guaranteed execution. The bounded scope is one equal-quantity contract per leg,
same-day CDS/PDS, same expiry, standard 100-share American contracts, before expiry.
The existing two-minute entry and seven-minute time-exit engineering windows,
individual freshness, size, spread, tick, cash and cost checks remain in force.
These windows are an engineering rehearsal scope, not a newly approved strategy.

The input must separately declare `evidenceContext`:

| Context | Accepted source / records | Meaning |
| --- | --- | --- |
| TEST_FIXTURE | SYNTHETIC_FIXTURE originals and records | Explicit synthetic transport test, never real acceptance |
| ATTRIBUTED_REAL_EVIDENCE | HOST_MARKET_TOOL_RESPONSES original; OWNER_DOCUMENT / PROVIDER_DOCUMENT records | Saved attributed evidence; hashes do not authenticate the broker or document |

Fixture origins remain synthetic in originals, plans and events. Switching a
context or event label cannot promote them into the real-evidence route. Real
account authentication remains UNKNOWN; document checks are labeled
DOCUMENT_EVIDENCE_PASSED, distinct from MOCK PASS. An unknown field, missing record
or missing reviewed verdict blocks the real route. No account tool is called.

## Required prior records

Reuse the eight existing raw-JSON/hash envelopes with source, reviewer, observed,
received, reviewed, valid-through clocks and an explicit verdict. They must be
reviewed before the decision and valid through the planned exit. A local
`paper-...` account alias links evidence without embedding broker credentials.

| Record | Required content / present source gap |
| --- | --- |
| STRATEGY_REQUEST | Prior request ID, research/selection/evidence hashes, paper account alias, CDS/PDS, quantity one, model, entry/exit times, budgets, price/spread limits, parent IDs and entry/exit/invalidation conditions |
| RESEARCH | Existing saved prospective research including registration, direction, technical/trial conditions and uncertainty; no past-price reconstructed thesis |
| CONTRACT | Both exact identities, multiplier, standard deliverable, American exercise and tradability; quote responses alone leave deliverable/exercise unknown |
| COST_MODEL | PAPER_FIXED_PER_LEG_COST_V1, ID/source, each leg's entry/exit fee and adverse exit allowance; dated readable fee evidence and explicit assumptions are needed |
| PRODUCT_PERMISSION | Explicit account alias, enabled spread products and symbols; no readable real permission evidence has been supplied for this run |
| DATA_ENTITLEMENT | Provider, permitted symbols, real-time options and local-retention evidence; no inferred entitlement from successful connectivity |
| ACCOUNT_FUNDS | Settled cash, existing reservations and unsettled cash, USD and matching alias; no buying-power screenshot is silently treated as settled cash |
| RISK_LIMITS | Explicit existing per-trade budget and maximum-loss limits; no new allocation or 20/30/50 rule |

Each source must remain an exact local record. A source URL or generic product
description does not prove a particular account's permission, funds or data rights.
The official saved quote adapter supplies identities, bid/ask, size, individual
provider clocks and acquisition receipts. It does not supply all the account,
deliverable, exercise or fee evidence above. This turn did not acquire such data.

## Independent clocks and lifecycle

The request must pin an explicit `maxSourceSkewMs` matching the prior selection,
between zero and the existing 60000-ms schema bound; there is no default. Later
batches must use the same frozen tolerance and exact contracts. Each source time
is preserved and individually checked. A source after the actual decision but
before collection remains valid if otherwise fresh. Source clocks, acquisition
request clocks and original-publication clocks have separate meanings.

The mapper creates `TECH_QUOTE_PAPER_SPREAD_BATCH_EVENT_V1`, retaining the full
original/hash, parent-plan fingerprint and per-leg clocks. Complete preflight is
repeated at creation and replay, and an original cannot be observed before its
recorded time. New observations remain ordered; identical historical retries
verify the entire history and return the current complete state without appending.

Only settled cash minus reservations funds entry. Initial unsettled cash is not
buying power or new P&L. Entry is never appended by preview or plan creation.
Without a later eligible quote, time exit stays pending with open exposure and
unknown P&L. Invalid/missing quotes cannot manufacture a close or release funds.
Conditions remain available for explicit manual close and the existing time exit;
the engine does not automatically interpret research prose. Overnight, assignment,
residual disposal, scaling and broker execution remain unsupported.

## Existing executable entrypoint

Prepare the prior records and qualified original under ignored local runtime
storage. `INPUT` includes one original `{id,path,sha256}` and the eight records.
`REF` includes `{id,path,sha256,eventId,action}`; action is OBSERVE or CLOSE.
Use distinct `paper-...` run and event IDs. The following commands are readiness
instructions, not commands executed against real data in this delivery:

```text
npm run options:tech-spread-plan -- --preview INPUT
npm run options:tech-spread-plan -- --start INPUT --run-id paper-UNIQUE
npm run options:tech-spread-plan -- --append-original REF --run-id paper-UNIQUE --at UTC
npm run options:tech-spread-plan -- --recover --run-id paper-UNIQUE --at UTC
```

The append operation reads an explicit saved original; it performs no collection.
At an authorized regular-session trial, first freeze the real request/research,
identities, tolerance, costs, limits and evidence. Then use separately authorized
existing source collection, save an independent later batch and explicitly append
each eligible observation. Do not backfill the old same-strike call/put samples.
The existing collector/Host call-limit caveat remains unchanged: the collector is
bounded, while excess completed Host calls are detected after completion.

## Delivered evidence and acceptance

The TEST_FIXTURE CDS/PDS demonstrations exercise the existing CLI from plan-only
save through independent-clock entry, independent later exit and recovery; each
models -$9.20. These are fictional observations. Regression tests cover missing
evidence, costs/funds unknown, future/stale/predecision quotes, missing/wrong legs,
skew bounds, source retiming and label tampering, pending exits, historical retries
and preserved legacy behavior. The independently reviewed clock/idempotency repair
is retained. Actual market collection and real Paper runs remain NOT_TESTED.

Before a real run, the remaining requirements are a qualified session, prospective
real research/selection, all eight readable evidence records, an eligible initial
two-strike batch and an independent later batch. No successful fixture or test
count substitutes for these. See [status](status/tech-real-quote-paper.json).
