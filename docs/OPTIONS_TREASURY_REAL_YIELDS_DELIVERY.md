# Treasury daily real-yield context delivery

## September 7 writer-guard correction

Review found that a caller retaining the append function could use it after the
exclusive writer callback returned. An append/fsync exception also left the
callback able to try another append from an uncertain in-memory predecessor.
The two guards now reject expired capabilities and require restart recovery
after any uncertain persistence. Source parsing, journal format and accepted
assessments remain unchanged; no real record was affected during this review.

Changed `scripts/lib/options-treasury-io.mjs` and its I/O tests. The expired-scope
regression failed before the fix. All 31 Treasury I/O and 16 readiness I/O tests
passed after the fix, including simulated fsync failure and successful restart.
One actual read-only recovery verified the original source and twelve protected
files without network calls or journal appends. The previous full bundle remains
the 2,708-test readiness checkpoint; this isolated JavaScript correction used
47 focused checks. See [correction evidence](status/treasury-writer-guards.json).
Local single-writer and finite-capacity limitations remain. Next, continue source
collection preparation while preserving the frozen opening window.

## Original module delivery

Task OPT-RATES-1, September 7, 2026. The Owner requested continued autonomous
GLD/IBIT development and relevant factor collection while away. Automatic orders,
paid data, account access and risk escalation remain excluded.

## Change and purpose

Treasury's documented anonymous XML endpoint supplies one numerical driver
family: daily par real yields at 5, 7, 10, 20 and 30 years. A strict pure parser
retains exact hundredths of annual percentage points, including negatives and
nulls. It separates source dates, feed updates and actual Alpha retrieval time.
The report shows dated values, missing tenors, differences between consecutive
source observations and the 10-year minus 5-year slope, without deriving a
trading signal. [Official source documentation](https://home.treasury.gov/treasury-daily-interest-rate-xml-feed).

The script transport performs one current-New-York-month GET: fixed host/path,
no credentials/redirects, twelve-second total request/body deadline and 512 KiB
decoded-body cap. Invalid UTF-8, schema changes, partial bodies and provider
failures retain fixed diagnostics. Failed and empty latest retrievals cannot
silently promote an older value to current. Only successful XML is retained.

A separate 32 MiB / 1,000-retrieval journal saves source text, assessment and
checksum-linked envelopes. Recovery re-parses every source and recomputes all
assessments. Path/link checks, an exclusive writer lock and immutable append
order reject corruption, overlapping clocks and unsafe files. A-to-B-to-A rate
revisions preserve the actual first-observed time of each revision.

## Files and operation

- Pure parser/report and tests: `src/engines/options-treasury/`.
- Fixed transport, journal and CLI: `scripts/lib/options-treasury-io.mjs`,
  `scripts/options-treasury.mjs`, `scripts/options-treasury.test.mjs`.
- Labeled synthetic source: `fixtures/options-treasury/`.
- Commands, ignored runtime path and aggregate registration: `package.json`,
  `.gitignore`, `.gitattributes`, `scripts/alpha-validate.mjs`. Targeted LF rules
  preserve the original/active restoration snapshots and prompt on new checkouts.
- Versioned daily restoration snapshot, wrapper/phase/runbook and host tests:
  `docs/OPTIONS_MARKET_CONTEXT_HEARTBEAT_RESTORE_V2.json`, existing heartbeat
  documents and `scripts/options-robinhood-collection-host.test.mjs`.
- Current guidance and evidence: README, AGENTS, architecture, handoff, roadmap,
  changelog, decisions, specification and [checkpoint](status/treasury-real-yields.json).

Run `npm run options:treasury -- --refresh` for one source read or `--report`
for local recovery. Runtime data remains outside Git in
`data/runtime/options-treasury-rates/retrievals.ndjson`. Do not delete a writer
lock or damaged journal to bypass a failure. At its bounded capacity, a reviewed
export/rotation procedure is required; there is no automatic deletion.

## Actual verification

The new CLI performed one successful real GET from `2026-09-07T04:01:13.631Z`
through `04:01:13.937Z`. The 5,094-byte XML hash was
`b8349abe7d7490a2dd186c9254e1aad27c3b1c547a406ffedf46c349a0207912`.
It contains September 1-4 source dates, with all five tenors present. The most
recent source date is September 4; its 10-year value is 243 basis points (2.43%).
This is a daily source observation, not a current tradable quote. Independent
`--report` recovery rechecked the journal without another HTTP request.

The append fingerprint is
`e19561b1ca82a8350260570e535ee967e71c699c137de1f8f4069296d9432619`.
All four source dates first became known to this new runtime journal at the
actual September 7 receipt time, not on their earlier source dates. The earlier
source-inspection probe remains separately recorded in the specification.

The new active daily baseline adds Treasury to the existing daily 09:00 news
workflow. The original news-only snapshot remains byte-for-byte intact. The
opening quote window remains September 8, 09:30-09:50 New York with the same
four contracts, plan hash and target cadence. Treasury does not refresh every
minute during option collection. Host readback and complete validation evidence
are recorded in the checkpoint after activation.

## Validation and limits

Focused checks cover strict XML/schema/units/clock boundaries, failed/empty and
partial values, actual-time revisions, transport deadlines/UTF-8/body limits,
sanitized errors, append/restart integrity, locks, hard links and junctions,
plus preservation of the original news fields and opening quote window.
Strict TypeScript checking passes. The focused suites passed 32 engine, 29 I/O
and 10 host tests. `npm run alpha:validate` passed all 2,664 tests across 101
components with zero failures (43,053 ms); warnings concern uncommitted changes
and Git line-ending notices. The checkpoint retains exact protected hashes.
The active host fields were independently read back at
`2026-09-07T04:08:53.148Z`, with config SHA-256
`ec4f6a67d8672467dd6b25b639835b09b8eefd814c0927db513a1c7a72ac0da2`.
An initial readback used the wrong local TOML field name; reading the actual
`target_thread_id` confirmed the correct task without reapplying the automation.

The source API is read-only and anonymous; network escalation was needed on this
host and was approved under the existing collection authorization. No credentials,
accounts, options quotes, trades or purchases were used for this delivery.
Checksums do not authenticate a publisher. Source clocks do not establish
historical vintages or a verified release calendar; date lag is descriptive.
Month boundaries may legitimately yield no rows, and the strict schema will
fail visibly if Treasury changes its feed. Local history requires this checkout.

Next: review actual opening-session quote coverage, then qualify a Robinhood
paper-replay adapter from usable data and explicit cost/fill assumptions. Expand
other numerical drivers only with independently reviewed source semantics and
time-of-knowledge records. No source count establishes an 80% win probability.
