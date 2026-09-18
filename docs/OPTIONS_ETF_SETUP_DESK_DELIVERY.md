# ETF trend to contract research desk

September 17, 2026. [Scope and acceptance](specifications/OPTIONS_ETF_SETUP_DESK_V1.md).

Later September 17 update: the Owner restarted the connection and the actual
historical adapter now saves 78 bars per ETF. All interpolation flags are omitted,
so setup qualification remains open. See [source delivery](OPTIONS_ROBINHOOD_ETF_BARS_DELIVERY.md).
The original source prerequisite and acceptance below describe this desk's earlier delivery.

Daily guidance now has **ETF trend → contract research**. It accepts a future,
immutable breakout, pullback or key-level rule, validates normalized GLD/IBIT
five-minute OHLCV, records observed confirmation/failure and compares the saved
option sample with the declared direction, exit horizon and delta target.
Contract reasons retain the existing quote, allocation, cash, calendar and cost
blockers. New ordering is explicitly research fit, not predicted profitability.
The original guidance and frozen paper outcomes are unchanged.

Validation uses exact micro-USD, complete regular-session grids, explicit bar
flags and source/receipt clocks. Baseline means/volume use only bars before rule
activation. Within-session mean volume is not time-of-day relative volume, and
typical-price bar VWAP is an approximation over the imported window. Intrabar
invalidation takes precedence over an ambiguous entry. Later failed breaks,
excess chase and expired windows remain visible. No actual option PnL is inferred.

Plans, imports and copied-input assessment snapshots are append-only under
`data/runtime/options-etf-setup`. The local protected API, CLI and English UI
share the same engine. Snapshot recovery does not need original source stores.
Imported provenance is unverified and cannot authorize an entry or supply a
qualified live signal. No production rule or synthetic bar file was installed.

## Actual source prerequisite

Robinhood's [official tool list](https://robinhood.com/us/en/support/articles/trading-with-your-agent/)
includes `get_equity_historicals`. The existing Codex connection previously exposed
only five market tools. This task added only that sixth read-only tool to its
`enabled_tools`; endpoint, authentication and all other config bytes were preserved.
The active conversation still exposes the five original tools. Configuration is
not proof of a source response: reload the MCP connection, inspect the actual
schema, then implement/test its normalization using real GLD/IBIT responses.
No unofficial endpoint, credential extraction, account/order tool or source timer
was introduced. Existing scheduled monitoring remains unchanged.

## Use and verification

Open Daily guidance, expand **Declare a future research rule**, and enter real
ETF levels with future device-local times in one New York regular session.
Defaults are untested research parameters. A normalized `OPTIONS_ETF_BARS_V1`
JSON import is optional; its exact shape is in `src/contracts/OptionsEtfSetup.ts`.
It is a development/research input, not a substitute for the pending live adapter.

Commands: `npm run options:etf-setup -- --desk`, `--register <relative JSON>`,
`--import <relative JSON>`, `--snapshot <plan ID>`, `--verify <saved record>`.
No command transmits brokerage instructions or enrolls a paper plan.

The focused suite verifies 36 cases including both directions, all three setups,
malformed/gapped/future bars, prospective timing, ambiguous invalidation, failed
breaks, chase limits, deterministic contract fit, retained cost/budget blocks,
copied-only recovery, tamper rejection and session-protected HTTP integration.
Original decision-card (12), guidance (101) and workbench (57) suites pass.
Desktop and 390-pixel browser checks show the honest empty states and accessible
rule form without horizontal overflow or console errors. No form was submitted
to the Owner workspace; protected mutations were tested in isolated storage.
`node scripts/alpha-validate.mjs` passes: 4,582 tests, zero failures, 174 components,
including typecheck. Integrated/UI checks are recorded in
[the checkpoint](status/etf-setup-desk.json). Existing September 17 V2/V3 paper
reports still verify independently; neither frozen result was recalculated as
a new strategy outcome.

This completes the local research desk, not the whole trend recommendation stage.
Real ETF source semantics/qualification and independently observed strategy
outcomes remain open. The prior engineering paper milestone stays complete.
