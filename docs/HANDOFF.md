# Alpha Handoff

Date: 2026-09-06. Current scope: GLD/IBIT options on Robinhood.

## Latest Owner direction

After delivery `9915d79`, the Owner explicitly approved enabling only the five
reviewed market-data tools and personally completing official login. The enabled
host configuration is installed and verified; the official existing-account login
page has been opened for the Owner. Completion has not yet been observed. Stop
before any new-account or paid step; do not repeat the connection permission
question. See [host setup](OPTIONS_ROBINHOOD_CONNECTION_SETUP.md). The build snapshot
below and in current.json predates this host operation and remains historical
validation evidence, not a live configuration inventory.

The latest instruction continues toward real-price testing. The Owner has
Robinhood; no account/API connection or entitled target-ETF quote file is available
to Alpha. This delivery adds a public capability report, offline local catalog
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
instrument queries. No connection/authentication was performed. Historical
bid/ask sizes, interval limits, retention and GLD/IBIT entitlements are unverified.
Its documented access includes all-account read visibility and trading tools, so
an authorized read-only capability assessment must preserve scope. Do not assume
Cboe purchase is the only route. Exact sources are in the
[reference document](OPTIONS_ROBINHOOD_RESEARCH_REFERENCE.md).
The disabled example is a client tool-name filter, not a narrower server-side
permission grant or GLD/IBIT argument check. Connection/login has since been
authorized as recorded above; new-account onboarding remains excluded. Exact response units, clocks, sizes and contract linkage
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

Continue local preparation without purchasing data. Assess authorized read-only
Robinhood MCP capabilities using the reviewable readiness output before assuming
a paid file is necessary. Complete the already authorized official login with the
Owner, stopping before any new-account or paid step.
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
score is an 80% option-outcome probability. No brokerage access or execution is
implemented.

Do not scrape Cboe/Nasdaq display pages or silently substitute Alpaca indicative
quotes for OPRA. Do not purchase subscriptions or access account credentials as
part of routine validation. Market imports live in a separate ignored journal;
the old paper journal and v1 output fingerprints must remain reproducible.
