# Independent simulated account with real market evidence

The existing `TECH_SPREAD_PLAN_INPUT_V2` / `REAL_QUOTE_PAPER` path now supports
`SIMULATED_ACCOUNT_REAL_MARKET_DATA`. Its account is explicitly simulated;
real broker funds and product qualification stay UNKNOWN and are not prerequisites
for this mode. The original attributed-account and MOCK paths keep their behavior.
There is no second fill engine, new collector, production arming or order route.

## Separate evidence origins

The same eight records and original raw-JSON/hash envelopes are retained:

| Record | Origin in this context |
| --- | --- |
| STRATEGY_REQUEST, RESEARCH | Existing attributable prior request/research; never simulated evidence |
| CONTRACT | Existing attributable exact identity, expiry, strike, type, multiplier, deliverable, exercise style and tradability |
| DATA_ENTITLEMENT | Existing attributable real-time data and local-retention rights; not inferred from connectivity or virtual funds |
| COST_MODEL, PRODUCT_PERMISSION, ACCOUNT_FUNDS, RISK_LIMITS | Explicit `SIMULATED_ACCOUNT_ASSUMPTION`; never relabeled broker documents |

Real quote batches retain `HOST_MARKET_TOOL_RESPONSES`, the existing complete-batch
preflight, original clocks, after-decision order, freshness, source-skew, size and
spread checks. Missing or old quotes cannot create prospective fills. The separate
`TEST_FIXTURE_SIMULATED_ACCOUNT` context uses fictional market fixtures and remains
visibly labeled in plans, events, reports and the existing status panel. It cannot
be switched into real-market acceptance by changing the context.

## This engineering account scope

The Owner selected simulation. The assistant's adjustable starting assumption is
$1,000 USD, entirely settled, zero reservations/unsettled funds, no initial
positions, additional deposits or borrowing. This is a local engineering assumption,
not a permanent Owner risk rule or the separate $160 challenge. The bounded version
permits a smaller explicitly recorded starting capital; budgets and maximum-loss
limits cannot exceed its initial capital or this version's $1,000 ceiling.

The `ACCOUNT_FUNDS` payload adds `basis: ISOLATED_SIMULATED_CAPITAL_V1`,
`initialCapitalCents`, `additionalDepositsCents: 0`, `borrowingCents: 0` and
`initialPositions: []`. Initial settled cash must equal initial capital; reserved
and unsettled cash are zero. `PRODUCT_PERMISSION` adds `basis:
SIMULATED_PRODUCTS_ONLY` and `brokerQualification: UNKNOWN`. `RISK_LIMITS` adds
`basis: THIS_ENGINEERING_RUN_ONLY`. `COST_MODEL` adds `basis:
EXPLICIT_SIMULATION_COST_ASSUMPTION` and `actualBrokerFees: UNKNOWN`.

Support remains one equal-quantity contract per leg, same-day CDS/PDS, identical
expiry, standard 100-share American contracts before expiry. Each opening uses
long ask / short bid; closing uses long bid / short ask with adverse tick-rounded
allowances. Debit, entry/exit fees and exit allowance reserve must fit cash and
the explicit request budget. Sale proceeds remain unsettled and unavailable for
another entry. No extra deposits, margin, scale-ins, overnight/assignment or
partial-leg disposal are modeled. Terminal maximum loss is not an early-close or
assignment guarantee.

The prepared local cost assumption is 65 cents per contract per side and 5 cents
per share of adverse closing allowance on each leg. That is $2.60 total fees plus
$10 allowance reserve for one two-leg round trip. These are modeling assumptions,
not Robinhood's fee schedule. Exact contract IDs still need to be bound before
decision; unknown costs cannot silently become zero or be filled after entry.

Simulated accounts use `paper-sim-...` aliases. The journal run ID must equal the
account alias, so another run cannot silently clone the same starting capital.
The unchanged journal remains inside isolated development storage; no challenge
ledger or broker account is a supported destination. Recovery rechecks the account
basis, evidence origins and all original plan bindings, not only hashes.

## Preparation and proposed next observation

Use the existing strict launcher with `--prepare-plan INPUT` or `--plan-preview
INPUT`; preparation has no filesystem writes and cannot start a journal. The
separately saved local configuration is a draft with no market quote and no frozen
strategy request. It preserves UNKNOWN for missing market entitlement and contract
evidence. Real account screenshots are no longer requested for this mode.

Under the existing reviewed 2026 calendar, a proposed next engineering window is
October 12 at 10:00 America/New_York (14:00 UTC). This is a proposal, not a scheduled
job or a promise of an open/unhalted contract. Refresh research first; before the
actual decision freeze exact research/selection/evidence references, direction,
conditions, contract identities, per-leg costs, explicit budget/debit/spread/skew
limits and the actual decision clock. Do not assign a future decision timestamp
now or reconstruct a decision from later prices.

Retain the existing decision +2-minute entry cutoff and +7-minute time exit. For
a genuine 10:00 decision, that means 10:02 entry cutoff and a later independent
quote around 10:07 for the modeled exit. A separate observation around 10:30 may
describe the short price path; it does not extend the position or validate a
two-week win rate. If evidence is missing, record NO_ENTRY/BLOCKED; if exit quotes
are absent after an entry, retain unresolved exposure. No new timing automation
was installed and no weekend fill was generated.

Engineering validation covers source separation, capital/fees, absent and stale
quotes, recovery, account-run isolation and status labels. Synthetic tests are not
real-market Paper acceptance. Private configurations and receipts remain ignored.
