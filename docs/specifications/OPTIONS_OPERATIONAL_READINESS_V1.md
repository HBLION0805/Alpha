# GLD/IBIT operational readiness v1

Task OPT-READY-1. The Owner requests continuous progress toward the first complete
real-price test, automatic data collection only, and retained trade reviews and
mistake records. The current verified pieces are separate local commands. Add
one read-only report that shows their actual evidence and remaining dependencies
without turning synthetic trade outcomes, source counts or coverage into a win
probability or permission to trade.

## Reviewed design

`options:readiness -- --report <study-id>` checks six bounded local components:
the selected Robinhood study/closeout, existing paper account and reviews,
independent historical research, imported market evidence, official headline
history and Treasury daily real-yield history. Use existing repository recovery
and report functions; do not parse journals differently or modify their accepted
outputs. Script-owned reads may acquire/release existing writer locks, but may
not append a quote, scenario, lesson, report, retrieval or simulated trade.

Check fixed workspace paths and bounded IDs before reading. Missing storage is
MISSING, corrupted/unsafe/busy storage is BLOCKED, and a recovered component is
AVAILABLE even when its source observations are empty or failed. These states
must not be conflated. A failure in one component must not hide the others.
Keep exception details to fixed local diagnostics; no raw source/error contents,
credentials, arbitrary commands or URLs. The CLI never invokes a market tool or
performs HTTP, inspects brokerage accounts, starts scheduling or trades.

The pure readiness engine accepts typed component summaries, each bound to the
underlying recovered report fingerprint and actual check clock. It verifies
counts, scope, statuses and chronology. Summaries retain the selected study's
window, attempted/frame/usable counts, elapsed/pending coverage and candidate
operational lessons; paper origins, status counts, reviewed closed outcomes and
candidate notebook counts; historical origins and independent-account status;
imported evidence's unchanged NO_REPLAY gate; current headline source health;
and Treasury's dated latest retrieval/nullable values and missing tenors.

Represent dependency steps explicitly. Pending future collection is not a source
failure; a fully populated diagnostic study still needs reviewed quote/size clock
semantics, cost/fill assumptions and a source-specific adapter. Synthetic or
owner-imported modeled outcomes cannot satisfy real-price execution validation
or calibration. Do not aggregate independent research account returns with the
local paper account or infer real account balances. The existing paper engine
remains the authority for its risk limits and review calculations.
Paper fixture clocks may be hypothetical future scenario times; label them as
scenario clocks, not actual brokerage execution or first-recording timestamps.

There is no combined readiness score, forecast, automatic strategy change or
execution authority. Optional macro gaps remain contextual gaps rather than an
invented requirement to connect every conceivable factor before testing. The
report is a sequential local read, not an atomic snapshot of every subsystem or
a live inspection of the host scheduler. No new recurring automation is needed.

## Acceptance

Test pending/partial/ended collection, missing/busy/corrupt component isolation,
scope and future-clock rejection, false trading/calibration promotion, separate
source health and storage health, complete per-closed-trade review coverage,
candidate-only lessons, and preservation of all journals during real readback.
Use isolated fixture repositories; no HTTP or brokerage tests. Run focused and
aggregate validation, save one local diagnostic result outside Git, document
actual counts and remaining blockers, then commit/push under standing authority.
