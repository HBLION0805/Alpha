# Full-chain activity review and operator board v1

Task OPT-CHAIN-REVIEW-1, September 7, 2026 New York. Owner explicitly requested
all GLD/IBIT expirations from September 8 through the September 16 FOMC meeting,
plus September 18 strike-range comparison, and continued operator integration.
Current configured model, no delegation. Scope: new offline chain review engine,
tests, immutable CLI/HTML board, registration and focused current-state docs.

## Evidence and interpretation

The one-time authorized host read enumerated all returned active contracts with
complete cursor pagination and read quotes in groups of at most 20, retaining
official prior-close fields. The raw bundle preserves exact request/response
and actual second-precision request/receipt clocks. It has no account/order calls.
All option refresh clocks in this baseline are September 4. Neither future
session prices nor future volume exist in this snapshot. Do not repeat calls
to try to make stale holiday data current. The old opening pilot stays cancelled.
The Owner subsequently authorized daily close records through September 16.
Add seven prospective New York sessions (September 8, 9, 10, 11, 14, 15, 16),
at 16:20, retaining September 18 as a comparison. Preserve the existing daily
09:00 context task and its immutable v6 restoration fields. No opening collection
or scheduled development is authorized. Restore v6 after the final closing run,
or before any work on a later wake. Never delete the shared market-context task.

Each close re-enumerates active dates from the actual session through September
16 plus September 18, and separately enumerates same-session expired contracts
without a tradability filter. Repeated IDs across changing active/expired pages
fail review rather than silently selecting one version. Quote batches contain
at most 20 IDs, with bounded calls and failures retained. The host collector uses
only injected market-tool and clock callbacks; local CLIs cannot authenticate.
Actual requests/receipts and source dates remain separate. A missed session is
not backfilled using later quotes. No provider or scheduler success is inferred
from local fixture tests.

Compare verified saved reports by contract ID, retaining added/absent contracts,
both raw volume/OI values and source clocks. Differences are descriptive reported
counter changes, not extra contracts traded between days or verified daily totals.
Unchanged/regressed/unknown clocks disable derived changes. Missing values stay
unknown; no historical significance or causal certainty follows from a difference.

Interpret strike_price as contract exercise price, not option premium, a price
ceiling or forecast. Option bid/ask/mark are separate per-share decimal values.
Keep missing/zero/crossed/no-size quotes visible. Keep all contracts, not just
high-activity candidates. Detect incomplete pagination, missing/extra/duplicate
quote IDs, request/chain/expiry mismatches and unsupported multiplier metadata.
Do not silently replace bad contracts or omit partial scope. The parser is local
evidence checking, not source authentication, a replay adapter or execution path.

## Screening and arithmetic

Retrospectively declared ACTIVITY_REVIEW_FILTER_V1 is a descriptive review aid,
not a fitted anomaly detector or signal. Flag any of:

- observed volume at least 1,000 contracts;
- observed volume at least 100 and at least three times positive reported OI;
- observed volume at least 100 and at least five times the positive-volume median
  among at least five peers with the same symbol, expiry, option side and New York
  quote-refresh date. Disable the peer rule for incomplete instrument/quote scope.

Retain each threshold, peer count, exact median numerator/denominator and ratio
inputs so results are reproducible. OI zero never becomes division by one or
infinity. OI has no independent as-of field; volume has no independent session or
refresh field. Label that uncertainty even when quote dates match. Historical
relative volume, intraday acceleration, trade direction, opening/closing activity,
multi-leg linkage, participant identity and causal explanation remain unknown.
Use bounded integer counts and exact decimal parsing; floating point is display
only. No premium-flow estimate from volume multiplied by a snapshot midpoint.

Cause notes are explicit hypotheses and evidence requirements. FOMC coverage,
near-spot concentration, both-side activity and calendar expiry type can supply
context, never prove a trade cause. No claim that a large call trade is bullish,
a large put is bearish, or the highest listed strike predicts a market target.
Published exchange listing rules explain possible range differences; exact
listing/addition times and reasons are absent from this interface.

## Persistence and operator surface

Preserve the new raw bundle in a dedicated ignored runtime directory. A bounded
strict-UTF8 parser rejects duplicate decoded JSON keys and unsafe structures.
Offline CLI produces all-row JSON and an English HTML review board grouped by
expiry, with all flagged rows and expandable full-chain tables. Include original
paper/portfolio snapshot diagnostics by invoking its unchanged verifier. The
board distinguishes real source snapshots from the independent synthetic account;
it never feeds short-dated source contracts into the 14-45 DTE paper engine.

Exclusive snapshot directories retain raw input, deterministic report, HTML and
checksummed manifest; preserve the exact paper artifact when requested and verify
it with its original reader. Fresh-process verification checks exact bytes and
recomputes reports/rendering without network or source journals. Dates of future
observations stay unpopulated. Browser view is local only, with escaped source
values, no remote assets, orders or credential input. No journal append, source
adapter, probability, size increase or first real-price gate acceptance follows.

## Acceptance

Test pagination/scope/IDs and partial data, stale/invalid clocks, exact decimals,
missing/zero counters, threshold equality and median arithmetic, zero OI, all-case
preservation, date isolation and unknown causes. Test immutable safe storage,
tampered reports/HTML/paper references, fresh-process recovery, no source access
and HTML escaping. Visually inspect the generated board. Run relevant original
paper/portfolio checks and the full integrated validation bundle before Git delivery.
