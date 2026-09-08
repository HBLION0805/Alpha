# Focused gold and Bitcoin news

Task OPT-FOCUSED-NEWS-1, September 8, 2026.

## Behavior and reason

The Owner asked for screenshot-style news monitoring focused on gold and Bitcoin.
The previous six official headline feeds covered only part of that need. The
News & calendar page now combines those originals with Fed speeches, EIA energy
and CoinDesk. Direct gold/GLD and Bitcoin/IBIT stories are retained alongside
rates, currencies, inflation/jobs, energy, liquidity and geopolitical context.
Unrelated individual-stock and token stories are filtered from this view.
The trading universe remains GLD and IBIT.

Relevance is deterministic and does not establish direction. The page displays
conditional transmission mechanisms, source type, actual feed/publication clocks,
failures, partial results, unknown dates and coverage gaps. Filters select asset,
macro-only context, source and headline text. The existing analyst interpretation
adds supported evidence, opposing factors and invalidation, linked to daily
guidance. Screenshots and other ChatGPT tasks are not synchronized or accepted as
verified market data.

The existing Host runbook now includes a bounded daily web review of WGC, ETF
issuers and material gold/Bitcoin macro news. The nine RSS feeds run hourly while
Alpha runs; web review requires a successful Host wake. It is not a continuous
newswire. Official BLS/FOMC calendars take precedence over relative news wording.
No Host field, schedule, close-capture date or immutable restoration file changed.

## Actual source evidence

The authorized service once-run at 13:42:26 UTC skipped already-attempted original
hourly and daily slots, then completed the independent focused-hourly slot.
All three supplemental sources returned OK: Fed 15 titles, EIA 13 and CoinDesk
25, with zero rejected items. Metadata and the feed hash were saved exclusively
under the independent focused-news store and verified through its own CLI.
This single successful read does not establish future availability.

The resulting combined view contains 171 distinct saved titles: 50 relevant,
including nine direct stories, and 121 outside the focused view. Nine relevant
titles have publication timestamps within 72 hours. Original source records
remain intact. EIA's uninterpreted EST publication strings remain unknown;
current receipt time is never substituted for publication time.

Primary source setup references are the [Fed feed catalog](https://www.federalreserve.gov/feeds/feeds.htm),
[EIA RSS catalog](https://www.eia.gov/tools/rssfeeds/) and
[CoinDesk RSS announcement](https://www.coindesk.com/coindesk-news/2021/09/17/coindesk-rss).
CoinDesk's trailing-slash URL returned 308; its verified canonical endpoint
without the slash returned XML. The transport still rejects redirects. A probed
MINING.COM gold feed returned 403 and was not configured. No registration, paid
step, proxy workaround or new dependency was used.

A fresh attributed note was recorded at 13:45:27 UTC, assessed at 13:44:23 UTC,
using WGC's dated weekly review, IBIT's dated issuer page, the official BLS
calendar and a saved CoinDesk headline. The latest CoinDesk article reread was
unavailable; the note explicitly does not accept its article-specific figures.
No screenshot price, flow figure, VWAP claim or trade outcome was imported.
The independently verified issued view at 13:46:35 UTC retains WATCH for both
ETFs and insufficient price history. Source URLs and actual retrieval clocks
are stored in the note.

## Implementation and validation

Changed files: the new focused-news contracts, pure projection, bounded metadata
reader/writer/CLI and tests; shared feed transport wrappers, public service slot,
workbench reader and compact Host brief; frontend focused-news module, routing,
filters/export and guidance link; package/validation/ignore registration and
the linked specification, runbook, status and operational documentation.

The original six-source allowlist and journal formats remain unchanged. A new
independent slot allows activation after an old hourly claim already exists.
Failed refreshes keep old titles with failed current source health. Immutable
records verify hashes on recovery; earlier as-of reads cannot be displaced by
later-day directories. Current projections retain only the latest seven eligible
saved days; original files remain available. Missing/unsafe stores fail explicitly.

Validation commands: `node scripts/alpha-validate.mjs`, the focused-news,
context-service and workbench tests, source/analysis/issued-record verification,
owner-ledger verification, the guarded workbench restart and `git diff --check`.
The final aggregate passed 3,923 tests across 157 components with zero failures
in 80,374 ms, including 41 focused-news cases, eight context-service cases,
existing workbench/guidance regressions and strict TypeScript. Warnings cover
the reviewed uncommitted tree and configured Windows line endings. The
[checkpoint](status/focused-news.json) records the actual acceptance.

The first aggregate run found one old service test expecting two subprocesses
instead of the new three; its expected count was corrected. The rerun passed.
A later review added an earlier-as-of recovery regression and retained partial
legacy-source diagnostics. No financial calculation or frozen guidance input
format changed. Browser QA initially used an exact label selector that did not
match the nested select; the inspected accessible combobox role worked. The
browser's empty-fill operation did not clear the search, so keyboard select-all
and Backspace were verified instead. The actual view returned 50 unfiltered,
41 macro-only, 41 GLD, nine CoinDesk/IBIT and one golden-cross search match.
That Bitcoin title does not match the literal-gold filter. All nine source cards,
the new analyst note and official calendar were visible. The 390-by-844 phone
viewport had no horizontal overflow and no application console errors.
After final restart, all seven pages rendered successfully, the nine-source
news view recovered, and the existing BEA rejected-item diagnostic appeared as
partial coverage. The unchanged owner-ledger head was independently verified.

The local workbench was restarted only after repeated PID, process-creation,
full-command, loopback-port and workspace/ledger checks. Its health confirms
context refresh is enabled. Owner ledger verification still reports zero events,
trades and fills, with its original head hash. Synthetic tests remain isolated.

## Limits and next check

Keywords can miss relevant stories or include irrelevant ones. Headlines and
attributed reports do not prove causation, institutional buying, independent
corroboration or an option edge. WGC demand/central-bank/ETF coverage remains
bounded web review, not an automatic numerical connector. Live dollar, oil,
nominal-yield, ETF-flow, funding and liquidation series remain incomplete.
The catalog of 94 indicators is not 94 connected feeds.

This delivery does not change the ten-workstream baseline (4 LOCAL_VALIDATED,
3 PARTIAL, 3 NOT_VALIDATED) or the three open first-real-price paper-flow gates.
Next inspect the following hourly receipt and daily focused web interpretation,
then use qualified market evidence to reassess conditional candidates. Do not
force an entry, invent a probability, or treat a stop as a guaranteed fill.

Git: the Owner's standing save/commit/push authorization applies. Stage only this
focused implementation and its documentation; runtime market/news/analyst records
remain ignored. The final committed and remote head are recorded by Git and the
local delivery evidence.
