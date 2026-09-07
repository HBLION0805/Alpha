# Robinhood snapshot paper-adapter qualification

OPT-RH-PAPER-QUALIFICATION-1. Design review September 7, 2026. Current configured
model, no delegation. This unit defines evidence requirements; it implements no
adapter, order path or relaxation of the original NO_REPLAY gates.

## Objective and evidence boundary

Support one explicitly modeled GLD/IBIT long-option paper lifecycle from qualified
saved Robinhood snapshots, retaining every no-entry, unresolved and closed case.
First evaluate the frozen opening study through the original capture, observation
and closeout readers. A complete collection is not automatically qualified input.

At/after the window end, restore v6 through the shared host procedure before any
collection evidence read, then install the appropriate V3 continuation fields.
This specification does not add a source call or alter the four frozen contracts,
20-minute window, cadence, budget, old reports or existing study-based exports.

Inputs to this review are dated local evidence: the loaded market-schema review,
its exact saved catalog, existing observation/closeout code and the current paper
contract types. Their source-review clocks are retained; this design is not a new
public-source, contract-listing, broker-account or data-entitlement verification.

## Required qualification evidence

| Requirement | Evidence to retain | Acceptance and current limitation |
| --- | --- | --- |
| Selected study and actual collection | Original plan hash, all frame/attempt hashes, closeout stage and clock | Evaluate only a completed selected window; retain missing and failed attempts separately from market moves |
| Per-contract useful observations | Original per-contract counts/blockers, exact source/receipt clocks and displayed quantities | Inspect each contract independently; global complete-usable coverage can include budget exclusions and is not a source-failure count |
| Source field semantics | Dated loaded schema and actual response bytes linked to each capture | Quote updated_at is a refresh clock; independent option side/size clocks are not exposed in the reviewed schema and must remain unknown |
| Contract/session identity | Exact instrument/chain/expiry/strike/type, listed multiplier/deliverable/adjustment and session evidence | A matching GLD/IBIT root or generic ETF specification does not certify a particular series; current local declarations remain insufficient for a qualified claim |
| Permitted retention/research use | Attributable evidence covering the intended data and use | Existing schema/public review did not establish these terms; development or OAuth authorization alone is not the missing source evidence |
| Costs, whole-contract feasibility and account rules | Versioned entry/exit cost and slippage assumptions, applicable account/session constraints and original risk calculations | Unknown cost cannot become zero; hypothetical cash is not verified broker buying power; no account/order tools are authorized |
| Explicit paper execution model | Frozen profile stating data clocks, quantity treatment, price/trigger/fill timing and failure behavior | Displayed quotes are not observed fills; no executable-liquidity or target-before-stop probability claim follows |
| Outcome and recovery evidence | Immutable case/run IDs, exact dependencies, modeled events, state, review and restart checks | Preserve every valid disposition; a no-entry run does not demonstrate a completed entry-to-exit trade |

Every required item has a source reference/hash, original evidence time, actual
review time and an explicit ESTABLISHED, UNKNOWN, CONFLICTING or UNSUPPORTED
assessment. Source text and manual declarations cannot independently approve
themselves. Do not implement an all-green switch driven by user-entered booleans.
A future engine should compose original checks and verified inputs, retaining
their blockers rather than rewriting them to make a new readiness score pass.

## Source-to-model mapping that must be reviewed before implementation

| Existing model input | Robinhood source evidence | Required treatment |
| --- | --- | --- |
| contractId and immutable contract identity | Declared option instrument and its chain/series fields | Bind exact original IDs and series evidence; reject identity changes instead of replacing the selected contract |
| bid/ask integer cents per share | Original option bid_price/ask_price strings | Retain raw decimals; reject unsupported non-cent precision, invalid/crossed prices and invalid ticks instead of rounding into eligibility |
| size in whole option contracts | bid_size/ask_size as declared in reviewed metadata | Retain missing/zero/invalid quantities; never invent minimum size or treat it as historical queue availability |
| source and receipt timing | Quote updated_at, exact capture request/receipt/record clocks, sourceNanoseconds | Existing OptionQuote uses millisecond UTC strings; preserve exact original precision and ordering in provenance, reject unsupported lossy mapping instead of merging distinct source events |
| underlying price/time alignment | Saved GLD/IBIT equity bid/ask and their separate venue clocks | Preserve the declared side-selection method and both clocks; do not transfer equity side clocks to option quotes or convert BTC spot into IBIT prices |
| sourceId and origin | Exact Robinhood capture/frame identity | Use a separately reviewed Robinhood profile with explicit unverified/import lineage where applicable; never label it Cboe or verified exchange execution |
| IV and delta | Nullable saved provider values and explicit units | Optional context only; leave unsupported unit/precision mappings unknown and never infer a calibrated strategy probability |

The generic OptionQuote contract cannot itself represent all source clocks or
all retrospective-selection facts. A reviewed lineage-carrying outer record is
required before any adapter can construct a model input. Do not change old
contract/journal fingerprints or quietly truncate source precision to reuse them.

## Research timing and fill-model decisions

The current authorization collects market data only. There is no formal live
research strategy or prospective paper plan registered for the opening study.
A plan chosen after viewing its price path is retrospective, even though the
collection window and contract sample were frozen earlier. Keep the actual plan
recording clock and the separately declared historical decision clock; do not
backfill a research observation or claim a decision was made before its receipt.

A later retrospective trial needs a separately reviewed snapshot-research profile
and an isolated account/run lineage. It cannot silently enter the old persistent
paper account as an actual prior decision, nor reuse the Cboe interval assumptions
by changing a source label. Prospective paper testing needs a genuinely earlier
frozen plan and subsequent supported observations. Both modes remain unimplemented.

Before implementing either mode, explicitly choose and document:

- Which later received snapshot may evaluate an entry or exit, the side used,
  quantity sufficiency, modeled slippage/fees and whether partial fills are
  unsupported. Ask entry and bid exit are proposed conservative model choices,
  not proof of an exchange execution or worst possible loss.
- How source refresh clocks differ from independent event clocks. A snapshot
  assumption may be described as such, but cannot certify contemporaneous sizes
  or fill availability. The unresolved qualification blockers remain visible.
- What happens through gaps, repeated/conflicting clocks, missing/zero quantities,
  unavailable underlying alignment and the last available snapshot. Do not fill
  gaps with OHLC/interpolated bars, last marks, fabricated ticks or terminal exits.
- How an observed threshold crossing differs from a modeled fill. Stops are not
  guaranteed loss caps; if a fill cannot be modeled under the declared evidence,
  retain the pending/unresolved position and its exposure.
- How short sample coverage limits conclusions. A 09:30-09:50 series cannot
  validate multi-hour or multi-day holding, path shape outside that interval, or
  a target reached later. Do not force a closed winner/loss at the window end.

No risk increases or contract substitutions may make a trial fit. Reuse unchanged
declared risk/account diagnostics with explicit costs and whole-contract checks.
If no contract fits, report NO_ENTRY and its reasons; do not count that as a closed
trade, successful lesson or validated high-win-rate strategy.

## Review and acceptance cases

Before a source-specific implementation is accepted, exercise a qualified finite
quote path, every mapped boundary above, budget/cost exclusion, partial source
failure, clock conflict/regression, gaps spanning entry/exit, unavailable prices,
no entry, unresolved exit and closed outcomes. Preserve original source artifacts
and timestamps and independently reconstruct modeled events and cash arithmetic.
Keep terminal modeled PnL, costs, duration and failure reasons separate from any
empirical win-rate claim. Outcome notebook entries are candidates at actual review
time; they do not automatically change strategy or position size.

Acceptance must distinguish: input review completed, adapter implemented/tested,
actual-data trial run, and a complete entry/fill/exit/review lifecycle demonstrated.
No-entry or unresolved cases are valid audit outcomes, but do not silently close
the last lifecycle milestone. Engineering tests alone close none of these
market-evidence requirements. The ten-workstream and six-gate reporting baselines
therefore remain unchanged by this design.
