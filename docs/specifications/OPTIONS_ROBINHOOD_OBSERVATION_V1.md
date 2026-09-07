# Robinhood budget screening and prospective observations v1

Task: RH-OBSERVE-1. Continue the Owner's authorized local GLD/IBIT workflow,
without further step-by-step approval. Keep the five market-tool boundary, all
existing risk limits, accepted capture v1 reports and historical journals intact.

## Reviewed specification

Two sequential modules use the existing capture parser without changing its
version or output. Neither module is an execution adapter.

1. A bounded screen assesses up to sixteen captures / sixty-four distinct
   contracts. It retains every sampled contract, takes its latest received quote
   (rejecting conflicting same-receipt observations), verifies stable contract
   identity, and labels the scope as a sample. It reports 14-45 calendar DTE from
   the New York assessment date, quote blockers, whole-contract premium, spread,
   and cost headroom under the unchanged $50 allocation, $5 planned risk and
   $25 stress limits. Unknown costs stay unknown. Premium headroom is only a
   necessary lower-bound check. No price ranking, probability ranking or
   high-win-rate claim is produced. Missing quotes stay visible.
2. A prospective observation study freezes one source capture, one to four
   declared instrument IDs and a future collection window within explicitly
   declared regular-session calendar evidence. A local recording clock, original
   input bytes and hashes bind the plan. A later frame must request option and
   underlying quotes after that clock, request exactly the frozen contract set,
   and retain the frozen chain/contract identity. Historical OHLC is excluded.
   Catalog metadata may predate the plan, but is not refreshed by copying it.

Frames retain original source precision, actual request/receipt and recording
clocks, original capture reports and a previous-record hash. A sixty-second
freshness limit and ten-second option/underlying source-time skew are explicit
observation diagnostics, not verified execution semantics. Every frame reports
missing sides/sizes, stale/future/regressed source clocks, repeated timestamps,
changed values under an unchanged source timestamp, missing underlying sides,
out-of-window data and excessive collection gaps. Repeated polls cannot create
independent observations. Bad market frames are recorded and reviewed; malformed
scope, conflicting contract identity and backdated collection requests fail.

Collection is bounded to 120 frames, one session, a maximum two-hour window and
at least sixty seconds between quote requests. Each frame keeps all selected
contracts, including missing or failed observations; neither profitable paths nor
cheap contracts can be substituted after freezing. Study review counts diagnostic
outcomes and candidate data-quality lessons at actual recording time. It never
creates a win/loss, P&L, learned probability, trade or approved strategy guard.

The CLI is offline. It prepares the exact next two approved quote requests for
the host, accepts a bounded response capture, and verifies every existing record
on restart. It neither stores OAuth credentials nor starts a network daemon or
scheduler. Immutable numbered frame files and a writer lock protect one local
process; identical repeats reuse verified records, mutations/conflicts fail,
partial artifacts fail closed and abandoned locks require explicit investigation.
All paths stay inside the workspace, links and hard-linked files are refused,
file sizes and directory entries are bounded, writes use exclusive creation.

## Design review and acceptance

The existing OptionQuote contract requires non-null execution semantics which
Robinhood has not established. Therefore observations remain source-specific and
NO_REPLAY even if every local diagnostic passes. The collection plan is a local
declaration, not proof of publisher authenticity, entitlement or an exchange
calendar. Provider profit-at-expiry values never unlock sizing or enter scoring.

Test budgets/unknown costs, whole contracts, DTE and partial sample scope;
prospective clocks and stable selection; stale/duplicate/regressed/conflicting
observations; exact quote coverage, aligned underlying sides, missing sizes;
session boundaries, cadence and gaps; immutable restart, corruption, lock and
path failures; and end-to-end synthetic freeze/record/review. Run typecheck,
focused tests and aggregate validation, verify protected journal hashes, then
commit and push under the Owner's standing authorization. Live checks may sample
only the five approved tools and must preserve closed-market results as such.
