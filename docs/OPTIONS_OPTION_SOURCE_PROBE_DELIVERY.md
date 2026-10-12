# Single-ID option quote connection diagnostic — October 12, 2026

The Owner authorized exactly one existing AAPL October 16, 2026 $335 put ID,
`b657988e-1d0a-4277-b7cb-6056a4f48080`, as a connection diagnostic sample. This is
not a trading selection. Its identity comes from the saved October 9 real Host
capture, SHA256 `921c77234e37c559ee5a2d218e8e2fb0d7805ede1a5c2138c9141e8e917afb4d`.
The original tool responses and request binding were checked locally; the old
active/tradable fields are historical, not a statement of current tradability.

## Bounded entrypoint

`npm run options:option-source-probe -- --probe --instrument-id b657988e-1d0a-4277-b7cb-6056a4f48080 --run-id UNIQUE_ID --host-config PRIVATE_CONFIG`

The dedicated thin diagnostic uses the already reviewed pinned Codex Host
mechanism and existing OAuth, exposing only `get_option_quotes` with the one
fixed `instrument_ids` value. It does not invoke the four/five-call collector,
create a second leg, look up chains/instruments, substitute another ID, or retry.
The prior SPY probe and frozen runbook are unchanged. There is no new generic
tool router, recurring collection, credential, login or account/order access.

Before the Host starts, exclusive private intent records the actual creation
clock, exact parameters and historical identity reference. Original stdout,
stderr, timed tool events, capture, assessment, run/persistence clocks and file
hashes follow the same bounded mechanism as the equity diagnostic. Host action
monitoring rejects unexpected tools or extra calls; it is not an upstream hard
call-budget guarantee. Assessment errors retain the original and failure record.

## Evidence interpretation

Tool response returned, exact-ID quote present, and quote quality are separate.
Error, absent response, empty results, missing quote, foreign/duplicate ID, malformed
data, unknown/invalid prices or sizes, zero displayed size, and crossed markets
retain explicit diagnostics. The original response is never reconstructed.

`updated_at` is the provider's quote-refresh clock. Its original nanosecond string,
UTC/ET date and age at receipt/assessment are retained. No independent exchange
bid/ask timestamps are synthesized from it. The displayed 60-second reference
comes from the existing option snapshot engine and is not a new admission rule.
Old, future or unknown source clocks do not become fresh because the request
returned successfully. Exact-ID access applies only to this response; current
series tradability, account product permission, realtime entitlement, cache and
provider delay are not established by the diagnostic. No new authentication
certificate requirement is introduced, and research/execution gates stay intact.

## Recovery and verification

Records stay ignored under `data/runtime/options-workbench-development/<run-id>`.
`--recover DIRECTORY` checks hashes, raw Host/event/capture binding, the fixed
historical series reference, derived recomputation and ordered process/tool/save
clocks. It reports its check time without refreshing source clocks or calling any
tool. Hashes establish local consistency, not independent provider authentication.
Fixture transport is explicitly synthetic and cannot be tagged as a real call.

The 35 focused fixtures cover these boundaries, including explicit attempted
second calls, wrong IDs, extra tools, assessment failures, copied recovery and
rehashed reference/timestamp tampering. Independent pre-call review verifies the
code and original identity. Actual results and final validation are recorded in
[status](status/option-source-probe.json).

Actual run `option-probe-20261012-aapl-put-01` requested the single ID at
15:33:26.262 UTC and observed the return at 15:33:26.377 UTC (11:33:26 EDT).
The matching quote's provider refresh was 15:33:23.528621287 UTC, about 2.85
seconds old at receipt. Capture persisted at 15:33:30.971 UTC and assessment
persisted at 15:33:30.974 UTC. The Host exited normally after one call, with
no retry. Original and copied replay passed at 15:33:59.190/.198 UTC without
additional source access. This is an actual option quote response for that
one ID, not current series/account trading permission or a Paper result.

No plan, journal, fill, account or frozen claim is created or updated. The earlier
NO_TRADE result, strategy/risk rules, source schedules, port 4178 and the challenge
ledger remain unchanged. Code changes receive a local commit only; publication
requires approval of that exact new scope. Private originals are not published.

Independent review replayed the original and copied bundle at 15:34:26.128/.136
UTC, verifying all eight hash-bound original files with no source calls. Final
offline validation passed: 251 components, 6,373 tests, zero failures (307,979 ms).
The validation log SHA256 is
`723fa5c9c11506f463f7d39ea0a088b15da251e91769ef13c613a95e2a178f1e`.
These checks verify software and saved evidence consistency, not Paper admission.
