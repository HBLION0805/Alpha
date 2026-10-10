# Saved two-leg quote preflight

This offline preflight reads explicitly selected existing `TECH_QUOTES_RECEIPT_V1`
originals. It never captures data, registers a plan, arms Paper, models a fill or
calls an account/order tool. `assessTechSpreadPreflight` is pure;
`readTechSpreadOriginal` and the CLI only read supplied files. Launch-tool caches
and logs are outside this core guarantee; npm is a convenience runner, not the
strict whole-process residual launcher described in the separate residual delivery.

Use `options:tech-spread-preflight -- --input FILE` through npm, or call the pure
interface from an equipped offline tool. The input has version
`TECH_SPREAD_PREFLIGHT_INPUT_V1`, mode `REAL_SAVED_SOURCE_REPLAY` or `MOCK_CONTROL`,
UTC `at` and `decisionAt`, one or two originals, and exactly two selected legs.
Each CLI original supplies `id`, `path`, and SHA256 of its exact saved bytes.
The pure API uses `rawJson` instead of `path`. Each leg supplies `originalId`,
`direction` LONG/SHORT, whole `quantity`, and exact `contract` fields
`id`, `symbol`, `expiry`, `type`, `strike`, `multiplier`. No original is rewritten.
`decisionAt` is a supplied clock reference for ordering checks; this interface
does not verify an immutable research registration or prove a prospective decision.
Passing that clock comparison cannot substitute for Confirm & Freeze or admission.

Outer byte hashes, inner capture hashes, intent selection, acquisition sequence,
source identities and receipt clocks are checked. Hashes bind copied bytes and
do not authenticate a provider. Existing `normalizeTechOptionCapture` and
`assessSnapshotQuote` own bid/ask/tick, source-age, source/receipt order, underlying
and reviewed-session checks. Missing source clocks stay unknown. The report keeps
both legs' clocks and the exact nanosecond difference, without inventing exchange
bid/ask clocks from the provider's quote-refresh timestamp.

The existing structure inference is reused after checking same symbol, expiry,
option type and 100-share multiplier; distinct contracts/strikes; opposite
directions; and equal whole quantities. Only bull-call and bear-put debit verticals
are accepted as static shapes. A same-strike call plus put is not CDS/PDS. Static
validity is independent from source coherence and executable admission.

The current original producer selects **one strike per capture**, optionally one
call and one put. Consequently it cannot supply a same-capture debit vertical.
Different captures can establish a static structure but are never stitched into
an executable quote, even when their refresh clocks happen to match. Combined
economics remain null. This is an explicit producer capability gap, not evidence
that a new two-strike collector or account entitlement exists.

Every gate reports its source and scope. The inherited 60-second freshness,
mechanical bid/ask spread cap and exact-clock comparison are engineering references,
not newly approved Owner spread rules. Same-capture provenance does not prove
simultaneous execution. Single-leg full-premium budgets, the seven-minute rehearsal
window and suggested 20/30/50 sizing are not imported as spread strategy rules.

Optional `costs` supplies total `entryFeesCents`, `exitFeesCents`,
`exitSlippageReserveCents`, `reference`, `frozenAt`, and origin `OWNER_ASSUMPTION`
for real replay or `SYNTHETIC_FIXTURE` for MOCK. No default fees are supplied.
These are attributed assumptions, not actual charges. Without executable combined
economics, cash/risk sufficiency and net spread payoff are not calculated.

Optional `accountEvidence` has an explicit `accountId` and four original records:
DATA_ENTITLEMENT, PRODUCT_PERMISSION, ACCOUNT_FUNDS and RISK_LIMITS. The original
technology feasibility record-integrity/clock validator is shared, preserving its
hash, review and validity checks. Permission must name the specific debit-spread
product; long-option permission is insufficient. USD settled/reserved cash,
limits, realtime options and local-retention claims remain separately checked.
Documents are attributed claims, never account authentication; missing records
remain UNKNOWN. MOCK and real origins cannot be mixed. The current adapter also
does not expose standard deliverable or exercise-style evidence.

The isolated October 10 replay inspected the two existing AAPL/TSLA originals
without source calls. Both contained same-strike call/put pairs, both were stale
at the Saturday assessment, and both were rejected. Saturday receipt did not make
Friday TSLA quotes fresh. Exact original hashes, clocks, requests and reports stay
ignored locally; no real originals are published. This replay is not prospective
research, a fresh quote observation, a fill or a strategy result.

Tests separately cover MOCK static CDS/PDS, original/hash/intent tampering,
mixed origins, clocks, stale/weekend quotes, crossed books, absent sizes/quotes,
account unknowns, permission specificity, cost attribution and filesystem
immutability. Existing one-leg feasibility and atomic/residual regression suites
remain included. See [checkpoint](status/tech-spread-preflight.json).

Real Paper acceptance remains NOT_TESTED: a suitable coherent two-strike source,
contract details, reviewed spread policy, costs, account evidence and a qualified
real lifecycle are still absent. A bounded next increment is a design and MOCK
validation of a same-batch two-strike receipt contract, with no new collection or
permissions implied. CPI, schedules, production and the challenge ledger remain
unchanged.
