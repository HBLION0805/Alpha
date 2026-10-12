# Official historical tool identity and semantics — October 12, 2026

This supplements the [automatic OHLCV delivery](OPTIONS_AUTOMATIC_OHLCV_DELIVERY.md).
It does not modify the frozen October 12 trial or its NO_TRADE terminal.

## Identity and invocation

`robinhood_alpha_market_data` is the local configuration name for the existing
remote OAuth MCP connection to `https://agent.robinhood.com/mcp/trading`.
Its configuration uses a URL, not a local command. Robinhood's official
[connection instructions](https://robinhood.com/us/en/support/articles/agentic-trading-overview/)
publish that endpoint, and its official
[market-data tool table](https://robinhood.com/us/en/support/articles/trading-with-your-agent/#market-data-tools)
lists `get_equity_historicals` for external agents.

The persistent local allowlist already contains six read-only tool names:
`get_option_chains`, `get_option_instruments`, `get_option_quotes`,
`get_option_historicals`, `get_equity_quotes`, `get_equity_historicals`.
This inspection did not change the configuration or read account data.

The frozen quote Host uses `techQuoteHostOverrides()` to narrow its own process
to four chain/instrument/equity-quote/option-quote tools. Its catalog therefore
did not describe all tools already configured on the computer. The new automatic
bar Host independently narrows its process to `get_equity_historicals` only.
Neither operation expands the persistent allowlist.

Invocation path: Alpha CLI -> pinned installed Codex executable -> existing
OAuth remote MCP tool -> Host JSONL/events -> immutable capture -> local pure
bar/research calculations. The new local wrapper supplies bounds and verifies
responses; it is not a replacement market-data service. Acquisition still uses
a Codex Host model turn and depends on its availability/allowance. It is not a
model-free direct vendor client or a newly connected TradingView API.

## Current evidence

The historical-only catalog was observed at 14:03:24.464–14:03:26.526 UTC.
It reported the official origin, OAuth and the actual historical tool schema;
runtime status was null, so discovery alone did not prove a live connection.
Actual later calls supplied that separate source-access evidence.

For the complete five-minute run `ohlcv-20261012-final-01`, process clocks were
14:13:21.870–14:13:36.851 UTC. Tool start/return events were locally observed at
14:13:31.818 / 14:13:31.943 UTC. These are not provider HTTP or publication clocks.
The sole action was the named historical tool. Original capture, raw Host bytes,
events and derived research are separately hash-bound and recoverable.

Private evidence directories under ignored
`data/runtime/options-workbench-development`:

- `ohlcv-20261012-discovery/schema-approved.json`: actual discovered schema.
- `ohlcv-20261012-semantics-01/identity-and-semantics.json`: sanitized configuration
  identity, schema hash, response field inventory and semantic assessment.
- `ohlcv-20261012-final-01`: original five-minute run and nine-file manifest.
- `ohlcv-20261012-daily-probe-01`: separate daily original and probe manifest.

## Meaning supported by the schema

| Item | Established meaning | Remaining unknown |
| --- | --- | --- |
| Adjustment | Explicit `none` requests raw prices under the official input contract | Response has no adjustment echo; independent verification not performed |
| Volume | Bar volume is a number of shares | Exchange/consolidated coverage and venue composition |
| Interpolation | Explicit true means synthesized gap-fill carrying no new information | Omitted-field semantics; omission remains null, never false |
| Clock | Bar timestamps are UTC left-edge labels | Provider publication time and original HTTP receipt time |
| Close | Last trade in the bar | Not an official settled close |
| Delay | No historical latency field or guarantee found in the inspected material | Numeric delay and real-time entitlement |
| Cache | No cache metadata in the returned tool object | Whether upstream served cached content |

The raw-price request has a documented meaning; lack of a response echo does not
erase that meaning. This supplement introduces no independent source-authentication
or provider-certificate requirement. Existing trade gates are unchanged.

## One bounded daily validation

The same Host transport made one authorized request for SPY/QQQ/AAPL/TSM,
`interval=day`, `bounds=regular`, `adjustment_type=none`, October 5 00:00 UTC
through October 10 00:00 UTC. Process: 14:25:12.820–14:25:29.395 UTC;
local tool events: 14:25:23.559 / 14:25:23.662 UTC.

It returned five daily bars per symbol, twenty total, labeled October 5–9 at
00:00 UTC. All reported `session=reg`; all twenty interpolation flags were
omitted. No retries or additional market tools were used. Capture SHA256:
`ba5a7fc3c6464e41ba77962e8741e8175de4800fbcc59ac41a13dcbe9c2cfaad`.

The transport's new daily request branch is limited to four symbols, seven UTC
dates, explicit raw/regular scope and the same single-call monitor. The initial
probe and its original review remain unchanged historical evidence.

The subsequent daily consumer uses this saved original with zero new source
calls. Run `ohlcv-20261012-daily-research-01` was assessed at
14:39:22.421 UTC (10:39:22.421 EDT). It preserves UTC midnight as a source date
label and explicitly maps that date to the reviewed local session, without
converting it to the previous New York date or calling midnight the session open.
Modeled session end at request start determines elapsed-session eligibility;
it does not establish provider finality. Weekends/holidays are excluded from
expected dates, DST and early closes use the existing calendar, and missing
completed sessions block aggregation. Unknown calendar years block analysis.

All twenty bars were consumed as descriptive research, with twenty interpolation
flags still unknown and all four original gates WAIT. Five-session SMA, observed
direction/range and total share volume are available; a last-volume ratio against
five previous sessions is unavailable in this bounded window. The evaluator's
30-minute context placeholder is not a forecast or registered holding plan.
Original and copied daily replay passed; the original five-minute bundle still
replays unchanged. Source delay/cache/volume coverage and response adjustment
confirmation remain unknown. The documented raw-price request meaning remains
known. No prospective technical-plan gate is bypassed.

Daily research manifest SHA256:
`45de908ad6840c2004b7a426f0174aa935d3aa9dbacb3fd8e3ccb998749e5dda`.
Final focused/full validation is recorded in [status](status/automatic-ohlcv.json).
