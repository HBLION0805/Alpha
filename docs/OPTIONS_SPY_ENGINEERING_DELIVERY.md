# One-share SPY engineering lifecycle — October 12, 2026

This explicit local command tests the mechanics of one simulated stock purchase,
holding period, sale, cash accounting and recovery using new real quote receipts.
It is not a directional strategy test. Research and strategy qualification are
`NOT_APPLICABLE_ENGINEERING_ONLY`; the existing option admission paths and the
morning/R2 NO_TRADE records remain unchanged.

## Fixed scope

- SPY only, one long share, one entry attempt and one exit attempt. No additions,
  shorts, options, borrowing, source retry or real order.
- `REAL_MARKET_DATA_SIMULATION` is separate from `SYNTHETIC_FIXTURE`. The reused
  journal has a historical mock filename; its new start/report versions explicitly
  identify this engineering lifecycle and never describe fixtures as real data.
- Real mode binds the entire existing simulated funds envelope, including its
  original validity, to a fixed SHA-256 and the existing account
  `paper-sim-tech-1000-20261010`. The initial $1,000 is reused, not added again.
  The fixed account directory cannot accept a different start manifest.
- A per-account exclusive lock protects start, append and recovery. The operator
  must also confirm that the same account has no journal or concurrent writer in
  the other protected workspaces before the one authorized start. This lock is
  local to the selected workspace, not a distributed account lock.

## Prices, costs and clocks

The simulated buy uses displayed ask plus $0.01 adverse slippage, plus $0.01 other
friction. The sell uses displayed bid minus $0.01 adverse slippage, minus $0.01
other friction. Commission is explicitly assumed zero. These are engineering
assumptions, not a statement of Robinhood fees. One-share execution at the shown
price assumes availability where displayed size is absent; it is not a fill-depth
guarantee. Exact micro-USD integers retain fractional-cent prices.

The full entry cost plus a two-cent exit reserve must fit settled cash and the
fixed $1,000 budget. No direction, QQQ level, profit target or strategy spread
limit applies. Bid/ask must be positive, uncrossed, SPY/active, within the existing
120-second freshness reference and regular session, with both source clocks and
the request strictly after the actual new T0. Entry must be applied within two
minutes of T0. Real start/application must be within five seconds of the actual
local wall clock; caller-supplied timestamps cannot backdate them.

Hold time is seven minutes from the actual simulated entry application. Exit
request and both quote clocks must be at or after that deadline. A missing,
failed, stale or unsuitable exit leaves `OPEN_UNRESOLVED`; recovery does not
manufacture a close. Application clocks are millisecond instants; original
nanosecond provider quote clocks remain in the report and source originals.

Sale proceeds remain unsettled under an explicit T+1 stock-sale assumption.
No settlement credit is implemented and unsettled cash cannot fund an entry.
There is no second trade. Real broker fills are always zero; modeled fills and
modeled P&L are reported separately.

## Retained evidence and commands

The existing one-call `options:equity-source-probe` is the only acquisition path.
The lifecycle event retains its complete original bundle: intent, Host transcript,
events, capture where present, run, assessment and manifest. The same pure
verification used by probe recovery checks hashes, origin relationships, exact
request/response binding, assessment replay and persistence clocks. This is local
provenance/integrity evidence, not cryptographic provider authentication.

`options:spy-engineering` exposes `--start PLAN`, `--append PROBE_DIRECTORY
--action ENTRY|EXIT --account ID`, and `--recover --account ID --at UTC`.
The command makes no source or broker call. Plan construction is available as
`makeSpyEngineeringPlan`; T0 is assigned only when the approved protocol is
actually started. Source and lifecycle writes remain explicit separate actions.

## Verification and current acceptance

The dedicated suite covers the normal full lifecycle, micro-USD reconciliation,
failure/missing/stale/future quotes, bid/ask integrity, insufficient funds, missing
exit, duplicate events, cross-process recovery, writer exclusion, raw-source
tampering, fixture relabeling, full funds validity and nanosecond boundary cases.
Independent review found and prompted repairs for the latter source and funds
bindings before any real run. See [status](status/spy-engineering.json).

Implementation and fixtures do not establish real Paper acceptance. The real
protocol remains private and must be reviewed before actual T0/acquisition. All
real originals, protocol, journals and results stay ignored/local. No stock UI,
general strategy framework, new timer, deployment, CPI/15:50 change or challenge
ledger change is included. This stage permits local commit only; public push
requires its own scope authorization.
