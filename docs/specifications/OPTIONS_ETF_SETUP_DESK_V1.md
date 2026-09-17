# ETF setup and contract research desk V1

Owner continuation, September 17, 2026: connect ETF trend confirmation to contract
selection alongside the frontend. This is a bounded research increment after the
completed actual-quote engineering milestone, not another paper-pipeline test.

## Dispatch and architecture

Task ETF-SETUP-01; current model, high reasoning; medium complexity. No paid
dependency. Files: new setup contract/engine, local IO/CLI, workbench integration,
focused tests and current delivery documents. Preserve canonical guidance, frozen
paper reports, portfolio, allocation settings and all source recurrences.

The existing options-market-context qualifier is explicitly fixture-bound to QQQ.
Do not label GLD/IBIT data as that fixture or weaken its authorization. The new
desk validates normalized GLD/IBIT five-minute regular-session OHLCV separately;
caller-supplied provenance is not authenticated source qualification. It is a
research projection, never a replacement for the canonical daily decision.

## Data and rule contract

- Accept only GLD/IBIT, USD, raw prices, share volume, explicit source reference,
  receipt time, window start/end and five-minute bars. Bound to 1,000 bars and one
  regular session under the existing reviewed calendar. Reject missing bars,
  duplicate/unsorted clocks, unfinished/future bars, off-grid/holiday bars,
  invalid OHLC/volume and unknown/interpolated observations. Prices retain six
  decimal places using integer micro-USD. Unknown adjustments remain blocked.
- Display a descriptive fast/slow completed-close comparison, prior range and
  approximate typical-price bar VWAP (not true trade VWAP). No forecasts.
- A local plan freezes symbol, side, setup (breakout/pullback/key level), explicit
  range/zone, invalidation, trigger buffer, chase limit, mean-volume multiplier,
  fast/slow windows, activation and time exit; plus planned holding horizon,
  expiry buffer and target absolute delta. Server assigns registration time.
  Activation must be future and on-grid. No retrospective registration.
- Research evaluation uses completed bars only, history strictly before activation
  for the descriptive trend/range/volume baseline, and subsequent bars for trigger
  and invalidation. Baseline is a declared within-session mean, NOT time-of-day
  relative volume. Stop/invalidation takes precedence when intrabar order is
  unknown. Retain first confirmation, later failure and expired-plan states.
- Source received after the assessment cannot enter it. Imported bars remain
  IMPORTED_UNVERIFIED; a matched rule is not a qualified entry. No hypothetical
  option profit or win probability is inferred.

## Contract interpretation

Read the current verified guidance input, never alter it. Long call/put research
follows the declared side and measured ETF setup. Retain every original candidate
blocker. Add expiry beyond the declared exit plus calendar-day buffer, and sort
eligible research references by distance to declared absolute delta, expiry
distance to the desired holding horizon, spread, then immutable contract ID.
Keep one-contract $100–$500 allocation checks, unknown fees, quote ages, calendar
and event gates. Display why each contract passed/failed and Greeks/IV gaps. A
candidate is research-only even when all mechanical checks pass. Canonical WATCH
is unchanged. Expiry breakeven is not a pre-expiry profit threshold.

## Persistence and UI

Append-only plans, bar imports and copied-input assessment snapshots under ignored
data/runtime/options-etf-setup. Exact keys, bounded files, exclusive writes,
hashes and recomputation on recovery. Read paths make no mutations or source
calls. UI provides plain-English rule inputs, a normalized evidence file import,
source gaps, calculated setup evidence and ranked contract reasons. A protected
local API shares existing origin/session checks. CLI can verify independent copied
records. No automatic paper enrollment or approved mistake rule is added.

## Connection prerequisite

The current connection exposes five read-only tools. Robinhood's official page
lists get_equity_historicals for OHLCV. Add only that read-only name to the existing
Codex enabled_tools list; retain endpoint/authentication and all other fields.
This does not expand OAuth scopes, enable account/orders or change any source
schedule. Actual availability requires a reloaded tool catalog. Do not invent its
request/response schema or call unofficial endpoints when it is unavailable.

## Acceptance

Test exact fractional prices, grids/early closes, gaps, unknown flags, source
clocks, future registration, no look-ahead, bullish/bearish setup sequences,
ambiguous invalidation, expiry/budget/cost blockers, deterministic ranking,
copied-source recovery, corrupted records and English escaped UI. Run typecheck,
dependent guidance/workbench tests and aggregate validation. Inspect desktop and
mobile. Production missing bars or plans must remain visible and never become a
fixture-backed signal. Data qualification and prospective strategy benefit remain
open until real source and independent outcome evidence exist.

References reviewed September 17:
- [Robinhood market tools](https://robinhood.com/us/en/support/articles/trading-with-your-agent/)
- [Codex MCP configuration](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)
- [OIC option price behavior](https://www.optionseducation.org/referencelibrary/faq/option-price-behavior)
