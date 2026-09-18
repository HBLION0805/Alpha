# ETF source consistency investigation

September 17, 2026 New York. [Specification](specifications/OPTIONS_ETF_SOURCE_AUDIT_V1.md).
The investigation is implemented; source qualification and real trend-to-contract
validation remain blocked. No strategy result is claimed.

The current official MCP schema defines interpolated=true but gives no default
for omitted values. Robinhood's [official tool listing](https://robinhood.com/us/en/support/articles/trading-with-your-agent/)
confirms historical OHLCV availability but does not resolve that omission. Old
unofficial-client examples are not evidence of current MCP semantics.

One new read requested September 17 09:30–16:00 New York, raw regular-session
one-minute GLD/IBIT bars. Request/receipt: September 18 00:27:29 UTC (September 17
20:27:29 New York), with 390 consecutive bars per ETF. All 780 flags are omitted.
The existing five-minute response was received at 23:49:18 UTC. Both raw receipts
are retained without edits. No new schedule, retry, order or account read.

Exact micro-USD aggregation compared open/maximum high/minimum low/final close
and summed share volume across each five-minute interval:

| ETF | Matching intervals | Different intervals | Differing fields | Difference starts, New York |
| --- | ---: | ---: | ---: | --- |
| GLD | 76 | 2 | 6 | 10:15, 14:50 |
| IBIT | 76 | 2 | 7 | 10:15, 13:05 |

At 10:15, GLD's five-minute open is $400.370000 versus $400.715000 from the
one-minute aggregate; volumes are 17,969 versus 51,283 shares. IBIT's corresponding
opens are $43.395000 versus $43.520100; volumes are 81,576 versus 217,215 shares.
The UI and saved report contain all 13 field differences. All 156 paired closes
match. This does not validate highs/lows, volume, flags or any trend signal.

These are same-provider observations at different receipt times, not independent
confirmation. Revisions, trade filters and interval construction are possible
questions, not established causes. Neither interval is selected as correct.
Original data are not averaged, replaced or imported into strict setup inputs.

Daily guidance now shows **ETF source consistency audit** with per-ETF counts,
both receipt clocks, exact differences and unsent provider questions. The existing
CLI adds `--audit-source <verified-five-minute-source-record> <minute-input-json>`.
Reports copy both complete inputs; a copied record alone recomputes the audit.
The old source report fingerprint remains
`sha256:facecccc7d8dbe3e961eb55d2a85617d09c6a65e9cda19483e51a39e159679b0`.

Actual audit: `data/runtime/options-etf-setup/audits/2026-09-18T00-33-35-131Z-61488d64-72d8-4a58-b1cb-bd3d5cb3e7b3.json`.
Fingerprint: `sha256:24ec3f9d91f5b6fe74871a76af78bb337957f4547ae36a43d508a0f564e34eb9`.
The private source pair and copied-only recovery are retained locally and ignored
by Git. No source captures or account data are committed.

Validation: 45 new audit tests, 38 existing adapter tests and 36 setup tests pass;
strict typecheck passes. `node scripts/alpha-validate.mjs`: 4,665 tests passed,
zero failed, 176 components. Desktop and 390-pixel mobile checks passed with
expanded difference tables, no page overflow and zero console errors.
See [checkpoint](status/etf-source-audit.json).

Next obtain documented provider clarification for both omitted flags and interval
construction/revisions, or authorize/use another qualified ETF data source.
The draft is visible in the desk; it has not been sent to anyone. A subsequent
prospective setup test must use qualified data and a rule declared before its
window. Do not backfill today's signals, reopen completed engineering rehearsals
or silently relax the quality checks to produce a recommendation.
