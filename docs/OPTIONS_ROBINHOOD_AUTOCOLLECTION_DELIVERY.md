# Robinhood automatic collection delivery

Task RH-AUTO-1, September 7, 2026 UTC (September 6 New York). The Owner explicitly
requested automatic collection and excluded automatic orders. This delivery
activates the previously discussed bounded observation window, not trading.

## Implementation and reason

- `scripts/options-robinhood-collect.mjs` prepares an exact two-request batch and
  accepts bounded base64 UTF-8 replies. It enforces the frozen window, contract
  selection, actual request/receipt times, cadence and data-only scope. Base64 is
  safe argument transport, not encryption; decoded replies are limited to 20 KiB.
- Successful replies are assembled with unchanged original catalog responses and
  passed to existing immutable capture/frame recording. Repeats reuse original
  records; conflicting IDs, corrupt attempts, altered source files and failed
  scope checks stop the operation. A separate writer lock and at most 120 attempts
  bound local state. Attempts preserve recording time and SHA-256 links.
- If either source call fails, a sanitized attempt record retains the error code
  and the other outcome. It cannot become a fake frame. Failures also count toward
  cadence. Provider error bodies, credentials and tool guides are excluded.
- `options-robinhood-observe.mjs` exports its existing storage boundary for reuse.
  Its prior outputs and all TypeScript observation/capture engines are unchanged.
- The [host runbook](OPTIONS_ROBINHOOD_AUTOCOLLECTION_RUNBOOK.md) contains tested
  orchestration for exactly two fixed market tools. It compares the expected study
  hash and UUIDs before any provider call, keeps original timestamps, and saves
  outcomes through the CLI. A small late-start wait may absorb scheduling jitter.
- Package commands, validation registration and dedicated CLI/host tests support
  unattended operation. See the
  [reviewed specification](specifications/OPTIONS_ROBINHOOD_AUTOCOLLECTION_V1.md).

## Operational configuration

The host allows only one active heartbeat per task. An attempted separate create
was rejected without creating a task or automation. The authorized next step
therefore updates the existing `gld-ibit` heartbeat; no workaround cron is used.
Its ACTIVE state and exact armed fields were independently read back at
`2026-09-07T02:49:23.328Z`, with config SHA-256
`bc7dcede2062841d5f533bcd5fcee2a24a7d29b760faa70d410af807134f1913`.
See [the operational checkpoint](status/robinhood-autocollection.json).
The host timezone was read as `Eastern Standard Time` (US/Canada), which observes
daylight saving time. The collection window is September 8, 2026, 10:00-10:20
New York, or 14:00-14:20 UTC. Before that window the temporary schedule wakes daily
at 09:00 and 10:00. The 09:00 branch executes the original news workflow; other
pre-window wakes make no quote request. The first in-window wake switches this
same heartbeat to a one-minute interval, with a target of one batch per sixty
seconds. The first wake at or after 14:20 UTC restores the exact original daily
09:00 news fields before loading collection artifacts, then saves a coverage review.

The CLI independently enforces the UTC window and does not roll it forward. Late
or missed jobs remain missing evidence. This is a bounded first automatic run;
it does not establish an indefinite all-session collector. The shared news task
must never be deleted. Its unchanged original prompt, name, target, status and
schedule are retained in the [restoration snapshot](OPTIONS_ROBINHOOD_HEARTBEAT_RESTORE.json),
whose source configuration SHA-256 was
`a377513f2ed0772b06e3c0ec62f7f8395d8d23600879933a432b15a60bcec75e`.
The [phase fields](OPTIONS_ROBINHOOD_HEARTBEAT_PHASES.json) and
[wrapper prompt](OPTIONS_ROBINHOOD_HEARTBEAT_PROMPT.txt) retain the exact operational
instructions. Original news cadence was verified as daily, correcting older
hourly descriptions without changing the underlying feed logic.

The host uses its already-authorized Robinhood connection. The only scheduled
provider operations are `get_option_quotes` for the four frozen contracts and
`get_equity_quotes` for GLD/IBIT. No account/order tools, credential reads, repeated
OAuth login, data purchase, automatic orders or simulated executions are scheduled.

Desktop tasks depend on the computer being awake, the app running, the local
worktree being present and tools being available. Scheduling does not guarantee
an exact execution second or an uninterrupted data stream. The official docs
support minute-based in-chat schedules and describe local-machine requirements.
[OpenAI scheduled-task documentation](https://learn.chatgpt.com/docs/automations?surface=app).

## Validation and preservation

The real host preflight at `2026-09-07T02:34:37.339Z` returned WAIT, zero prepared
requests and zero automatic attempts. No new closed-market quote call was made.
The existing smoke frame remains one frame with zero usable observations. The
first scheduled market run is still pending; enabling a schedule is not evidence
that future data has already been captured.

Twenty CLI/storage tests cover window and scope gates, successful source assembly,
failures without fabricated frames, minimum cadence, fixed errors, timestamps,
transport limits, immutable retries, corruption and partial-write recovery. Eight
isolated host-program tests cover the exact tool allowlist, no-op branches, changed
plan/symbol rejection, unavailable tools, safe error transport and chunked stdout.
They execute the checked-in runbook program against mocked ports, not the broker.
The old observation storage tests also pass. Aggregate results are recorded in
the operational checkpoint: `npm run alpha:validate` passed all 2,559 tests across
97 components in 42,010 ms after activation and documentation updates. Focused
commands were `npm run test:options-robinhood-collect` (20/20),
`npm run test:options-robinhood-collection-host` (8/8), and
`npm run test:options-robinhood-observe-io` (20/20). Host readback and the four
protected file hashes were rechecked after validation. No scheduled in-window
source call has yet run. An initial documentation-link scan misread a JavaScript
index-and-call expression as a Markdown link; the expression was rewritten without
changing behavior. The repository-wide checker was not relaxed.

Unchanged protected hashes:

- Paper journal: `3e4f4e3bc453e69f64987a1ab0c2e3dc3fd743f082ca6bf5fae0bdff0cfd549b`.
- Historical journal: `f34d16cf9852cfcaadd84e716172b1359beb139ece976ae5109ff6cdf4395b62`.
- Study plan file: `cdfecca741947e647d3146d0b18d7a6e307db371e109b34147e1759cfbbc39cc`.
- Original frame file: `75ea45a63bfefd9364ca87d3efd3dd506998a071583d9aa59800b52ea2a6e13c`.

Runtime captures, attempts and window reviews remain local and ignored by Git.
The prior observation checkpoint remains the dated pre-scheduler state; the new
checkpoint records host scheduling separately from offline parser capabilities.
No past quote, paper trade, risk budget or candidate mistake record was rewritten.

The changed code is limited to the new collection CLI and its tests, the existing
observation storage export, package commands and aggregate validation registration.
The specification, runbook, exact heartbeat fields, activation status and current
README/AGENTS/architecture/handoff/roadmap/decision/changelog entrypoints document
the operational change. Baseline Git commit was `a2ad784` on
`codex/gld-ibit-options-foundation`; the Owner's standing commit/push authorization
applies. Runtime source files and validation logs are excluded from the commit.

## Next step and limits

Let the bounded scheduled run collect available source data, then assess its
coverage and quality. Automatic collection does not certify independent side/size
event timing, executable fills, costs, account rules or win probability. Existing
source reports remain NO_REPLAY, actual trade count remains zero, and automatic
orders are explicitly excluded. A missed window is a gap, not permission to
backdate collection, invent observations or enable an unreviewed replay adapter.
