# Event anticipation and reaction research

Date: September 8, 2026. Scope: GLD/IBIT long-option research on saved Robinhood
market data. [Specification](specifications/OPTIONS_EVENT_PHASE_RESEARCH_V1.md)
and [verification checkpoint](status/event-research.json).

The eighth **Event research** page joins future event registration, fixed option
identities, four observation windows, three separate comparisons, original
feasibility and candidate process notes. It records hypotheses before outcomes.
The existing review notebook includes these candidates with an UNKNOWN market
cause; they do not change a strategy or masquerade as actual trade lessons.

## Actual evidence

The authorized Host obtained 36 options in each of two bounded captures, using
15 market calls per capture. The first completed at 16:56:58 UTC; the tracked
smoke completed at 17:27:24 UTC. Both had zero reported collection failures.
All four active study identities were included in the second capture. These are
current data-access checks, not future study observations or qualified fills.

At the second capture, source trades were GLD $402.76 at
17:27:20.384264857 UTC and IBIT $44.455 at 17:27:19.003197488 UTC. Neither number
is a persistent live price or evidence of a trade execution.

Two independent PPI experiments were registered before their windows:

| Hypothesis | Frozen contract alternatives | Actual registration (UTC) |
| --- | --- | --- |
| GLD call anticipation / same-ETF reaction | October 9, $403 call and put | September 8, 17:24:19.665 |
| IBIT call anticipation / same-ETF reaction | October 9, $44.50 call and put | September 8, 17:26:54.088 |

The PRE call hypotheses and 20-bps reaction threshold are unvalidated declarations,
not conclusions from the current news or a recommended direction. Both use the
saved BLS PPI calendar time, September 10 at 08:30 New York. All four observation
windows last 20 minutes:

| Phase | Entry window begins (New York) | Exit window begins (New York) |
| --- | --- | --- |
| PRE | September 9, 12:40 | September 9, 15:40 |
| POST | September 10, 09:40 | September 10, 15:40 |

These windows surround already configured 12:50, 15:50 and 09:50 Host reads.
They neither add a schedule nor guarantee a wake, a successful source response
or a timely record. Retain misses and data-quality failures. Later imports cannot
retroactively fill a window. A future recommendation still requires its own
current guidance checks.

## Capital and evidence limits

The declared account remains $1,000 with $50 normal allocation, $5 planned loss
and $25 full-premium stress allowance. Fees and slippage remain unknown. At
selection, the GLD call ask was $1,245 for one contract and the IBIT call ask was
$221. Both fail the accepted budget; registration does not authorize purchase.
The frontend exposes this failure before any future endpoint is available.

COMBINED consumes the same event risk allowance after PRE losses. Gains do not
increase that allowance, and exit proceeds are not assumed settled. The three
modes and the two studies are separate counterfactual accounts, not concurrent
allocations. Risk diagnostics are not live brokerage enforcement.

Reference P&L uses a timely entry ask and later exit bid, multiplier 100 and frozen
declared costs. Unknown costs preserve unknown net outcomes. All-blocked modes
have no accepted result, rather than a fabricated zero-profit success. Snapshot
prices do not reveal intervening stops, targets, paths or actual executions.
The POST comparison includes the overnight move since PRE exit and cannot isolate
PPI causality. It is not a candle/VWAP or surprise-value model.

Quote retention and research eligibility remain distinct. Same-second Host
receipt rounding can leave exact source ordering unproven; this engine rejects
quotes later than the recorded receipt instant rather than inventing precision.
Independent bid/ask clocks, exchange session detail, retention terms and the
source-specific execution adapter still need qualification. No SPY/0DTE lane,
calibrated probability, paid source, account tool or automatic order was added.

The fixed progress comparison remains 4 locally validated / 3 partial / 3 not
validated across ten workstreams, and 3 available / 3 open real-price gates.
Frontend and local test acceptance are not a completion percentage or win rate.

## Commands and recovery

```powershell
npm run options:event-research -- --report
npm run options:event-research -- --register data/runtime/options-event-research-inputs/request.json
npm run options:event-research -- --save ppi-20260910-ibit-call-reaction
npm run options:event-research -- --verify data/runtime/options-event-research/plans/ppi-20260910-ibit-call-reaction.json
npm run test:options-event-research
npm test
```

The form is the preferred registration interface. CLI request files use the exact
fields in the specification and actual server registration time; old plans cannot
be rewritten. GETs recompute without appending records. Repeat registration IDs
with identical requests are idempotent; a changed request conflicts. Saved reports
copy their registration and verified normalized observations and recompute without
requiring mutable original stores. Checksums detect corruption, not authenticity.

Stores are ignored under data/runtime/options-event-research and temporary input
files under data/runtime/options-event-research-inputs. Existing guidance captures,
manual fills, activity cohort, paper journals and all Host field snapshots remain
unchanged. The existing Host source reserves at most six active identities and
rechecks current instrument metadata within its original limits; partial pages
remain explicit gaps. See [Host runbook](OPTIONS_DAILY_GUIDANCE_RUNBOOK.md).

## Validation and next work

Focused engine/storage/HTTP/frontend tests cover timing, missing quotes/costs,
exact reaction thresholds, shared losses, cash, unsafe arithmetic, recovery,
session protections, tracking and draft preservation. The first aggregate run
passed all tests but identified missing Git ignores for the new runtime stores;
those ignores were added. The final aggregate passed 3,987 tests across 158
components; the 64 focused event tests also passed after making storage-test
dates independent of this particular release week. Type, transport, secret,
Markdown and whitespace checks passed in the aggregate bundle. Browser checks
confirmed actual registration, cross-page draft retention, selection blockers,
New York windows, notebook filtering and a 390x844 phone viewport without page
overflow or console errors. Final service recovery retains two WAITING studies,
an unchanged empty owner ledger and hourly public context refresh.

Research recovery also includes saved dates beyond the guidance display's
60-day range, up to an explicit 1,000-capture bound. A dedicated regression check
prevents older study observations from silently disappearing. Saved snapshots
verify independently after the service restart.

Next assess the fixed windows when actual records arrive. Preserve every skip,
unresolved endpoint and budget block. Qualify denser noninterpolated bars and
option timing before testing executable stop/target paths, then gather independent
future samples before considering strategy weights or a profitability claim.
