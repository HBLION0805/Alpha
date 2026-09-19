# ETF source and sampling feasibility — September 19, 2026

## Decision

**C — current source, Host scheduling and local storage cannot support frozen
GLD/IBIT trend V1.** This is an operational finding, not a failed trading strategy.
More polling alone would not repair source semantics, uncertain freshness or
whole-capture duplication.

**No prospective regular-session observation window was validated.** Today is
Saturday. The saved September 18 day remains DATA_MISSING for both ETFs, with
zero signals, entries and closures; it is not an observed no-signal day.
Completed engineering paper rehearsals were not reopened. Frozen rules, cohort,
capital, risk settings, canonical guidance and historical records remain intact.

This delivery adds evidence and operating-note corrections only. The preceding
focused repairs are retained. No product module, page, questionnaire, collector,
test framework or timer was added. Private evidence is under
data/runtime/options-workbench-development/.

## Final-code verification

The existing command **node scripts/alpha-validate.mjs** was rerun after the
previous monitoring-grace adjustment, on the actual final implementation:

- Completed September 19 **22:41:04.216 UTC**, exit 0; **4,781 passed, 0 failed,
  179 components**, duration 123,832 ms.
- Includes type checking, 51 current trend tests, existing source, paper and
  application checks, and staged/unstaged whitespace checks.
- Warnings are the expected uncommitted worktree and Windows line-ending notices.
- Log: source-feasibility-final-workspace-validation.log; SHA-256
  213b34dcc8a71046043d2a02ad6b95106478360b7da1c26d270130d637116f6c.
- source-feasibility-audit.json records the seven changed implementation/test
  file hashes. None changed after validation; subsequent edits are documentation.
- Final read-only recovery at 22:57:14.834 UTC verified both existing trend files
  (registration plus day record) and all 18 snapshot plans/reports, with zero
  production writes. See source-feasibility-preserved-records.json. The first
  broad file enumeration included enrollment metadata unsupported by the snapshot
  verifier; narrowing to its plan/report scope passed without a product change.

Reproduce local checks from the Alpha root:

    node --import tsx data/runtime/options-workbench-development/source-feasibility-audit.mjs

This private script performs no network call, enrollment or production-store
write. Its sizing and 200/201-event exercises are engineering inputs, not market
observations. Rerunning refreshes private audit/timing output only.

## Source qualification

Current callable tool descriptions and their retrieval clock are saved in
source-feasibility-tool-schema.json. The [official Robinhood tool catalog](https://robinhood.com/us/en/support/articles/trading-with-your-agent/)
confirms historical-bar and quote tools, but does not explain omitted flags,
bar publication deadlines, request-rate allowance or these discrepancies.

| Question | Evidence | Finding |
| --- | --- | --- |
| Omitted interpolation flags | Schema makes the field optional and explains explicit true. All 156 five-minute and 780 minute bars omit it. | UNKNOWN; no documented omitted=false default. The settled-close interpolation field is a different field. |
| Labels, bounds, adjustment | Schema says UTC left-edge labels; saved requests explicitly use regular bounds and no adjustment. Grids contain 78 five-minute / 390 minute bars per ETF. | Request/label facts confirmed; exact trade-boundary inclusion and filtering undocumented. |
| Provider aggregation | Schema says intermediate bars are not server-aggregated for custom intervals. It does not promise native five-minute bars equal grouped native minute bars. | Native construction, trade filters, late-print corrections and revision clocks UNKNOWN. |
| Differences | Independent exact arithmetic reproduces all original differences. | CONFLICTED: four intervals / 13 fields; no local parser or grouping fault reproduced. |

The independent implementation groups raw minute rows by UTC timestamps, not
production-parser rows or index slices. It checks every expected minute, then
uses first open / max high / min low / final close / summed volume with integer
micro-USD. Text and structured payloads agree. Both existing production reports
also recompute to their original fingerprints.

| ETF / September 17 New York interval start | Matching intervals | Differences |
| --- | --- | --- |
| GLD 10:15, 14:50 | 76 / 78 | open, high, volume in each: 6 fields |
| IBIT 10:15, 13:05 | 76 / 78 | open, high, volume; then open, high, low, volume: 7 fields |

The exact source values remain in the private minimal reproduction below; only
the conflict counts and affected fields are published here. All closes match.
These are historical discrepancies, not current price recommendations.

source-feasibility-minimal-repro.json contains the four raw five-minute rows,
twenty contributing minute rows, exact differences, requests, original receipt
clocks and file hashes. Five-minute receipt: September 17 23:49:18 UTC;
minute receipt: September 18 00:27:29 UTC. Different receipt times are a possible
variable, not a proven cause. Neither history was fetched again.

Supplier questions are drafted, not sent:

1. Does omission of bars[].interpolated guarantee false, for which schema/feed/
   interval versions? Can explicit flags be returned?
2. Do minute and five-minute bars use the same trades, boundary inclusion,
   odd-lot/correction filters and adjustment policy? What is exact start/end inclusion?
3. Explain the attached four intervals at their original receipt clocks. Is
   revision, cancellation or late-print metadata available for these 13 differences?
4. When is a closed regular bar first available and final? What refresh behavior,
   rate/concurrency limits and monetary charges apply to these market tools?

No source-code repair or additional regression test was warranted by this
reproduction. Existing audit/parser tests passed. Descriptive display remains
separate from strict research qualification.

## Installed Host and local processing

At **22:47:35.426 UTC**, the installed file
<CODEX_HOME>/automations/gld-ibit/automation.toml was ACTIVE but scheduled
**09:00 every day only**. Its prompt still names hourly news and 15:50/event quotes.
File SHA-256: c6384c0ba40f35dd1cf2024a737ce9e07c4a79d0d289f53401373468800d4f19.

The saved Host V3 document describes 26 daily wakes; that is intended configuration,
not installed recurrence evidence. The app view rendered the automation card but
returned no machine-readable recurrence. The installed-file readback is the
auditable evidence here. The discrepancy's cause is unknown; nothing was restored
or rescheduled during this audit.

The actual 09:00 ongoing route has marketCapture=false: **zero scheduled
regular-session quote collections** under this recurrence. Even the intended
one routine collection, or up to seven on event days, cannot cover frozen V1.
The desk's next nominal quote is not a verified future wake.

[Official local scheduling documentation](https://learn.chatgpt.com/docs/automations?surface=app)
requires the computer and app to remain running for local tasks. Minute-based
thread schedules are supported, but the reviewed documentation provides no
60-second completion SLA. Available usage and working market authorization are
also necessary; no usage reset was requested.

The existing Host collector does not request ETF history. The local 60-second
service tick processes saved evidence and then awaits public-source refresh.
Its active guard skips overlapping ticks; public subprocesses can each take up
to 90 seconds and run sequentially. A 60-second timer is not a processing guarantee.

Actual saved receipts and current local measurements:

- **16 saved Host captures**, September 8–17; none dated September 18 in this
  store. Each used 15 or 16 calls, returned 24–36 non-null option quotes and
  856–1,076 instrument metadata rows.
- Seven September 17 captures each used 16 calls / 36 option quotes. Collection
  took 3–9 seconds; capture-to-record took 6.417–19.477 seconds. Sparse success
  does not demonstrate continuous coverage.
- In the wider sample one capture-to-record delay was **83.401 seconds**.
- At September 17 14:05 New York, three of 36 quotes were over 60 seconds old;
  the oldest was **420.586 seconds**. More requests do not imply newer source data.
- Several old receipt clocks have only one-second precision. Zero-millisecond
  recorded durations do not prove zero latency. Small negative source ages
  remain clock conflicts; they are not rounded into eligibility.
- Local normalization averaged **1.107 ms** over ten runs; audit recomputation
  **4.061 ms**; recovering all capture copies **421.527 ms**; existing day
  verification **8.915 ms**.
- Full read-only workbench state assembly took **9,892.170 ms**, from
  22:49:05.572 to 22:49:15.464 UTC. These benchmarks reflect current small stores,
  not loaded or end-to-end source-to-decision performance.

## Capacity derived from the frozen registration

The private audit reads and validates the saved registration, then calls existing
trendObservationWindow. It does not create another rule configuration.

An ordinary session needs opening history from 09:30, baseline through 10:30,
**47 five-minute closes from 10:40–14:30**, at most **60 seconds** source/processing
latency, independent entry within **300 seconds**, and time exit **15:40**.
Original stop/target checks and gaps over 60 seconds remain. Early-close dates
use the existing calendar adjustment.

One collector has a 24-call guard, 36 requested quote IDs and six tracked IDs.
The successful current code structure uses at most **21 calls**:
one equity batch + two chain calls + sixteen instrument pages + two quote batches.
Its 180-second request-start guard is neither a per-call timeout nor a supplier
rate-limit allowance.

| Concrete scenario | Tool calls | Returned rows assuming full responses | Local storage events |
| --- | --- | --- | --- |
| One full existing Host collection | 7–21 with a full 36-quote sample; guard 24; recent actual 16 | 2 equity quotes, up to 36 option quotes, up to 1,600 instrument metadata rows; separate close rows | One capture containing all receipts; at most one combined observation when consumed. Calls/rows are not events. |
| Intended ordinary / event day | 1 / up to 7 collections: guard 24 / 168; structural max 21 / 147 | Up to 36 / 252 option quotes and 2 / 14 equity quotes; no bars | 1 / 7 capture files, plus any separate reports. Installed 09:00-only schedule currently supplies neither. |
| Literal full collector at each of 47 entry closes plus one two-ETF bar request per close | **376–1,034**, guard **1,175** | Up to 1,692 option quotes, 94 equity quotes, **3,478 cumulative bar rows**, only **120 distinct bars** | 47 capture + 47 source files; ideally 47 combined events, up to 94 if separately consumed, before phase-only checks |
| Selection 10:40, entry 10:41, minute observations through 15:40 using full collector; five-minute bars through exit | **2,168–6,382**, guard **7,285**: 301 capture frames + 61 bar calls | Up to 10,836 option quotes, 602 equity quotes and 5,368 cumulative bars | At least **301 merged events**, or 362 separately consumed source/quote events; already over daily bounds |

The last two rows are capacity counterexamples, **not authorized collection plans**.
The bar counts sum 14–60 and 14–74 per ETF respectively. Repeated history counts
as returned rows, not new unique bars. Failed/null responses reduce returned
rows, not attempted calls. A smaller quote-only follow-up collector would change
the arithmetic but does not exist here.

Actual tracking workload can change despite fixed ceilings. The latest capture
used eight GLD pages and three IBIT pages: 1 + 2 + 11 + 2 = **16 calls**.
One extra IBIT page makes **17**. A tracked expiry outside routine expiries broadens
the query. GLD is already at eight pages in that sample; greater breadth may mean
partial lists/missing IDs rather than more allowed calls. Tracking within a
sampled expiry may add none. Six shared slots prioritize event and enrolled-paper
IDs; two new trend identities are not guaranteed space. Ceilings do not establish
unchanged actual usage or cost.

Storage is independently binding:

- **200 events per study/day**. An isolated 201-event engine input reproduced
  TREND_STUDY_DAY; the 200-event input was accepted.
- **16 MiB per trend record**. Each append copies prior events, source/report
  objects and complete market-capture UTF-8 payloads.
- With the actual saved full-day source and latest 16-call capture, no audit copy,
  14 event envelopes serialize to **16,179,196 bytes**; 15 to **17,334,848 bytes**,
  above 16 MiB even before study/report fields. These are sizing examples, not
  valid new observations or a universal 14-event limit. Smaller opening histories
  vary; including audits increases size.
- 47 such envelopes total 54,315,712 bytes in one record. Repeated append-only
  copies also amplify aggregate disk use approximately quadratically.
- Guidance readers independently cap **200 capture files per UTC date**, **1,000
  research captures overall**, 8 MiB per capture, and 64 MiB of snapshot-source
  copies combined. The collector's call guard does not enforce those totals.
- ETF source storage caps its catalog at **1,000 files**, 1 MiB each. Sixty-one
  source files per session for 20 sessions would be 1,220 before old records.

No records were deleted, truncated or overwritten to evade limits. These capacity
constraints were not refactored under this verification task.

## Minimum actual check completed

One additional read-only get_equity_quotes request for GLD and IBIT:

- Requested **22:44:11.173 UTC**, received **22:44:11.396 UTC**, **223 ms**.
- **One tool call**, **two quote rows plus two separate close rows**.
- Latest regular trade clocks: September 18 near 19:59:59 UTC; nonregular clocks:
  23:55:52.357932596 and 23:59:41.192631035 UTC, about **22.81 / 22.74 hours old**
  at receipt. Bid/ask clocks were around September 19 00:00 UTC.
- Returned close objects still carried September 17 dates. They were preserved,
  not relabeled as September 18.
- One private receipt file saved and read back: source-feasibility-connectivity.json.
  **Zero current-cohort events, enrollment or fills.**

This verifies connectivity and one response time only. No historical reread,
account/position/order or brokerage Paper Trading interface, paid service,
purchase or quota reset. Incremental brokerage market calls this task: **1**.
Per-call dollar charge and sustained throughput allowance remain **unknown**;
no monetary charge receipt was provided. Recurring usage was not increased.

## One disabled minimum prospective proposal

Historical proposal retained for audit. The Owner subsequently rejected this
28-call diagnostic; do not enable it. Current scope is only the existing routine
collection described in OPTIONS_ROUTINE_1550_DELIVERY.md.

**NOT AUTHORIZED; enabled=false.** This is a reviewable one-off source-latency
experiment, not an activation switch for a ready collector or a new cohort.

Proposed window: **September 21, 2026, 10:40–10:46 America/New_York**, only if Owner
approves before the window and starts this task with Host available by 10:39.
If missed, do not catch up; a different future date requires explicit direction.
No persistent recurrence or gld-ibit rewrite is proposed.

1. Just after 10:40: request GLD/IBIT five-minute regular/raw history from
   09:30 to 10:40, then run the existing bounded Host collector once.
2. At 10:41: one GLD/IBIT equity batch and one option batch for at most two control
   IDs from the initial sample, one per ETF. Choose smallest verified complete ID
   per ETF; retain identities even if subsequent quotes are missing. These are
   connectivity controls, not trading selections. If initial collection misses
   this slot, mark it missed and do not shift/retry.
3. Just after 10:45: request the same history through 10:45. Complete local
   source/clock checks by 10:46. Do not reread another interval to replace prices.

Maximum **28 attempted calls**: 2 history + existing 24-call Host guard + 1 equity
+ 1 option batch; current successful structure at most 25. Only the existing five
market tools; GLD/IBIT and at most two observed control contracts. No retries or
expanded pagination. Full grids: **58 returned bars** (28 + 30), at most
**38 option quotes**, **4 equity quotes**, **1,600 instrument metadata rows**;
optional close rows counted separately.

Storage: **12 MiB total**, at most five raw top-level envelopes (two bar receipts,
one Host capture with nested receipts, two follow-up receipts), plus one window
assessment. Up to **28 tool receipts**, three diagnostic epochs, **zero cohort
events**. A fresh ignored diagnostic directory retains actual clocks/hashes;
nothing feeds active source stores or enrolls plans.

Cost per call is unknown; ordinary Host/model usage applies. No subscription,
purchase, reset, login or consent. Stop on rate limit, authentication requirement,
cancellation, malformed/out-of-scope data, call/storage bound or 10:46. Preserve
failed/missed epochs. Stale clocks/unknown flags/conflicting overlaps fail their
respective checks; no replacement requests.

Owner may revoke before or during the window: no further reads, retained evidence,
no recurring job left running.

Acceptance is scoped to both complete bar grids, sampled quotes and the same
control identities' later timestamps, plus actual source-to-local-assessment
clocks. Compare ages with the **existing frozen 60-second value**. Omitted flags
remain disqualifying for strict trend use. Complete diagnostic coverage would
not establish all 47 closes, a continuous exit path or a completed trade.
Incomplete coverage stays UNVERIFIED.

## One future version suggestion and next task

A possible future **multi-session snapshot study** could use one bounded 15:50
capture per trading day, a predeclared GLD/IBIT/contract comparison, and next
session's independent 15:50 quote as outcome. Overnight/intraday paths stay
unknown; it would not claim five-minute entries or intraday stop execution.
Missing/stale data stays missing under explicit date/age criteria. ETF bars
remain descriptive until qualified.

That is a different hypothesis from frozen V1. Owner must separately approve
its rules, actual scheduling and natural prospective verification. It is not
implemented, registered or substituted here.

**Historical proposed next task (superseded and not authorized):** the single
10:40–10:46 diagnostic above. The Owner instead selected routine collection repair
and its first natural-run acceptance; no new experiment is active.
The C conclusion already stands; waiting for one window does not make V1 operational.
