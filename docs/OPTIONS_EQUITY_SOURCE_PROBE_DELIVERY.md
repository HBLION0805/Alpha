# Independent equity quote connection probe — October 12, 2026

The existing quote collector requires an explicit option selection, while the
frozen October 12 workflow stops before selection when research is unqualified.
That workflow remains unchanged. This separate diagnostic can test an existing
equity quote connection without a research plan or an option selection.

## Explicit entrypoint

`npm run options:equity-source-probe -- --probe --symbol SPY --run-id UNIQUE_ID --host-config PRIVATE_CONFIG`

The bounded first version accepts SPY only and exposes only the existing
`robinhood_alpha_market_data.get_equity_quotes` tool with `{"symbols":["SPY"]}`.
It reuses the reviewed Codex executable pin and existing OAuth configuration.
It installs no credentials or persistent permissions and creates no login flow.
One explicit invocation requests one call, without retries or pagination. The
Host disables shell, web search and the configured Node REPL. Unexpected actions
or extra calls invalidate acceptance and stop the child. This is monitored
enforcement, not an upstream server-side hard call budget.

## Separate evidence layers

| Layer | This probe establishes |
| --- | --- |
| Catalog | Not rechecked; existing catalog checks remain independent and may be cached |
| Tool call | Exact bound tool response or a separately retained failure; successful return is not necessarily usable quote data |
| Quote data | Symbol match, original prices, separate last-trade/bid/ask clocks, UTC/ET dates and source age |
| Research | Not assessed or promoted; original research requirements remain unchanged |
| Execution | Always false; no contract, permission, funds, plan, journal or fill is created |

Empty or malformed results, missing quotes, wrong symbols, missing/invalid source
clocks, stale prices, future source clocks and crossed bid/ask retain their own
diagnostics. Nanosecond source strings and age calculations remain intact; only
the derived ET calendar date uses millisecond conversion. Last trade never borrows
a fresh bid/ask timestamp. The 120-second display reference reuses the existing
quote convention and does not introduce a new permission or entry requirement.
Source age alone does not prove real-time entitlement, publication latency or
cache status. An equity quote cannot prove option quote access. No new independent
authentication or provider-certificate requirement is introduced.

## Original preservation and recovery

Exclusive private output lives under ignored
`data/runtime/options-workbench-development/<run-id>`. The intent, original Host
bytes, stderr, timed events, capture (when bound), assessment and run report are
hash-bound in a manifest. Requested/returned clocks are local Host event
observations, not provider HTTP clocks. The run separately records process,
event persistence, capture persistence, assessment and assessment-persistence
clocks. Assessment exceptions retain the capture plus explicit failure/report
metadata; clocks are never moved to make them pass.

`npm run options:equity-source-probe -- --recover DIRECTORY` checks file hashes,
raw-event/capture binding, original assessment recomputation and clock order,
including tool events within the process window. It reports its actual check
time and current receipt age without refreshing original evidence or calling
sources. A copied complete bundle can replay independently. Hashes establish
local consistency, not provider authentication. Fixture transport is explicitly
synthetic and cannot claim actual invocation.

## Validation and actual evidence

Thirty-six focused cases cover missing research, cached/absent catalog evidence,
failure and empty/malformed responses, identity errors, precise clocks, stale and
unknown timestamps, limited tool scope, one-shot persistence, fixture origin,
exclusive output, copied replay and rehashed tampering. Independent review found
and cleared the nanosecond date-conversion and process/event clock-binding issues
before the actual probe was launched.

Actual run and final full-suite results are recorded in
[status](status/equity-source-probe.json). Actual run
`equity-probe-20261012-spy-01` made exactly one call. Local tool start/return were
15:06:57.070 / 15:06:57.180 UTC (11:06:57 EDT). Last-trade/bid/ask source clocks
were October 12, about 3.82 / 4.02 / 4.02 seconds old at local receipt. This
verifies that equity quote path at that time, not real-time entitlement or option
quote access. Capture persisted at 15:07:02.373 UTC; assessment persisted at
15:07:02.375 UTC. Original and copied offline replays passed at
15:08:19.290 / 15:08:19.297 UTC without any further source call.

Independent post-call review recovered both bundles, checked all eight original
file hashes and confirmed the sole action was the exact SPY equity quote request.
The final aggregate run passed 6,338 tests in 250 components, zero failures,
including all 36 new focused cases, TypeScript and repository checks. Only factual
delivery metadata was updated after that run; code/tests did not change.

The frozen trial, its NO_TRADE result,
old runbook, port 4178, source schedules, challenge ledger, capital and risk rules
remain unchanged. No website deployment or main merge is included. A new local
commit requires its own exact public-push scope approval.
