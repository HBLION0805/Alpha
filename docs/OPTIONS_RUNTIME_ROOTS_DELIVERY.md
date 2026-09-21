# Owner runtime code/data root correction — September 21, 2026

## Confirmed cause and correction

The public-context launcher resolved executable paths relative to the selected
private workspace. A data-only workspace could not supply the current scripts or
the TypeScript loader. Separately, five classic collector CLIs chose their module
directory as the data root; fixing only the launch location would therefore have
written evidence into the code checkout.

The running module now supplies `codeRoot`; `workspaceRoot` remains the private
data location. The launcher uses absolute loader/script paths, a code-root working
directory and an explicit `--workspace` argument. A shared argument parser passes
the existing data directory to all seven collectors: headlines, BTC, Treasury,
BLS, FOMC, focused news and macro context. Legacy direct-command defaults remain
compatible. No code, dependencies or private evidence is copied between roots.

Existing hourly/daily eligibility, exclusive slot claims, network limits, source
clocks, append-only journals and no-retry behavior are unchanged. The existing
News & calendar page exposes a compact diagnostic disclosure and `/api/state`
returns the same results. Executable, HTTP, parse, storage, unknown local failure,
already-attempted and not-yet-eligible states stay distinct. Raw stderr, response
bodies and credentials are not included in these operational summaries. Older
receipts retain their original, sometimes less specific, failure descriptions.

## Validation on the final product code

- `npm run alpha:validate`: **5,032 passed, zero failed**, including TypeScript,
  source IO, workbench and both Git whitespace checks.
- Context service: **22/22**; workbench: **58/58**; driver IO: **37/37**.
- The separated-root process regression uses `fixture-code-root` and an empty
  `fixture-owner-workspace`, with no application files in the latter. The old
  launcher failed all seven child executions; the corrected launcher passed all
  seven and wrote only into the data root.
- A second isolated test executes all seven actual collector CLIs with injected
  HTTP 503 responses and a filesystem write guard. All preserve the failures in
  the selected workspace; no network request occurs in this test.
- Existing concurrent claims, consumed-slot behavior, late daily eligibility,
  UTC/New York boundaries, paper finalization and recovery tests remain passing.
- The first full-validation attempt found that the driver CLI isolation fixture
  did not copy the new shared helper. Its dependency list was corrected; the final
  full run above passed. No source parsing or evidence gate was loosened.

## Bounded real runtime acceptance

The smoke uses the current development checkout as code and the Owner's existing
authoritative workspace as data. It does not operate on the old main checkout.
The pre-smoke inventory and case snapshot were saved at
`2026-09-21T04:49:48.644Z`. A single bounded workbench started at
`2026-09-21T04:52:46.634Z` with public context enabled on localhost port 4173.

The current UTC 04 hourly and focused-hourly slots already had failed receipts.
They were read as `ALREADY_ATTEMPTED`, not retried, erased or relabeled. Before
09:00 New York, Treasury/BLS/FOMC remain `NOT_YET_ELIGIBLE`; macro context remains
ineligible before 17:00. The browser displayed those distinctions and retained
the independent market-capture/calendar gaps in Daily guidance.

The next natural service tick, `2026-09-21T05:00:46.696Z` (01:00:46 EDT),
claimed UTC 05 without a second collector or catch-up. It finished public work
at `05:00:47.890Z` and issued the existing guidance report at `05:00:47.970Z`.

| Collector | Actual attempt → completion (UTC) | Result / saved rows |
| --- | --- | --- |
| Headlines | 05:00:46.700 → 05:00:47.292 | Six feeds OK; 118 headline observations. BEA rejected one invalid item and retains partial coverage. |
| BTC | 05:00:47.292 → 05:00:47.556 | One public level-1 context; `OBSERVED_CONTEXT`. HTTP request 05:00:47.426, receipt 05:00:47.525; source clock 05:00:43.900298479. |
| Focused news | 05:00:47.563 → 05:00:47.890 | Fed speeches 15, EIA 17, CoinDesk 25 saved items; all three feeds OK. |
| Treasury / BLS calendar / FOMC | No request | `NOT_YET_ELIGIBLE` before 09:00 New York. The successful BLS headline feed is not a calendar refresh. |
| Macro context | No request | `NOT_YET_ELIGIBLE` before 17:00 New York. |

There were **three collector invocations and ten public GET attempts** (six
headline feeds, one BTC endpoint, three focused feeds), with no retries or
redirect following. Successful parsing used the existing HTTP-200 gates; the
receipt does not invent individual feed request clocks where only the collector
start and feed receipt clocks were available. No source request failed in this
slot. BEA's rejected item remains a quality limitation, not a missing executable.

Eight durable files were added in the selected private workspace: two claims,
two context receipts, one headline journal envelope, one BTC journal record, one
focused-news batch and one issued guidance report. The 175 headline rows and
one BTC context are payloads within those records, not 176 separate files.
All 32 previous Owner files remained unchanged. The code-root runtime inventory
(1,720 files, excluding explicitly private development-test receipts/logs) was
unchanged. Existing source validators and the saved workbench API read the new
records successfully.

Browser acceptance on the same instance confirmed:

- `/api/health`: context refresh enabled.
- News & calendar: **9/9** headline sources within the refresh window, one partial
  feed; Fed speeches, EIA and CoinDesk now show the real 01:00 EDT read clock.
- Daily guidance: the new 01:00 EDT issued report and refreshed news are consumed;
  headline-refresh-unavailable no longer appears. Missing market quotes, closed
  regular session and not-yet-refreshed calendar still produce Watch/Unknown.
- Restoring the existing employment draft shows **one latest saved draft, one
  expectation and four comparisons**, still `DRAFT / NOT_CREATED`, with no trade.
  Exact before/after ledger and case-record comparison passed in both roots.

The smoke exposed one diagnostic mapping omission: BTC's valid
`OBSERVED_CONTEXT` was summarized as `UNKNOWN` in the new operational receipt.
The original receipt is preserved. The mapper now also preserves
`OBSERVED_CONTEXT` and `UNUSABLE_CONTEXT`; an isolated regression and offline
replay of the saved real BTC input verify the correction. No second source read
was made. Full validation was rerun after this final mapping change; the result
in the validation section applies to that final product code. A future natural
receipt will use the corrected detail; old receipts are not rewritten.

Private evidence locators, relative to the selected data root:

- `data/runtime/options-context-service/2026-09-21/hourly-2026-09-21T05.receipt.json`
  — SHA-256 `274283780c454373a87a304f5ed6afea9ad428d39a9cfca1ea736d720cf75e15`.
- `data/runtime/options-context-service/2026-09-21/focused-hourly-2026-09-21T05.receipt.json`
  — SHA-256 `0cb9dfe5742663a68d3e47919065c8b58a0c345b682b8f94f273bf39dba3ac89`.
- Focused batch fingerprint:
  `sha256:e445ad7ad521a5d0816e458f343a7ffa7bec251fe986fb91c4e240144002de4d`.

The code checkout's ignored `options-workbench-development` directory holds the
before/after inventories, smoke summary, browser checks and validation logs.
The bounded acceptance process was closed after the checks; no second ongoing
instance was installed. Actual future daily-source success is not claimed.

Brokerage/option tool calls: **0**. Model/Jev calls and Jev Phase 2 samples: **0**;
the root cause was established deterministically. Dollar fees: **UNKNOWN**, with
no new paid service or subscription. The existing source-call budget per slot
does not increase; previously broken launches can now perform their intended
authorized public reads.

## Boundaries and operation

Run from the current code checkout using the existing workbench command with
`--workspace` pointing to the existing private data folder; see
[the workbench guide](OPTIONS_WORKBENCH_GUIDE.md). Do not place scripts or
node_modules in that folder. Restarting does not retry a consumed slot.

The employment case, manual ledger, research, handoff records and trading
semantics are outside this correction. No new timer, Host schedule, source,
market permission, model integration, trading rule or risk policy is added.
The independent 15:50 natural acceptance and first real targeted-quote statuses
are not changed by public-context success. Runtime receipts and acceptance logs
remain private and excluded from Git.
