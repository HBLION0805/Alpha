# News network-access recovery

Task OPT-NEWS-ACCESS-1, September 7, 2026.

## Cause and reviewed scope

The saved 13:02 UTC refresh has six FEED_NETWORK_FAILED results. A bounded
Federal Reserve diagnostic at approximately 15:42 UTC reproduced EACCES in the
restricted command environment. The existing six-source refresh, executed once
through the supported approved network path, then exited 0: all six feeds were
OK at 15:42:28 UTC, 118 accepted items and zero newly saved observations. BEA
retained its existing one-item rejection. This supports a local access failure
for this incident; it does not prove that every earlier generic network error
has the same cause.

Keep endpoints, parsers, deadlines, journals and calculations unchanged. Expose
only FEED_NETWORK_ACCESS_DENIED for structured EACCES/EPERM codes, including
Node cause/AggregateError wrappers. Inspect at most sixteen error objects, with
cycle detection. Never store raw exception messages, addresses or credentials.
Other unclassified failures retain FEED_NETWORK_FAILED; an HTTP 403 remains an
HTTP status and must not be mistaken for a local sandbox restriction.

Version the daily restoration instructions to v6 with a hash link to unchanged
v5. The news command uses the supported per-command network permission request
when this restricted environment is known, just as the other four public
context flows already allow. Run it once per scheduled flow, without an internal
retry or privilege-changing subprocess. A denial remains a visible blocker;
do not bypass it. Preserve every non-prompt host field, the exact quote Host
program, frozen contracts, window and previous snapshots. Never weaken global
sandbox settings or install an alternative collector.

The [official Windows sandbox documentation](https://learn.chatgpt.com/docs/windows/windows-sandbox)
describes bounded network permissions and specific approved exceptions. The
observed local error and successful fixed-command execution establish this
incident's diagnosis; documentation alone would not establish it.

## Acceptance and continuation

Verify direct/nested/aggregate/cyclic error classification, unchanged HTTP and
unknown-error handling, one request per read, sanitized persisted CLI failures,
and restart recovery. Verify v5 bytes, other four subflows, schedule fields and
the quote Host hash. Run focused tests and the complete validation bundle.

After recovery, run the existing local operator/calendar briefs and collection
preflight. Preserve all original review and study artifacts. Actual collection
still waits for the frozen September 8 session; no simulated or brokerage order
is introduced.

## Measured delivery and next check

The [checkpoint](status/news-access-recovery.json), recorded at
2026-09-07T15:50:40.547Z, binds actual local reports and validation logs.

- Driver I/O/CLI tests: **37/37**; Host/snapshot tests: **17/17**.
- `node scripts/alpha-validate.mjs`: **3,114/3,114** tests, 120 components,
  zero failures, 67,265 ms. Typechecking is included. Warnings record the expected
  uncommitted changes and Windows line-ending conversion notices; no zero-warning
  claim is made. The new v6 snapshot has an explicit LF Git attribute.
- The existing automation was updated through `automation_update`. Independent
  on-disk readback matched all eight fields at 15:48:23.736 UTC. Only the active
  restoration reference changed; schedules and notification policy matched.
- Independent `options-drivers.mjs --report` recovered six OK states and 118
  observations. Two earlier failed batches remain in the integrity-checked
  journal. No failure was rewritten into success or old headline rediscovered.
- All **440** runtime files present after recovery and before implementation
  matched their hashes after the tests and next-step reads. Prior restoration
  hashes and the exact quote Host hash passed their focused checks.
- `options-robinhood-collect.mjs --prepare gld-ibit-observe-open-20260908`
  returned WAIT at 15:48:23.664 UTC, no requests and zero attempts/frames.
- `options-brief.mjs --report gld-ibit-observe-open-20260908 --json` recovered
  five simulated closed trades, five matching reviews, four paper candidates
  and fifteen independent historical candidates. No store was blocked. The
  external-history import store remains missing, as expected without a dataset.
- `options-calendar-brief.mjs --report --json` recovered both calendar stores
  and thirteen selected entries. Other context retains its original receipt
  times; the older BTC snapshot is explicitly stale. These local reads did not
  refresh Treasury, BTC, BLS or FOMC.

Changed files: driver transport/CLI and their tests; Host snapshot tests; new v6
snapshot and its LF attribute; active phase fields, prompt and runbook; focused
AGENTS, architecture, decisions, changelog, handoff and operations-index notes;
this delivery and its checkpoint. Successful response parsing, engine contracts,
risk calculations and journal formats are unchanged. During report preparation,
one patch context did not match and one local log extractor needed CRLF
normalization; both were corrected without a product/test failure.

Risks/assumptions: EACCES/EPERM means access denied, not proof of a particular
firewall rule. Approval and future scheduler availability still depend on the
host. Unknown network errors remain unknown, and recovery does not imply new
headlines, continuous monitoring or a strategy probability. A future approval
denial must stay visible. No fallback identity, paid data or order call was used.

Next: the existing September 8 09:30-09:50 New York collection, followed by v6
daily restoration and preserved closeout/quality lessons. Actual opening prices,
qualified execution assumptions and a source-specific paper adapter are still
required before a real-price trade test. Git diff review and commit/push use the
Owner's standing authorization; the resulting revision is recorded in Git history.
