# Technology option quote adapter V1

This reusable Alpha development entry removes the technology-symbol quote mapping
and manual raw-response transfer gap. It uses the already configured
`robinhood_alpha_market_data` OAuth MCP through the existing local Codex Host.
It does not read browser sessions, cookies, tokens or credential files.

## Entry and scope
`npm run options:tech-quotes -- --capture --symbol AAPL --expiry YYYY-MM-DD --strike DECIMAL --run-id UNIQUE_ID`

The Owner supplies one AAPL/TSM/QQQ symbol, expiry and strike for a source-feasibility
sample. This is not contract ranking, a trade recommendation, a plan or a fill.
The bounded collector makes at most four serial market calls: chain, exact
instruments, underlying equity quote, and one batch of at most two call/put quotes.
It rejects ambiguous chains, altered identities, unsupported multipliers, extra
pagination and source failures without retry or substitution.

The entry starts the existing local Codex Host in read-only mode, with a temporary
four-tool Robinhood allowlist and a local read-only validation MCP bound to this new ignored
run directory. No saved MCP configuration or production service is changed.
No new timer, scheduled source call, subscription or persistent background
service is installed. An equipped local Codex runtime, its authorized OAuth
connection and available runtime allowance are required.

The returned collector runs as a fixed function; the Host is instructed to call
it once and submit its complete result for read-only validation.
The parent Alpha CLI streams the original Host output into the ignored run,
binds the collector receipts to actual completed market tool events, and exclusively
saves the raw capture and normalization. The Host itself does not write files.
The first integration attempt preserved a write-tool approval refusal; the corrected
architecture keeps the existing read-only policy and requires no approval change. Host failures,
missing receipts and normalization failures remain explicit.

## Saved evidence and chronology
Each new run exclusively creates:
- request.json: actual request time, explicit selection and collector/code hashes;
- collector.js and host-prompt.txt: exact instructions used for this run;
- capture.json: original receipts, source/receipt clocks, hashes and normalization;
- host.jsonl, host-stderr.txt, host-run.json: local Host outcome and diagnostic originals.

No file is overwritten. Real artifacts remain under ignored
data/runtime/options-workbench-development. The original October 9 research
and short-window review are not edited or backfilled.

`npm run options:tech-quotes -- --normalize CAPTURE_OR_RECEIPT_FILE`
reassesses saved evidence at actual current time without any source calls.
An old successfully acquired quote may now be stale; its original assessment
is preserved. Normalization does not refresh any timestamp.

## Source semantics
Instrument identity, multiplier, bid/ask, sizes and min_ticks come from the exact
verified instrument and quote responses. The option's updated_at is the provider
quote-refresh time. It is not relabeled as independent exchange bid/ask times.
The equity's regular trade, bid and ask clocks remain separate nanosecond strings.
A recent equity bid/ask does not repair an old regular trade. Zero/missing quotes,
missing sizes, unknown clocks, stale/future data and off-grid prices fail closed.

Existing snapshot freshness, session and mechanical spread checks are reused.
Option mark, fill-rate estimates and model profit probabilities never become fills,
guaranteed prices, win rates or eligibility overrides. Chain can_open_position
does not prove this Owner's account permission. Contract deliverable, exercise
style, data entitlement, account permission, available funds and declared costs
remain unknown unless separately evidenced.

The output exposes SnapshotQuote-compatible saved observations for the separate
technology feasibility consumer. It does not synthesize its missing CONTRACT /
DATA_ENTITLEMENT / PRODUCT_PERMISSION / ACCOUNT_FUNDS / RISK_LIMITS reviews.
The existing GLD/IBIT capture, guidance and plan validators remain unchanged.

## Remaining lifecycle work
Quote acquisition and normalization do not create a decision or Paper position.
A subsequent scoped integration must bind a frozen exploratory/confirmed decision,
reviewed product/account/cost/risk evidence and structure comparison to a new
isolated technology plan/entry/position/exit adapter, then prove an independently
quoted exit and recovered review. No historical price may be used to invent entry.

## Reviewer correction
The trial classifier now preserves every existing research blocker by default,
rather than accepting only selected string prefixes. It explicitly defers only
named technical/pending confirmation requirements, while retaining
MATERIAL_NEWS_DETAIL_UNKNOWN and other current or newly added unknown blockers.
Eight regression cases cover this finding and related news combinations.

## Inherited policy and execution dependency
The spread formula is inherited from mechanicalReference in the existing
GLD/IBIT engineering bridge: max(tick, min(10 cents, rounded-down 10% of ask)).
It is not a universal safety or account rule. Technology applicability requires
a separate prospective decision; the current checks do not relax it.
Only options:tech-quotes launches the local native OAuth Host. Offline
options:tech-paper does not make source calls. Runtime evidence stays ignored.
