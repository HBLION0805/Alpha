# BTC daily context and readiness integration

Task OPT-BTC-2, September 7, 2026 UTC. The independently verified public BTC source
now joins daily context collection and the local operational readiness report.
The [reviewed specification](specifications/OPTIONS_BTC_CONTEXT_INTEGRATION_V1.md)
records the design and source boundaries before implementation.

## Changes

Added a v3 restoration snapshot, retaining exact v1/v2 bytes and all non-prompt
automation fields. Updated the shared wrapper, phase references and runbook so
the daily 09:00 New York branch independently attempts news, Treasury and one BTC
refresh. Their existing commands provide bounds, actual source clocks, local
history and sanitized failures. Daily BTC staleness is expected between snapshots;
routine price changes do not independently trigger notifications. The four frozen
option contracts, September 8 09:30-09:50 window, cadence and host quote JavaScript
remain unchanged. No second timer or process is installed.

Added `OptionsContextReadinessEngine.ts` and tests. `scripts/options-readiness.mjs`
now uses the v2 composition for its CLI while preserving the original v1 recovery
export and pure engine. The exact v1 report is recomputed before extension. BTC
evidence has a source report hash, actual check clock, original source/receipt
clocks, counts, latest source state, midpoint, quality issues and separate display
staleness. Failed or missing storage is independent of source failure. The v1
review calculations and core next step/dependencies remain unchanged; optional
BTC context has its own next step and cannot qualify an option replay.

Also updated the context/host tests, npm/aggregate registration, LF preservation,
README, architecture, roadmap, decisions, changelog and handoff. Older source and
readiness delivery reports remain dated records. No accepted runtime data is
committed or overwritten.

## Validation and operational evidence

Focused typecheck, readiness recovery and host-phase tests pass. The v2 actual
readback is `data/runtime/options-readiness/btc-context-v2.json`: six available
stores, imported evidence missing, no blocked stores; five closed paper trades
retain five reviews and four candidate notebook entries. One BTC observation
remains recorded at its original actual receipt; its display-freshness flag is
false at this later check. No new source request or trade was needed.

`npm run alpha:validate` passed **2,800/2,800 tests across 106 components** in
46,898 ms, including strict typecheck and documentation/scope checks. Independent
host readback at **2026-09-07T05:12:08.639Z** matched all expected v3 armed fields;
the host file SHA-256 is
`66a5bad3cd80d32fc893f4bdff32b06a1937e9b676df97d8546db9f93c25bbc5`.
The [integration checkpoint](status/btc-context-integration.json) binds fifteen
unchanged accepted artifacts and the actual v2 report hash
`6b4a9ff42b3d86f15e95a9749d91ecb3cec41c92c8517351255e97461f26cb3b`.
Tests retain original v1 output behavior,
isolate missing/busy/corrupt/unsafe BTC storage, reject falsified source/clock/
permission summaries and verify source journals stay byte-identical. The shared
host update uses only the already authorized automation API; frozen option data
and the exact host quote program were compared independently to the prior Git
commit. A fixture union annotation initially failed strict typecheck and was
corrected without weakening compiler settings. No validation failure remains.

## Limits and next step

This remains a local sequential diagnostic, not an atomic database snapshot,
calibrated signal, continuous BTC feed, broker account check or execution adapter.
Daily context supports review; it cannot provide intraday price paths or override
quote quality and capital limits. Actual first-window option data is still pending.

The local computer, app, project dependencies, network and available Codex execution
capacity must support later wakes. An armed timer is not proof that collection
will run after quota exhaustion. No reset credit or paid capacity is consumed.
Next evaluate actual opening collection coverage and source semantics before any
real-price research adapter. Git commit/push uses the Owner's existing authority;
all automatic orders remain disabled.
