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
years block acquisition. V1 intentionally supports one regular session and only
five-minute bars. It does not join sources or fill gaps.

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

Thirty-eight focused tests cover the above quality boundaries, timestamp/session
rules, Host action restrictions, split UTF-8 stream handling, request binding,
failure persistence, stale-source recovery and tampered Host/capture/research
replay even after recomputed file hashes. Independent review cleared the repaired
Host boundaries and independently recovered both real and copied bundles.
The approved-environment aggregate run passed 6,280 tests in 249 components,
zero failures, including TypeScript and repository checks. The two additional
recovery-negative cases passed afterward in the final 38-test focused suite;
production code did not change after aggregate validation started. The initial
sandbox aggregate hit existing hardlink EPERM failures and is retained separately.

Frozen October 12 version, 09:54 terminal/claim, port 4178, CPI/15:50 schedules,
the challenge ledger, risk settings and production deployment remain unchanged.
Remaining automatic paths include daily/multi-session bars, qualified latency
and source semantics, prospective strict technical-plan binding, and any later
explicitly authorized scheduling. This delivery does not claim those completed.
