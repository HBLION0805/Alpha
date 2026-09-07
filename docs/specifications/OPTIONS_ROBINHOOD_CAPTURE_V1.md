# Robinhood market capture assessment v1

Task: RH-CAPTURE-1. Owner authorized the next GLD/IBIT market-data step after
successful OAuth and runtime loading. Implementation is a bounded offline
assessment of exported market responses, with optional immutable local storage.
No account/order access, credential transport, subscription or execution adapter.

## Reviewed design

- Use only the five previously approved MCP tools for the manual host smoke test.
  Resolve chains, then active instruments, then quotes/history by returned UUID.
  Sample at most four contracts. Selection is a schema test, not a recommendation.
- A capture contains version, ID, declared origin and at most twelve calls.
  Each call retains exact arguments, request/receipt clocks and structured `data`.
  It is a reserialized MCP response, not original HTTP bytes. Exported JSON alone
  cannot authenticate the caller, publisher, entitlement or request clocks.
- The parser consumes at most 512 KiB of JSON text, enforces depth/row limits,
  approved tool and ticker scopes, contract/chain/quote/close/OCC linkage and
  chronology. It never follows response URLs. Unknown numeric liquidity remains
  unknown; volume/open interest cannot replace displayed bid/ask quantities.
- Source quote timestamps retain original precision; age arithmetic uses
  milliseconds. A fixed 60-second diagnostic flags stale data both on receipt
  and at assessment. It is not a live execution policy. Missing/future clocks,
  missing/zero/crossed quote sides and missing/zero sizes block usability.
- Historical bars are UTC left-edge OHLC. Count `interpolated=true` separately
  from explicit false and missing flags. Check chronology, range, OHLC and OCC
  identity. No bar supplies historical bid/ask, sizes or volume. Neither bar
  closes nor marks nor fast-fill estimates are executable quote substitutes.
- Preserve exact bid/ask cents where representable. Half-cent marks are retained
  only as source data. Reuse the existing retail engine for a one-contract,
  hypothetical USD 1,000 scenario, 20% research stop and 2R target. Costs remain
  unknown. Premium-alone lower bounds may exceed the existing USD 50 allocation
  or USD 25 stress cap; no passing affordability calculation grants permission.
- `chance_of_profit_long` describes a provider model of profit at expiry, not
  the probability of reaching Alpha's stop/target first. Outcome probability is
  always null and size escalation remains closed.
- Every assessment returns NO_REPLAY, zero trades and executionAllowed=false.
  Candidate data-quality lessons remain separate from trade reviews and approved
  knowledge. Existing paper, Cboe, research and mistake journals are unchanged.
- `--inspect <JSON>` reassesses at actual time without writing. `--save` records
  input bytes, SHA-256, original report and actual recording time under the ignored
  Robinhood captures directory. Exclusive file creation prevents replacement.
  Identical repeats verify/reuse original records; changed input, corrupt/partial
  artifacts and unsafe paths fail. Current assessment time still advances.

## Acceptance and review

Review: the observed schemas contain present option sides/sizes and a quote-refresh
clock, but do not document independent side/size event clocks. Sampled history
has no execution quotes and includes interpolated bars. Therefore a separate
capture diagnostic is justified; a replay adapter would be premature.

Tests must cover scope/identity mismatch, precision, stale/future/missing clocks,
missing/zero sizes, mark-only input, interpolation/unknown flags, bar order and
OCC identity, premium lower bounds, provider probability isolation, payload limits,
immutable recovery, corrupt files and no-network/no-trade behavior. Run typecheck,
focused tests, aggregate validation and old-journal hash checks. Keep live source
payloads local; commit only synthetic fixtures, implementation and summaries.
