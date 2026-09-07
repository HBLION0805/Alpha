# Alpha Handoff

Date: 2026-09-07. Current scope: GLD/IBIT options on Robinhood.

## Latest Owner direction

OPT-NEWS-GUARDS-2 corrects the older headline transport's total deadline,
cancellation and UTF-8 handling, sanitizes CLI failures and rejects hard-linked
journals during direct recovery/append. Existing as-of discovery filtering,
valid parser/engine outputs, source URLs, accepted history and host scheduling
remain unchanged. See [review](OPTIONS_HEADLINE_TRANSPORT_CORRECTION.md) and
[checkpoint](status/headline-transport-guards.json). No new live requests were
needed; injected failure tests use isolated temporary workspaces.

OPT-BRIEF-1 adds `options:brief -- --report <study-id> [--json]`. The actual local
brief at 2026-09-07T06:26:30.711Z shows the unchanged 09:30 opening window, no
collected frames yet, all five closed-paper reviews, four paper candidates and
fifteen separate historical candidates, plus source clocks and four upcoming
BLS releases. It is saved in data/runtime/options-readiness/operator-brief.txt
with a bound JSON counterpart. See [delivery](OPTIONS_OPERATOR_BRIEF_DELIVERY.md).
No source, host or journal changes; readiness v1/v2 and export versions remain
unchanged. The brief is a new consumer, not evidence of market test readiness.

OPT-CALENDAR-2 integrates the verified BLS calendar into the shared daily 09:00
workflow. Active restoration baseline is now v4, with all prior snapshots and
the exact option Host tick preserved. News, Treasury, BTC and calendar subflows
remain independent. See [delivery](OPTIONS_BLS_DAILY_CONTEXT_DELIVERY.md) and
[readback evidence](status/bls-daily-context.json). No new source calls or journal
changes were needed for integration. Existing readiness v2 and the original
evidence-export package exclude BLS and must not claim otherwise.

OPT-CALENDAR-1 adds standalone BLS scheduled-release collection and recovery.
The first actual runtime retrieval at 2026-09-07T06:08:21.599Z retained 313 events;
upcoming PPI/CPI times agree with the official September page. Source DTSTAMP and
LAST-MODIFIED are absent and remain unknown. Existing journals, frozen studies
and active v3 shared heartbeat are unchanged. See
[delivery](OPTIONS_BLS_RELEASE_CALENDAR_DELIVERY.md). Integrate daily calendar
context only after this independent source delivery; there is no automatic
calendar refresh yet and no change to option collection/trading authority.

OPT-EXPORT-2 rehearsed actual package recovery in a fresh temporary workspace:
six components readable, imports missing, none blocked; all five closed paper
trades retain five reviews and four candidate lessons, with fifteen separate
historical candidates. Original package and active runtime bytes are unchanged.
See [rehearsal delivery](OPTIONS_EVIDENCE_REHEARSAL_DELIVERY.md). This validates
local repository recovery, not market outcomes or live execution readiness.

OPT-EXPORT-1 adds an immutable local evidence package and independent verification.
Package `gld-ibit-prewindow-20260907` holds seven files / 522,292 bytes from the
opening study, five present journals and the existing closeout. Imported evidence
and collection attempts are explicitly absent. The original clocks and bytes
remain intact; this is no off-device backup or semantic-recovery guarantee.
See [delivery](OPTIONS_EVIDENCE_EXPORT_DELIVERY.md). No automatic exports or
restores are scheduled and all source/host records remain unchanged.

OPT-BTC-2 integrates the verified BTC source into daily 09:00 context and readiness
v2. The shared wrapper restores [v3](OPTIONS_MARKET_CONTEXT_HEARTBEAT_RESTORE_V3.json);
v1/v2 snapshots and the opening study are unchanged. The CLI now returns seven
components while the original v1 engine/export remains reproducible. See
[integration delivery](OPTIONS_BTC_CONTEXT_INTEGRATION_DELIVERY.md) for actual
host readback and validation. Optional BTC failures cannot alter core review
calculations or qualify a replay. Subsequent Codex wakes depend on available
account allowance as well as the host/app; no reset credits may be consumed.

OPT-BTC-1 adds standalone public Coinbase Exchange BTC-USD level 1 context for
IBIT, with exact nanosecond/decimal validation and a separate recovery-checked
journal. One actual retrieval at 2026-09-07T04:55:22.743Z passed the at-receipt
context checks; it is a single venue observation and no longer-current prices
must not be described as live. See [delivery](OPTIONS_BTC_SPOT_CONTEXT_DELIVERY.md).
The shared heartbeat and six-component readiness report have not yet been changed
to include this source. Next integrate daily collection after this bounded delivery.

Paper and headline journals now apply the same uncertain-persistence discipline:
paper cached access and further appends require restart after a failed write;
headline append capability is scoped to its synchronous lock callback. Complete
and partial write faults are tested, with 2,716 aggregate tests passing and all
accepted artifacts unchanged. See [correction](OPTIONS_JOURNAL_RECOVERY_CORRECTION.md)
and [checkpoint](status/journal-recovery-guards.json).

The Treasury writer now rejects append capabilities used outside the locked
callback and prohibits another append after uncertain persistence until restart
recovery. Focused fault-injection and integration checks pass; actual journal
bytes and host scheduling remain unchanged. See [correction evidence](status/treasury-writer-guards.json).

OPT-READY-1 adds the unified local readiness command for an explicitly selected
study. It recovers six existing components, reports missing/busy/corrupt stores
independently, checks all closed paper trades have matching reviews, retains
separate candidate notebook counts and lists the remaining source/cost/adapter
dependencies. It cannot refresh sources, append records, inspect the host timer
or authorize replay. See [delivery](OPTIONS_OPERATIONAL_READINESS_DELIVERY.md)
and [checkpoint](status/operational-readiness.json). Existing paper fixture clocks
remain hypothetical scenario times; they are not actual broker trade timestamps.

OPT-RATES-1 adds the first public numerical context source: Treasury daily par
real yields at 5, 7, 10, 20 and 30 years. One actual CLI retrieval and independent
restart recovery are recorded in [delivery](OPTIONS_TREASURY_REAL_YIELDS_DELIVERY.md)
and [checkpoint](status/treasury-real-yields.json). Raw XML stays in its own
checksum-linked journal; missing values, failures and original publication times
remain explicit. This does not qualify option quotes or enable replay/trades.
The shared heartbeat's active daily restoration baseline is now
[v2 news plus Treasury](OPTIONS_MARKET_CONTEXT_HEARTBEAT_RESTORE_V2.json), retaining
the original news-only snapshot byte-for-byte. Treasury refreshes once in the
daily 09:00 workflow; the frozen 09:30-09:50 opening window is unchanged.
The prior delivery chronology below retains its original restoration evidence.

The Owner requested continued autonomous development while away, with automatic
orders still excluded. RH-CLOSEOUT-1 adds the deterministic final acceptance
report: completed request slots, source failures, missing/unusable quotes,
per-contract coverage and candidate operational lessons. Reports recover their
original input prefixes and assessment clocks after later records arrive.
The final host step restores original news first, then runs the closeout CLI
`--save`; the opening window and original restoration fields are unchanged.
See [delivery](OPTIONS_ROBINHOOD_CLOSEOUT_DELIVERY.md) and
[latest checkpoint](status/robinhood-closeout.json). Actual opening data is pending.

The Owner questioned the 10:00 collection start. The active first window now
begins at the market open: September 8, 09:30-09:50 New York, using a new frozen
study `gld-ibit-observe-open-20260908`. The old 10:00 plan and all records are
preserved. Armed wakes are daily 09:00/09:30; the original news restoration
snapshot remains unchanged. See [the correction](OPTIONS_ROBINHOOD_OPENING_WINDOW.md)
and [latest operational status](status/robinhood-opening-collection.json).
The chronology below retains the preceding 10:00 activation evidence.

The Owner now requests continuous progress without separate step reports.
The latest instruction explicitly authorizes automatic collection and excludes
automatic orders. RH-AUTO-1 is armed and independently read back at
`2026-09-07T02:49:23.328Z`. The host permits one heartbeat per task; update the
existing `gld-ibit`, never create a workaround cron or delete the news task.
Its original daily 09:00 New York news workflow remains in the restoration
snapshot. The temporary 09:00/10:00 schedule switches to one-minute collection
inside the frozen September 8 window, then restores the exact original fields
before reviewing any collection files. See the
[collection delivery](OPTIONS_ROBINHOOD_AUTOCOLLECTION_DELIVERY.md),
[runbook](OPTIONS_ROBINHOOD_AUTOCOLLECTION_RUNBOOK.md) and
[current operational status](status/robinhood-autocollection.json).
Preflight returned WAIT with no new quote requests or automatic attempts; actual
in-window collection remains pending. Keep the host awake and app running.

RH-OBSERVE-1 adds bounded budget screening, prospective study freeze, linked frame
records and data-quality review/recovery. Eight actual sampled contracts remain
NO_TRADE. Study `gld-ibit-observe-20260908` is frozen for September 8, 10:00-10:20
a.m. New York. Its first actual smoke frame is outside that window and has zero
usable observations; four candidate data-quality lessons are retained. Its
pre-scheduler [delivery](OPTIONS_ROBINHOOD_OBSERVATION_DELIVERY.md)
and [operational status](status/robinhood-observation.json) remain historical. This superseded the
earlier capture checkpoint operationally; all accepted artifacts remain intact.

The preceding "start next step" completed RH-CAPTURE-1: five callable market tools,
seven bounded live reads, four real option quotes and 120 history bars. All four
quotes are stale and exceed the unchanged budgets; all 120 sampled bars are
interpolated. The local capture diagnostic, immutable save/recovery and four
candidate data-quality lessons are implemented. Source payloads are local only.
See [delivery](OPTIONS_ROBINHOOD_CAPTURE_DELIVERY.md) and
[latest capture status](status/robinhood-capture.json). Prior current.json remains
the dated pre-connection build checkpoint. Real-price trade replay is NOT_RUN.

After delivery `9915d79`, the Owner explicitly approved enabling only the five
reviewed market-data tools and personally completing official login. The enabled
host configuration is installed and verified. The Owner explicitly accepted the
broader official connection grant, and OAuth completed with CLI exit 0 and a
separate `o_auth` readback on 2026-09-07 UTC (September 6 New York). The five-tool
allowlist is unchanged. Runtime loading and actual bounded quote retrieval have
now succeeded, as recorded above.
The local refresh proxy failed before initialization (Windows socket error 10050).
That earlier refresh failure is resolved; do not repeat restart or login. Stop
before any new-account or paid step; do not repeat the connection permission
question. See [host setup](OPTIONS_ROBINHOOD_CONNECTION_SETUP.md). The build snapshot
below and in current.json predates this host operation and remains historical
validation evidence, not a live configuration inventory.

The latest instruction continues toward real-price testing. The Owner has
Robinhood; host OAuth and sampled quote access are verified, but no qualified
historical bid/ask path is available. The preceding build added a public capability report, offline local catalog
inspection, one anonymous endpoint check and a disabled configuration example.
See [current delivery](OPTIONS_ROBINHOOD_DATA_READINESS_DELIVERY.md),
[previous preparation](OPTIONS_RESEARCH_PREPARATION_DELIVERY.md) and the
[broker research reference](OPTIONS_ROBINHOOD_RESEARCH_REFERENCE.md).

The Owner requested a more realistic premium stop, 1.5R-2R exits, broad
historical/news/geopolitical driver coverage and deletion of unrelated code.
The USD 1,000-to-USD 50,000 end-2026 target is recorded as an aspiration only.
Development, commits and pushes remain explicitly authorized.
The Owner subsequently chose to defer paid data and continue preparing the local
workflow. The earlier procurement question has been answered; no purchase is pending.

## Delivered state

- Robinhood data readiness: five fixed candidate tools, bounded unverified local
  tools/list assessment and anonymous fixed-endpoint HTTP classification. No MCP
  invocation, authenticated connection, configuration installation or new quote
  adapter. All connectivity/semantic/execution flags remain false; actual quote
  replay remains NOT_RUN. Existing accepted records and fingerprints are unchanged.
- Preparation links the extraction manifest, exact child hash, metadata and
  frozen configuration, checks counts/date/contracts/chronology, and optionally
  saves an immutable report. INPUTS_LINKED_FOR_RESEARCH means coherent declared
  inputs only; no import/replay, fee accuracy or trading readiness is certified.
- Dated fee estimates cover one ordinary GLD/IBIT execution on September 4, 2026,
  with proceeds-dependent SEC fees and each component's rounding. They do not
  automatically replace existing replay costs. The reference also records both
  products' normal 16:15 ET close, September 8 scheduled sale settlement and
  explicit account/order/early-close uncertainties.
- Historical research: isolated USD 1,000 counterfactual runs, frozen intraday
  plans, declared contract/session/cost assumptions, later-snapshot assumed fills,
  pending exits and unsettled proceeds. Target triggers do not guarantee profits.
  Source snapshot time, actual import time and run-recording time remain distinct;
  plan and subset choices are retrospective declarations. No calibrated result.
- Research reviews cover all outcomes, including blocked and unresolved cases.
  Observed gaps, liquidity delays and missing-source conditions enter a candidate
  notebook using actual research-recording order; no automatic strategy changes.
- Extraction: one session / up to four declared contracts; parent/child hashes,
  source/selected/excluded counts and immutable selection manifest. Source input
  is bounded to 64 MiB / 250,000 rows; child import to 4 MiB / 10,000 rows.
- Market evidence: documented Cboe DataShop CSV adapter, exact prices, nullable
  sizes, DST-aware interval times, current ingestion clock, source/usage metadata
  and replay-checked local imports. NO_REPLAY and zero real-data trades: no actual
  file is available and contract/calendar/availability/cost/fill-model gates remain.
- Local lifecycle: GLD/IBIT contract/quote inputs, frozen intraday plans, 14-45 DTE,
  modeled fills/exits, costs, reservations, unsettled proceeds, restart recovery
  and reviews. Quote inputs are synthetic or unverified imports; no strategy
  performance, learned trend weights or brokerage readiness is established.
- Risk v2: 20% research-default premium stop, 10%-25% comparisons, all-in cash R,
  0.5% current-equity planned risk ceiling, 5% allocation maximum and separate
  USD 25 full-premium stress cap. Net target 1.5R-2R; rounded indicative exit;
  unknown costs and uncalibrated 10% escalation blocked.
- Driver catalog: 16 families, 94 indicators, 34 primary-source references.
- Actual read-only refresh: six official feeds tested, 118 initial observations
  saved locally. Headline tags are candidates only; numerical drivers remain
  NOT_CONNECTED and no probability or trading permission is emitted.
- 292 unrelated files removed. Generic calendar validation extracted from the
  removed Daily Scan composition; reusable Twelve Data and history/AI/audit
  modules preserved. See [manifest](OPTIONS_FOCUS_DELETION_MANIFEST.json).

Actual-data check on 2026-09-06: five official Cboe samples contained zero GLD or
IBIT observations. Nonbinding DataShop quotes for GLD plus IBIT on 2026-09-04 at
one-minute intervals were USD 48 basic, or USD 80 including Greeks/open interest.
No order, payment, subscription or target-ETF data acquisition occurred. These are
dated quote observations, not guaranteed current prices; supporting detail is in
the [delivery report](OPTIONS_HISTORICAL_REPLAY_DELIVERY.md).

Subsequent acquisition attempt on September 6 configured the same USD 48 basic
Cboe request in the public UI. **Automatic approval review rejected Add to cart.**
No item was added, and no payment, credentials or data acquisition followed.
The Owner subsequently answered the one-off, maximum-USD-50 purchase question by
deferring paid data and directing continued local workflow preparation. The
historical rejection remains recorded; the procurement decision is no longer pending.

New public-source finding: Robinhood's official Trading MCP lists
`get_option_historicals` (OHLC), `get_option_quotes` (real-time), chain and
instrument queries. That public-source review performed no authentication;
the later host OAuth verification is recorded above. Historical
bid/ask sizes, interval limits, retention and GLD/IBIT entitlements are unverified.
Its documented access includes all-account read visibility and trading tools, so
an authorized read-only capability assessment must preserve scope. Do not assume
Cboe purchase is the only route. Exact sources are in the
[reference document](OPTIONS_ROBINHOOD_RESEARCH_REFERENCE.md).
The disabled example is a client tool-name filter, not a narrower server-side
permission grant or GLD/IBIT argument check. Host login has since succeeded as
recorded above; account/order calls and new-account onboarding remain excluded. Exact response units, clocks, sizes and contract linkage
remain unverified; any adapter must preserve a separate Robinhood source identity.

Use `npm run options:robinhood-data -- --report` for the dated preparation report,
`--inspect-tools <JSON>` for offline catalog inspection, or `--probe-public` for
one anonymous fixed-endpoint GET. The probe neither reads a response body nor
invokes MCP. HTTP status cannot prove quote availability. Its final observed result
and validation are recorded in the [delivery](OPTIONS_ROBINHOOD_DATA_READINESS_DELIVERY.md).
The [configuration example](../fixtures/options-robinhood-data/codex.disabled.example.toml)
remains disabled; the separate host copy is now installed. No credentials are stored in this repository.

Use `npm run options:research-preflight -- --manifest <JSON> --metadata <JSON> --config <JSON>`
for preparation; add `--save` to preserve the first report and clock. Use
`npm run options:broker-reference -- --reference` for the dated scope, or
`npm run options:broker-reference -- --fees <JSON>` for a supported fee estimate.
Preparation does not import the candidate or run the research engine. Preserve
the manifest and preparation record alongside the explicit subsequent steps.

Use `npm run options:historical-replay -- --demo` for synthetic cases,
`--record-demo` to persist them separately, `--input <config JSON>` to look up a
locally imported dataset, and `--report` to reconstruct runs and the notebook.
Missing data is a recorded BLOCKED outcome. Use
`npm run options:market-extract -- --input <CSV> --selection <JSON>` before market
import when the source is larger than the import limits. See the
[config example](../fixtures/options-historical-replay/config.example.json) and
[selection example](../fixtures/options-historical-replay/selection.example.json).
The examples deliberately contain unqualified assumptions and illustrative
contract identities; they do not authorize a trade.

Research history is separate in `data/runtime/options-historical-replay/` and
excluded from Git. Replays retain complete source evidence and exact hashes;
extracted source subsets remain local. Same-ID repeats are idempotent. Changed
inputs, corrections or a later retry after a missing-data attempt need new IDs.
Do not change the original NO_REPLAY gate or old paper/review fingerprints to
make a research attempt pass.

Local headline history lives under `data/runtime/options-driver-monitor/` and
is ignored by Git. The journal stores one linked refresh batch at a time and
rejects damaged history or an existing writer lock. Refresh is a one-shot
command. An external hourly Codex heartbeat (automation id: gld-ibit) is active
for this task; it requires the computer/app and this worktree to be available.
It reports meaningful related changes or source failures, not routine no-change updates.

See [current delivery](OPTIONS_ROBINHOOD_DATA_READINESS_DELIVERY.md),
[data-readiness specification](specifications/OPTIONS_ROBINHOOD_DATA_READINESS_V1.md)
and [machine status](status/current.json) for validation and exact boundaries.
Old milestone/test records remain historical; never report 3145 as the current
post-deletion test count.

## Next work

Continue without purchasing data. Screening, prospective capture preparation,
recording and quality review are implemented. Use the frozen September 8 study's
`--review` and `--template` commands, then capture the two approved quote responses
at actual time during its window. Record every attempted market frame, including
missing or bad data. There is no automatic quote scheduler and no current usable
series. If the window is missed, preserve it and freeze a new future study. The
eight probes are not a complete chain search and cheap options are not a proven
high-win-rate strategy. See the current delivery for exact paths and commands.
Host OAuth, tool loading and the first actual schema/quote assessment are complete;
stop before any new-account or paid step. Do not repeat completed login or consent.
Historical OHLC by itself does not meet replay input needs. A future adapter needs
its own source/clock semantics; prospective capture cannot be backdated and cannot
inherit the existing Cboe source label, interval model or size cutoff.
Alternatively obtain an entitled local file, prepare its linked inputs, then
inspect actual GLD/IBIT source/contract/session/cost evidence, evaluate feasibility
and run a small explicitly assumed research trial if it qualifies. Modern recorded
sizes require the declared assumption mode and still must be positive and sufficient. Follow
with stricter availability/fill evidence, broker-specific risk/settlement,
quantitative drivers, independent outcomes, calibration and UI.
Paper history is in `data/runtime/options-paper/`, excluded from Git. Never
rewrite accepted plans or quotes or report scripted outcomes as a strategy win rate.
No whole contract fitting the constraints means no trade.
Do not chase the 50x aspiration by increasing risk or pretending an AI confidence
score is an 80% option-outcome probability. No product brokerage-account adapter
or order execution is implemented; host OAuth does not establish either capability.

Do not scrape Cboe/Nasdaq display pages or silently substitute Alpaca indicative
quotes for OPRA. Do not purchase subscriptions or access account credentials as
part of routine validation. Market imports live in a separate ignored journal;
the old paper journal and v1 output fingerprints must remain reproducible.
