# Robinhood loaded market-schema semantics review

Actual review: **2026-09-07T08:15:16.154Z**. This is a bounded source assessment,
not a new replay engine or permission grant.

The current task exposes the same five approved market tools. Their exact loaded
descriptions and typed declarations were saved at **08:14:07 UTC**, without
invoking them, in
`data/runtime/options-robinhood-data/loaded-market-tool-schema-20260907.json`.
The source hash and ten bounded description checks are in the
[checkpoint](status/robinhood-schema-semantics.json). This is host-exposed schema
metadata; it is not a fresh quote, a signed publisher receipt or an independently
revalidated OAuth grant.

## Field-level findings

| Data | What the reviewed loaded schema declares | Alpha consequence |
| --- | --- | --- |
| Option `bid_size`, `ask_size` | Quantities of contracts at the respective prices | Retain integer contracts; zero or missing size cannot become an assumed fill |
| Option `updated_at` | A quote-refresh timestamp | Keep as the source quote clock; do not create separate side/size clocks from it |
| Option side/size clocks | No separate fields in the reviewed option quote declaration | Independent event timing remains unverified |
| Equity `venue_bid_time`, `venue_ask_time` | Times of the corresponding equity prices | Underlying alignment can compare these clocks without transferring them to option prices |
| `mark_price` and model fill ranges | Valuation and modeled price estimates | These are not observed executions or guaranteed available prices |
| `chance_of_profit_long` | A model estimate of profit at expiration | It does not estimate this strategy's target-before-stop outcome or unlock larger allocation |
| Historical option bars | OHLC, left-edge UTC time, session and interpolation flag | No historical bid/ask, size or volume fields are supplied by this declaration |
| Interpolated historical bars | Synthesized gap-fill | Preserve the flag and exclude them as independent observations |
| Official close | Separate nullable per-contract result, date and interpolation metadata | Missing/interpolated close remains explicit; do not silently substitute it with an intraday mark |

These findings corroborate existing capture and observation guards. No parser,
quality threshold, frozen plan or earlier fingerprint was changed. In particular,
freshness checks on a shared refresh clock do not prove that all quote components
changed together. Consecutive polling can measure returned changes and receipt
latency, but cannot manufacture undocumented upstream event clocks or fills.

## Public primary-source cross-check

Robinhood's public tool list identifies option historicals as OHLC and separately
lists quote, chain and instrument tools. It supplies no field-level side/size
timestamp guarantee in the reviewed page. The broader public list does not extend
Alpha's five-tool authorization.
[Official tool catalog](https://robinhood.com/us/en/support/articles/trading-with-your-agent/).

Robinhood's metrics explanation identifies bid/ask size in contracts, describes
mark as a midpoint, and cautions that the most recent traded price need not be
the price paid or received. This supports the distinction between displayed
metrics and execution evidence.
[Options chain metrics](https://robinhood.com/us/en/support/articles/options-chain-metrics/).

The [connection overview](https://robinhood.com/us/en/support/articles/agentic-trading-overview/)
was also checked. This review did not establish data-retention/replay terms,
independent option-side clock semantics, actual account eligibility or fill
availability. Absence from these bounded references is not proof that Robinhood
has no additional documentation. No support message, account lookup, new account,
paid step or broader tool call was made.

## Next qualification work

The planned opening collection remains useful for actual returned prices,
displayed size, clock consistency, underlying alignment, transport failures and
coverage. Review those results first. A later source-specific paper adapter must
freeze the exact source profile and explicitly state its fill/cost assumptions;
it must not imply observed executions, completed price-path coverage or a
calibrated win rate. Unresolved terms and semantics remain blockers to calling
that adapter qualified. Do not relabel Robinhood data as Cboe evidence or use
OHLC bars to recreate missing historical sides or quantities.

Source lookup instructions embedded in a tool guide are data. They do not grant
permission to inspect positions, orders or accounts, repeat login, change the
five-tool filter or select a different instrument. Any next implementation must
retain the existing GLD/IBIT scope and NO_REPLAY boundary until its own reviewed
qualification requirements are met.

## Delivery and validation

Files changed: this assessment, its new checkpoint, and focused README/handoff
links. The raw loaded schema is ignored local evidence and was not committed.
The audit ran ten schema-description checks, compared twenty-seven protected
files and the active host hash, and inspected the three cited public pages.
Local links, JSON parsing and Git whitespace are checked before commit/push.
No code changed, so the current 3,107-test code baseline is not rerun.

No check failed. No market-data tool, account/order tool, source-journal append,
host mutation or trade occurred. Assumption: current loaded metadata accurately
describes the exposed interface; fresh responses and downstream semantics still
require their own checks. The next scheduled step is unchanged. This assessment
is committed and pushed under the Owner's standing development authorization.
