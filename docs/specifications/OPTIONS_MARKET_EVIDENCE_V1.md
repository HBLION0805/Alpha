# Options market evidence v1

Date: 2026-09-06. Reviewed before implementation. Baseline e38e877.

## Objective and authority

The Owner authorized the next step toward real GLD/IBIT quote-path testing.
Implement a source-attributed import, evidence history and replay qualification
boundary without claiming a live feed or changing existing simulated results.
Development, saving, commits and pushes remain authorized. No data subscription,
new account, credential search or brokerage action is part of this delivery.

Research found that Cboe delayed dashboard extraction is prohibited and Nasdaq
web pages are not a supported automated feed. Documented options APIs require
credentials/data rights; Alpaca indicative quotes are modified derivatives, not
actual OPRA quotes. Do not substitute them for an authorized OPRA source.

Implement licensed **Cboe DataShop Option Quotes CSV** as the first supported
local file format. A file format match is not publisher authentication or proof
of licensing. Owner-provided files carry an explicit local-use declaration;
fixtures remain synthetic. Actual data access is a separate prerequisite.

## Inputs and semantics

Required metadata: datasetId, origin (SYNTHETIC_FIXTURE or OWNER_PROVIDED_FILE),
source (CBOE_DATASHOP_OPTION_QUOTES), usageDeclaration (SYNTHETIC_TEST_ONLY,
OWNER_ATTESTED_LOCAL_USE or UNKNOWN), intervalMinutes (1-405) and delivery
(HISTORICAL_FILE or INTRADAY_15_MIN_DELAYED). Do not accept caller-provided
ingestion time, hashes, live authority or verification flags. The CLI assigns
the actual ingestion clock and hashes exact UTF-8 file content before parsing.

Accept the documented CSV fields with exact headers and bounded RFC4180-style
quoted cells, BOM/CRLF and optional analytics/open-interest columns. Reject
truncated, duplicate-header, over-limit, malformed-number or contradictory rows;
never silently truncate a file. Restrict trading instruments to GLD/IBIT.
Record counts of non-target rows if skipped; adjusted/nonstandard target roots
remain explicit blockers. Parse USD decimals exactly into integer cents; reject
sub-cent values rather than silently round. Preserve missing bid/ask/size as null,
not zero or fabricated liquidity. Distinguish quote times from last-trade times.

quote_datetime is interval end in America/New_York. Convert with date-aware DST
rules and reject ambiguous/nonexistent local times. Keep both original ET time
and normalized UTC. Ingestion is a separate current timestamp and never replaces
historical market time. Input quote times after ingestion are rejected for owner
files; controlled future fixtures remain labeled synthetic. IV zero is unavailable
under this format's documented model semantics. Retain optional Greeks as exact
bounded decimals and unknown values without invented model output.

Source limitations are code-owned: 15-minute delay for intraday delivery,
historical delivery availability not known per quote, interval sampling does
not establish tick order, early-close timestamps require independent calendar
evidence, and sizes on/after 2026-06-22 can reflect the last PRICE CHANGE in the
interval rather than contemporaneous displayed liquidity. Contract deliverable,
multiplier, exercise style and price grid require independent verification.

## Qualification and integration boundary

Produce deterministic per-contract path summaries: row counts, start/end,
duplicate/revision handling, missing fields, gaps against declared interval,
snapshot versus multi-observation status and explicit replay blockers. Exact
duplicate economic snapshots are idempotent; conflicting records at one contract
and snapshot time reject the dataset. Prices can support source-labeled inspection
but cannot alone establish an executable trade or a win rate.

Preserve data origin and actual ingestion timestamp. Qualified format does not
mean qualified market provenance. A single snapshot never establishes a complete
trade path. No export into v1 paper trading is allowed until independently proven
contract/calendar/cost evidence and an explicit historical availability/fill model
exist. Do not backdate receivedAt to get past v1's freshness checks, fill unknown
sizes, infer a verified holiday calendar, or silently widen accepted origins.

This is the integration gate into the existing simulator, not another simulator.
It outputs NO_REPLAY with concrete reasons and zero trades while those gates are
unmet. Existing paper/review engine outputs and their persisted fingerprints must
remain unchanged. A later replay engine/version may consume this evidence with
declared assumptions; its outcomes must remain separate from synthetic tests.

## Storage and commands

Store normalized evidence in a separate ignored `data/runtime/options-market-evidence/`
single-writer, bounded, hash-linked journal. No copyrighted full articles or API
credentials. Persist source file hash and normalized observations, not a repository
copy of licensed raw data. Replay checks recompute normalization/qualification
from validated stored normalized fields and retain the original file hash as a
local integrity reference, not proof of origin. Same datasetId with changed
content is a conflict; the same payload/metadata imported again is idempotent
without inventing a new first-seen time. Corrections use a new datasetId.

Deliver catalog/help/demo, local CSV+metadata import and saved-report commands.
The demo is synthetic and exercises missing fields, delayed data, adjusted roots,
snapshot-only and modern size semantics. Preserve the existing paper journal
byte-for-byte and verify that it still reproduces its saved result.

## Acceptance

Strict schema/number/time/source validation, tested DST transitions, duplicate
and conflict behavior, old/new size semantics, latency distinction, no fabricated
replay authority, bounded storage, idempotency, corruption checks and restart
recovery. Run focused suites, strict typecheck and the full aggregate. Document
actual data access separately: if no authorized file/API exists, report that
real-price replay is blocked rather than presenting fixtures as real outcomes.

References: [product](https://datashop.cboe.com/option-quote-intervals),
[file layout](https://datashop.cboe.com/documents/Option_Quotes_Layout.pdf),
[Alpaca historical data](https://docs.alpaca.markets/us/docs/historical-option-data).
