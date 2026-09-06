# Alpha

A focused decision-support system for **GLD and IBIT options on Robinhood**.
Alpha combines attributable context, explicit uncertainty and deterministic
risk arithmetic. It promises no return and has no order-execution authority.

## Current capabilities

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
increase risk limits. Read [current delivery](docs/OPTIONS_FOCUS_V2_DELIVERY.md)
and the authoritative [machine status](docs/status/current.json).

## Run locally

Node.js 24.12 or later is required. Install locked dependencies with
`npm ci`, then run:

| Command | Purpose |
| --- | --- |
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

A public headline is an unverified source assertion. Keyword tags only suggest
which factors deserve review; they do not establish causality, direction or
probability. Coverage remains incomplete. No quantitative-driver or verified
GLD/IBIT option-chain connector, complete portfolio-risk runtime, calibrated
option-outcome replay or Options Dashboard is implemented yet.

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
