# ETF source recheck - September 29 session, September 30 UTC receipt

The existing authorized Robinhood MCP connection returned actual completed-window
GLD and IBIT five-minute OHLCV. Source qualification remains blocked: all 156
bars omit interpolation flags. No source semantics, setup, trigger or trade
qualification was inferred from successful connectivity.

## Bounded acquisition and provenance

One batch get_equity_historicals invocation; zero retries, paging, account or
order calls. Existing Codex CLI session 01a0effe-d742-7c03-aa4e-cef7ac49f20c used
the configured robinhood_alpha_market_data server. Actual exposed schema supports
symbols, explicit start/end, interval 5minute, bounds regular and adjustment_type
none. Request covered 2026-09-29T13:30:00Z through 20:00:00Z.

Wall clocks measured around the tool promise: requested 2026-09-30T01:48:03.474Z,
received 2026-09-30T01:48:03.580Z. Original session tool completion was logged at
01:48:03.574Z. These are host receipt clocks, not provider finality clocks.

| Asset | Returned / expected | Unknown interpolation | Gaps / duplicates | Adapter result |
|---|---|---|---|---|
| GLD | 78 / 78 | 78 | 0 / 0 | QUALITY_BLOCKED |
| IBIT | 78 / 78 | 78 | 0 / 0 | QUALITY_BLOCKED |

All session markers are reg, with left edges 13:30 through 19:55 UTC. All elapsed
intervals ended before request. Price, volume, ordering and scope checks passed.
INTERPOLATION_UNKNOWN remains the explicit local blocker. Adjustment none was
requested but not echoed as a response guarantee; revision and finality metadata
remain unavailable. No September 29 one-minute comparison was requested. The
September 17 four conflicting intervals / thirteen fields remain unresolved;
they are not erased or asserted as September 29 conflicts.

This is an after-hours historical diagnostic, not a natural 15:50 capture,
prospective setup, fresh entry observation or September 30 scheduled acceptance.

## Independent checks and private evidence

Private evidence is under the isolated worktree's ignored directory:
data/runtime/options-etf-source-inputs/source-recheck-20260929/.

- original-mcp-event.json: programmatically extracted original completed event.
- verified-capture.json: exact request and original response, with verified clocks.
- clock-and-call-proof.json: original session clock code/output and MCP event.
- independent-verification.json: adapter results, fingerprints and call counts.
- codex-events.jsonl and batch-20260930T014803474Z.receipt.json: original CLI log
  and saved receipt. Saved response was deep-equal checked against original event.
- isolated-validation/data/runtime/options-etf-setup/sources/ contains one private
  source record, independently recovered with verifyEtfSetup.

Input fingerprint: sha256:92ce73834adde83b39deba811eadeff9ec3067ce1d262f73b08e3654d1673a3d.
Report fingerprint: sha256:eb2bad092108f756dca4ce85153b1a6b572f70c4a9bccbf6fee3a261abdd5df8.
Original event file SHA-256: ad1ddeeb32b2b13d8a7b3de0ea269331ce1fa295ef9bd8888518cd430e03675e.

Existing assessRobinhoodEtfBars, recordRobinhoodEtfBars and verifyEtfSetup processed
these original inputs and recomputed the stored report. Both assets retain
sourceQualified=false and setupInputAutomaticallyInstalled=false. Related tests:
Robinhood ETF bars 38/38; source audit 45/45. No application implementation changed,
so the deployed c46ff75 full validation remains the implementation baseline.
Production Alpha and Alpha-workbench ETF sources/audits/plans/bars remain zero;
no production record, source import, prospective rule or plan was installed.

## Concrete remaining source requirement and existing entry points

The next source step requires provider-backed meaning for omitted interpolation
flags, or explicit non-interpolated flags with independently supportable source
provenance; raw adjustment and revision/finality semantics also need evidence.
The September 17 same-provider cross-interval discrepancies need an explanation,
not a chosen winning copy. There is no justified sourceQualified=true path today.
Provider questions already exist in OPTIONS_ETF_SOURCE_AUDIT_DELIVERY.md; none
were sent by this task. Do not repair evidence by adding false flags.

Existing local entry points are scripts/options-etf-setup.mjs --record-source
<capture-path> and --verify <record-path>, implemented in
scripts/lib/options-etf-setup-io.mjs and RobinhoodEtfBars.ts. They retain blocked
source inputs. Use a private isolated workspace root for qualification experiments.
The --audit-source command requires the verified five-minute record plus a genuine
same-window one-minute capture; no such September 29 capture was obtained here.
Prospective --register / --import and existing setup assessment require their own
valid evidence and cannot backfill this retrospective session. A qualified source
alone would still not establish prospective rule registration, current attributed
analysis, direction/contract alignment, fresh quotes, known costs or Owner freeze.

Alpaca remains a documented optional preflight, not an active adapter. Tracked
Alpaca references are historical specifications; inspected Codex MCP configuration
has no Alpaca server. Inspected process key-presence checks and repository .env /
.env.local presence checks were not configured. No key values were read or printed.
This is limited to inspected surfaces, not a claim about all machine secret stores.
No account, subscription, alternate endpoint or connection changes were attempted.

Running Workbench and Windows scheduled task pins are managed separately by the
integration task. This documentation-only branch does not deploy or alter them.

The existing 15:50 scheduled collector still uses its four quote/chain tool types;
it does not automatically call get_equity_historicals. This one historical read
does not establish continuing five-minute bar coverage or prospective setup rules.
Successful natural quote-chain capture alone cannot establish an automatic entry.
