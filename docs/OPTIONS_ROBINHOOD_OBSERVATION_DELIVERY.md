# Robinhood screening and observation delivery

Task: RH-OBSERVE-1. Recorded September 7, 2026 UTC (September 6 New York).
The Owner requested continuous progress without separate step reports and has
standing authorization for local development, saving, commits and pushes.

## Changes and purpose

- `RobinhoodObservationEngine.ts`: a bounded sample screen followed by a separate
  prospective observation study. Both reuse unchanged capture v1; neither maps
  Robinhood data into Cboe or the existing paper execution contracts.
- `options-robinhood-observe.mjs`: offline screen, immutable plan freeze, linked
  frame recording, restart verification, candidate data-quality review and exact
  host request preparation. No credentials, network calls, daemon or scheduler.
- Engine/CLI tests, a synthetic calendar/plan fixture, package commands and the
  aggregate validation registry. README, architecture, roadmap, decisions,
  changelog, handoff, AGENTS and the observation checkpoint reflect this delivery.
- See the [reviewed specification](specifications/OPTIONS_ROBINHOOD_OBSERVATION_V1.md).

The screen covers a declared sample, at most sixteen captures and sixty-four
contracts. It does not claim to exhaust a chain, rank probabilities or select a
trade. A later missing quote does not fall back to an older available quote.
Contract identity, DTE, exact whole-contract premiums, spread and separate budget
headroom remain visible. Costs stay unknown and all trade eligibility is false.

The study freezes selection and a future window before new quote requests. It
records source/request/receipt/recording clocks, flags repeats and regressions at
nanosecond precision, compares both underlying side clocks, and retains missing,
stale and out-of-window observations. Sixty-second cadence/freshness and ten-second
source skew are explicit diagnostics. These thresholds do not establish side/size
event semantics or actual fill availability. One study has at most 120 frames
over a declared regular-session window of at most two hours.

Immutable plan and numbered frame files preserve original input text and reports,
SHA-256 links and actual first recording times. Repeats verify and reuse; altered
inputs, conflicting IDs, partial writes, sequence holes and engine replay mismatch
fail. A writer lock excludes concurrent operations; an abandoned lock is preserved
for investigation. Workspace path containment, bounded reads/enumeration, link and
hard-link refusal, UTF-8 validation and exclusive writes guard the local store.
Hashes detect local changes; they do not authenticate a publisher or prevent a
privileged actor from replacing an entire history.

## Actual observations

Six new market-only tool calls at 01:47 UTC queried four declared out-of-the-money
contracts and their underlying quotes. Two previously captured chain responses
were reused with their original clocks, so the new capture has eight declared
calls but only six newly executed calls. The sample was an affordability/format
diagnostic, not a directional view or investment recommendation.

All contracts expire September 25, 2026. Prices below are stale September 4 source
quotes received on September 7; they are not executable current offers.

| Sample | One-contract ask premium | $50 allocation headroom | $25 stress headroom | $5 risk headroom before costs |
| --- | ---: | ---: | ---: | ---: |
| GLD 445 call | $137 | -$87 | -$112 | -$22.40 |
| GLD 370 put | $82 | -$32 | -$57 | -$11.40 |
| IBIT 50 call | $40 | $10 | -$15 | -$3.00 |
| IBIT 40 put | $21 | $29 | $4 | $0.80 |

The combined screen retained these and the four initial near-money probes: eight
contracts total. Only the $21 sample passes both premium-alone budget bounds; its
$0.80 planned-risk headroom is not an actual fee/slippage estimate. All eight are
stale, costs remain unknown, and no candidate qualifies for a trade. Lower premium
does not establish stability or a high target-before-stop win rate.

The new capture is locally saved as `rh-gld-ibit-20260907-0147`:

- Original recording: `2026-09-07T01:55:04.278Z`.
- Artifact SHA: `12c8e588c6a3d49d47a60f79dd51049ede8b38920fb902acf996a132b6d8ec16`.
- Source export: `data/runtime/options-robinhood-data/rh-gld-ibit-20260907-0147.capture.json`.
- Immutable record: `data/runtime/options-robinhood-data/captures/rh-gld-ibit-20260907-0147.json`.

## Frozen prospective study and first diagnostic record

Study `gld-ibit-observe-20260908` was frozen at
`2026-09-07T02:04:53.532Z`, before two later host quote calls. Its plan hash is
`a5e14b121c3454640f0986a519bda2f4259ca4faf08e265196317d3d98166bff`.
It retains the four new contracts for source-quality and budget observation,
including the three already exceeding one or more limits; selection is not a
trade plan and cannot be replaced after seeing outcomes.

The declared window is September 8, 10:00-10:20 a.m. New York
(`14:00-14:20 UTC`). Cboe's public schedule lists September 7 as a regular-session
holiday and normal options hours starting at 9:30 a.m. The September 8 window is a
local prospective declaration based on that schedule, not an authenticated
exchange event or guaranteed uninterrupted session. [Cboe hours and holidays](https://www.cboe.com/about/hours/us-options).

One explicitly out-of-window smoke capture then exercised the actual record and
review path. Both quote calls were requested at `2026-09-07T02:05:19.285Z` and
received at `02:05:19.707Z`. Original source quotes remained September 4. The
frame was recorded at `02:05:21.251Z` with SHA
`dfe6bb5805ecbe5891ca5966f679b600a242cf690fb7290215d224cb0d8cf769`.
All four observations are excluded from usable in-window evidence. No fill,
trade outcome, P&L or strategy score was created.

The record produced four candidate data-quality lessons at that actual recording
time: source/receipt separation, missing or unaligned data, off-session evidence,
and unchanged risk checks for cheaper contracts. These are saved inside the
immutable frame and reconstructed in review, separate from the existing trade
mistake notebook. Existing trade reviews still run after modeled closed trades;
this failed data check is not mislabeled as a lost trade.

## Continue the same workflow

```text
npm run options:robinhood-observe -- --review gld-ibit-observe-20260908
npm run options:robinhood-observe -- --template gld-ibit-observe-20260908
npm run options:robinhood-observe -- --record gld-ibit-observe-20260908 --capture <new workspace capture JSON>
```

The template preserves complete selected catalog calls and prepares exactly
`get_option_quotes` and `get_equity_quotes`. During the declared window, the host
can invoke those approved tools at actual time, preserve both response payloads
and clocks in a new capture, then record and review it. It must not simulate a
missing call result, advance source clocks, change the contract set or reuse the
old capture ID. Catalog calls retain their original request/receipt times. If a
source response groups selected and unselected contracts, request a correctly
scoped catalog instead of fabricating a filtered provider response.

`requestReadyNow` is false before the window; no scheduler was created or changed.
The existing public-feed heartbeat remains a separate public-news task and does
not collect Robinhood quotes. If the window passes without collection, review
reports the coverage gap; a new future study must be frozen rather than backdated.
Fresh sequential aligned data is the next external dependency. Only after its
assessment should a separate source-specific assumed-fill research adapter and
explicit contract/calendar/cost/account assumptions be considered.

## Validation and limits

Executed `npm run typecheck`, `npm run test:options-robinhood-observe`,
`npm run test:options-robinhood-observe-io` and `npm run alpha:validate`.
Final aggregate result: **2,531/2,531 tests passed, 95 components, 47,969 ms,
zero failures**. The new engine contributes 42 tests and storage/CLI contributes
20. `git diff --check` passes. The initial strict-typecheck literal-type issue was
fixed before acceptance. Review also closed stale fallback after a missing latest
response, sub-millisecond future-clock handling and out-of-window coverage gaps.

Real repeat/recovery at `2026-09-07T02:08:42.479Z` retained the first frame's
`02:05:21.251Z` recording clock, reused the same frame, and preserved plan/frame
file hashes. Both original capture artifact hashes also reverified unchanged.
No actual-data validation failure was suppressed: the first real frame still has
zero usable observations and explicit closed-market/window/source-skew blockers.

Focused engine and CLI tests exercise budget/missing-response selection, frozen
scope, prospective/session/cadence rules, source precision and regression,
duplicates/conflicts, source alignment, missing quantities, immutable recovery,
corruption, locks, paths and a two-frame synthetic workflow. Aggregate results
are recorded in [the operational checkpoint](status/robinhood-observation.json).
Actual saved plan/frame recovery is checked separately from synthetic tests.

The old paper journal remains SHA
`3e4f4e3bc453e69f64987a1ab0c2e3dc3fd743f082ca6bf5fae0bdff0cfd549b`;
the historical journal remains SHA
`f34d16cf9852cfcaadd84e716172b1359beb139ece976ae5109ff6cdf4395b62`.
Initial capture artifacts and previous paper/research reviews are preserved.
The unchanged older `current.json` is a dated build checkpoint, not live status.

Unresolved: no eligible-session Robinhood series, verified side/size event clocks,
complete source/retention and contract/calendar evidence, current cost assumptions,
account-rule adapter, calibrated outcomes or execution authority. All reports
remain NO_REPLAY/NO_TRADE, execution false, real trade count zero and win probability
null. A green engineering suite is not strategy validation. Runtime data stays
ignored; only synthetic inputs, code, design and non-sensitive summaries are committed.
