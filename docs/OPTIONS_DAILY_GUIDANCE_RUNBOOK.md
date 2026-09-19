# Daily news and GLD/IBIT guidance Host

## September 19 15:50 routine repair — current operating instruction

Owner approved repairing **only** the existing gld-ibit daily 09:00 context work
and weekday 15:50 GLD/IBIT collection. Use `OPTIONS_DAILY_GUIDANCE_HOST_V4.json`
and `status/routine-1550.json`. This supersedes older hourly/event/26-wake
instructions below. The disabled 28-call feasibility diagnostic is rejected.
Do not enable it, restore expired closes, create another job or change V1.

The Git Host V4 file is a sanitized reference only. Actual local binding and full
before/after configurations remain private; committing this file neither backs up
nor restores the app scheduler. Do not apply the reference as an update payload.
Git operations belong only to equipped development sessions, never scheduled
market work. First natural acceptance remains PENDING_NATURAL_RUN until the
window arrives. A later development session must check the saved receipts and
existing browser page without repeating market requests. Record an uninspectable
page as NOT_OBSERVED, not as a successful display. Use existing routine freshness
rules; frozen minute-level V1's 60-second rule is not this acceptance criterion.

The existing heartbeat uses the host's local timezone, currently verified as
America/New_York (Windows Eastern Standard Time, including DST). Its weekly
recurrence selects 12 wakes: seven 09:00 and five weekday 15:50. Confirm this
timezone before collection; a timezone mismatch blocks market reads and needs
Owner attention. App/host availability and allowance are still required.

1. Record actual task-start time, then run `--route-ongoing` with the actual clock.
   At 09:00 retain the fixed context refresh, attributed review, paper observation
   and guidance publication. No market collection is authorized in this branch.
2. At 15:50 require `marketCapture=true`, then `--begin-slot <route.slot>` once.
   The route now uses the existing reviewed 2026 calendar: holiday, already-closed
   early-close day and unknown year skip collection. A 13:00 close is **not**
   moved to 12:50. An existing claim forbids another acquisition even after failure.
   The actual routine route expires at 16:00; missed windows remain missing.
   A skip records its actual reason; it is not a successful capture.
3. Before sources, check current capture count/bytes against existing limits:
   200 capture records per UTC storage date, 1,000 total research captures,
   8 MiB per capture and 64 MiB aggregate copied snapshot sources. September 19
   preflight fits one normal capture; this is not unlimited future capacity.
   Preserve old files and limits. If there is no room, stop acquisition and report
   the actual capacity block. Do not prune history to make a read pass.
4. Run the existing `--host-source` collector first, ahead of slower public work.
   Keep its six tracked identities, 24-call and 36-option-quote limits. Use only
   the four named market read tools below. Check actual New York time before each
   tool invocation; do not start a request at or after 16:00. An already pending
   response may finish later: preserve that late clock and mark its limitation.
   Count actual tool invocations separately from returned rows and local writes;
   a local guard rejection is not a provider invocation. Never retry acquisition
   to hide partial responses, absent IDs, source lag or a future source clock.
5. Save exact raw input under `data/runtime/options-daily-guidance-inputs`, use
   `--record`, then `--verify`. Inspect automatic paper observation output and
   run `--observe-paper` before publishing. Completed rehearsals stay closed;
   no registration, invented fill or strict trend qualification is authorized.
6. Refresh the existing attributed analysis against this saved capture, publish
   and verify; read `--decision-cards` and `--delivery-health`. Use the existing
   Daily guidance page's Reload saved data button. Match the displayed capture
   clock and IDs/coverage with the saved capture and `/api/state` guidance input.
   API availability and a rendered page are different acceptance stages.

For the first natural window, save an append-only receipt under
`data/runtime/options-workbench-development/routine-1550-runs/` and point
`docs/status/routine-1550.json` to it. This is an operational receipt, not a new
framework. Include scheduled NY/UTC window; actual task start and exclusive claim;
actual request/response clocks and tool-call counts; selected/returned/missing
quote IDs; unchanged source timestamps and age at receipt; future/second-precision
clock issues; raw and verified record paths/hashes; automatic paper result/errors;
published report and market fingerprint; API capture clock/IDs; browser observation
time, displayed capture clock/coverage, and actual page check result. Record each
stage as PASSED, FAILED, SKIPPED or NOT_OBSERVED with its own evidence. Use the
existing freshness rules; do not call returned quotes fresh merely because saved.
If the task never started, preserve the missing window on the next natural wake;
do not invent a claim or request in the past. A stale/partial sample may still be
displayed with its existing warnings. Until these natural receipts exist, report
**repair complete, awaiting first natural run**. Local copied-data tests do not
fulfil that acceptance. No dollar source fee has been verified.

## September 19 installed schedule and feasibility finding

Installed gld-ibit was read at 22:47:35.426 UTC: ACTIVE, 09:00 daily only. Its
prompt still names hourly/15:50/event coverage; that is not installed recurrence.
Cause is unknown. The actual 09:00 ongoing route does not collect market quotes.
Do not infer execution from Host V3 or the next nominal wake; do not silently
change the automation. See [feasibility](OPTIONS_SOURCE_FEASIBILITY_DELIVERY.md)
for evidence, the C conclusion, capacity counts and one disabled prospective
proposal. No source frequency is authorized here. Existing actual-time routing
and exclusive claims still govern any actual wake.

## September 19 focused observation repair

`--host-source` now also reports `trendTracking`. Existing event research and
explicitly enrolled paper identities retain priority; actual-source frozen trend
selections share unused capacity within the same six tracked IDs, 24 calls and
36 quotes. Capacity waits, identity conflicts, expired entry windows and synthetic
exclusion are explicit. A tracked identity is a request preference, not a returned
quote or a fill. Closed studies are not restarted. Use the generated collector
unchanged and retain its failed/missing identities.

The trend desk now distinguishes missing prospective observations from a fully
observed no-signal window, and entry quotes from accepted later exit observations.
These are current read-only diagnostics; saved V1 reports remain unchanged.
The cadence requirements preview is disabled, not a new schedule or authorization.
Continue the existing actual-time route, exclusive claim, record/verify and
observe-paper workflow. No additional source call or timer is requested here.

## September 16 restart — current operating instruction

The Owner approved the narrowed daily-decision milestone. The app reported the
old gld-ibit task absent; both ordered restore/update attempts failed because it
did not exist. A new gld-ibit heartbeat was created in ONGOING mode using
OPTIONS_DAILY_GUIDANCE_HOST_V3.json. The expired seven-close study must not run
or restore again. Older TRANSITIONAL instructions below are historical.

On September 17 only, the existing 10:20 and 11:20 hourly wakes also authorize
one bounded market capture for enrolled pipeline-check-ibit-20260917, even if
the event-day condition is false. Claim the actual ongoing slot once; a combined
event/rehearsal wake still performs only one capture. Use the existing host-source
collector with active paper identities. Never change the frozen plan, collect
outside the actual window to backfill it, or treat NO_ENTRY as a round trip.
Inspect paperObservations after recording and run --observe-paper before each
publication. Subsequent regular observation/finalization remains unchanged.

After publication, --decision-cards reads the same current decision projection
used by the frontend. A dated-fee example does not fill missing global fees or
promote WATCH. Fresh news receipt and fresh option quote clocks remain separate.
The active goal requires a genuine later-snapshot modeled entry and exit plus
recoverable review, in addition to the recovered sources and daily cards.
Routine wakes remain quiet; do not run automatic development or periodic progress
reports. Source or host failure requiring Owner action must still be disclosed.


`deliveryHealth.contractCoverage` now shows all selected contract identities and
expiry-level counts from the verified original capture. `SOURCE_QUOTE_MISSING`
means a successful response lacked that ID's quote; it does not establish why.
New captures explicitly record `OPTION_QUOTE_IDENTITIES_MISSING`. Preserve the
partial receipt and source clocks; do not retry, swap contracts or backfill a
paper window to make the missing count disappear. See
[quote coverage](OPTIONS_QUOTE_COVERAGE_DELIVERY.md).

Owner schedule change, September 12: use
[Host V2](OPTIONS_DAILY_GUIDANCE_HOST_V2.json) for current updates and final-close
ongoing fields. Routine samples are now 15:50 only; 09:50 and 12:50 are cancelled.
Hourly news, 09:00 context, conditional event-hour reads and bounded 16:20 closes
are retained. The first affected weekday is September 14. Historical missing
windows and the immutable Host V1/v6 snapshots remain unchanged.

The Host brief includes `eventReactions`, a read-only comparison of saved ETF
last-trade observations and prior analyst views around current scheduled events.
Use its actual sample offsets, calendar receipts and missing reasons. Date-only
FOMC coverage cannot supply an intraday reaction; a same-direction change does
not validate a hypothesis or identify its cause. This projection does not request
quotes or alter routing, claims, publication or frozen paper cutoffs. See
[delivery](OPTIONS_EVENT_REACTION_DELIVERY.md).

The Host brief now includes bounded contract rationales and six-dimensional
evidence gaps. Treat terminal breakevens as expiry payoff references, never a
pre-expiry forecast or target. A note preceding newer market evidence requires
reassessment. Original gates/ranking are unchanged; see [delivery](OPTIONS_GUIDANCE_RATIONALE_DELIVERY.md).

Owner authorization: September 8, 2026. Use only existing gld-ibit in the Alpha
workspace C:/Users/liuha/.codex/worktrees/8f09/Alpha. Development stays in the
current conversation. No development continuation, progress reports, orders,
account tools, paid steps, re-login, consent, quota resets or new tasks.

## Public macro context addition

The local context service also claims three official macro reads once per New
York date after 17:00: Treasury nominal, Fed H.10 broad USD/FX and Cleveland CPI/PCE
models. Its macro-daily claim uses the local date across UTC midnight. This does
not change Host schedule/restore fields or existing source claims. The Host
brief exposes saved macroContext: retain its source lag and distinguish model
estimates from consensus and reported actuals. No second refresh is required
when today's macro claim already exists. See [delivery](OPTIONS_MACRO_CONTEXT_DELIVERY.md).

## Current capital policy

The Owner explicitly removed the old risk caps on September 9. The new saved
OWNER_ALLOCATION_ONLY_V2 settings retain $100–$500 per trade / $1,000 declared
equity. Read the current Host brief's capitalPolicy; do not reinstate the old
$5 planned-loss, $25 full-premium or shared event caps from dated analyst notes.
Stops, net-R targets and full-premium exposure remain scenario calculations;
unknown costs and source/evidence blockers remain. Historical frozen studies
retain their own settings. See [delivery](OPTIONS_OWNER_ALLOCATION_DELIVERY.md).

## Route and claim

Run `node node_modules/tsx/dist/cli.mjs scripts/options-daily-guidance.mjs --route`
in the transitional phase, or `--route-ongoing` in the ongoing phase.
Use its actual clock; never inject a past clock. The configured New York wakes
are hourly at :20, plus 09:00 and 15:50 (26 daily wakes). Public refresh also runs
locally while Alpha is open; it does not depend on a model wake. Source refresh
claims are shared by the local service and this Host.

During the transitional schedule, if route.pastCloseWindow is true (after 18:00
New York on September 16, or any later date),
first restore the exact immutable v6 restoreFields through automation_update,
then install ongoingFields from OPTIONS_DAILY_GUIDANCE_HOST_V2.json. Do this
before other evidence work. An ongoing-phase wake never restores v6 again.

If route.publish is false, stop. Otherwise run `--begin-slot <route.slot>`.
An existing claim is not proof of successful completion: inspect source clocks
and the newest issued record. Do not repeat source acquisition in that slot.
An interrupted attempt remains a gap. The next eligible slot is a new attempt.

## Public context

Run `node node_modules/tsx/dist/cli.mjs scripts/options-context-service.mjs --once`
once using the supported approved per-command network path. This fixed command
reads hourly headlines/BTC and daily Treasury/BLS/FOMC after 09:00 New York,
with independent sanitized source receipts and no brokerage access. An existing
same-hour/day claim prevents duplicate reads. A failed source remains failed;
do not retry to manufacture success or relabel old headlines as new.

After a late startup, an unattempted current-day daily group remains eligible
from 09:00 until New York midnight. Its claim is stored under that local date,
including after UTC midnight. Existing failed or unfinished daily claims remain
unchanged and suppress another attempt. The separate 18:00 close-capture boundary
is unchanged. Do not manufacture an earlier day's receipt. See
[late-start correction](OPTIONS_CONTEXT_LATE_START_CORRECTION.md).

When starting the persistent workbench from Codex, use the supported approved
per-command network path for `node scripts/start-options-workbench.mjs --no-open`.
A child started in the restricted command environment can inherit its network
denial. The launcher checks loopback interface identity only; it cannot upgrade
an already running process or establish successful outbound reads. Before a
needed restart, identify the exact Alpha workspace/script process and matching
127.0.0.1:4173 listener. Keep claims/failed receipts and verify the next natural
hourly collection. Do not change global security settings or create a collector.
See [startup correction](OPTIONS_COLLECTOR_STARTUP_CORRECTION.md).

The public service also has an independent hourly `focused_news` claim. It reads
three fixed supplemental feeds: Federal Reserve speeches, EIA Today in Energy
and CoinDesk. Original six-feed claims and journals remain unchanged. A completed
old hourly claim does not suppress this new slot. Inspect supplemental source
health, publication/receipt clocks and partial-feed diagnostics in `--host-brief`.
An unavailable source remains a coverage gap; retained older titles are not a
successful new refresh. CoinDesk titles are attributed reporting, not verified
ETF flows or institutional positions. Unknown and future publication clocks must
never be promoted to current verified facts.

## Daily focused news review

The Host brief now includes `goldFramework`: all 14 Owner screenshot areas and
seven added checks, with declared horizon/regime review orders and actual saved
coverage. Use it to select relevant evidence and name missing inputs. Do not
count a macro release, Fed repricing, rates and USD as independent causal votes,
infer a current regime from the checklist, or treat daily TIPS as intraday yields.
Technical confirmation requires qualified underlying OHLCV; option histories
do not supply GLD VWAP. The framework adds no source calls or schedule change.
See [cross-check and corrections](OPTIONS_GOLD_FRAMEWORK_DELIVERY.md).

At the first daily 09:00-or-later context wake, use the existing Host web tool for
a bounded focused review: at most three targeted searches and four article opens.
Inspect today's saved analyst note first to avoid duplicating a completed review.
At a material event checkpoint, update only the relevant changed evidence. This
uses the existing Host schedule, not a new task or an additional brokerage call.

- Gold: World Gold Council demand, central-bank purchases and ETF commentary;
  distinguish weekly/quarterly evidence from today's flows. Use GLD issuer or
  official policy releases for specific facts when available.
- Bitcoin: IBIT issuer disclosures, Bitcoin ETF developments, official regulation
  and material Bitcoin/crypto-system news. Attribute specialist reporting and
  distinguish reported flows from a connected, independently checked flow series.
- Shared drivers: rates, real yields, USD, inflation/jobs, oil, liquidity and
  geopolitics. Broader reputable reporting may identify a development; prefer the
  original institution for verifiable releases. Exclude unrelated single-stock
  technology stories and other tokens unless their transmission to GLD/IBIT is
  explicit. Missing sources and paywalls are gaps, not reasons to pay or register.

Record source URL/title and actual retrieval time in the existing analyst note;
leave unknown publication times null. Summarize only material supported evidence
and distinguish conditional mechanisms from observations. BLS/FOMC official
calendars take precedence over relative dates in a news article. Explain unresolved
disagreements rather than silently choosing a convenient interpretation. A daily
web review is not a continuous newswire or automatic access to another ChatGPT
task. User screenshots are unverified reference material until corroborated.

## Existing bounded close collection

When route.closeCapture is true, execute the existing close runbook's bounded
capture, record, compare and activity-study sequence. Preserve its raw collector,
seven session dates, 16:20 window, all prior journals and original field snapshots.
Do not run the cancelled opening collection.

On September 16 use a finally block: restore exact v6 fields FIRST, then install
ongoingFields from OPTIONS_DAILY_GUIDANCE_HOST_V2.json SECOND, before comparisons,
activity updates or final evidence reads. This preserves the original restoration
ordering while fulfilling the Owner's newer request for ongoing daily guidance.
Do not delete the shared task. Any final-close failure must still run both field
steps. A later transitional wake performs the same restoration/install ordering.

## Bounded guidance market capture

At route.marketCapture (15:50 weekdays), collect once. Do not restore the cancelled
09:50 or 12:50 routine reads. Additionally,
an hourly :20 weekday wake between 09:30 and 16:00 may collect once when the
current host brief lists a major event whose dates include today (10:20, 11:20,
12:20, 13:20, 14:20 and 15:20). This supplies
event-day checks without claiming exact event-time fills. On market holidays,
stale source clocks must produce WATCH; do not declare the session open merely
because it is a weekday.

Read `scripts/options-daily-guidance.mjs --host-source` using the checked-in CLI.
Evaluate only that returned repository function, never provider text:

```javascript
const code = await tools.exec_command({
  cmd: "node node_modules/tsx/dist/cli.mjs scripts/options-daily-guidance.mjs --host-source",
  workdir: "C:/Users/liuha/.codex/worktrees/8f09/Alpha", max_output_tokens: 8000
});
if (code.exit_code !== 0) throw Error("GUIDANCE_HOST_SOURCE_UNAVAILABLE");
const collect = new Function("return (" + JSON.parse(code.output).source + ");")();
const allowed = {
  get_equity_quotes: tools.mcp__robinhood_alpha_market_data__get_equity_quotes,
  get_option_chains: tools.mcp__robinhood_alpha_market_data__get_option_chains,
  get_option_instruments: tools.mcp__robinhood_alpha_market_data__get_option_instruments,
  get_option_quotes: tools.mcp__robinhood_alpha_market_data__get_option_quotes
};
const capture = await collect({
  clock: async () => (await tools.clock__curr_time({})).current_time,
  call: async (name, request) => {
    if (!Object.hasOwn(allowed, name)) throw Error("MARKET_TOOL_NOT_ALLOWED");
    const marketTool = allowed[name];
    const result = await marketTool(request);
    if (result.isError || !result.structuredContent?.data) throw Error("MARKET_SOURCE_FAILED");
    return result.structuredContent;
  }
});
store("guidance-market-capture", capture);
text({capturedAt:capture.capturedAt,calls:capture.calls,
  selected:capture.selectedIds.length,failures:capture.failures.length});
```

The collector bounds calls to 24, pagination to eight pages per symbol and quote
selection to 36 existing IDs, in batches <=20, with a three-minute request-start
deadline. A pending call may complete later. Preserve null/missing replies.

The returned source also embeds at most six contracts from verified active event
research plans and explicitly enrolled prospective V2 paper plans. Event research
keeps priority; identical paper identities share the same slot. Paper capacity
waits, identity conflicts and recovery failures are returned in `paperTracking`.
Synthetic enrollments cannot enter Host tracking. It rechecks metadata in current instrument replies and
gives them priority inside the same 18-per-ETF / 36-total limit. Missing tracked
contracts and pagination/deadline exhaustion remain failures. Extra expiry dates
share the existing call/page limits. After a study's final observation window,
its priority ends. The Host fields, scheduled times and close workflow do not
change. The Event research page consumes these saved captures automatically;
it cannot invoke the Host or create an order.

Save exact JSON with apply_patch Add File to a NEW actual-timestamp path under
data/runtime/options-daily-guidance-inputs. Never interpolate provider JSON into
shell commands. Then run `--record <workspace-relative-input-path>` and verify the
returned record with `--verify <path>`. The local parser cannot authenticate a
caller-provided export. No historical candles, trades or wins may be invented.

`--record` first preserves the original capture, then independently saves paper
observations for eligible enrolled plans. Inspect its `paperObservations`, including
per-plan errors. A paper save failure does not invalidate the primary capture and
must not trigger a second source acquisition. To retry local processing only, call
`observePaperPlans(workspaceRoot, savedCapturePath)` from
`scripts/lib/options-paper-observation-io.mjs`; use its actual default clock.
Automatic report identity binds the capture hash; retries reuse the same immutable
report and cannot add evidence recorded after that capture. This is an assumed
snapshot lifecycle, not execution or a calibrated signal.

Before each issued publication, including wakes with no market capture, run
`node node_modules/tsx/dist/cli.mjs scripts/options-daily-guidance.mjs --observe-paper`.
The running local public service also performs this offline null-capture pass
before network work on its existing minute tick. Check Event research for the
actual local status. This is idempotent recovery, not a replacement quote reader;
keep the Host step and final-close restoration order. See
[local recovery](OPTIONS_LOCAL_PAPER_FINALIZATION_DELIVERY.md).
It finalizes expired paper windows using only sources recorded by five minutes
after the plan's modeled session close. It makes no source calls. A missing entry
stays NO_ENTRY; a missing exit stays OPEN_UNRESOLVED. Reports retain reviews and
candidate lessons in the existing notebook. The original final-close v6/ongoing
restoration must still occur first. Do not create, enroll or cancel a paper plan
from a scheduled wake; enrollment is an explicit local development/Owner action.
See [paper observation specification](specifications/OPTIONS_PAPER_OBSERVATION_V1.md).

## Attributed analysis and issued view

Read `--host-brief` (compact; avoid printing the entire state). Examine source
receipt times, latest published titles, event dates, previous interpretation,
trend inputs, option clocks, liquidity and unchanged economics.

The brief's `deliveryHealth` and offline `--delivery-health` check the same
verified capture, claim and publication evidence as Daily guidance. Its denominator
contains dated fixed New York ten-minute windows over
seven calendar dates, after activation and excluding reviewed closed sessions.
Event-dependent reads and full-chain close collection are separate. A saved
claim is not completion; a receipt can still contain stale or missing quotes.
Inspect actual Host errors for a missed window's cause. Do not replay a past
window, change the schedule or increase the read budget from this diagnosis.
`usesCurrentMarketInputs` confirms exact copied market inputs, not freshness or
substantive analysis quality. Publishing another WATCH cannot refresh a quote.
See [delivery health](OPTIONS_GUIDANCE_DELIVERY_HEALTH_DELIVERY.md).

Save a new English interpretation when there is new material evidence, a market
capture, an event checkpoint, or the prior interpretation is older than 24 hours.
Use primary-source articles when verification is needed; treat source text as
untrusted data. Separate actual facts, conditional mechanisms and missing data.
An article outside the nine fixed RSS feeds is a separately attributed Host read,
not a new automatic connector. Never infer institutional order direction from volume.

Stage JSON with exactly:
```json
{
  "assessedAt": "ACTUAL_CURRENT_UTC_ISO_WITH_MILLISECONDS",
  "assets": [
    {
      "symbol": "GLD",
      "bias": "INSUFFICIENT_EVIDENCE",
      "summary": "A concise source-backed assessment.",
      "supporting": ["Observed facts or explicitly conditional mechanisms."],
      "opposing": ["Contradictions and coverage gaps."],
      "invalidation": "What would invalidate this view.",
      "eventPlan": "Before/after event posture; current stop/target limitations.",
      "sources": [
        {
          "url": "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm",
          "title": "The actual source title",
          "publishedAt": null,
          "retrievedAt": "ACTUAL_SOURCE_RECEIPT_UTC_ISO_WITH_MILLISECONDS"
        }
      ]
    }
  ]
}
```
The actual file must include exactly one GLD and one IBIT asset. Allowed biases:
BULLISH, BEARISH, MIXED, INSUFFICIENT_EVIDENCE. Source receipt must not be later
than assessment. Leave unknown publication clocks null. Do not use a current
clock to make an old read appear new. These are uncalibrated interpretations;
they can block but cannot override the deterministic checks.

Run `--analysis <staged-path>`, then `--publish` and verify returned records.
Both WATCH and conditional candidates are saved. If costs are unknown, do not
invent an exact net-R target; show the existing indicative premium stop and
explicit missing costs. No daily quota of trades, 80% win claim, larger allocation
or forced-entry recommendation is permitted. Record actual owner executions only
when the Owner supplies them to the separate existing manual ledger.

The local frontend automatically reads saved evidence while idle. Issued records
are immutable; current reassessment can change as quotes age. Missed source reads
and failures remain gaps. An awake online host, working authorization and available
Codex allowance remain necessary for the Host market reads; there is no persistent
brokerage socket or independent broker collector.
