# Gold and Bitcoin focused news v1

Task OPT-FOCUSED-NEWS-1. Owner request, September 8, 2026: bring the illustrated
news-monitoring workflow into Alpha, scoped to gold/GLD and Bitcoin/IBIT.

## Reviewed design

Keep the original six-source journal, parsers, reports and issued guidance
reproducible. Add a separate supplemental headline store for three verified
fixed public feeds: Federal Reserve speeches/testimony, EIA Today in Energy,
and CoinDesk's canonical RSS endpoint. Reuse the hardened bounded transport and
RSS subset through new fixed-source wrappers; original wrappers retain their
original six-source allowlist and behavior. No arbitrary URLs or redirects.
Store title/link/publication/actual receipt metadata, not article bodies.

A pure classifier projects all available headline metadata into direct GLD,
direct IBIT, or indirect macro context. Keep interest rates, inflation/jobs,
USD/FX, oil, liquidity and geopolitical risk when a concrete possible connection
exists. Exclude unrelated single-company technology and unrelated token stories
from the default view; retain source records. Keyword matches are leads, not
facts, directional signals, independent corroboration or probabilities.
Show a conditional transmission mechanism, source type and original clocks.
Unknown publication time, stale titles, partial/failed feeds and missing coverage
remain explicit. Repeated headlines do not become new events or fresh facts.

Supplemental snapshots use exclusive files, fingerprints, recomputation and
bounded safe recovery. Add an independent hourly public-context slot so old
hour/day claims remain unchanged and cannot falsely imply supplemental reads.
Workbench reads do not fetch sources. The existing hourly process/Host performs
the new bounded refresh. No new schedule, account capability or order path.

Use a focused default News & calendar view with GLD/IBIT/macro filters, source
coverage, excluded counts and analyst support/opposition/invalidation links.
The Host brief gets an additional focused-news section without changing old
guidance report inputs or historical hashes. Add a bounded daily Host web review
for gold industry/ETF/central-bank demand and BTC/ETF/regulatory/geopolitical
developments; prioritize original sources, keep actual URLs and receipt times,
and explicitly retain missing numerical or article evidence. WGC/Reuters-style
web review is separate from continuously connected RSS coverage.

Screenshots are examples of presentation and user interests. Their quoted prices,
probabilities, VWAP assertions and outside ChatGPT conclusions are not imported
as verified market data. No automated access to other ChatGPT conversations.

## Acceptance

Test direct/indirect/excluded classification and ambiguity, stale/future/unknown
clocks, duplicate/corrected titles, missing/failed recovery, unsafe paths and
tampering, fixed feed scope/deadlines/redirects, independent hourly claims,
focused UI filtering and escaping, and unchanged original report recovery.
Run relevant suites, strict typecheck and aggregate validation; inspect the
running desktop/mobile UI and perform one bounded live supplemental refresh.
Keep runtime data ignored, retain owner ledger and original market restrictions.
