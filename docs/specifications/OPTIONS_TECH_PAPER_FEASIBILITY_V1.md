# Technology research to Paper feasibility V1

Owner authorization: October 9, 2026, local development only.

## Boundary
Add a read-only feasibility consumer for AAPL, TSM and QQQ saved research.
Keep research direction and exploratory/confirmation conditions visible even when
research eligibility, product access, account funds, quotes or Paper fail.
This is not an alternative entry strategy and does not relax the three-facet gate.
Existing GLD/IBIT selection, capture, guidance, plans, fills and automation stay unchanged.

The scope is one long call or put contract per assessment. Equity/ETF research does
not establish an equity/ETF fill route. No arm, network, broker account/order,
scheduler, stock shorting, spread, subscription or credential operation is added.
A passing result is attributed feasibility only; lifecycle admission remains false.
Real quote acceptance and a complete Paper lifecycle require later integration and
their own preserved evidence, not just expansion of a symbol whitelist.

## Evidence input
CLI reads --research FILE and optional --evidence FILE; --out NEW_FILE writes
an exclusive self-contained assessment with input bytes, hashes and actual time.
Research uses the existing ThreeFacetInput. Missing evidence returns blockers.

Evidence version TECH_PAPER_EVIDENCE_V1 freezes symbol, accountId, quantity=1,
decisionAt, entryDeadlineAt, timeExitAt, costsFrozenAt, declared entry/exit fees
and exit slippage, entry limit, maximum spread, and six records:
CONTRACT, DATA_ENTITLEMENT, PRODUCT_PERMISSION, ACCOUNT_FUNDS, RISK_LIMITS, QUOTE.
Each record carries origin OWNER_DOCUMENT / PROVIDER_DOCUMENT / SYNTHETIC_FIXTURE,
source, observedAt, receivedAt, reviewedAt, validThrough, reviewedBy, verdict,
rawJson and its SHA256. Hashes prove copied-byte integrity, not claim authenticity.
Unknown, unsupported, future, expired, mismatched, unreviewed or malformed claims
fail closed. Identity and qualification records must be available by decision;
the quote must have source and receipt clocks strictly after that decision.
Synthetic records can exercise mechanics but never pass real-evidence feasibility.

CONTRACT payload uses the existing snapshot quote identity fields id, symbol,
expiry, type, strike, multiplier, plus deliverable STANDARD_100_SHARES_USD,
exerciseStyle AMERICAN and tradability tradable. QUOTE is the existing SnapshotQuote
shape, with identical contract identity and actual copied source clocks.
DATA_ENTITLEMENT states provider, symbols, realtimeOptions and localRetention.
PRODUCT_PERMISSION states accountId, symbols, products LONG_CALL/LONG_PUT and enabled.
ACCOUNT_FUNDS states accountId, currency USD, settledCashCents, reservedCashCents.
RISK_LIMITS states accountId, tradeBudgetMaxCents and maximumLossCents.
All claims are explicit attributed evidence, never constants granting access.

Reuse existing nanosecond clocks, exact underlying prices, snapshot spread/tick/size
qualification, reviewed session calendar and exit-observation reserve. Keep the
existing 120-second selection age, 60-second quote freshness and mechanical spread
ceiling. Require full premium plus declared round-trip cost/slippage reserve within
available settled cash, trade budget and maximum loss. No margin or extra funding.

## Status
research: original direction, hypothesis and unchanged existing gate/blockers;
quote: independently assessed later saved quote;
feasibility: blocked, synthetic-only, or attributed check passed, separately from research;
paper: NOT_ARMED / lifecycle route not integrated, fills=0, PnL=null.
No output constitutes source authentication, trading permission or a fill.

## Validation
Network-free tests cover unsupported products/symbols, absent and forged hashes,
missing/revoked/expired permissions, account mismatch, insufficient funds, future
evidence, stale/before-decision quotes, identity mismatch, size/tick/spread,
calendar/exit reserve and synthetic-only qualification. Test old GLD/IBIT paths
unchanged; retain original October 9 frozen research and real observations.

## Directional trial and confirmation are separate
The new consumer emits a pre-confirmation research candidate without requiring
technical confirmation. It still requires the original research registration,
aligned fundamental/news holding-window direction, reviewed nontechnical evidence
and the six existing risk reviews. A pending known catalyst can remain a hypothesis.
Conflicts, unknowns, expired research and unreviewed risks withhold the trial opinion.
The original frozen trial/confirmation conditions remain copied verbatim; this
projection cannot retrospectively amend them or turn the opinion into an order.
No fixed 20/30/50 sizing rule is added.

## Minimum remaining interfaces for an isolated real-data lifecycle
1. The separate options:tech-quotes adapter supplies exact option identity, chain session,
   tick schedule, bid/ask sizes and distinct provider/receipt clocks; explicit
   data/retention entitlements. Existing GLD/IBIT capture stays unchanged.
2. A new versioned isolated plan/admission interface consuming this evidence receipt,
   the explicit Owner product/account/settled-cash/risk/cost review and original
   research decision. It must distinguish exploratory from confirmed plans and
   compare option alternatives; no forced technical-confirmation gate for research.
3. A technology-symbol-aware copied-source quote/plan validator and fill-engine
   adapter with compatibility tests preserving GLD/IBIT historical fingerprints.
   Current contract, snapshot plan and guidance validators remain GLD/IBIT-only.
4. A local one-shot lifecycle store/runner: immutable arm before fresh entry quote,
   explicit entry/open/exit state, idempotent append receipts, later independent
   exit quotes, unchanged economics, cutoff and recovery rules. An unresolved
   exit remains open; no-entry remains no-entry. No production schedule or ledger.
5. An independently recovered complete real-data case with entry, later exit and
   labeled costs. Synthetic mechanics and this feasibility receipt cannot satisfy it.

Record validThrough expresses the review's declared documentary validity;
the quote must separately pass the existing 60-second freshness gate. Raw JSON
hashes establish exact copied bytes, not provider or account authenticity.

## Inherited policy and execution dependency
The spread formula is inherited from mechanicalReference in the existing
GLD/IBIT engineering bridge: max(tick, min(10 cents, rounded-down 10% of ask)).
It is not a universal safety or account rule. Technology applicability requires
a separate prospective decision; the current checks do not relax it.
Only options:tech-quotes launches the local native OAuth Host. Offline
options:tech-paper does not make source calls. Runtime evidence stays ignored.
