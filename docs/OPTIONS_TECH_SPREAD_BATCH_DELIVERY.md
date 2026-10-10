# Explicit two-strike quote batch extension

The existing technology quote adapter, Host entrypoint and saved-original
preflight now support an explicit CDS/PDS request. This is implemented code with
MOCK transport validation, not a design-only proposal. No real source call was
made for this delivery. Real quote and Paper acceptance remain NOT_TESTED.

The existing single-strike V1 request still has at most four calls. V2 has at
most five calls in the same existing 120-second acquisition bound: one chain
lookup, two instrument lookups, one underlying quote call, and one option quote
call containing exactly the two requested IDs. No pagination, automatic retry,
substitution, option chain expansion or new connection is introduced. The same
four authorized read-only market tool names are used; account/order tools are
not available through the Host scope.

The manual entrypoint is:

```text
npm run options:tech-quotes -- --capture-spread --request FILE --run-id UNIQUE_BATCH_ID
```

This command performs real bounded market reads when explicitly invoked in an
equipped session. It was not invoked against a real Host in this delivery.
`--normalize CAPTURE_FILE` remains offline. The saved-original preflight accepts
the resulting V2 receipt through its existing `--input` entrypoint. These capture
commands intentionally save local originals; they are not the strict filesystem
read-only residual launcher. No timer, scheduled source work or deployment is added.

The request file is `TECH_DEBIT_SPREAD_SELECTION_V1` with exact fields:

- `batchId`: unique run ID, matched to the CLI run ID;
- `symbol`: existing technology scope AAPL/TSM/QQQ/TSLA;
- `expiry`: one valid calendar date;
- `structure`: BULL_CALL_DEBIT or BEAR_PUT_DEBIT;
- `type`: respectively call or put;
- `legs`: exactly LONG then SHORT, each with the complete explicit `id` and
  cent-exact decimal `strike`; IDs and strikes must differ and the strike order
  must match the declared debit vertical;
- `maxSourceSkewMs`: explicit integer engineering assumption, zero through the
  inherited 60,000-ms individual freshness ceiling, with no default.

IDs must already be supplied before acquisition; the collector does not select
contracts from a recommendation or substitute a nearby strike. Each instrument
response must match the requested ID, strike, expiry, type, underlying, standard
multiplier and tradability. The instrument API may return the companion option
type, but only the exact predeclared ID is selected. Both selected IDs then enter
one quote request. Missing, extra or foreign quote IDs cannot supply a valid pair.

`TECH_OPTION_CAPTURE_V2`, `TECH_QUOTES_REQUEST_V2` and `TECH_QUOTES_RECEIPT_V2`
retain the batch ID, full tool envelopes, exact request bodies, acquisition clocks
and original source-refresh clocks. The normalizer reuses existing snapshot,
tick, size, age, underlying and session checks. Each leg exposes its instrument
request/receipt and quote request/receipt times. A batch is **not an atomic or
simultaneous market snapshot**: source refresh clocks can differ, and the tool
does not expose separate option bid/ask exchange timestamps. The exact nanosecond
difference is compared to the frozen explicit skew assumption; passing it does
not establish an approved Owner strategy rule.

The preflight binds V2 selection/intent/batch/original hashes and each selected
direction. Different captures or batches cannot be stitched, even with identical
source clocks. Same-batch evidence can reach `COHERENT_BATCH_EVIDENCE_ONLY`;
combined executable economics remain null and admission stays false. Missing
legs, mismatched identities, invalid prices/sizes, stale or expired quotes,
future source clocks, backward acquisition clocks and excessive skew block the
pair. Missing final acquisition time is retained as null and blocks normalization,
not replaced by a fabricated clock. The prior V1 exact-clock reference and its
historical rejected real originals retain their original meaning.

Every run uses exclusive directory/file creation. Reusing a run/batch ID fails
before another Host starts; retry requires a new explicit request/batch/run ID.
Success and failure originals are not overwritten, and no prior successful leg
is loaded into a later attempt. Parent persistence still verifies actual Host
tool names, request bodies and source response bodies against collector receipts.
On a failed Host binding, raw Host output remains local and no normalized capture
is promoted. On a transport exception, raw Host output/failure evidence is retained;
an incomplete receipt set cannot qualify a pair.

MOCK tests cover both debit structures, serializable Host source, request bounds,
all five failure positions, exact IDs/strike/expiry/type, pagination, missing legs,
prices/sizes, expiration, nanosecond skew boundaries, source/acquisition clocks,
cross-batch rejection and exclusive persistence. An explicit injected MOCK Host
also exercises the actual parent capture/persistence path for complete, missing-leg
and altered-response cases. Synthetic origin cannot use the real spawn transport.
All originals and demonstration receipts remain ignored locally. No synthetic
record is labeled real. See [checkpoint](status/tech-spread-batch.json).

Real Paper still lacks a fresh prospective real batch, verified contract
deliverable/exercise details, approved spread admission/exit policy and cost basis,
entitlement/permission/funds evidence, and a qualified real spread lifecycle with
independent exit and residual handling. This increment solves request/batch mapping
and coherence checking only. A bounded next step is an explicitly scoped regular-
session source-only acceptance of one predeclared pair, without Paper arming;
account evidence and lifecycle work remain separate. CPI, schedules, challenge
ledger, strategies and risk settings remain unchanged.
