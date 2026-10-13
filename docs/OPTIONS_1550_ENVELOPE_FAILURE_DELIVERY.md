# October 12 15:50 Host failure: response envelope mismatch

Diagnosed October 13, 2026 from saved local records only. Development base:
`fdda07ec5519f7f855d5e70c1ebd2540b6bc91e3`. Production remains the separate clean
`C:/projects/Alpha-workbench` checkout pinned to
`c18d03f89b899e76e7e98c4ff4fa349c8b85e31d`; no production files were replaced.

## First failure and propagation

Actual run: `0bc442fc-a211-42bd-b041-751b57c560e4`.
Its retained collector source SHA256 is
`a690a10b7d9c68fdf2aa1a84cd866be640141b70496a0afb2e691565878af453`.
The source and all three submitted response hashes match the run journal.
The submitted market data also matches the provider tool output.

1. ETF quotes were requested at `2026-10-12T19:50:13.574Z` and received at
   `19:50:18.864Z` (15:50:18.864 ET). The submitted object has `content` and
   `structuredContent`, with payload at `structuredContent.data`; it has no
   top-level `data`. The pinned collector checks only `response.data` and throws
   `SOURCE_SHAPE`. Its catch reduces this to `MARKET_SOURCE_FAILED`. This is the
   first demonstrated failure, before the next request at `19:50:18.866Z`.
2. GLD and IBIT chain replies have the same envelope mismatch. Exact-source
   offline replay consumes three saved responses, retains zero accepted receipts
   and returns three source failures plus two underlying/chain selection failures.
3. At `19:50:19.255Z`, after the IBIT response, the Host checks nonempty collector
   failures and emits `FAST_HOST_SESSION_COLLECTOR_FAILURE`. It does not expose
   the individual collector reasons. No instruments or option quotes were requested.
4. No ingest or finish call occurs. The outer runner sees no current `finish_note`
   and reports `CURRENT_RUN_FINISH_BINDING`; its latest pointer remains October 8.
   The verifier later reports `RUN_FAILED`. Those are downstream failures, not
   the cause of the rejected quote response. No terminal success record exists.

The model followed the installed instruction to pass the complete tool response.
It stopped on Host failure and completed with CLI exit 0. The saved tool calls do
not show quota exhaustion or failed market responses. A later transport-session
DELETE 400 is after the collector failure and does not explain the parser rejection.
This establishes a local transport contract mismatch, not when or whether the
provider changed its schema. It does not establish contract availability, quote
freshness or downstream selection correctness, because those stages were not reached.

## Minimum development repair

The existing serialized `collectGuidanceMarket` now accepts bare `data`, MCP
`structuredContent` / `structured_content`, and a single JSON text body. Multiple
representations must agree on data; malformed text, conflicting representations
and explicit tool errors fail closed. Bare successful responses retain their old
shape. Wrapped responses retain the supplied envelope unchanged under
`response.originalToolResponse` alongside the normalized `data` field. No provider
price, identity or clock is synthesized. Safe parser reason codes supplement the
existing `MARKET_SOURCE_FAILED` code; exception text is not exposed.

All collection limits, selection rules, session/lease guards, risk conditions and
publication checks are unchanged. The separate local Host bridge still collapses
collector failures to its generic code; this patch does not replace that bridge,
alter its configuration or repair historical receipts.

138 focused tests passed: daily guidance 126 and fast Host 12, including 14 new
transport, conflict, serialization and original-retention cases. Synthetic ingest
and verification run only in temporary workspaces. Full repository tests were not
run. The corrected collector replays the three actual saved responses and reaches
the first `get_option_instruments` request; replay stops before that unsaved request
is made. This is evidence of the repaired parsing boundary, not a complete capture.

Private evidence: `data/runtime/options-workbench-development/host-1550-envelope-diagnosis-20261013-01`.
It retains copied original logs/code, baseline and repaired replay reports, original
hashes and test logs. The actual market responses are not committed.

## Recovery boundary

This change is a separate local development commit after `fdda07e`; neither commit
is newly pushed or deployed by this work. Production will not use this repair until
an explicitly reviewed deployment updates the active pinned code/source generator
and its corresponding integrity references through the established deployment
procedure. Do not bypass the pin or change the schedule to make the patch run.

After that separate approval, use the next eligible natural 15:50 run, preserving
the existing exclusive claim and all bounds. Verify a new run-specific capture,
finish binding, published report and verifier result independently. Do not rerun
the consumed October 12 slot, overwrite its latest pointer, fetch missing historical
responses or manufacture a successful receipt. No account/160-dollar ledger or
cancelled CPI forecast was accessed or changed.
