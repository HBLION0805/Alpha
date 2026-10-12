# Automatic equity OHLCV research — October 12, 2026

The existing authorized Robinhood connection already includes
`get_equity_historicals`. The October 12 frozen trial's quote-specific Host
allowlist did not expose it. This development delivery adds a separate one-shot
automatic acquisition command, not a change to that terminated trial.

## Working path

`npm run options:automatic-bars -- --capture --run-id UNIQUE_ID --host-config PRIVATE_CONFIG`

The command derives the current reviewed regular-session window, excludes the
in-progress five-minute interval, requests SPY/QQQ/AAPL/TSM in one official tool
call, saves the original Host bytes and timed events, validates returned bars,
calculates descriptive metrics, and supplies the original capture to the existing
ThreeFacet research evaluator. Optional `--symbols AAPL,TSM` narrows the request.
It uses the already reviewed executable hash and existing OAuth connection.
It does not install credentials, change persistent MCP configuration, or access
account/order tools. No recurring service or schedule is installed.

The child process disables shell, web search and the configured Node REPL, and
exposes only the existing historical-data tool from the market server. Unexpected
action events or excess calls stop the process and invalidate acceptance. The
one-call budget is monitored, not enforced by the upstream server. Authentication,
permission, HTTP 403/429, malformed or missing responses remain failures without
retries. Local event observation times are not provider HTTP timestamps.

## Research and quality

Source bars retain UTC timestamps and America/New_York presentation metadata,
regular-session scope, raw adjustment request, and provider-reported share volume.
Adjustment confirmation, market-wide volume coverage, provider publication time,
cache status and source latency remain UNKNOWN when not supplied. A recent bar
timestamp does not prove real-time access. Positive volume does not imply an
omitted interpolation flag is false.

Forming and explicit interpolated bars are excluded. Identical duplicates are
counted and removed; conflicting duplicates, out-of-order data, invalid OHLCV,
unexpected identities, session errors and completed-grid gaps block aggregation.
The reviewed 2026 session calendar handles DST, holidays and early closes; unknown
years block acquisition. The current-session acquisition command supports
five-minute bars. A bounded daily transport and saved-daily consumer also support
up to seven UTC dates; neither joins sources nor fills gaps. Daily labels retain
their UTC source dates with explicit local session interpretation. Completed
means the reviewed session elapsed at request start, not provider finality.
See the [source identity supplement](OPTIONS_AUTOMATIC_OHLCV_SOURCE_IDENTITY.md).

Descriptive metrics include first-open to last-close return, observed direction,
range, total provider share volume, five-bar SMA, and the last bar's volume versus
the preceding five completed bars where available. They are observed-window
statistics, not a forecast, official daily close, frozen trigger or approved rule.

The optional `automaticBars` research input is independently recalculated by
ThreeFacet. It adds `automaticTechnicalObservation`; it does not replace the
existing strict technical input or fundamental/news/risk requirements. Legacy
inputs omit the new output and retain their old behavior. No REVIEWED source
quality, interpolation=false, Owner confirmation or executable plan is created.
Existing global historical capability labels are not current connection evidence;
the automatic observation carries the actual capture's separate metadata.

## Persistence and recovery

All actual records remain under ignored
`data/runtime/options-workbench-development/<run-id>` with exclusive creation.
The manifest hashes the capture, derived research and available Host originals.
`--recover DIRECTORY` verifies hashes and recomputes the original assessment;
it reports current source age without refreshing its original receipt clock.
It never calls a source. A copied complete bundle can recover independently.
Hashes provide local consistency, not independent provider authentication.

`--analyze CAPTURE --run-id UNIQUE_ID` consumes an existing private capture into
a separate research bundle without repeating the acquisition. No browser or
manual screenshot is needed in either acquisition or analysis.

## Evidence and boundaries

Initial actual acquisition `ohlcv-20261012-real-01` made one call on October 12
at 14:05 UTC and returned 24 bars: six each for all four symbols, covering
13:30–14:00 UTC. All 24 interpolation flags were omitted. Research consumption
and copied-capture replay passed; all four original recommendation gates stayed
WAIT. These are actual data-path results, not Paper fills or strategy validation.

The final integrated CLI run `ohlcv-20261012-final-01` ran at
14:13:21.870–14:13:36.851 UTC (10:13 EDT). One source call returned 32 bars,
eight per symbol, for 13:30–14:10 UTC; the command automatically persisted and
consumed all four research inputs. All 32 interpolation flags remain unknown,
and all four recommendation gates remain WAIT. This run used the reviewed Host
restrictions and closed its child process. It is separate from the first sample.

Final integrated CLI acceptance and validation details are recorded in
[status](status/automatic-ohlcv.json). Raw data, Host logs and private local
configuration are excluded from Git. The public change contains only code,
synthetic tests and sanitized delivery metadata.

The initial delivery's aggregate passed 6,280 tests in 249 components before two
additional recovery-negative tests were added. That historical result is not the
final daily-consumer validation. The final focused suite now covers 58 cases,
including daily attribution, completion at request time, DST/holidays/early close,
missing sessions, unknowns and copied replay. Final aggregate and independent
review results are recorded in the status file. The initial sandbox aggregate's
existing hardlink EPERM failures remain separately recorded.

Final code and all final tests passed together: 249 components, 6,302 tests,
zero failures, including all 58 automatic-bar cases, TypeScript and repository
checks. Independent code/document review and four saved-bundle replays passed.
Only this factual validation metadata was updated after the final run.

The saved daily probe returned 20 bars, five per symbol for October 5–9. Separate
run `ohlcv-20261012-daily-research-01` consumed them at 14:39:22.421 UTC with zero
new source calls. All four descriptive observations are ready; all twenty
interpolation flags remain unknown and all original recommendation gates WAIT.
The original probe, its timestamps and its earlier not-yet-consumed review remain
unchanged. Daily copied replay and old five-minute replay both pass.

Frozen October 12 version, 09:54 terminal/claim, port 4178, CPI/15:50 schedules,
the challenge ledger, risk settings and production deployment remain unchanged.
Remaining automatic paths include wider multi-session windows, qualified latency
and source semantics, prospective strict technical-plan binding, and any later
explicitly authorized scheduling. This delivery does not claim those completed.
