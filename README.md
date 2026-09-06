# Alpha

A focused decision-support system for **GLD and IBIT options on Robinhood**.
Alpha combines attributable context, explicit uncertainty and deterministic
risk arithmetic. It promises no return and has no order-execution authority.

## Current capabilities

- Source-labeled Cboe DataShop option CSV import, exact prices and Eastern-time
  normalization, missing-data checks and a separate integrity-checked history.
  The Owner currently has Robinhood only; no authorized option data file/API
  has been supplied. File parsing does not establish real-price replay readiness.
- A complete local simulated trade lifecycle: GLD/IBIT contract/quote inputs,
  frozen plans, risk checks, cash reservations, modeled fills/exits and recovery.
- Every closed trade receives a review and candidate mistake checks for future
  entries. Synthetic or unverified imports only; no calibrated win rate.
- Intraday plans, 14-45 day expiries, one position and separate unsettled proceeds.
- Six official public headline feeds: Federal Reserve, BLS, BEA, ECB, OFAC and SEC.
- An extensible catalog of 16 driver families and 94 indicators, with mechanisms,
  primary sources, expected release cadence and coverage limitations.
- Bounded one-shot refresh, local version history, correction-preserving dedupe,
  timestamp checks, source health and candidate relevance tags.
- Offline options economics using 10%-25% premium-stop comparison, a 20% research
  default, net 1.5R-2R targets, integer contracts, costs and price-grid checks.
- Fixed 5% allocation ceiling, 0.5% equity planned cash-risk budget and the
  separately retained USD 25 full-premium stress cap. Conditional escalation is closed.
- Fixture-only options news verification and QQQ benchmark market context.
- Reusable canonical market data, calendar validation, Twelve Data integration
  foundations, historical evidence, journal, research, audit and AI cost controls.

The 20% stop is a research choice, not a validated optimal live rule. R includes
round-trip fees and exit slippage; it remains a planned loss, not a guaranteed
fill. A USD 25 premium with zero assumed costs, 20% stop and 2R has a USD 5 planned
loss and USD 10 net profit target. No passing diagnostic authorizes a trade.

The USD 1,000-to-USD 50,000 year-end aspiration is a scenario only and cannot
increase risk limits. Read [current delivery](docs/OPTIONS_MARKET_EVIDENCE_DELIVERY.md)
and the authoritative [machine status](docs/status/current.json).

## Run locally

Node.js 24.12 or later is required. Install locked dependencies with
`npm ci`, then run:

| Command | Purpose |
| --- | --- |
| `npm run options:market-data -- --catalog` | Inspect reviewed source options and access limitations |
| `npm run options:market-data -- --demo` | Inspect synthetic quote-path qualification without saving |
| `npm run options:market-data -- --import <CSV> --metadata <JSON>` | Save a supported local file with explicit origin and usage declaration |
| `npm run options:market-data -- --report` | Recompute saved data-quality reports; no fill simulation |
| `npm run options:paper -- --demo` | Run scripted round trips and failure cases without saving |
| `npm run options:paper -- --record-demo` | Save the demo, including restart/resume and trade reviews |
| `npm run options:paper -- --input fixtures/options-paper/gld-target.json` | Append one local scenario |
| `npm run options:paper -- --report` | Recompute saved trades, balances, reviews and mistake notebook |
| `npm run options:feasibility -- --demo` | Compare illustrative options risk/R scenarios |
| `npm run options:feasibility -- --input fixtures/options-retail-feasibility/gld-normal.json` | Check one manually supplied scenario |
| `npm run options:drivers -- --catalog` | Show all driver families, indicators and source gaps |
| `npm run options:drivers -- --refresh` | Read six fixed public feeds once and save local history |
| `npm run options:drivers -- --report` | Reassess saved headlines and freshness without network access |
| `npm run options:drivers -- --demo` | Demonstrate candidate tagging with a labeled synthetic observation |
| `npm run alpha:validate` | Run all surviving tests, strict typecheck, scope and documentation checks |

Headline refreshes are stored in `data/runtime/options-driver-monitor/refreshes.ndjson`
inside the checkout, excluded from Git. Each refresh is one checksum-linked
append containing both observations and source health. A damaged/truncated
journal or existing writer lock blocks the command; never delete a lock without
first checking whether another monitor is running. History is bounded at 16 MiB;
rotation/export requires a reviewed operation rather than silent deletion.

## Boundaries

Market evidence is stored separately in `data/runtime/options-market-evidence/`.
Its importer supports the documented Cboe DataShop format, not dashboard scraping.
See the [metadata example](fixtures/options-market-evidence/metadata.example.json)
and [import instructions](docs/OPTIONS_MARKET_EVIDENCE_DELIVERY.md). A source name
and local checksum do not prove publisher identity or data rights. Unknown sizes,
sampled paths and delivery limitations remain explicit. Until contract/calendar,
availability and cost/fill-model evidence is qualified, the gate returns `NO_REPLAY`
and zero trades. There is no adapter into the older paper engine that backdates
historical quotes or fills missing liquidity.

A public headline is an unverified source assertion. Keyword tags only suggest
which factors deserve review; they do not establish causality, direction or
probability. Coverage remains incomplete. No quantitative-driver or verified
GLD/IBIT option-chain connector, complete portfolio-risk runtime, calibrated
market-validated option-outcome replay or Options Dashboard is implemented yet.

Local paper history lives in `data/runtime/options-paper/sessions.ndjson`, excluded
from Git. Each batch preserves its input, result and review. Reopening recomputes
results and checks the hash chain. Damage or an existing writer lock blocks the
command; do not erase history or locks to bypass a failure. Only the latest active
scenario can resume by appending quotes received after its previous as-of time.
Frozen plans and earlier quotes cannot change. Synthetic and imported cases
cannot share one account. Sale proceeds remain unsettled; no settlement is invented.

The refresh command is one-shot. A separate hourly Codex heartbeat named
"GLD and IBIT official information monitoring" is configured for this task. It
requires the local computer and app to remain available; no server daemon is
installed. Meaningful related changes and source failures are the notification
criteria.
No account, credentials, paid subscription, brokerage paper account or order
endpoint is accessed. Original news fixtures retain their separate verification
rules; live headlines cannot inherit their verified status.

## Focused architecture

The Owner authorized removal of obsolete Event Contract/Kalshi, legacy Python,
Daily Scan and fixed-stock-universe Alpaca business lanes. 292 files were removed
with dependency checks; see the [deletion manifest](docs/OPTIONS_FOCUS_DELETION_MANIFEST.json).
Reusable macro and broad-market evidence is retained as context for gold/BTC,
never as permission to trade another asset. Historical design documents and
Git history remain audit records, not active product entry points.

See [architecture](docs/ARCHITECTURE.md), [roadmap](docs/ROADMAP.md),
[handoff](docs/HANDOFF.md) and [v2 specification](docs/specifications/OPTIONS_FOCUS_RISK_AND_DRIVERS_V2.md).
