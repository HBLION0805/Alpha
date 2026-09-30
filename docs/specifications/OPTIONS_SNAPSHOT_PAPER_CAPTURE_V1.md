# Bounded snapshot paper capture V1

Owner-authorized engineering rehearsal, September 30, 2026. This source collector
reuses the existing V3 snapshot paper engine, source normalizer and immutable
capture/report recovery. It introduces no P&L, trading or prediction authority.

## Interface

scripts/lib/options-snapshot-paper-capture.mjs exports the standalone serializable
async collectSnapshotPaperMarket({contract,call,clock}). It imports nothing and
can run in the existing authorized Host connection. contract has exactly id,
chainId, symbol (GLD/IBIT), expiry, type, strike (decimal string), multiplier 100.
The operator binds it to the already verified frozen plan; the helper cannot
choose a contract. clock returns real UTC ISO milliseconds. call(tool,request)
returns the actual tool response's data envelope without changing its contents.
The bridge retains original wire responses and actual invocation/receipt clocks.

The collector reads the exact chain, at most three active-instrument pages for
one expiry, then GLD+IBIT equity quotes and only the frozen option ID. It preserves
all returned metadata and original source timestamps. The normalizer's established
equity request requires both symbols; this does not select a second option.
There are at most six market calls. The 180-second elapsed bound applies before
and after calls, with no retries. A Host deadline must bound an in-flight call;
the helper does not cancel a pending MCP promise or create a second task.

Result is {status,capture,attempt}. CAPTURED contains the established
OPTIONS_GUIDANCE_MARKET_CAPTURE_V1 envelope. NO_CAPTURE has capture:null. The
attempt retains scope, actual clocks, calls, original responses and fixed failure
codes. All results have accountAccessed:false and executionAllowed:false. A
malformed initial scope/clock rejects; the Host must retain its task/error receipt.
Missing or changed exact identity, provider error, malformed/repeated cursor,
exhausted pages or elapsed bound abort without a substitute. Historical cursor
URLs are parsed only as the existing exact provider cursor format; no URL is fetched.

CAPTURED means an identified response, not an eligible fill. The unchanged
normalizer and V3 mapper validate capture linkage; the unchanged paper engine
checks price/tick, size, freshness, source progression, costs, allocation and
session timing. A one-IBIT-option capture honestly remains complete:false in the
full GLD/IBIT guidance view. Do not label it a 36-contract full survey or use it to
claim the independent daily Decision/Owner readiness chain has passed.

## Operator boundaries

The external runner binds code hash, runtime root, plan fingerprint and exact
identity, and claims each dated slot exclusively before starting its one Host
call. It checks replayed state before every market attempt: CLOSED_MODELED skips
all remaining reads; NO_ENTRY after entryDeadlineAt also skips. Missing slots,
failed calls, overrun and skipped terminal states get private receipts. A late
runner cannot backdate or catch up a missed entry slot. No recovery may replay a
market call whose outcome is ambiguous. This helper alone is not a scheduler.

Record the full result privately before ingest. For CAPTURED, use existing
recordGuidanceMarket and observePaperPlans(root,capturePath); verify the resulting
source and paper reports. They use actual record time and copied source bytes.
At final bounded observation, saveSnapshotPaperReport persists CLOSED_MODELED,
NO_ENTRY or OPEN_UNRESOLVED honestly. Copy the report alone into a new isolated
workspace at its original relative path and verifySnapshotPaper to prove recovery.
Never alter older plans or infer an unseen stop/target fill.

## Rehearsal assumptions

Current candidate is IBIT October 16 2026 $47 put, ID
8f59fe6b-62c1-4c83-9993-faef95313b10, chain
f4b86825-a92b-4e23-8f93-1ee813d0ec15. Engineering purpose is plumbing, not a bearish
forecast or profitability claim. Freeze before the 10:15 New York decision and
enroll using PIPELINE_REHEARSAL_NOT_SIGNAL before that decision. Existing register
supports retrospective records, so enrollment's PROSPECTIVE_ONLY check matters.

Proposed window is September 30 10:15-10:21 New York; time exit 10:35. Separate
bounded observations are 10:15, 10:20, 10:25, 10:30, 10:35, and 10:40 fallback if
still unresolved. One contract; entry limit 150 cents/share; spread cap 10 cents;
exit allowance 1 cent/share; frozen 20% stop and net 2R settings. The reviewed
September 10 fee profile is a dated engineering estimate, actualFeesConfirmed
false, not a new claim about current brokerage charges. Entry/exit manual fee
fields remain null in that profile. Global unknown costs are not overwritten.

The 100-500 USD allocation and declared 1,000 USD cash are frozen existing
settings, not verified account balances. A 150-dollar premium plus modeled costs
fits that allocation; each actual quote must independently pass unchanged gates.
A low ask can fail the minimum allocation and must not increase quantity silently.
Price-limit eligibility cannot be inferred from the September 29 reference ask.

Five-minute observations exceed the existing 60-second gap threshold. Therefore
quoteGapObserved is expected once a position spans these observations. The
unobserved path can hide earlier stop/target events; modeled exits use only later
admissible independent quotes. If none arrives, retain open premium exposure and
unknown net P&L. Do not force a zero-price exit or claim continuous monitoring.

Existing Paper validation displays plan, fills, review, costs and candidate
lessons. The separate manual-ledger Evidence loop / Alpha Journal is not populated
by paper fills; no invented prediction or reported trade may be inserted there.
The existing 15:50/16:05 jobs and their natural acceptance remain independent.
CollectionPlan may retain SCHEDULE_GAP because its dated Host cadence does not
include this separate one-off job; only explicit job and slot receipts prove it.

## Acceptance

Synthetic fixtures test standalone serialization through original capture
normalization and V3 mapping, exact identities, metadata paging/call limits,
provider failures, malformed/repeated cursors and elapsed/clock boundaries.
No synthetic fixture establishes tomorrow's entry, exit or completed acceptance.
The operator owns real registration, scheduler installation and market execution;
this change does not itself install those actions.
