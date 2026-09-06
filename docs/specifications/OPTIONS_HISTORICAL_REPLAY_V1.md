# Options historical sampled replay v1

Date: 2026-09-06. Reviewed implementation specification. Baseline 4db85e9.

## Authorized outcome

The Owner authorized the proposed next step: obtain a small authorized GLD/IBIT
historical sample, assess affordability and liquidity, simulate a complete trade
when evidence permits, and preserve results/reviews. Existing save/commit/push
authorization persists. This does not purchase data, access credentials or trade.
Actual sample availability must be reported separately from engineering tests.

## Version and meaning

Add a separate research engine and journal. Do not change v1 paper, review or
market-evidence outputs, loosen their NO_REPLAY gate or backdate receivedAt.
Every new run retains the complete market-evidence snapshot, exact fingerprints,
original import clock and actual research run clock. A missing dataset produces a
recorded BLOCKED result. Owner-provided data remains unauthenticated; file-format
acceptance is never publisher authentication, data-rights proof or actual fills.

This first model is COUNTERFACTUAL_SNAPSHOT_TIME with NEXT_SNAPSHOT_MARKET_EXIT:
historical snapshots drive hypothetical decisions at their original market times;
this is explicitly not a reconstruction of historical feed availability or a
pre-registered trading strategy. Input selection is RETROSPECTIVE_DECLARATION.
Intraday-15-minute-delayed delivery is not supported in this model. No probability,
strategy performance certification, real brokerage readiness or automatic risk
increase follows. Add stricter independently qualified models in later versions.

## Frozen research configuration

Config exactly: schemaVersion='1.0', runId, datasetId, contractKey, plan and
assumptions. Identifiers bounded to 100 safe characters; unknown fields reject.
Plan exactly: strategyVersion, setupKey, decisionAt, entryDeadlineAt, timeExitAt,
entryLimitPerShareCents, quantity, stopLossBps, rewardMultipleMilliR,
maxEntrySpreadPerShareCents, thesis. Thesis uses the existing nine narrative
direction/magnitude/horizon/volatility/path/invalidation/monthly/daily/intraday
fields; no signal weights or claimed probability. Canonical UTC milliseconds.

Assumptions exactly: contractTerms (null or {multiplier:100,
deliverable:'STANDARD_100_SHARES_USD',exerciseStyle:'AMERICAN',minimumPriceTickCents,
reference}), session (null or {sessionDate,marketOpen,marketClose,reference}),
costs (null or {entryFeeCents,exitFeeCents,exitSlippagePerShareCents,reference}),
liquidityModel ('REQUIRE_CONTEMPORANEOUS_SIZE' or
'ASSUME_RECORDED_SIZE_AVAILABLE'), acknowledgeCounterfactual (boolean).
References are bounded explanatory source strings, not programmatic verification.
Source/calendar/contract/fee assumptions remain clearly unverified in output.

One run is an isolated USD 1,000 research account, one long standard GLD/IBIT
call or put, one historical session, 14-45 calendar days to expiry. Root must equal
the GLD/IBIT underlying. Session clocks must roundtrip to the declared Eastern
date, weekday and 09:30 open; close may be 13:00, 16:00 or 16:15 with an explicit
reference. These checks do not independently certify holidays, early closes or
symbol-specific extended option hours. decisionAt < entryDeadlineAt < timeExitAt,
all strictly within the supplied session; quote at close cannot fill. One-minute
through 15-minute declared intervals only. Caller cannot set initial equity,
probability, leverage, portfolio state, cash settlement or production authority.

Missing required assumption, usage declaration, dataset, selected contract, two
or more selected observations, or positive bid/ask/underlying prices/sizes at an
entry is reported explicitly. Zero or missing liquidity cannot be invented.
On/after 2026-06-22 Cboe sizes cannot meet the contemporaneous-size model. An
explicit alternative may assume recorded POSITIVE sufficient sizes available,
label every fill assumed, and preserve the provider's timing limitation. This
does not alter source observations or pass a real execution gate.

## State and arithmetic

Use evaluateOptionsRetailFeasibility for limit-risk and actual fill economics.
Keep 5% allocation, 0.5% initial-equity all-in R, USD25 full-premium-plus-fees cap,
10%-25% stop research range and net 1.5R-2R target/80% configured gross ceiling.
Quantities and cents are bounded safe integers; overflow fails. Unknown costs
block. Limits, stops and exit quotes must respect the declared tick.

The last selected quote at/before decisionAt (at most one declared interval old)
supports pre-entry diagnosis. Do not select a cheaper contract after seeing exits.
For this conservative preflight, a baseline bid above the entry limit produces
LIMIT_BELOW_BASELINE_BID; this is a research-model restriction, not a statement
that a broker forbids placing a lower limit order.
Buy only on a later eligible snapshot at ask <= frozen limit, before deadline;
recheck economics, spread, both sizes and prices before fill. Reserve limit
capital plus roundtrip fees while pending; report cancellation at entry deadline
if the supplied dataset actually reaches it, otherwise ENTRY_PENDING.

After entry, observe net liquidation value at bid minus adverse slippage and
roundtrip fees. Stop triggers at loss >= planned R; target triggers at net profit
>= configured net target. At or after timeExitAt, TIME_EXIT triggers even when
the snapshot bid/size is unusable. Triggering observations cannot also fill exits.
Exit reason is sticky; sell only at a strictly later usable snapshot bid minus
slippage. TARGET is a market-style exit trigger, not a guaranteed target-price
fill: final proceeds may fall below target or lose. Actual losses may exceed R.
Do not bridge missing prices, reuse sale proceeds, invent settlement or liquidate
at a fabricated last price. Data-end states OPEN and EXIT_PENDING remain unresolved;
unrealized equity is null if there is no usable last bid mark.

Keep source quote times, decision/trigger/fill times, quote indexes, prices,
assumptions, cash/reservations/unsettled proceeds and reasons auditable. Report
elapsed quote gaps; a complete set of interval snapshots still cannot reveal
intraminute stop/target order. No account compounding across independent runs.

## Review and persistence

Every run has a process review, including blocked/unfilled/unresolved runs. Closed
runs reuse reviewClosedOptionTrade with an explicit owner-file -> UNVERIFIED_IMPORT
mapping wrapped in the unchanged original provenance and research assumptions.
Never insert new research reviews into the old paper account. Candidate notebook
includes objective gap/slippage/missing-source failures, not invented causal
explanations or automatically approved knowledge. Prior research lessons are shown
for matching symbol/strategy/setup but never represented as historically known
before they were actually recorded or used to mutate a frozen plan.

Separate ignored data/runtime/options-historical-replay/runs.ndjson: bounded
16MiB/1000 batches, hash chain, one writer, callback-scoped handles, uncertain-write
poisoning, recompute complete results on read. Persist config/evidence/null and run
timestamp/result together. Same runId and payload is idempotent (original clock
preserved); changed inputs require a new runId. A failed missing-data attempt is
not silently overwritten later. Never copy raw licensed files into Git.

CLI options: --help, --demo (isolated synthetic cases), --record-demo (separate
synthetic research history), --input <config JSON> (lookup imported dataset by ID,
record blocked if absent), --report (recompute saved outcomes/notebook).

## Acceptance

Provenance/unknown fields/time/session/DTE/ticks/overflow/source-usage checks;
limit and actual risk, spread and sizes; next-snapshot entry and exits; stop gaps,
target reversal, time exits without liquidity, incomplete paths, out-of-session
quotes, no fabricated settlement; persistence conflicts/corruption/restart and
data-missing runs. All existing journals must retain exact hashes/results.
Run strict typecheck, focused tests and the aggregate. Actual source absence must
remain visible rather than counting synthetic cases as real-price evidence.

## Bounded source-preserving subset extraction

Licensed full-chain files can exceed the existing import limits. A separate local
streaming utility accepts exactly selectionId, sessionDate, one to four distinct
standard GLD/IBIT contractKeys and an explanatory rationale. This is a retrospective
declaration, not pre-registration. Selection does not assign source authenticity,
usage rights or replay authority. Validate the selection before reading a source.

Read at most 64 MiB and 250,000 source rows using fatal streaming UTF-8 decoding;
bound each logical CSV record to 16 KiB. Support quoted cells, escaped quotes,
BOM and CRLF split across chunks. Embedded newlines in quoted fields are rejected:
the supported source's scalar fields do not require multiline text. Normalize
only record separators to LF. Validate each row with the existing CSV parser,
then retain original selected record text for the specified Eastern session and
contract keys. Bound the child to 4 MiB / 10,000 selected rows and validate all
selected records together for cross-row conflicts. Never silently truncate.

Publish exclusively to the ignored local extracts/selectionId directory under
data/runtime/options-historical-replay. Keep quotes.csv and a manifest linking
exact parent/child SHA-256, selection fingerprint, scanned/selected/excluded counts,
actual requested/finished clocks and the retrospective/unverified classification.
NO_MATCH writes only its explicit manifest. Refuse unsafe directories, existing
partial outputs and changed content under one selectionId. Repeated complete
outputs are idempotent after hash/manifest validation and preserve first clocks.
Use exclusive publication and retain partial outputs for review if publication
fails. Never modify the parent file or automatically import/trade the subset.
