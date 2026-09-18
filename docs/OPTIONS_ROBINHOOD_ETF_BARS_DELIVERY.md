# Real Robinhood ETF bars connected

September 17, 2026. [Specification](specifications/OPTIONS_ROBINHOOD_ETF_BARS_V1.md).
The Owner restarted the connection. The sixth tool now exposes its actual schema
and returned GLD and IBIT history in one read-only call. No further MCP restart
is needed for this capability.

The request selected September 17 09:30–16:00 New York, five-minute regular-session
raw prices. Requested and received at 23:49:18 UTC. Each ETF returned 78 consecutive
bars with OHLC, share volume and reg session. Prices retain six decimal places.

| Returned window observation | GLD | IBIT |
| --- | ---: | ---: |
| First bar open | $400.320000 | $43.240000 |
| Last bar close | $398.280000 | $43.315000 |
| High | $401.430000 | $43.610000 |
| Low | $398.040000 | $42.955000 |
| Reported share volume | 2,932,833 | 13,327,057 |
| Missing interpolation flags | 78 | 78 |

These are retrospective returned-window observations, not official daily closes,
live prices, validated trends or trade recommendations. All 156 interpolated
fields are omitted and map to null. Positive volume never changes null to false.
Both source assessments are QUALITY_BLOCKED / INTERPOLATION_UNKNOWN. The strict
setup store has no new bars or rules; canonical WATCH and frozen paper reports
remain unchanged. No source schedule, account access or order was added.

The pure adapter checks request/response identities, interval, raw-price request,
grids, clocks, OHLC and volume. A separate evidence projection preserves unusable
or unknown observations in Daily guidance under **Robinhood ETF price observations**,
including expandable per-bar tables. An elapsed bar window is not independent
upstream finality certification. Local export provenance remains unqualified
even if all shape checks pass. Reported percentage changes truncate to whole
basis points; exact source prices remain available.

Use `npm run options:etf-setup -- --record-source <workspace-relative JSON>` to
save request, response, clocks, report and hashes. `--verify` recovers copied
records alone. Input and record directories are explicitly ignored by Git; the
first aggregate check caught missing ignore entries, corrected before staging.
No runtime record was committed.

Actual private record:
`data/runtime/options-etf-setup/sources/2026-09-17T23-55-10-454Z-f536f391-9abb-4c20-b9ec-2810636dec87.json`.
Report fingerprint:
`sha256:facecccc7d8dbe3e961eb55d2a85617d09c6a65e9cda19483e51a39e159679b0`.

The adapter's 38 cases and existing setup desk's 36 cases pass. Aggregate
`node scripts/alpha-validate.mjs` passes 4,620 tests in 175 components, zero
failures, including typecheck. Browser and recovery evidence is in
[the checkpoint](status/robinhood-etf-bars.json).
The actual record also recovers from a separate copied-record-only directory.
Desktop and 390-pixel mobile inspection pass, including expanded source rows;
table overflow was corrected using the existing scroll container and bounded
grid item width. No browser console errors or production form submissions.

Next resolve upstream omitted-flag semantics with verifiable evidence or another
qualified traded-ETF source, then register future setup rules and observe their
outcomes prospectively. Never backfill a rule for this completed session.
The completed engineering round trips do not validate a strategy.
